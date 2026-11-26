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

export type TaskType = 
  | 'architecture_design' 
  | 'bug_investigation' 
  | 'refactoring' 
  | 'new_feature' 
  | 'one_off_query' 
  | 'unknown';

export interface TaskProfile {
  taskType: TaskType;
  complexityScore: number; // 0.0 - 1.0
  confidence: number;      // 0.0 - 1.0
  detectedKeywords: string[];
  recommendedBudgetMultiplier: number;
  minRetentionThreshold: number;
  reasoning: string;
}

export type ContextCategory = 
  | 'architecture' 
  | 'code' 
  | 'memory' 
  | 'history' 
  | 'schema' 
  | 'dependency';

export type EvidenceType = 
  | 'known_fact' 
  | 'inferred_fact' 
  | 'uncertain_assumption' 
  | 'missing_context';

export type ContextItemDisposition = 'must_include' | 'normal' | 'summarize' | 'omit';

export interface ContextItem {
  id: string;
  category: ContextCategory;
  sourcePath?: string;
  rawContent: string;
  importanceScore: number; // 0.0 - 1.0
  scoreBreakdown: {
    taskRelevance: number;
    graphCentrality: number;
    semanticSimilarity: number;
    recency: number;
    memoryBoost: number;
  };
  disposition: ContextItemDisposition;
  evidenceType: EvidenceType;
  metadata?: Record<string, any>;
}

export interface ContextImportanceResult {
  items: ContextItem[];
  totalItems: number;
  topItemsCount: number;
  averageImportance: number;
}

export interface EvidenceItem {
  id: string;
  type: EvidenceType;
  statement: string;
  source?: string;
  confidence: number;
  impact: 'high' | 'medium' | 'low';
}

export interface EvidenceStatus {
  totalKnown: number;
  totalInferred: number;
  totalUncertain: number;
  totalMissing: number;
  completenessScore: number; // 0.0 - 1.0
  warnings: string[];
}

export interface EvidenceReport {
  items: EvidenceItem[];
  status: EvidenceStatus;
  recommendations: string[];
}

export interface ModelPolicy {
  modelName: string;
  maxContextTokens: number;
  maxOutputTokens: number;
  optimalTier: CompressionTier;
  maxAllowedTier: CompressionTier;
  contextWindowSafetyFactor: number;
  reasoningPreservation: boolean;
}

export interface TenantContext {
  tenantId: string;
  organizationId: string;
  workspaceId: string;
}

export interface OptimizationReceipt {
  timestamp: string;
  taskId?: string;
  taskType: TaskType;
  model: string;
  originalTokenEstimate: number;
  finalTokenEstimate: number;
  compressionRatio: number;
  savingsPct: number;
  qualityGatePassed: boolean;
  qualityScore: number;
  evidenceCompleteness: number;
  itemsIncluded: number;
  itemsSummarized: number;
  itemsOmitted: number;
  executionTimeMs: number;
  warnings: string[];
}

export type FailurePattern = 
  | 'repetitive_retry' 
  | 'context_exhaustion' 
  | 'missing_dependency_hallucination' 
  | 'conflicting_constraints';

export interface FailureMitigationAction {
  pattern: FailurePattern;
  detectedCount: number;
  mitigationApplied: string;
  recommendedAction: string;
}

export type MemoryCategory = 'decision' | 'constraint' | 'dependency' | 'architecture' | 'gotcha';

export interface MemoryEntry {
  id: string;
  category: MemoryCategory;
  title: string;
  content: string;
  createdAt: string;
  updatedAt: string;
  tags: string[];
  priority: 'high' | 'medium' | 'low';
  tenantId?: string;
  workspaceId?: string;
  isStale?: boolean;
  contradictedBy?: string;
}

export interface CriticalMemoryState {
  entries: MemoryEntry[];
  version: number;
  lastModified: string;
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

  // v6.0 Context Intelligence Engine additions
  activeModel?: string;
  enableIntelligencePipeline?: boolean;
  enableCapabilityEqualization?: boolean;
  enableCriticalMemory?: boolean;
  enableQualityGate?: boolean;
  qualityGateMinRetention?: number;
  memoryPath?: string;
  maxMemoryEntries?: number;
  tenantId?: string;
  organizationId?: string;
}

