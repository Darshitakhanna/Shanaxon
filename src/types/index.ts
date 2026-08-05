export type CompressionTier = 'normal' | 'medium' | 'aggressive' | 'omitted';

export interface FileData {
  filePath: string;
  signatures: string;
  rawCode: string;
}

export interface RouteResult {
  filePath: string;
  content: string;
  swapped: boolean;
  isDependency?: boolean;
}

export interface TelemetryRecord {
  timestamp: string;
  filePath: string;
  rawTokens: number;
  compressedTokens: number;
  tier: CompressionTier;
  savingsPct: number;
  latencyMs: number;
}

export interface WorkspaceConfig {
  defaultTier: CompressionTier;
  maxTokenBudget?: number;
  showInlineSummary: boolean;
  enableSemanticRanking: boolean;
  gitAwareTiers?: boolean;
  pricingModel?: string;
  preserveCommentPatterns: string[];
  alwaysInclude: string[];
  excludePatterns: string[];
  languages: string[];
  cacheStrategy: 'memory' | 'disk' | 'shared';
  cachePath: string;
  maxCacheSizeMb: number;
  telemetryRotationLimit: number;
  workspaces?: string[];
  enableUsageLearning?: boolean;
}
