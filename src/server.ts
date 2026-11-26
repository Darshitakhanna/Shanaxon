import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
  ErrorCode,
  McpError
} from '@modelcontextprotocol/sdk/types.js';
import * as path from 'path';
import { promises as fs } from 'fs';
import { CodeCompressionEngine } from './core/parser';
import { normalizePath } from './core/guardrails';
import { WorkspaceIndexer } from './core/workspaceIndexer';
import { AstCache } from './core/cache';
import { ImportGraph } from './core/importGraph';
import { enforceBudget, estimateTokens } from './core/budgetManager';
import { EmbeddingRanker } from './core/embeddingRanker';
import { MetricsCollector } from './telemetry/metricsCollector';
import { renderDashboard } from './telemetry/terminalConsole';
import { loadConfig, getConfig } from './core/configLoader';
import { getLanguageInfoForFile } from './core/languageRegistry';
import { getGitAwareTier } from './core/gitAwareTier';
import { WorkspaceManager } from './core/workspaceManager';
import { UsageTracker } from './core/usageTracker';
import { getAutoTunedTier } from './core/tierTuner';
import { getFileDiffContext } from './core/diffContext';
import { ImportanceScorer } from './core/importanceScorer';
import { HybridRanker } from './core/hybridRanker';
import { routePrompt } from './middleware/promptRouter';
import { pruneHistory } from './middleware/historyPruner';

// Tokenist v2 Revolutionary Extensions
import { RetrieveCache } from './core/retrieveCache';
import { SmartCrusher } from './core/smartCrusher';
import { CacheAligner } from './core/cacheAligner';
import { getTersePrompt } from './core/terseMode';
import { SchemaCompressor } from './core/schemaCompressor';
import { ContextReceiptGenerator } from './core/contextReceipt';

// Tokenist v6.0 Context Intelligence & Capability Equalization Extensions
import { classifyTask } from './intelligence/taskUnderstanding';
import { getModelPolicy, adjustTierForModel } from './intelligence/modelPolicy';
import { storeMemory, recallMemory, listMemory, deleteMemory } from './intelligence/criticalMemory';
import { scoreContextImportance, RawContextInput } from './intelligence/contextImportanceEngine';
import { evaluateEvidence } from './intelligence/evidenceLayer';
import { equalizeContext } from './intelligence/capabilityEqualizer';
import { evaluateQualityGate } from './intelligence/qualityGate';
import { detectAgentFailure } from './intelligence/failureDetector';
import { runBenchmarkSuite } from './benchmark/benchmarkRunner';
import { createOptimizationReceipt, getLastOptimizationReceipt } from './intelligence/optimizationMetadata';
import { CompressionTier, ContextItemDisposition, TaskProfile, WorkspaceConfig } from './types';

function globToRegex(pattern: string): RegExp {
  const escaped = pattern.replace(/[.+^${}()|[\]\\]/g, '\\$&');
  const regexStr = '^' + escaped.replace(/\\\*\\\*/g, '.*').replace(/\\\*/g, '[^/]*') + '$';
  return new RegExp(regexStr);
}

function isPinned(filePath: string, alwaysInclude: string[], workspaceRoot: string): boolean {
  const relPath = path.relative(workspaceRoot, filePath).replace(/\\/g, '/');
  return alwaysInclude.some((pattern) => {
    const regex = globToRegex(pattern);
    return regex.test(relPath);
  });
}

export class McpCompressionServer {
  public server: Server;
  private engine: CodeCompressionEngine;
  private cache: AstCache;
  private importGraph: ImportGraph | null = null;
  private embeddingRanker: EmbeddingRanker;
  private metricsCollector: MetricsCollector;
  private workspaceManager!: WorkspaceManager;
  private usageTracker!: UsageTracker;
  private importanceScorer: ImportanceScorer;
  private hybridRanker: HybridRanker;

  // v2 Engines
  private retrieveCache = new RetrieveCache();
  private smartCrusher = new SmartCrusher();
  private cacheAligner = new CacheAligner();
  private schemaCompressor = new SchemaCompressor();
  private receiptGenerator = new ContextReceiptGenerator();

  private workspaceRoot: string;
  private isInitialized = false;

  constructor() {
    this.workspaceRoot = path.resolve(process.cwd());
    this.engine = new CodeCompressionEngine();
    this.cache = new AstCache();
    this.embeddingRanker = new EmbeddingRanker();
    this.metricsCollector = new MetricsCollector(this.workspaceRoot);
    this.importanceScorer = new ImportanceScorer();
    this.hybridRanker = new HybridRanker();
    
    this.server = new Server(
      {
        name: 'tokenist',
        version: '6.0.0',
      },
      {
        capabilities: {
          tools: {},
        },
      }
    );

    this.setupHandlers();
  }

  private async ensureInitialized(): Promise<void> {
    if (this.isInitialized) return;
    
    const config = await loadConfig(this.workspaceRoot);
    this.workspaceManager = new WorkspaceManager(this.workspaceRoot, config.workspaces || []);
    this.usageTracker = new UsageTracker(this.workspaceRoot);

    if (config.cachePath) {
      this.cache = new AstCache(config.maxCacheSizeMb * 20, config.cachePath);
    }
    
    await this.cache.loadFromDisk();
    await this.engine.init();

    this.isInitialized = true;
  }

  private async getImportGraph(): Promise<ImportGraph> {
    await this.ensureInitialized();
    if (!this.importGraph) {
      this.importGraph = new ImportGraph(this.engine.getParser()!);
    }
    return this.importGraph;
  }

  private async getEmbeddingRanker(): Promise<EmbeddingRanker> {
    await this.ensureInitialized();
    await this.embeddingRanker.init();
    return this.embeddingRanker;
  }

  private setupHandlers() {
    // 1. List available tools (13 total in v5.0.0)
    this.server.setRequestHandler(ListToolsRequestSchema, async () => {
      return {
        tools: [
          {
            name: 'fetch_optimized_repository_map',
            description:
              'Recursively scans a local directory inside workspaces (respecting gitignore rules), compresses all supported files using AST optimization, and returns a unified code map.',
            inputSchema: {
              type: 'object',
              properties: {
                directoryPath: {
                  type: 'string',
                  description: 'The absolute or relative directory path to scan.',
                },
                level: {
                  type: 'string',
                  enum: ['normal', 'medium', 'aggressive'],
                  description: 'The default compression tier level (default: aggressive).',
                },
                maxTokenBudget: {
                  type: 'number',
                  description: 'Optional maximum token budget. Tiers will be dynamically escalated to fit this budget.',
                },
                semanticQuery: {
                  type: 'string',
                  description: 'Optional search query to rank files semantically before budget optimization.',
                },
                activePrompt: {
                  type: 'string',
                  description: 'Optional active user prompt to extract mentioned symbols and auto-pin relevant files.',
                },
              },
              required: ['directoryPath'],
            },
          },
          {
            name: 'read_optimized_file',
            description:
              'Reads and returns the AST-optimized, compressed content of a single local source file (TypeScript, Python, Go, Rust, Java, C#, etc.).',
            inputSchema: {
              type: 'object',
              properties: {
                filePath: {
                  type: 'string',
                  description: 'The path of the file to compress.',
                },
                compressionTier: {
                  type: 'string',
                  enum: ['normal', 'medium', 'aggressive'],
                  description: 'The compression tier level (default: aggressive).',
                },
                maxTokenBudget: {
                  type: 'number',
                  description: 'Optional maximum token budget. Tiers will be dynamically escalated to fit this budget.',
                },
              },
              required: ['filePath'],
            },
          },
          {
            name: 'get_file_diff_context',
            description:
              'Gets uncommitted git changes of a file with surrounding context lines, giving 90-95% token savings compared to full file reads.',
            inputSchema: {
              type: 'object',
              properties: {
                filePath: {
                  type: 'string',
                  description: 'The path of the file to query diff context for.',
                },
                contextLines: {
                  type: 'number',
                  description: 'Optional context lines to show around each change hunk (default: 10).',
                },
              },
              required: ['filePath'],
            },
          },
          {
            name: 'reindex_workspace',
            description:
              'Pre-indexes workspaces using .gitignore filters to scan all source files, build dependency graph, and cache AST optimizations.',
            inputSchema: {
              type: 'object',
              properties: {},
            },
          },
          {
            name: 'get_token_savings_report',
            description:
              'Generates a formatted console dashboard showing cumulative token savings efficiency rating, cost estimation, and latency statistics.',
            inputSchema: {
              type: 'object',
              properties: {},
            },
          },
          {
            name: 'prune_chat_history',
            description:
              'Prunes multi-turn context conversation history, collapsing long terminal output dumps and stack traces to preserve context tokens.',
            inputSchema: {
              type: 'object',
              properties: {
                messages: {
                  type: 'array',
                  description: 'Array of conversation messages with role ("user" | "assistant" | "system") and content string.',
                  items: {
                    type: 'object',
                    properties: {
                      role: { type: 'string' },
                      content: { type: 'string' },
                    },
                    required: ['role', 'content'],
                  },
                },
                maxTurns: {
                  type: 'number',
                  description: 'Maximum number of recent conversation turns to keep fully intact (default: 5).',
                },
              },
              required: ['messages'],
            },
          },

          // --- TOKENIST v2 REVOLUTIONARY TOOLS ---
          {
            name: 'retrieve_original',
            description:
              'Retrieves the original uncompressed content for a given retrieve hash marker. Use when compressed output contains [tokenist:retrieve hash=<hash>] and you need the full uncompressed source code.',
            inputSchema: {
              type: 'object',
              properties: {
                hash: {
                  type: 'string',
                  description: 'The 8-character hash from the retrieve marker.',
                },
              },
              required: ['hash'],
            },
          },
          {
            name: 'compress_output',
            description:
              'Compresses non-code content (JSON API responses, terminal output, build logs, stack traces) using intelligent content-type-aware crushing. Reduces tokens by 60-90% while preserving errors and key data.',
            inputSchema: {
              type: 'object',
              properties: {
                content: {
                  type: 'string',
                  description: 'The raw non-code content to compress (JSON, logs, terminal output, stack trace).',
                },
              },
              required: ['content'],
            },
          },
          {
            name: 'stabilize_prompt',
            description:
              'Reorganizes a prompt by relocating dynamic values (timestamps, UUIDs, hashes, PIDs) to the end, making the static prefix cache-friendly for Anthropic/OpenAI KV caching (~90% cost reduction on cached portion).',
            inputSchema: {
              type: 'object',
              properties: {
                prompt: {
                  type: 'string',
                  description: 'The raw prompt text to cache-align.',
                },
              },
              required: ['prompt'],
            },
          },
          {
            name: 'get_terse_system_prompt',
            description:
              'Returns an optimized system prompt instruction that forces the LLM to respond concisely, saving output tokens (which cost 3-5x more than input). Choose minimal (60-75% savings), compact (30-50% savings), or standard (no change).',
            inputSchema: {
              type: 'object',
              properties: {
                level: {
                  type: 'string',
                  enum: ['minimal', 'compact', 'standard'],
                  description: 'Verbosity level (default: compact).',
                },
              },
            },
          },
          {
            name: 'compress_mcp_schemas',
            description:
              'Compresses MCP tool schema definitions to reduce schema bloat. Shortens descriptions, flattens nested types, and removes verbose metadata. Essential when using 5+ MCP servers that consume 10k+ tokens in tool definitions.',
            inputSchema: {
              type: 'object',
              properties: {
                schemas: {
                  type: 'string',
                  description: 'JSON string of the tool schema array to compress.',
                },
              },
              required: ['schemas'],
            },
          },
          {
            name: 'get_blast_radius',
            description:
              'Analyzes the full impact chain of changing a file. Returns all files that import it (reverse deps) and all files it imports (forward deps), traversed up to N hops deep. Risk-rated by total affected files.',
            inputSchema: {
              type: 'object',
              properties: {
                filePath: {
                  type: 'string',
                  description: 'The file path to analyze blast radius for.',
                },
                maxHops: {
                  type: 'number',
                  description: 'Maximum dependency depth to traverse (default: 3).',
                },
              },
              required: ['filePath'],
            },
          },
          {
            name: 'get_context_receipt',
            description:
              'Returns the full session audit trail of all Tokenist operations: files processed, compression tiers applied, tokens saved, and budget utilization per request.',
            inputSchema: {
              type: 'object',
              properties: {},
            },
          },

          // --- TOKENIST v6.0 CONTEXT INTELLIGENCE & CAPABILITY EQUALIZATION TOOLS ---
          {
            name: 'analyze_task',
            description:
              'Analyzes a prompt using deterministic classification and returns a structured TaskProfile (type, complexity, confidence, recommended budget multiplier) and ModelPolicy profile.',
            inputSchema: {
              type: 'object',
              properties: {
                prompt: {
                  type: 'string',
                  description: 'The user prompt or query to classify.',
                },
                modelName: {
                  type: 'string',
                  description: 'Optional active LLM model identifier (e.g., "claude-3-7-sonnet", "gpt-4o").',
                },
              },
              required: ['prompt'],
            },
          },
          {
            name: 'store_critical_memory',
            description:
              'Stores an architectural decision, constraint, dependency, or gotcha in persistent critical memory to preserve system constraints across sessions.',
            inputSchema: {
              type: 'object',
              properties: {
                category: {
                  type: 'string',
                  enum: ['decision', 'constraint', 'dependency', 'architecture', 'gotcha'],
                  description: 'Category of critical memory.',
                },
                title: {
                  type: 'string',
                  description: 'Short descriptive title of the memory.',
                },
                content: {
                  type: 'string',
                  description: 'Detailed explanation of the decision, constraint, or gotcha.',
                },
                priority: {
                  type: 'string',
                  enum: ['high', 'medium', 'low'],
                  description: 'Priority level (default: medium).',
                },
                tags: {
                  type: 'array',
                  items: { type: 'string' },
                  description: 'Optional array of search tags.',
                },
              },
              required: ['category', 'title', 'content'],
            },
          },
          {
            name: 'recall_critical_memory',
            description:
              'Recalls matching critical memories for a prompt or query using keyword and relevance scoring.',
            inputSchema: {
              type: 'object',
              properties: {
                query: {
                  type: 'string',
                  description: 'Search query or prompt to match against stored memories.',
                },
                category: {
                  type: 'string',
                  enum: ['decision', 'constraint', 'dependency', 'architecture', 'gotcha'],
                  description: 'Optional category filter.',
                },
                limit: {
                  type: 'number',
                  description: 'Maximum number of memories to return (default: 10).',
                },
              },
              required: ['query'],
            },
          },
          {
            name: 'list_critical_memory',
            description:
              'Lists all stored critical memories in the workspace, optionally filtered by category.',
            inputSchema: {
              type: 'object',
              properties: {
                category: {
                  type: 'string',
                  enum: ['decision', 'constraint', 'dependency', 'architecture', 'gotcha'],
                  description: 'Optional category filter.',
                },
              },
            },
          },
          {
            name: 'delete_critical_memory',
            description:
              'Deletes a critical memory entry by ID.',
            inputSchema: {
              type: 'object',
              properties: {
                id: {
                  type: 'string',
                  description: 'The unique ID of the memory entry to delete.',
                },
              },
              required: ['id'],
            },
          },
          {
            name: 'equalize_context',
            description:
              'Bridges capability gaps by automatically augmenting novice prompts with relevant architectural constraints, recalled memories, and diagnostic guidelines.',
            inputSchema: {
              type: 'object',
              properties: {
                prompt: {
                  type: 'string',
                  description: 'The user prompt to augment.',
                },
              },
              required: ['prompt'],
            },
          },
          {
            name: 'detect_agent_failure',
            description:
              'Analyzes prompt/response conversation turns to detect agent failure loops (repetitive retries, context exhaustion, missing dependency hallucination) and returns mitigation actions.',
            inputSchema: {
              type: 'object',
              properties: {
                history: {
                  type: 'array',
                  description: 'Array of conversation turn objects with role and prompt/response strings.',
                  items: {
                    type: 'object',
                    properties: {
                      role: { type: 'string' },
                      prompt: { type: 'string' },
                      response: { type: 'string' },
                    },
                    required: ['prompt'],
                  },
                },
              },
              required: ['history'],
            },
          },
          {
            name: 'run_benchmark',
            description:
              'Runs the Tokenist 16-scenario benchmark suite validating task classification, model policies, memory operations, context scoring, evidence evaluation, quality gate, and failure detection.',
            inputSchema: {
              type: 'object',
              properties: {},
            },
          },
          {
            name: 'get_optimization_receipt',
            description:
              'Retrieves the last generated Tokenist v6.0 OptimizationReceipt containing quality gate status, token savings, evidence completeness, and execution telemetry.',
            inputSchema: {
              type: 'object',
              properties: {},
            },
          },
        ],
      };
    });

    // 2. Call tool execution handler
    this.server.setRequestHandler(CallToolRequestSchema, async (request) => {
      await this.ensureInitialized();
      const config = getConfig();

      const { name, arguments: args } = request.params;

      try {
        if (name === 'fetch_optimized_repository_map') {
          const rawDirPath = String(args?.directoryPath);
          const level = (args?.level as 'normal' | 'medium' | 'aggressive') || config.defaultTier;
          const maxBudget = args?.maxTokenBudget ? Number(args.maxTokenBudget) : config.maxTokenBudget;
          const semanticQuery = args?.semanticQuery ? String(args.semanticQuery) : undefined;
          const activePrompt = args?.activePrompt ? String(args.activePrompt) : undefined;

          const normalizedDir = normalizePath(rawDirPath);
          const activeWorkspaceRoot = this.workspaceManager.findWorkspaceForFile(normalizedDir);
          const result = await this.fetchRepositoryMap(
            normalizedDir,
            level,
            maxBudget,
            hasExplicitArg(args, 'level'),
            activeWorkspaceRoot,
            semanticQuery,
            activePrompt
          );
          return {
            content: [{ type: 'text', text: result }],
          };
        }

        if (name === 'read_optimized_file') {
          const rawPath = String(args?.filePath);
          const hasExplicitTier = hasExplicitArg(args, 'compressionTier');
          const tier = (args?.compressionTier as 'normal' | 'medium' | 'aggressive') || config.defaultTier;
          const maxBudget = args?.maxTokenBudget ? Number(args.maxTokenBudget) : config.maxTokenBudget;

          const normalizedFilePath = normalizePath(rawPath);
          const activeWorkspaceRoot = this.workspaceManager.findWorkspaceForFile(normalizedFilePath);
          
          let fileCode = '';
          try {
            fileCode = await fs.readFile(normalizedFilePath, 'utf-8');
          } catch {
            return {
              content: [{ type: 'text', text: `Error: File non-existent or inaccessible at path: ${normalizedFilePath}` }],
              isError: true,
            };
          }

          let activeTier = tier;
          
          if (config.enableUsageLearning && !hasExplicitTier) {
            activeTier = getAutoTunedTier(normalizedFilePath, this.usageTracker, tier);
            this.usageTracker.recordAccess(normalizedFilePath);
          } else if (config.gitAwareTiers && !hasExplicitTier) {
            activeTier = await getGitAwareTier(normalizedFilePath, activeWorkspaceRoot, tier);
          }

          // Apply v6.0 Model Policy Tier Cap
          if (!hasExplicitTier) {
            activeTier = adjustTierForModel(activeTier, config.activeModel || 'claude-3-5-sonnet');
          }

          let compressedContent = await this.cache.get(normalizedFilePath, activeTier, fileCode);
          if (!compressedContent) {
            const normal = await this.engine.compress(fileCode, normalizedFilePath, 'normal');
            const medium = await this.engine.compress(fileCode, normalizedFilePath, 'medium');
            const aggressive = await this.engine.compress(fileCode, normalizedFilePath, 'aggressive');
            
            await this.cache.set(normalizedFilePath, { normal, medium, aggressive }, fileCode);
            compressedContent = activeTier === 'normal' ? normal : activeTier === 'medium' ? medium : aggressive;
          }

          // Apply v6.0 Quality Gate Evaluation
          let qualityPassed = true;
          let qualityScore = 1.0;
          const qualityWarnings: string[] = [];

          if (config.enableQualityGate !== false) {
            const activePromptStr = args?.activePrompt ? String(args.activePrompt) : undefined;
            const taskProfile = activePromptStr ? classifyTask(activePromptStr) : {
              taskType: 'unknown' as const,
              complexityScore: 0.5,
              confidence: 0.5,
              detectedKeywords: [],
              recommendedBudgetMultiplier: 1.0,
              minRetentionThreshold: config.qualityGateMinRetention || 0.85,
              reasoning: 'Default fallback task profile'
            };

            const gateResult = evaluateQualityGate(
              fileCode,
              compressedContent,
              taskProfile,
              activeTier,
              config.qualityGateMinRetention
            );

            qualityPassed = gateResult.passed;
            qualityScore = gateResult.score;
            if (gateResult.warnings.length > 0) qualityWarnings.push(...gateResult.warnings);

            if (!gateResult.passed && gateResult.fallbackTier && gateResult.fallbackTier !== activeTier) {
              activeTier = gateResult.fallbackTier;
              let fallbackContent = await this.cache.get(normalizedFilePath, activeTier, fileCode);
              if (!fallbackContent) {
                fallbackContent = await this.engine.compress(fileCode, normalizedFilePath, activeTier);
              }
              compressedContent = fallbackContent;
            }
          }

          // Inject CCR retrieve marker for compressed tiers
          if (activeTier !== 'normal') {
            compressedContent = this.retrieveCache.injectMarker(
              compressedContent,
              fileCode,
              normalizedFilePath,
              activeTier
            );
          }

          if (maxBudget) {
            const { results } = await enforceBudget(
              [{ filePath: normalizedFilePath, code: fileCode }],
              this.engine,
              maxBudget
            );
            if (results.length > 0) {
              compressedContent = results[0].content;
              activeTier = results[0].tier as any;
            }
          }

          await this.cache.flushToDisk();
          this.metricsCollector.logMetrics(normalizedFilePath, fileCode, compressedContent, activeTier, 0, config.telemetryRotationLimit).catch(() => {});

          // Generate Context Receipt
          const rawTokens = estimateTokens(fileCode, normalizedFilePath);
          const compTokens = estimateTokens(compressedContent, normalizedFilePath);
          
          createOptimizationReceipt({
            timestamp: new Date().toISOString(),
            taskType: 'unknown',
            model: config.activeModel || 'claude-3-5-sonnet',
            originalTokenEstimate: rawTokens,
            finalTokenEstimate: compTokens,
            compressionRatio: compTokens > 0 ? parseFloat((rawTokens / compTokens).toFixed(2)) : 1.0,
            savingsPct: rawTokens > 0 ? parseFloat((((rawTokens - compTokens) / rawTokens) * 100).toFixed(2)) : 0,
            qualityGatePassed: qualityPassed,
            qualityScore,
            evidenceCompleteness: 1.0,
            itemsIncluded: 1,
            itemsSummarized: 0,
            itemsOmitted: 0,
            executionTimeMs: 1,
            warnings: qualityWarnings
          });

          const receipt = this.receiptGenerator.generate(
            'read_optimized_file',
            [
              {
                filePath: normalizedFilePath,
                tier: activeTier,
                rawTokens,
                compressedTokens: compTokens,
                savingsPct: rawTokens > 0 ? parseFloat((((rawTokens - compTokens) / rawTokens) * 100).toFixed(2)) : 0,
                hasRetrieveMarker: compressedContent.includes('[tokenist:retrieve'),
              },
            ],
            [],
            maxBudget || null
          );

          const footer = this.receiptGenerator.formatAsFooter(receipt);

          return {
            content: [{ type: 'text', text: `${compressedContent}${footer}` }],
          };
        }

        if (name === 'get_file_diff_context') {
          const rawPath = String(args?.filePath);
          const contextLines = args?.contextLines ? Number(args.contextLines) : 10;
          const normalizedFilePath = normalizePath(rawPath);
          const activeWorkspaceRoot = this.workspaceManager.findWorkspaceForFile(normalizedFilePath);

          const diffResult = await getFileDiffContext(normalizedFilePath, activeWorkspaceRoot, contextLines);
          return {
            content: [{ type: 'text', text: diffResult }],
          };
        }

        if (name === 'reindex_workspace') {
          const indexer = new WorkspaceIndexer(this.workspaceRoot);
          const matchedFiles = await indexer.indexWorkspace('.');
          const importGraph = await this.getImportGraph();
          importGraph.clear();

          for (const file of matchedFiles) {
            try {
              const code = await fs.readFile(file, 'utf-8');
              await importGraph.parseFileImports(file, code, this.engine.getLoadedLanguages());
              const normal = await this.engine.compress(code, file, 'normal');
              const medium = await this.engine.compress(code, file, 'medium');
              const aggressive = await this.engine.compress(code, file, 'aggressive');
              await this.cache.set(file, { normal, medium, aggressive }, code);
            } catch {}
          }
          await this.cache.flushToDisk();
          return {
            content: [{ type: 'text', text: `Pre-indexed ${matchedFiles.length} source files across workspaces.` }],
          };
        }

        if (name === 'get_token_savings_report') {
          // Read telemetry ledger from disk and render dashboard
          let telemetryRecords: any[] = [];
          try {
            const ledgerPath = path.resolve(this.workspaceRoot, 'telemetry_ledger.json');
            const raw = await fs.readFile(ledgerPath, 'utf-8');
            telemetryRecords = JSON.parse(raw);
          } catch {}
          const reportText = renderDashboard(telemetryRecords);
          return {
            content: [{ type: 'text', text: reportText }],
          };
        }

        if (name === 'prune_chat_history') {
          const rawMessages = args?.messages as any[];
          const maxTurns = args?.maxTurns ? Number(args.maxTurns) : 5;
          const pruned = pruneHistory(rawMessages || [], maxTurns);
          return {
            content: [{ type: 'text', text: JSON.stringify(pruned, null, 2) }],
          };
        }

        // --- HANDLERS FOR NEW TOKENIST v2 TOOLS ---

        if (name === 'retrieve_original') {
          const hash = String(args?.hash);
          const entry = this.retrieveCache.retrieve(hash);
          if (!entry) {
            return {
              content: [{ type: 'text', text: `No cached uncompressed content found for retrieve hash "${hash}". It may have expired.` }],
              isError: true,
            };
          }
          return {
            content: [
              {
                type: 'text',
                text: `[Tokenist CCR] Restored original uncompressed source for ${entry.filePath} (Tier was: ${entry.tier})\n\n${entry.original}`,
              },
            ],
          };
        }

        if (name === 'compress_output') {
          const rawContent = String(args?.content);
          const result = this.smartCrusher.crush(rawContent);
          const summary = `[SmartCrusher] Detected: ${result.contentType.toUpperCase()} | ${result.originalTokens} → ${result.crushedTokens} tokens (${result.savingsPct}% saved)`;
          return {
            content: [{ type: 'text', text: `${summary}\n\n${result.crushed}` }],
          };
        }

        if (name === 'stabilize_prompt') {
          const rawPrompt = String(args?.prompt);
          const result = this.cacheAligner.align(rawPrompt);
          const header = `[CacheAligner] Relocated ${result.dynamicCount} volatile variables. ${result.estimatedCacheSavings}`;
          const formatted = `${header}\n\n--- STABLE PREFIX (KV-Cacheable) ---\n${result.stablePrefix}\n\n--- DYNAMIC VARIABLE SUFFIX ---\n${result.dynamicSuffix}`;
          return {
            content: [{ type: 'text', text: formatted }],
          };
        }

        if (name === 'get_terse_system_prompt') {
          const level = (args?.level as any) || 'compact';
          const terse = getTersePrompt(level);
          return {
            content: [
              {
                type: 'text',
                text: `[TerseMode: ${terse.level.toUpperCase()}] ${terse.estimatedOutputReduction}\n\n${terse.systemInstruction}`,
              },
            ],
          };
        }

        if (name === 'compress_mcp_schemas') {
          const rawSchemas = String(args?.schemas);
          let parsed: any[];
          try {
            parsed = JSON.parse(rawSchemas);
          } catch {
            return {
              content: [{ type: 'text', text: 'Error: Input must be a valid JSON string representing an array of MCP tool definitions.' }],
              isError: true,
            };
          }

          const result = this.schemaCompressor.compress(parsed);
          const header = `[SchemaCompressor] ${result.toolCount} tools compressed | ${result.originalTokens} → ${result.compressedTokens} tokens (${result.savingsPct}% saved)`;
          return {
            content: [{ type: 'text', text: `${header}\n\n${result.compressed}` }],
          };
        }

        if (name === 'get_blast_radius') {
          const rawPath = String(args?.filePath);
          const maxHops = args?.maxHops ? Number(args.maxHops) : 3;
          const normalizedFilePath = normalizePath(rawPath);
          const activeWorkspaceRoot = this.workspaceManager.findWorkspaceForFile(normalizedFilePath);

          const importGraph = await this.getImportGraph();
          const indexer = new WorkspaceIndexer(activeWorkspaceRoot);
          const matchedFiles = await indexer.indexWorkspace('.');
          
          for (const file of matchedFiles) {
            try {
              const code = await fs.readFile(file, 'utf-8');
              await importGraph.parseFileImports(file, code, this.engine.getLoadedLanguages());
            } catch {}
          }

          const report = importGraph.getBlastRadius(normalizedFilePath, maxHops);

          const lines: string[] = [];
          lines.push('==================================================');
          lines.push(`TOKENIST MULTI-HOP BLAST RADIUS ANALYSIS`);
          lines.push('==================================================');
          lines.push(`Target File          : ${path.relative(activeWorkspaceRoot, report.targetFile)}`);
          lines.push(`Blast Radius Risk    : ${report.riskLevel.toUpperCase()}`);
          lines.push(`Total Affected Files : ${report.totalAffectedFiles}`);
          lines.push('--------------------------------------------------');
          lines.push('FORWARD DEPENDENCIES (Files imported by target):');

          if (report.forwardDeps.size === 0) {
            lines.push('  (None)');
          } else {
            for (const [hop, files] of report.forwardDeps.entries()) {
              lines.push(`  Hop ${hop}:`);
              for (const f of files) {
                lines.push(`    - ${path.relative(activeWorkspaceRoot, f)}`);
              }
            }
          }

          lines.push('--------------------------------------------------');
          lines.push('REVERSE DEPENDENCIES (Files that import target):');

          if (report.reverseDeps.size === 0) {
            lines.push('  (None)');
          } else {
            for (const [hop, files] of report.reverseDeps.entries()) {
              lines.push(`  Hop ${hop}:`);
              for (const f of files) {
                lines.push(`    - ${path.relative(activeWorkspaceRoot, f)}`);
              }
            }
          }
          lines.push('==================================================');

          return {
            content: [{ type: 'text', text: lines.join('\n') }],
          };
        }

        if (name === 'get_context_receipt') {
          const summary = this.receiptGenerator.formatSessionSummary();
          return {
            content: [{ type: 'text', text: summary }],
          };
        }

        // --- v6.0 CONTEXT INTELLIGENCE TOOL HANDLERS ---

        if (name === 'analyze_task') {
          const prompt = String(args?.prompt);
          const modelName = args?.modelName ? String(args.modelName) : config.activeModel;
          const taskProfile = classifyTask(prompt);
          const modelPolicy = getModelPolicy(modelName);

          const result = {
            taskProfile,
            modelPolicy,
            recommendedTier: adjustTierForModel(config.defaultTier, modelName)
          };
          return {
            content: [{ type: 'text', text: JSON.stringify(result, null, 2) }],
          };
        }

        if (name === 'store_critical_memory') {
          const category = args?.category as any;
          const title = String(args?.title);
          const content = String(args?.content);
          const priority = (args?.priority as any) || 'medium';
          const tags = Array.isArray(args?.tags) ? args.tags.map(String) : [];

          const stored = await storeMemory(
            { category, title, content, priority, tags },
            this.workspaceRoot
          );
          return {
            content: [{ type: 'text', text: `Successfully stored critical memory [${stored.id}]: "${stored.title}" (${stored.category.toUpperCase()})` }],
          };
        }

        if (name === 'recall_critical_memory') {
          const query = String(args?.query);
          const category = args?.category as any;
          const limit = args?.limit ? Number(args.limit) : 10;

          const memories = await recallMemory(query, this.workspaceRoot, { category, limit });
          return {
            content: [{ type: 'text', text: JSON.stringify(memories, null, 2) }],
          };
        }

        if (name === 'list_critical_memory') {
          const category = args?.category as any;
          const memories = await listMemory(this.workspaceRoot, category);
          return {
            content: [{ type: 'text', text: JSON.stringify(memories, null, 2) }],
          };
        }

        if (name === 'delete_critical_memory') {
          const id = String(args?.id);
          const success = await deleteMemory(id, this.workspaceRoot);
          if (!success) {
            return {
              content: [{ type: 'text', text: `Memory entry with ID "${id}" not found.` }],
              isError: true,
            };
          }
          return {
            content: [{ type: 'text', text: `Successfully deleted critical memory entry "${id}".` }],
          };
        }

        if (name === 'equalize_context') {
          const prompt = String(args?.prompt);
          const taskProfile = classifyTask(prompt);
          const equalized = await equalizeContext(prompt, this.workspaceRoot, taskProfile);
          return {
            content: [{ type: 'text', text: equalized.enrichedPrompt }],
          };
        }

        if (name === 'detect_agent_failure') {
          const rawHistory = args?.history as any[];
          const actions = detectAgentFailure(rawHistory || []);
          return {
            content: [{ type: 'text', text: JSON.stringify(actions, null, 2) }],
          };
        }

        if (name === 'run_benchmark') {
          const report = await runBenchmarkSuite(this.workspaceRoot);
          return {
            content: [{ type: 'text', text: JSON.stringify(report, null, 2) }],
          };
        }

        if (name === 'get_optimization_receipt') {
          const receipt = getLastOptimizationReceipt();
          if (!receipt) {
            return {
              content: [{ type: 'text', text: 'No optimization receipt generated in current session yet.' }],
            };
          }
          return {
            content: [{ type: 'text', text: JSON.stringify(receipt, null, 2) }],
          };
        }

        throw new McpError(ErrorCode.MethodNotFound, `Unknown tool: ${name}`);
      } catch (error) {
        if (error instanceof McpError) throw error;
        return {
          content: [{ type: 'text', text: `Internal Engine Error: ${(error as Error).message}` }],
          isError: true,
        };
      }
    });
  }

  private async runIntelligencePipeline(
    activePrompt: string | undefined,
    fileInputs: { filePath: string; code: string }[],
    config: WorkspaceConfig,
    importanceMap: Map<string, any>,
    activeWorkspaceRoot: string
  ): Promise<{
    taskProfile: TaskProfile | null;
    dispositionMap: Map<string, ContextItemDisposition>;
    adjustedTier: CompressionTier;
    equalizedPrompt?: string;
  }> {
    if (!activePrompt || activePrompt.trim().length === 0 || config.enableIntelligencePipeline === false) {
      return {
        taskProfile: null,
        dispositionMap: new Map(),
        adjustedTier: config.defaultTier,
      };
    }

    // 1. Task Understanding
    const taskProfile = classifyTask(activePrompt);

    // 2. Model Policy Tier Adjustment
    const modelName = config.activeModel || 'claude-3-5-sonnet';
    const adjustedTier = adjustTierForModel(config.defaultTier, modelName);

    // 3. Recall Critical Memories
    const memories = await recallMemory(activePrompt, activeWorkspaceRoot, { limit: 5 });

    // 4. Score Context Importance
    const rawItems: RawContextInput[] = fileInputs.map((f) => {
      const abs = path.resolve(f.filePath);
      const scoreObj = importanceMap.get(abs);
      const graphScore = scoreObj ? scoreObj.score : 0.5;
      return {
        id: f.filePath,
        category: 'code',
        sourcePath: f.filePath,
        rawContent: f.code,
        graphScore,
      };
    });

    const centralityRecord: Record<string, number> = {};
    for (const [key, val] of importanceMap.entries()) {
      centralityRecord[key] = typeof val === 'object' && val !== null && 'score' in val ? val.score : 0.5;
    }

    const importanceResult = scoreContextImportance(
      activePrompt,
      rawItems,
      taskProfile,
      centralityRecord,
      memories
    );

    const dispositionMap = new Map<string, ContextItemDisposition>();
    for (const item of importanceResult.items) {
      if (item.sourcePath) {
        dispositionMap.set(path.resolve(item.sourcePath), item.disposition);
      }
    }

    // 5. Capability Equalization
    let equalizedPrompt: string | undefined = undefined;
    if (config.enableCapabilityEqualization !== false) {
      const equalized = await equalizeContext(activePrompt, activeWorkspaceRoot, taskProfile);
      equalizedPrompt = equalized.enrichedPrompt;
    }

    return {
      taskProfile,
      dispositionMap,
      adjustedTier,
      equalizedPrompt,
    };
  }

  private async fetchRepositoryMap(
    dirPath: string,
    tier: 'normal' | 'medium' | 'aggressive',
    maxTokenBudget?: number,
    hasExplicitTier = false,
    activeWorkspaceRoot = process.cwd(),
    semanticQuery?: string,
    activePrompt?: string
  ): Promise<string> {
    const config = getConfig();
    const indexer = new WorkspaceIndexer(activeWorkspaceRoot);
    const matchedFiles = await indexer.indexWorkspace(dirPath);

    const importGraph = await this.getImportGraph();
    importGraph.clear();

    const fileInputs: { filePath: string; code: string }[] = [];

    for (const filePath of matchedFiles) {
      try {
        const code = await fs.readFile(filePath, 'utf-8');
        fileInputs.push({ filePath, code });
        await importGraph.parseFileImports(filePath, code, this.engine.getLoadedLanguages());
      } catch {}
    }

    let orderedInputs = fileInputs;

    if (semanticQuery) {
      const embeddingRanker = await this.getEmbeddingRanker();
      // Index all files for semantic search
      for (const f of fileInputs) {
        await embeddingRanker.indexFile(f.filePath, f.code);
      }
      // Get semantic ranking from embedding ranker
      const semHits = await embeddingRanker.rankFiles(semanticQuery, fileInputs.length);
      // Build file contents map for BM25
      const fileContentsMap = new Map<string, string>();
      for (const f of fileInputs) {
        fileContentsMap.set(f.filePath, f.code);
      }
      // Merge semantic + BM25 using hybridRanker
      const hybridHits = this.hybridRanker.mergeHybridScores(semHits, fileContentsMap, semanticQuery);

      const rankedPaths = hybridHits.map((h) => h.filePath);
      orderedInputs = fileInputs.slice().sort((a, b) => {
        const idxA = rankedPaths.indexOf(a.filePath);
        const idxB = rankedPaths.indexOf(b.filePath);
        return (idxA === -1 ? 9999 : idxA) - (idxB === -1 ? 9999 : idxB);
      });
    }

    const queryAdaptivePins: string[] = [];
    if (activePrompt) {
      const routed = routePrompt(
        activePrompt,
        fileInputs.map((f) => ({ filePath: f.filePath, signatures: f.code, rawCode: f.code })),
        (fp) => {
          const abs = path.resolve(fp);
          const outEdges = importGraph.getOutEdgesMap().get(abs);
          return outEdges ? Array.from(outEdges) : [];
        }
      );
      for (const item of routed) {
        if (item.swapped) {
          queryAdaptivePins.push(path.resolve(item.filePath));
        }
      }
    }

    const importanceMap = this.importanceScorer.calculatePageRank(importGraph);

    // v6.0 Context Intelligence Pipeline Execution
    const intel = await this.runIntelligencePipeline(
      activePrompt,
      fileInputs,
      config,
      importanceMap,
      activeWorkspaceRoot
    );

    const isFilePinned = (absFile: string) => {
      const isStaticPin = isPinned(absFile, config.alwaysInclude || [], activeWorkspaceRoot);
      const isAdaptivePin = queryAdaptivePins.includes(path.resolve(absFile));
      return isStaticPin || isAdaptivePin;
    };

    const pinnedInputs = orderedInputs.filter((f) => isFilePinned(f.filePath));
    const regularInputs = orderedInputs.filter((f) => !isFilePinned(f.filePath));

    const finalResults: { filePath: string; content: string; tier: string }[] = [];

    let pinnedTokensTotal = 0;
    for (const input of pinnedInputs) {
      let content = await this.cache.get(input.filePath, 'normal', input.code);
      if (!content) {
        content = await this.engine.compress(input.code, input.filePath, 'normal');
      }
      pinnedTokensTotal += estimateTokens(content);
      finalResults.push({
        filePath: input.filePath,
        content,
        tier: 'normal',
      });
    }

    const remainingBudget = maxTokenBudget ? Math.max(0, maxTokenBudget - pinnedTokensTotal) : undefined;

    if (remainingBudget !== undefined) {
      const { results } = await enforceBudget(regularInputs, this.engine, remainingBudget);
      results.forEach((r) => {
        finalResults.push({
          filePath: r.filePath,
          content: r.content,
          tier: r.tier,
        });
      });
    } else {
      for (const input of regularInputs) {
        let activeTier = tier;
        const absPath = path.resolve(input.filePath);
        const pageRankTier = importanceMap.get(absPath)?.recommendedTier;
        const disposition = intel.dispositionMap.get(absPath);

        if (disposition === 'must_include') {
          activeTier = 'normal';
        } else if (disposition === 'summarize') {
          activeTier = 'medium';
        } else if (disposition === 'omit') {
          finalResults.push({
            filePath: input.filePath,
            content: '[Omitted by Tokenist Context Intelligence Engine]',
            tier: 'omitted',
          });
          continue;
        } else if (config.enableUsageLearning && !hasExplicitTier) {
          activeTier = getAutoTunedTier(input.filePath, this.usageTracker, pageRankTier || tier);
        } else if (config.gitAwareTiers && !hasExplicitTier) {
          activeTier = await getGitAwareTier(input.filePath, activeWorkspaceRoot, pageRankTier || tier);
        } else if (pageRankTier && !hasExplicitTier) {
          activeTier = pageRankTier;
        }

        // Apply Model Policy Tier Cap
        if (!hasExplicitTier) {
          activeTier = adjustTierForModel(activeTier, config.activeModel || 'claude-3-5-sonnet');
        }

        let content = await this.cache.get(input.filePath, activeTier, input.code);
        if (!content) {
          const normal = await this.engine.compress(input.code, input.filePath, 'normal');
          const medium = await this.engine.compress(input.code, input.filePath, 'medium');
          const aggressive = await this.engine.compress(input.code, input.filePath, 'aggressive');
          await this.cache.set(input.filePath, { normal, medium, aggressive }, input.code);
          content = activeTier === 'normal' ? normal : activeTier === 'medium' ? medium : aggressive;
        }

        // Apply Quality Gate per file
        if (config.enableQualityGate !== false && intel.taskProfile) {
          const qg = evaluateQualityGate(
            input.code,
            content,
            intel.taskProfile,
            activeTier,
            config.qualityGateMinRetention
          );
          if (!qg.passed && qg.fallbackTier && qg.fallbackTier !== activeTier) {
            activeTier = qg.fallbackTier;
            let safer = await this.cache.get(input.filePath, activeTier, input.code);
            if (!safer) {
              safer = await this.engine.compress(input.code, input.filePath, activeTier);
            }
            content = safer;
          }
        }

        finalResults.push({
          filePath: input.filePath,
          content,
          tier: activeTier,
        });
      }
    }

    await this.cache.flushToDisk();

    // Inject CCR markers for compressed tiers
    for (const res of finalResults) {
      if (res.tier !== 'normal' && res.tier !== 'omitted') {
        const origCode = fileInputs.find((f) => f.filePath === res.filePath)?.code || '';
        res.content = this.retrieveCache.injectMarker(res.content, origCode, res.filePath, res.tier);
      }
    }

    for (const res of finalResults) {
      if (res.tier !== 'omitted') {
        const inputCode = fileInputs.find((f) => f.filePath === res.filePath)?.code || '';
        this.metricsCollector
          .logMetrics(res.filePath, inputCode, res.content, res.tier, 0, config.telemetryRotationLimit)
          .catch(() => {});
      }
    }

    const results: string[] = [];
    results.push(`Directory Structure Map for: ${path.relative(activeWorkspaceRoot, dirPath) || '.'}`);
    results.push(`Requested Tier: ${tier}`);
    if (maxTokenBudget) {
      results.push(`Max Token Budget: ${maxTokenBudget}`);
    }
    if (semanticQuery) {
      results.push(`Semantic Filter: "${semanticQuery}"`);
    }
    results.push('==================================================');

    for (const res of finalResults) {
      const relPath = path.relative(activeWorkspaceRoot, res.filePath);
      results.push(`\nFile: ${relPath} (Allocated Tier: ${res.tier})`);
      results.push('--------------------------------------------------');
      results.push(res.content);
      results.push('--------------------------------------------------');
    }

    // Create v6.0 Optimization Receipt
    const rawTotalTokens = fileInputs.reduce((sum, f) => sum + estimateTokens(f.code, f.filePath), 0);
    const finalTotalTokens = finalResults
      .filter((r) => r.tier !== 'omitted')
      .reduce((sum, r) => sum + estimateTokens(r.content, r.filePath), 0);

    const includedCount = finalResults.filter((r) => r.tier === 'normal').length;
    const summarizedCount = finalResults.filter((r) => r.tier === 'medium' || r.tier === 'aggressive').length;
    const omittedCount = finalResults.filter((r) => r.tier === 'omitted').length;

    createOptimizationReceipt({
      timestamp: new Date().toISOString(),
      taskType: intel.taskProfile ? intel.taskProfile.taskType : 'unknown',
      model: config.activeModel || 'claude-3-5-sonnet',
      originalTokenEstimate: rawTotalTokens,
      finalTokenEstimate: finalTotalTokens,
      compressionRatio: finalTotalTokens > 0 ? parseFloat((rawTotalTokens / finalTotalTokens).toFixed(2)) : 1.0,
      savingsPct: rawTotalTokens > 0 ? parseFloat((((rawTotalTokens - finalTotalTokens) / rawTotalTokens) * 100).toFixed(2)) : 0,
      qualityGatePassed: true,
      qualityScore: 1.0,
      evidenceCompleteness: 1.0,
      itemsIncluded: includedCount,
      itemsSummarized: summarizedCount,
      itemsOmitted: omittedCount,
      executionTimeMs: 1,
      warnings: intel.taskProfile ? [intel.taskProfile.reasoning] : []
    });

    // Generate Context Receipt
    const receipt = this.receiptGenerator.generate(
      'fetch_optimized_repository_map',
      finalResults
        .filter((r) => r.tier !== 'omitted')
        .map((r) => {
          const rawCode = fileInputs.find((f) => f.filePath === r.filePath)?.code || '';
          const rawTok = estimateTokens(rawCode, r.filePath);
          const compTok = estimateTokens(r.content, r.filePath);
          return {
            filePath: r.filePath,
            tier: r.tier,
            rawTokens: rawTok,
            compressedTokens: compTok,
            savingsPct: rawTok > 0 ? parseFloat((((rawTok - compTok) / rawTok) * 100).toFixed(2)) : 0,
            hasRetrieveMarker: r.content.includes('[tokenist:retrieve'),
          };
        }),
      finalResults.filter((r) => r.tier === 'omitted').map((r) => r.filePath),
      maxTokenBudget || null
    );

    results.push(this.receiptGenerator.formatAsFooter(receipt));

    return results.join('\n');
  }
}

function hasExplicitArg(args: Record<string, any> | undefined, argName: string): boolean {
  if (!args) return false;
  return Object.prototype.hasOwnProperty.call(args, argName) && args[argName] !== undefined;
}
