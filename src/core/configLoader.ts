import * as path from 'path';
import { promises as fs } from 'fs';
import { EconomicsConfig, OptimizerCostMode, WorkspaceConfig } from '../types';

const DEFAULT_ECONOMICS_CONFIG: EconomicsConfig = {
  enabled: true,
  optimizerCostMode: 'estimated',
  optimizerCostPerSecond: 0.001,
  optimizerComputeCostPerMs: 0.000001,
  minimumSavingsUsd: 0.00001,
  minimumSavingsPercent: 2.0,
  qualityFloor: 0.85,
  trackRetries: true,
  enablePreflight: true
};

const DEFAULT_CONFIG: WorkspaceConfig = {
  defaultTier: 'aggressive',
  showInlineSummary: true,
  enableSemanticRanking: false,
  gitAwareTiers: false,
  pricingModel: 'claude-sonnet-4',
  preserveCommentPatterns: ['TODO', 'FIXME', '@api', '@public'],
  alwaysInclude: [],
  excludePatterns: [],
  languages: ['typescript', 'javascript', 'python', 'go', 'rust', 'java', 'c_sharp'],
  cacheStrategy: 'disk',
  cachePath: '.shanaxon/cache.json',
  maxCacheSizeMb: 10,
  telemetryRotationLimit: 500,
  workspaces: [],
  enableUsageLearning: false,

  // v6.0 Context Intelligence Engine defaults (all enabled by default per requirement)
  activeModel: 'claude-3-7-sonnet',
  enableIntelligencePipeline: true,
  enableCapabilityEqualization: true,
  enableCriticalMemory: true,
  enableQualityGate: true,
  qualityGateMinRetention: 0.85,
  memoryPath: '.shanaxon/memory.json',
  maxMemoryEntries: 500,
  tenantId: 'local',
  organizationId: 'default',
  economics: { ...DEFAULT_ECONOMICS_CONFIG }
};

function parseBoolEnv(val: string | undefined): boolean | undefined {
  if (val === undefined) return undefined;
  return val.toLowerCase() === 'true' || val === '1';
}

function parseNumEnv(val: string | undefined): number | undefined {
  if (val === undefined || val.trim() === '') return undefined;
  const num = Number(val);
  return Number.isFinite(num) ? num : undefined;
}

function parseEconomicsConfig(parsedEconomics?: any): EconomicsConfig {
  const raw = parsedEconomics && typeof parsedEconomics === 'object' ? parsedEconomics : {};

  const validModes: OptimizerCostMode[] = ['estimated', 'workspace_configured', 'measured'];
  const optimizerCostMode: OptimizerCostMode = validModes.includes(raw.optimizerCostMode)
    ? raw.optimizerCostMode
    : DEFAULT_ECONOMICS_CONFIG.optimizerCostMode;

  const envCostPerSec = parseNumEnv(process.env.SHANAXON_OPTIMIZER_COST_PER_SECOND);
  const parsedCostPerSec = typeof raw.optimizerCostPerSecond === 'number' && Number.isFinite(raw.optimizerCostPerSecond)
    ? raw.optimizerCostPerSecond
    : undefined;
  const parsedCostPerMs = typeof raw.optimizerComputeCostPerMs === 'number' && Number.isFinite(raw.optimizerComputeCostPerMs)
    ? raw.optimizerComputeCostPerMs
    : undefined;

  const optimizerCostPerSecond =
    envCostPerSec ??
    parsedCostPerSec ??
    (parsedCostPerMs !== undefined ? parsedCostPerMs * 1000 : DEFAULT_ECONOMICS_CONFIG.optimizerCostPerSecond!);

  const optimizerComputeCostPerMs =
    envCostPerSec !== undefined
      ? envCostPerSec / 1000
      : (parsedCostPerMs ?? optimizerCostPerSecond / 1000);

  return {
    enabled:
      parseBoolEnv(process.env.SHANAXON_ECONOMICS_ENABLED) ??
      (typeof raw.enabled === 'boolean' ? raw.enabled : DEFAULT_ECONOMICS_CONFIG.enabled),
    optimizerCostMode,
    optimizerCostPerSecond,
    optimizerComputeCostPerMs,
    minimumSavingsUsd:
      parseNumEnv(process.env.SHANAXON_MIN_SAVINGS_USD) ??
      (typeof raw.minimumSavingsUsd === 'number' && Number.isFinite(raw.minimumSavingsUsd)
        ? raw.minimumSavingsUsd
        : DEFAULT_ECONOMICS_CONFIG.minimumSavingsUsd),
    minimumSavingsPercent:
      parseNumEnv(process.env.SHANAXON_MIN_SAVINGS_PCT) ??
      (typeof raw.minimumSavingsPercent === 'number' && Number.isFinite(raw.minimumSavingsPercent)
        ? raw.minimumSavingsPercent
        : DEFAULT_ECONOMICS_CONFIG.minimumSavingsPercent),
    qualityFloor:
      parseNumEnv(process.env.SHANAXON_QUALITY_FLOOR) ??
      (typeof raw.qualityFloor === 'number' && Number.isFinite(raw.qualityFloor)
        ? raw.qualityFloor
        : DEFAULT_ECONOMICS_CONFIG.qualityFloor),
    trackRetries: typeof raw.trackRetries === 'boolean' ? raw.trackRetries : DEFAULT_ECONOMICS_CONFIG.trackRetries,
    enablePreflight: typeof raw.enablePreflight === 'boolean' ? raw.enablePreflight : DEFAULT_ECONOMICS_CONFIG.enablePreflight
  };
}

let loadedConfig: WorkspaceConfig | null = null;
let loadPromise: Promise<WorkspaceConfig> | null = null;

/**
 * Loads .shanaxon.json from workspace root, applies SHANAXON_* env overrides, and populates cache.
 * Implements a thread-safe memoized promise to eliminate race conditions under concurrent initialization.
 */
export function loadConfig(workspaceRoot: string): Promise<WorkspaceConfig> {
  if (loadPromise) {
    return loadPromise;
  }

  loadPromise = (async () => {
    const configPath = path.resolve(workspaceRoot, '.shanaxon.json');
    let parsed: any = {};

    try {
      const rawData = await fs.readFile(configPath, 'utf-8');
      parsed = JSON.parse(rawData);
    } catch {
      // Fall back to empty object
    }

    loadedConfig = {
      defaultTier: (process.env.SHANAXON_DEFAULT_TIER || parsed.defaultTier || DEFAULT_CONFIG.defaultTier) as any,
      maxTokenBudget: process.env.SHANAXON_MAX_BUDGET 
        ? Number(process.env.SHANAXON_MAX_BUDGET) 
        : (typeof parsed.maxTokenBudget === 'number' ? parsed.maxTokenBudget : undefined),
      showInlineSummary: parseBoolEnv(process.env.SHANAXON_SHOW_INLINE_SUMMARY) ?? 
        (typeof parsed.showInlineSummary === 'boolean' ? parsed.showInlineSummary : DEFAULT_CONFIG.showInlineSummary),
      enableSemanticRanking: parseBoolEnv(process.env.SHANAXON_SEMANTIC_RANKING) ?? 
        (typeof parsed.enableSemanticRanking === 'boolean' ? parsed.enableSemanticRanking : DEFAULT_CONFIG.enableSemanticRanking),
      gitAwareTiers: parseBoolEnv(process.env.SHANAXON_GIT_AWARE_TIERS) ?? 
        (typeof parsed.gitAwareTiers === 'boolean' ? parsed.gitAwareTiers : DEFAULT_CONFIG.gitAwareTiers),
      pricingModel: process.env.SHANAXON_PRICING_MODEL || parsed.pricingModel || DEFAULT_CONFIG.pricingModel,
      preserveCommentPatterns: Array.isArray(parsed.preserveCommentPatterns) ? parsed.preserveCommentPatterns : DEFAULT_CONFIG.preserveCommentPatterns,
      alwaysInclude: Array.isArray(parsed.alwaysInclude) ? parsed.alwaysInclude : DEFAULT_CONFIG.alwaysInclude,
      excludePatterns: Array.isArray(parsed.excludePatterns) ? parsed.excludePatterns : DEFAULT_CONFIG.excludePatterns,
      languages: Array.isArray(parsed.languages) ? parsed.languages : DEFAULT_CONFIG.languages,
      cacheStrategy: (process.env.SHANAXON_CACHE_STRATEGY === 'memory' || process.env.SHANAXON_CACHE_STRATEGY === 'disk' || process.env.SHANAXON_CACHE_STRATEGY === 'shared')
        ? process.env.SHANAXON_CACHE_STRATEGY
        : ((parsed.cacheStrategy === 'memory' || parsed.cacheStrategy === 'disk' || parsed.cacheStrategy === 'shared') ? parsed.cacheStrategy : DEFAULT_CONFIG.cacheStrategy),
      cachePath: process.env.SHANAXON_CACHE_PATH || parsed.cachePath || DEFAULT_CONFIG.cachePath,
      maxCacheSizeMb: typeof parsed.maxCacheSizeMb === 'number' ? parsed.maxCacheSizeMb : DEFAULT_CONFIG.maxCacheSizeMb,
      telemetryRotationLimit: typeof parsed.telemetryRotationLimit === 'number' ? parsed.telemetryRotationLimit : DEFAULT_CONFIG.telemetryRotationLimit,
      workspaces: Array.isArray(parsed.workspaces) ? parsed.workspaces : DEFAULT_CONFIG.workspaces,
      enableUsageLearning: parseBoolEnv(process.env.SHANAXON_USAGE_LEARNING) ??
        (typeof parsed.enableUsageLearning === 'boolean' ? parsed.enableUsageLearning : DEFAULT_CONFIG.enableUsageLearning),

      // v6.0 Context Intelligence fields
      activeModel: process.env.SHANAXON_ACTIVE_MODEL || parsed.activeModel || DEFAULT_CONFIG.activeModel,
      enableIntelligencePipeline: parseBoolEnv(process.env.SHANAXON_INTELLIGENCE_PIPELINE) ??
        (typeof parsed.enableIntelligencePipeline === 'boolean' ? parsed.enableIntelligencePipeline : DEFAULT_CONFIG.enableIntelligencePipeline),
      enableCapabilityEqualization: parseBoolEnv(process.env.SHANAXON_CAPABILITY_EQUALIZATION) ??
        (typeof parsed.enableCapabilityEqualization === 'boolean' ? parsed.enableCapabilityEqualization : DEFAULT_CONFIG.enableCapabilityEqualization),
      enableCriticalMemory: parseBoolEnv(process.env.SHANAXON_CRITICAL_MEMORY) ??
        (typeof parsed.enableCriticalMemory === 'boolean' ? parsed.enableCriticalMemory : DEFAULT_CONFIG.enableCriticalMemory),
      enableQualityGate: parseBoolEnv(process.env.SHANAXON_QUALITY_GATE) ??
        (typeof parsed.enableQualityGate === 'boolean' ? parsed.enableQualityGate : DEFAULT_CONFIG.enableQualityGate),
      qualityGateMinRetention: typeof parsed.qualityGateMinRetention === 'number' ? parsed.qualityGateMinRetention : DEFAULT_CONFIG.qualityGateMinRetention,
      memoryPath: process.env.SHANAXON_MEMORY_PATH || parsed.memoryPath || DEFAULT_CONFIG.memoryPath,
      maxMemoryEntries: typeof parsed.maxMemoryEntries === 'number' ? parsed.maxMemoryEntries : DEFAULT_CONFIG.maxMemoryEntries,
      tenantId: process.env.SHANAXON_TENANT_ID || parsed.tenantId || DEFAULT_CONFIG.tenantId,
      organizationId: process.env.SHANAXON_ORG_ID || parsed.organizationId || DEFAULT_CONFIG.organizationId,

      // v6.1 Economics Engine configuration
      economics: parseEconomicsConfig(parsed.economics)
    };

    return loadedConfig;
  })();

  return loadPromise;
}

/**
 * Gets the current loaded config, or populates with ENV overrides if accessed before async load finishes.
 */
export function getConfig(): WorkspaceConfig {
  if (!loadedConfig) {
    return {
      ...DEFAULT_CONFIG,
      defaultTier: (process.env.SHANAXON_DEFAULT_TIER || DEFAULT_CONFIG.defaultTier) as any,
      maxTokenBudget: process.env.SHANAXON_MAX_BUDGET ? Number(process.env.SHANAXON_MAX_BUDGET) : undefined,
      showInlineSummary: parseBoolEnv(process.env.SHANAXON_SHOW_INLINE_SUMMARY) ?? DEFAULT_CONFIG.showInlineSummary,
      enableSemanticRanking: parseBoolEnv(process.env.SHANAXON_SEMANTIC_RANKING) ?? DEFAULT_CONFIG.enableSemanticRanking,
      gitAwareTiers: parseBoolEnv(process.env.SHANAXON_GIT_AWARE_TIERS) ?? DEFAULT_CONFIG.gitAwareTiers,
      pricingModel: process.env.SHANAXON_PRICING_MODEL || DEFAULT_CONFIG.pricingModel,
      enableUsageLearning: parseBoolEnv(process.env.SHANAXON_USAGE_LEARNING) ?? DEFAULT_CONFIG.enableUsageLearning,
      activeModel: process.env.SHANAXON_ACTIVE_MODEL || DEFAULT_CONFIG.activeModel,
      enableIntelligencePipeline: parseBoolEnv(process.env.SHANAXON_INTELLIGENCE_PIPELINE) ?? DEFAULT_CONFIG.enableIntelligencePipeline,
      enableCapabilityEqualization: parseBoolEnv(process.env.SHANAXON_CAPABILITY_EQUALIZATION) ?? DEFAULT_CONFIG.enableCapabilityEqualization,
      enableCriticalMemory: parseBoolEnv(process.env.SHANAXON_CRITICAL_MEMORY) ?? DEFAULT_CONFIG.enableCriticalMemory,
      enableQualityGate: parseBoolEnv(process.env.SHANAXON_QUALITY_GATE) ?? DEFAULT_CONFIG.enableQualityGate,
      economics: parseEconomicsConfig()
    };
  }
  return loadedConfig;
}

/**
 * Resets memoized loader state (for test suite isolation).
 */
export function resetConfigState() {
  loadedConfig = null;
  loadPromise = null;
}

