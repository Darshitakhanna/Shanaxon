import * as path from 'path';
import { promises as fs } from 'fs';
import { WorkspaceConfig } from '../types';

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
  cachePath: '.tokenist/cache.json',
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
  memoryPath: '.tokenist/memory.json',
  maxMemoryEntries: 500,
  tenantId: 'local',
  organizationId: 'default'
};

let loadedConfig: WorkspaceConfig | null = null;
let loadPromise: Promise<WorkspaceConfig> | null = null;

/**
 * Loads .tokenist.json from workspace root, applies TOKENIST_* env overrides, and populates cache.
 * Implements a thread-safe memoized promise to eliminate race conditions under concurrent initialization.
 */
export function loadConfig(workspaceRoot: string): Promise<WorkspaceConfig> {
  if (loadPromise) {
    return loadPromise;
  }

  loadPromise = (async () => {
    const configPath = path.resolve(workspaceRoot, '.tokenist.json');
    let parsed: any = {};

    try {
      const rawData = await fs.readFile(configPath, 'utf-8');
      parsed = JSON.parse(rawData);
    } catch {
      // Fall back to empty object
    }

    const parseBoolEnv = (val: string | undefined): boolean | undefined => {
      if (val === undefined) return undefined;
      return val.toLowerCase() === 'true' || val === '1';
    };

    loadedConfig = {
      defaultTier: (process.env.TOKENIST_DEFAULT_TIER || parsed.defaultTier || DEFAULT_CONFIG.defaultTier) as any,
      maxTokenBudget: process.env.TOKENIST_MAX_BUDGET 
        ? Number(process.env.TOKENIST_MAX_BUDGET) 
        : (typeof parsed.maxTokenBudget === 'number' ? parsed.maxTokenBudget : undefined),
      showInlineSummary: parseBoolEnv(process.env.TOKENIST_SHOW_INLINE_SUMMARY) ?? 
        (typeof parsed.showInlineSummary === 'boolean' ? parsed.showInlineSummary : DEFAULT_CONFIG.showInlineSummary),
      enableSemanticRanking: parseBoolEnv(process.env.TOKENIST_SEMANTIC_RANKING) ?? 
        (typeof parsed.enableSemanticRanking === 'boolean' ? parsed.enableSemanticRanking : DEFAULT_CONFIG.enableSemanticRanking),
      gitAwareTiers: parseBoolEnv(process.env.TOKENIST_GIT_AWARE_TIERS) ?? 
        (typeof parsed.gitAwareTiers === 'boolean' ? parsed.gitAwareTiers : DEFAULT_CONFIG.gitAwareTiers),
      pricingModel: process.env.TOKENIST_PRICING_MODEL || parsed.pricingModel || DEFAULT_CONFIG.pricingModel,
      preserveCommentPatterns: Array.isArray(parsed.preserveCommentPatterns) ? parsed.preserveCommentPatterns : DEFAULT_CONFIG.preserveCommentPatterns,
      alwaysInclude: Array.isArray(parsed.alwaysInclude) ? parsed.alwaysInclude : DEFAULT_CONFIG.alwaysInclude,
      excludePatterns: Array.isArray(parsed.excludePatterns) ? parsed.excludePatterns : DEFAULT_CONFIG.excludePatterns,
      languages: Array.isArray(parsed.languages) ? parsed.languages : DEFAULT_CONFIG.languages,
      cacheStrategy: (process.env.TOKENIST_CACHE_STRATEGY === 'memory' || process.env.TOKENIST_CACHE_STRATEGY === 'disk' || process.env.TOKENIST_CACHE_STRATEGY === 'shared')
        ? process.env.TOKENIST_CACHE_STRATEGY
        : ((parsed.cacheStrategy === 'memory' || parsed.cacheStrategy === 'disk' || parsed.cacheStrategy === 'shared') ? parsed.cacheStrategy : DEFAULT_CONFIG.cacheStrategy),
      cachePath: process.env.TOKENIST_CACHE_PATH || parsed.cachePath || DEFAULT_CONFIG.cachePath,
      maxCacheSizeMb: typeof parsed.maxCacheSizeMb === 'number' ? parsed.maxCacheSizeMb : DEFAULT_CONFIG.maxCacheSizeMb,
      telemetryRotationLimit: typeof parsed.telemetryRotationLimit === 'number' ? parsed.telemetryRotationLimit : DEFAULT_CONFIG.telemetryRotationLimit,
      workspaces: Array.isArray(parsed.workspaces) ? parsed.workspaces : DEFAULT_CONFIG.workspaces,
      enableUsageLearning: parseBoolEnv(process.env.TOKENIST_USAGE_LEARNING) ??
        (typeof parsed.enableUsageLearning === 'boolean' ? parsed.enableUsageLearning : DEFAULT_CONFIG.enableUsageLearning),

      // v6.0 Context Intelligence fields
      activeModel: process.env.TOKENIST_ACTIVE_MODEL || parsed.activeModel || DEFAULT_CONFIG.activeModel,
      enableIntelligencePipeline: parseBoolEnv(process.env.TOKENIST_INTELLIGENCE_PIPELINE) ??
        (typeof parsed.enableIntelligencePipeline === 'boolean' ? parsed.enableIntelligencePipeline : DEFAULT_CONFIG.enableIntelligencePipeline),
      enableCapabilityEqualization: parseBoolEnv(process.env.TOKENIST_CAPABILITY_EQUALIZATION) ??
        (typeof parsed.enableCapabilityEqualization === 'boolean' ? parsed.enableCapabilityEqualization : DEFAULT_CONFIG.enableCapabilityEqualization),
      enableCriticalMemory: parseBoolEnv(process.env.TOKENIST_CRITICAL_MEMORY) ??
        (typeof parsed.enableCriticalMemory === 'boolean' ? parsed.enableCriticalMemory : DEFAULT_CONFIG.enableCriticalMemory),
      enableQualityGate: parseBoolEnv(process.env.TOKENIST_QUALITY_GATE) ??
        (typeof parsed.enableQualityGate === 'boolean' ? parsed.enableQualityGate : DEFAULT_CONFIG.enableQualityGate),
      qualityGateMinRetention: typeof parsed.qualityGateMinRetention === 'number' ? parsed.qualityGateMinRetention : DEFAULT_CONFIG.qualityGateMinRetention,
      memoryPath: process.env.TOKENIST_MEMORY_PATH || parsed.memoryPath || DEFAULT_CONFIG.memoryPath,
      maxMemoryEntries: typeof parsed.maxMemoryEntries === 'number' ? parsed.maxMemoryEntries : DEFAULT_CONFIG.maxMemoryEntries,
      tenantId: process.env.TOKENIST_TENANT_ID || parsed.tenantId || DEFAULT_CONFIG.tenantId,
      organizationId: process.env.TOKENIST_ORG_ID || parsed.organizationId || DEFAULT_CONFIG.organizationId
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
    const parseBoolEnv = (val: string | undefined): boolean | undefined => {
      if (val === undefined) return undefined;
      return val.toLowerCase() === 'true' || val === '1';
    };
    return {
      ...DEFAULT_CONFIG,
      defaultTier: (process.env.TOKENIST_DEFAULT_TIER || DEFAULT_CONFIG.defaultTier) as any,
      maxTokenBudget: process.env.TOKENIST_MAX_BUDGET ? Number(process.env.TOKENIST_MAX_BUDGET) : undefined,
      showInlineSummary: parseBoolEnv(process.env.TOKENIST_SHOW_INLINE_SUMMARY) ?? DEFAULT_CONFIG.showInlineSummary,
      enableSemanticRanking: parseBoolEnv(process.env.TOKENIST_SEMANTIC_RANKING) ?? DEFAULT_CONFIG.enableSemanticRanking,
      gitAwareTiers: parseBoolEnv(process.env.TOKENIST_GIT_AWARE_TIERS) ?? DEFAULT_CONFIG.gitAwareTiers,
      pricingModel: process.env.TOKENIST_PRICING_MODEL || DEFAULT_CONFIG.pricingModel,
      enableUsageLearning: parseBoolEnv(process.env.TOKENIST_USAGE_LEARNING) ?? DEFAULT_CONFIG.enableUsageLearning,
      activeModel: process.env.TOKENIST_ACTIVE_MODEL || DEFAULT_CONFIG.activeModel,
      enableIntelligencePipeline: parseBoolEnv(process.env.TOKENIST_INTELLIGENCE_PIPELINE) ?? DEFAULT_CONFIG.enableIntelligencePipeline,
      enableCapabilityEqualization: parseBoolEnv(process.env.TOKENIST_CAPABILITY_EQUALIZATION) ?? DEFAULT_CONFIG.enableCapabilityEqualization,
      enableCriticalMemory: parseBoolEnv(process.env.TOKENIST_CRITICAL_MEMORY) ?? DEFAULT_CONFIG.enableCriticalMemory,
      enableQualityGate: parseBoolEnv(process.env.TOKENIST_QUALITY_GATE) ?? DEFAULT_CONFIG.enableQualityGate
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

