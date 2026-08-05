"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.McpCompressionServer = void 0;
const index_js_1 = require("@modelcontextprotocol/sdk/server/index.js");
const types_js_1 = require("@modelcontextprotocol/sdk/types.js");
const path = __importStar(require("path"));
const fs_1 = require("fs");
const parser_1 = require("./core/parser");
const guardrails_1 = require("./core/guardrails");
const workspaceIndexer_1 = require("./core/workspaceIndexer");
const cache_1 = require("./core/cache");
const importGraph_1 = require("./core/importGraph");
const budgetManager_1 = require("./core/budgetManager");
const embeddingRanker_1 = require("./core/embeddingRanker");
const metricsCollector_1 = require("./telemetry/metricsCollector");
const terminalConsole_1 = require("./telemetry/terminalConsole");
const configLoader_1 = require("./core/configLoader");
const gitAwareTier_1 = require("./core/gitAwareTier");
const workspaceManager_1 = require("./core/workspaceManager");
const usageTracker_1 = require("./core/usageTracker");
const tierTuner_1 = require("./core/tierTuner");
const diffContext_1 = require("./core/diffContext");
const importanceScorer_1 = require("./core/importanceScorer");
const hybridRanker_1 = require("./core/hybridRanker");
const promptRouter_1 = require("./middleware/promptRouter");
const historyPruner_1 = require("./middleware/historyPruner");
// Tokenist v2 Revolutionary Extensions
const retrieveCache_1 = require("./core/retrieveCache");
const smartCrusher_1 = require("./core/smartCrusher");
const cacheAligner_1 = require("./core/cacheAligner");
const terseMode_1 = require("./core/terseMode");
const schemaCompressor_1 = require("./core/schemaCompressor");
const contextReceipt_1 = require("./core/contextReceipt");
function globToRegex(pattern) {
    const escaped = pattern.replace(/[.+^${}()|[\]\\]/g, '\\$&');
    const regexStr = '^' + escaped.replace(/\\\*\\\*/g, '.*').replace(/\\\*/g, '[^/]*') + '$';
    return new RegExp(regexStr);
}
function isPinned(filePath, alwaysInclude, workspaceRoot) {
    const relPath = path.relative(workspaceRoot, filePath).replace(/\\/g, '/');
    return alwaysInclude.some((pattern) => {
        const regex = globToRegex(pattern);
        return regex.test(relPath);
    });
}
class McpCompressionServer {
    server;
    engine;
    cache;
    importGraph = null;
    embeddingRanker;
    metricsCollector;
    workspaceManager;
    usageTracker;
    importanceScorer;
    hybridRanker;
    // v2 Engines
    retrieveCache = new retrieveCache_1.RetrieveCache();
    smartCrusher = new smartCrusher_1.SmartCrusher();
    cacheAligner = new cacheAligner_1.CacheAligner();
    schemaCompressor = new schemaCompressor_1.SchemaCompressor();
    receiptGenerator = new contextReceipt_1.ContextReceiptGenerator();
    workspaceRoot;
    isInitialized = false;
    constructor() {
        this.workspaceRoot = path.resolve(process.cwd());
        this.engine = new parser_1.CodeCompressionEngine();
        this.cache = new cache_1.AstCache();
        this.embeddingRanker = new embeddingRanker_1.EmbeddingRanker();
        this.metricsCollector = new metricsCollector_1.MetricsCollector(this.workspaceRoot);
        this.importanceScorer = new importanceScorer_1.ImportanceScorer();
        this.hybridRanker = new hybridRanker_1.HybridRanker();
        this.server = new index_js_1.Server({
            name: 'tokenist',
            version: '5.0.0',
        }, {
            capabilities: {
                tools: {},
            },
        });
        this.setupHandlers();
    }
    async ensureInitialized() {
        if (this.isInitialized)
            return;
        const config = await (0, configLoader_1.loadConfig)(this.workspaceRoot);
        this.workspaceManager = new workspaceManager_1.WorkspaceManager(this.workspaceRoot, config.workspaces || []);
        this.usageTracker = new usageTracker_1.UsageTracker(this.workspaceRoot);
        if (config.cachePath) {
            this.cache = new cache_1.AstCache(config.maxCacheSizeMb * 20, config.cachePath);
        }
        await this.cache.loadFromDisk();
        await this.engine.init();
        this.isInitialized = true;
    }
    async getImportGraph() {
        await this.ensureInitialized();
        if (!this.importGraph) {
            this.importGraph = new importGraph_1.ImportGraph(this.engine.getParser());
        }
        return this.importGraph;
    }
    async getEmbeddingRanker() {
        await this.ensureInitialized();
        await this.embeddingRanker.init();
        return this.embeddingRanker;
    }
    setupHandlers() {
        // 1. List available tools (13 total in v5.0.0)
        this.server.setRequestHandler(types_js_1.ListToolsRequestSchema, async () => {
            return {
                tools: [
                    {
                        name: 'fetch_optimized_repository_map',
                        description: 'Recursively scans a local directory inside workspaces (respecting gitignore rules), compresses all supported files using AST optimization, and returns a unified code map.',
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
                        description: 'Reads and returns the AST-optimized, compressed content of a single local source file (TypeScript, Python, Go, Rust, Java, C#, etc.).',
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
                        description: 'Gets uncommitted git changes of a file with surrounding context lines, giving 90-95% token savings compared to full file reads.',
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
                        description: 'Pre-indexes workspaces using .gitignore filters to scan all source files, build dependency graph, and cache AST optimizations.',
                        inputSchema: {
                            type: 'object',
                            properties: {},
                        },
                    },
                    {
                        name: 'get_token_savings_report',
                        description: 'Generates a formatted console dashboard showing cumulative token savings efficiency rating, cost estimation, and latency statistics.',
                        inputSchema: {
                            type: 'object',
                            properties: {},
                        },
                    },
                    {
                        name: 'prune_chat_history',
                        description: 'Prunes multi-turn context conversation history, collapsing long terminal output dumps and stack traces to preserve context tokens.',
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
                        description: 'Retrieves the original uncompressed content for a given retrieve hash marker. Use when compressed output contains [tokenist:retrieve hash=<hash>] and you need the full uncompressed source code.',
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
                        description: 'Compresses non-code content (JSON API responses, terminal output, build logs, stack traces) using intelligent content-type-aware crushing. Reduces tokens by 60-90% while preserving errors and key data.',
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
                        description: 'Reorganizes a prompt by relocating dynamic values (timestamps, UUIDs, hashes, PIDs) to the end, making the static prefix cache-friendly for Anthropic/OpenAI KV caching (~90% cost reduction on cached portion).',
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
                        description: 'Returns an optimized system prompt instruction that forces the LLM to respond concisely, saving output tokens (which cost 3-5x more than input). Choose minimal (60-75% savings), compact (30-50% savings), or standard (no change).',
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
                        description: 'Compresses MCP tool schema definitions to reduce schema bloat. Shortens descriptions, flattens nested types, and removes verbose metadata. Essential when using 5+ MCP servers that consume 10k+ tokens in tool definitions.',
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
                        description: 'Analyzes the full impact chain of changing a file. Returns all files that import it (reverse deps) and all files it imports (forward deps), traversed up to N hops deep. Risk-rated by total affected files.',
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
                        description: 'Returns the full session audit trail of all Tokenist operations: files processed, compression tiers applied, tokens saved, and budget utilization per request.',
                        inputSchema: {
                            type: 'object',
                            properties: {},
                        },
                    },
                ],
            };
        });
        // 2. Call tool execution handler
        this.server.setRequestHandler(types_js_1.CallToolRequestSchema, async (request) => {
            await this.ensureInitialized();
            const config = (0, configLoader_1.getConfig)();
            const { name, arguments: args } = request.params;
            try {
                if (name === 'fetch_optimized_repository_map') {
                    const rawDirPath = String(args?.directoryPath);
                    const level = args?.level || config.defaultTier;
                    const maxBudget = args?.maxTokenBudget ? Number(args.maxTokenBudget) : config.maxTokenBudget;
                    const semanticQuery = args?.semanticQuery ? String(args.semanticQuery) : undefined;
                    const activePrompt = args?.activePrompt ? String(args.activePrompt) : undefined;
                    const normalizedDir = (0, guardrails_1.normalizePath)(rawDirPath);
                    const activeWorkspaceRoot = this.workspaceManager.findWorkspaceForFile(normalizedDir);
                    const result = await this.fetchRepositoryMap(normalizedDir, level, maxBudget, hasExplicitArg(args, 'level'), activeWorkspaceRoot, semanticQuery, activePrompt);
                    return {
                        content: [{ type: 'text', text: result }],
                    };
                }
                if (name === 'read_optimized_file') {
                    const rawPath = String(args?.filePath);
                    const hasExplicitTier = hasExplicitArg(args, 'compressionTier');
                    const tier = args?.compressionTier || config.defaultTier;
                    const maxBudget = args?.maxTokenBudget ? Number(args.maxTokenBudget) : config.maxTokenBudget;
                    const normalizedFilePath = (0, guardrails_1.normalizePath)(rawPath);
                    const activeWorkspaceRoot = this.workspaceManager.findWorkspaceForFile(normalizedFilePath);
                    let fileCode = '';
                    try {
                        fileCode = await fs_1.promises.readFile(normalizedFilePath, 'utf-8');
                    }
                    catch {
                        return {
                            content: [{ type: 'text', text: `Error: File non-existent or inaccessible at path: ${normalizedFilePath}` }],
                            isError: true,
                        };
                    }
                    let activeTier = tier;
                    if (config.enableUsageLearning && !hasExplicitTier) {
                        activeTier = (0, tierTuner_1.getAutoTunedTier)(normalizedFilePath, this.usageTracker, tier);
                        this.usageTracker.recordAccess(normalizedFilePath);
                    }
                    else if (config.gitAwareTiers && !hasExplicitTier) {
                        activeTier = await (0, gitAwareTier_1.getGitAwareTier)(normalizedFilePath, activeWorkspaceRoot, tier);
                    }
                    let compressedContent = await this.cache.get(normalizedFilePath, activeTier, fileCode);
                    if (!compressedContent) {
                        const normal = await this.engine.compress(fileCode, normalizedFilePath, 'normal');
                        const medium = await this.engine.compress(fileCode, normalizedFilePath, 'medium');
                        const aggressive = await this.engine.compress(fileCode, normalizedFilePath, 'aggressive');
                        await this.cache.set(normalizedFilePath, { normal, medium, aggressive }, fileCode);
                        compressedContent = activeTier === 'normal' ? normal : activeTier === 'medium' ? medium : aggressive;
                    }
                    // Inject CCR retrieve marker for compressed tiers
                    if (activeTier !== 'normal') {
                        compressedContent = this.retrieveCache.injectMarker(compressedContent, fileCode, normalizedFilePath, activeTier);
                    }
                    if (maxBudget) {
                        const { results } = await (0, budgetManager_1.enforceBudget)([{ filePath: normalizedFilePath, code: fileCode }], this.engine, maxBudget);
                        if (results.length > 0) {
                            compressedContent = results[0].content;
                            activeTier = results[0].tier;
                        }
                    }
                    await this.cache.flushToDisk();
                    this.metricsCollector.logMetrics(normalizedFilePath, fileCode, compressedContent, activeTier, 0, config.telemetryRotationLimit).catch(() => { });
                    // Generate Context Receipt
                    const rawTokens = (0, budgetManager_1.estimateTokens)(fileCode, normalizedFilePath);
                    const compTokens = (0, budgetManager_1.estimateTokens)(compressedContent, normalizedFilePath);
                    const receipt = this.receiptGenerator.generate('read_optimized_file', [
                        {
                            filePath: normalizedFilePath,
                            tier: activeTier,
                            rawTokens,
                            compressedTokens: compTokens,
                            savingsPct: rawTokens > 0 ? parseFloat((((rawTokens - compTokens) / rawTokens) * 100).toFixed(2)) : 0,
                            hasRetrieveMarker: compressedContent.includes('[tokenist:retrieve'),
                        },
                    ], [], maxBudget || null);
                    const footer = this.receiptGenerator.formatAsFooter(receipt);
                    return {
                        content: [{ type: 'text', text: `${compressedContent}${footer}` }],
                    };
                }
                if (name === 'get_file_diff_context') {
                    const rawPath = String(args?.filePath);
                    const contextLines = args?.contextLines ? Number(args.contextLines) : 10;
                    const normalizedFilePath = (0, guardrails_1.normalizePath)(rawPath);
                    const activeWorkspaceRoot = this.workspaceManager.findWorkspaceForFile(normalizedFilePath);
                    const diffResult = await (0, diffContext_1.getFileDiffContext)(normalizedFilePath, activeWorkspaceRoot, contextLines);
                    return {
                        content: [{ type: 'text', text: diffResult }],
                    };
                }
                if (name === 'reindex_workspace') {
                    const indexer = new workspaceIndexer_1.WorkspaceIndexer(this.workspaceRoot);
                    const matchedFiles = await indexer.indexWorkspace('.');
                    const importGraph = await this.getImportGraph();
                    importGraph.clear();
                    for (const file of matchedFiles) {
                        try {
                            const code = await fs_1.promises.readFile(file, 'utf-8');
                            await importGraph.parseFileImports(file, code, this.engine.getLoadedLanguages());
                            const normal = await this.engine.compress(code, file, 'normal');
                            const medium = await this.engine.compress(code, file, 'medium');
                            const aggressive = await this.engine.compress(code, file, 'aggressive');
                            await this.cache.set(file, { normal, medium, aggressive }, code);
                        }
                        catch { }
                    }
                    await this.cache.flushToDisk();
                    return {
                        content: [{ type: 'text', text: `Pre-indexed ${matchedFiles.length} source files across workspaces.` }],
                    };
                }
                if (name === 'get_token_savings_report') {
                    // Read telemetry ledger from disk and render dashboard
                    let telemetryRecords = [];
                    try {
                        const ledgerPath = path.resolve(this.workspaceRoot, 'telemetry_ledger.json');
                        const raw = await fs_1.promises.readFile(ledgerPath, 'utf-8');
                        telemetryRecords = JSON.parse(raw);
                    }
                    catch { }
                    const reportText = (0, terminalConsole_1.renderDashboard)(telemetryRecords);
                    return {
                        content: [{ type: 'text', text: reportText }],
                    };
                }
                if (name === 'prune_chat_history') {
                    const rawMessages = args?.messages;
                    const maxTurns = args?.maxTurns ? Number(args.maxTurns) : 5;
                    const pruned = (0, historyPruner_1.pruneHistory)(rawMessages || [], maxTurns);
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
                    const level = args?.level || 'compact';
                    const terse = (0, terseMode_1.getTersePrompt)(level);
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
                    let parsed;
                    try {
                        parsed = JSON.parse(rawSchemas);
                    }
                    catch {
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
                    const normalizedFilePath = (0, guardrails_1.normalizePath)(rawPath);
                    const activeWorkspaceRoot = this.workspaceManager.findWorkspaceForFile(normalizedFilePath);
                    const importGraph = await this.getImportGraph();
                    const indexer = new workspaceIndexer_1.WorkspaceIndexer(activeWorkspaceRoot);
                    const matchedFiles = await indexer.indexWorkspace('.');
                    for (const file of matchedFiles) {
                        try {
                            const code = await fs_1.promises.readFile(file, 'utf-8');
                            await importGraph.parseFileImports(file, code, this.engine.getLoadedLanguages());
                        }
                        catch { }
                    }
                    const report = importGraph.getBlastRadius(normalizedFilePath, maxHops);
                    const lines = [];
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
                    }
                    else {
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
                    }
                    else {
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
                throw new types_js_1.McpError(types_js_1.ErrorCode.MethodNotFound, `Unknown tool: ${name}`);
            }
            catch (error) {
                if (error instanceof types_js_1.McpError)
                    throw error;
                return {
                    content: [{ type: 'text', text: `Internal Engine Error: ${error.message}` }],
                    isError: true,
                };
            }
        });
    }
    async fetchRepositoryMap(dirPath, tier, maxTokenBudget, hasExplicitTier = false, activeWorkspaceRoot = process.cwd(), semanticQuery, activePrompt) {
        const config = (0, configLoader_1.getConfig)();
        const indexer = new workspaceIndexer_1.WorkspaceIndexer(activeWorkspaceRoot);
        const matchedFiles = await indexer.indexWorkspace(dirPath);
        const importGraph = await this.getImportGraph();
        importGraph.clear();
        const fileInputs = [];
        for (const filePath of matchedFiles) {
            try {
                const code = await fs_1.promises.readFile(filePath, 'utf-8');
                fileInputs.push({ filePath, code });
                await importGraph.parseFileImports(filePath, code, this.engine.getLoadedLanguages());
            }
            catch { }
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
            const fileContentsMap = new Map();
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
        const queryAdaptivePins = [];
        if (activePrompt) {
            const routed = (0, promptRouter_1.routePrompt)(activePrompt, fileInputs.map((f) => ({ filePath: f.filePath, signatures: f.code, rawCode: f.code })), (fp) => {
                const abs = path.resolve(fp);
                const outEdges = importGraph.getOutEdgesMap().get(abs);
                return outEdges ? Array.from(outEdges) : [];
            });
            for (const item of routed) {
                if (item.swapped) {
                    queryAdaptivePins.push(path.resolve(item.filePath));
                }
            }
        }
        const importanceMap = this.importanceScorer.calculatePageRank(importGraph);
        const isFilePinned = (absFile) => {
            const isStaticPin = isPinned(absFile, config.alwaysInclude || [], activeWorkspaceRoot);
            const isAdaptivePin = queryAdaptivePins.includes(path.resolve(absFile));
            return isStaticPin || isAdaptivePin;
        };
        const pinnedInputs = orderedInputs.filter((f) => isFilePinned(f.filePath));
        const regularInputs = orderedInputs.filter((f) => !isFilePinned(f.filePath));
        const finalResults = [];
        let pinnedTokensTotal = 0;
        for (const input of pinnedInputs) {
            let content = await this.cache.get(input.filePath, 'normal', input.code);
            if (!content) {
                content = await this.engine.compress(input.code, input.filePath, 'normal');
            }
            pinnedTokensTotal += (0, budgetManager_1.estimateTokens)(content);
            finalResults.push({
                filePath: input.filePath,
                content,
                tier: 'normal',
            });
        }
        const remainingBudget = maxTokenBudget ? Math.max(0, maxTokenBudget - pinnedTokensTotal) : undefined;
        if (remainingBudget !== undefined) {
            const { results } = await (0, budgetManager_1.enforceBudget)(regularInputs, this.engine, remainingBudget);
            results.forEach((r) => {
                finalResults.push({
                    filePath: r.filePath,
                    content: r.content,
                    tier: r.tier,
                });
            });
        }
        else {
            for (const input of regularInputs) {
                let activeTier = tier;
                const pageRankTier = importanceMap.get(path.resolve(input.filePath))?.recommendedTier;
                if (config.enableUsageLearning && !hasExplicitTier) {
                    activeTier = (0, tierTuner_1.getAutoTunedTier)(input.filePath, this.usageTracker, pageRankTier || tier);
                }
                else if (config.gitAwareTiers && !hasExplicitTier) {
                    activeTier = await (0, gitAwareTier_1.getGitAwareTier)(input.filePath, activeWorkspaceRoot, pageRankTier || tier);
                }
                else if (pageRankTier && !hasExplicitTier) {
                    activeTier = pageRankTier;
                }
                let content = await this.cache.get(input.filePath, activeTier, input.code);
                if (!content) {
                    const normal = await this.engine.compress(input.code, input.filePath, 'normal');
                    const medium = await this.engine.compress(input.code, input.filePath, 'medium');
                    const aggressive = await this.engine.compress(input.code, input.filePath, 'aggressive');
                    await this.cache.set(input.filePath, { normal, medium, aggressive }, input.code);
                    content = activeTier === 'normal' ? normal : activeTier === 'medium' ? medium : aggressive;
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
                    .catch(() => { });
            }
        }
        const results = [];
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
        // Generate Context Receipt
        const receipt = this.receiptGenerator.generate('fetch_optimized_repository_map', finalResults
            .filter((r) => r.tier !== 'omitted')
            .map((r) => {
            const rawCode = fileInputs.find((f) => f.filePath === r.filePath)?.code || '';
            const rawTok = (0, budgetManager_1.estimateTokens)(rawCode, r.filePath);
            const compTok = (0, budgetManager_1.estimateTokens)(r.content, r.filePath);
            return {
                filePath: r.filePath,
                tier: r.tier,
                rawTokens: rawTok,
                compressedTokens: compTok,
                savingsPct: rawTok > 0 ? parseFloat((((rawTok - compTok) / rawTok) * 100).toFixed(2)) : 0,
                hasRetrieveMarker: r.content.includes('[tokenist:retrieve'),
            };
        }), finalResults.filter((r) => r.tier === 'omitted').map((r) => r.filePath), maxTokenBudget || null);
        results.push(this.receiptGenerator.formatAsFooter(receipt));
        return results.join('\n');
    }
}
exports.McpCompressionServer = McpCompressionServer;
function hasExplicitArg(args, argName) {
    if (!args)
        return false;
    return Object.prototype.hasOwnProperty.call(args, argName) && args[argName] !== undefined;
}
