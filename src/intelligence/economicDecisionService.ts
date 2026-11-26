import {
  CompressionTier,
  EconomicEvaluation,
  OptimizationReceipt,
  TaskProfile,
  WorkspaceConfig,
} from '../types';
import { Tokenizer } from '../core/tokenizer';
import { analyzeBaseline } from './baselineAnalyzer';
import { shouldAttemptOptimization, PreflightDecision } from './economicPreflight';
import { evaluateParetoTradeoff, OptimizationCandidate } from './paretoSelector';
import { evaluateEconomicGate } from './economicGate';
import { calculateModelCost, calculateOptimizerCost, ModelPricingRegistry } from './economicsEngine';
import { AttemptTracker } from './attemptTracker';
import { evaluateQualityGate, QualityGateResult } from './qualityGate';
import { adjustTierForModel } from './modelPolicy';
import { createOptimizationReceipt } from './optimizationMetadata';

export type OptimizableTier = 'normal' | 'medium' | 'aggressive';

export interface EconomicDecisionInput {
  workspaceRoot: string;
  config: WorkspaceConfig;
  activeModel?: string;
  baselineText: string;
  filePath?: string;
  candidateOutputs: Partial<Record<OptimizableTier, string>>;
  qualityScores?: Partial<Record<OptimizableTier, QualityGateResult>>;
  taskProfile?: TaskProfile;
  optimizerDurationMs: number;
  sessionId?: string;
  taskId?: string;
  itemsIncluded?: number;
  itemsSummarized?: number;
  itemsOmitted?: number;
  evidenceCompleteness?: number;
}

export interface EconomicDecisionOutput {
  decision: 'OPTIMIZE' | 'FALLBACK_BASELINE';
  selectedTier: OptimizableTier;
  outputText: string;
  receipt: OptimizationReceipt;
  preflight?: PreflightDecision;
  economicEvaluation?: EconomicEvaluation;
  qualityScore: number;
  qualityPassed: boolean;
  warnings: string[];
}

const DEFAULT_TASK_PROFILE: TaskProfile = {
  taskType: 'unknown',
  complexityScore: 0.5,
  confidence: 0.5,
  detectedKeywords: [],
  recommendedBudgetMultiplier: 1.0,
  minRetentionThreshold: 0.85,
  reasoning: 'Default fallback task profile',
};

/**
 * Resolves the effective pricing model name by preferring activeModel if known in ModelPricingRegistry,
 * otherwise falling back to config.pricingModel.
 */
function resolvePricingModel(activeModel: string | undefined, config: WorkspaceConfig): string {
  const registry = ModelPricingRegistry.getInstance();
  const primary = activeModel || config.activeModel || config.pricingModel || 'claude-3-7-sonnet';
  if (registry.getPricingStatus(undefined, primary) === 'KNOWN') {
    return primary;
  }
  if (config.pricingModel && registry.getPricingStatus(undefined, config.pricingModel) === 'KNOWN') {
    return config.pricingModel;
  }
  return primary;
}

/**
 * Shared v6.1 Economic Decision Pipeline used by live MCP tool handlers.
 * Runs baseline cost analysis, preflight abstention, quality gate scoring,
 * Pareto tier selection, optimizer overhead & retry accounting, and the Economic Gate.
 */
export function evaluateEconomicDecision(input: EconomicDecisionInput): EconomicDecisionOutput {
  const {
    config,
    baselineText,
    filePath,
    candidateOutputs,
    qualityScores,
    optimizerDurationMs,
    sessionId,
    taskId,
  } = input;

  const econConfig = config.economics;
  const minSavingsUsd = econConfig?.minimumSavingsUsd ?? 0.00001;
  const minSavingsPercent = econConfig?.minimumSavingsPercent ?? 2.0;
  const qualityFloor = econConfig?.qualityFloor ?? config.qualityGateMinRetention ?? 0.85;
  const enablePreflight = econConfig?.enablePreflight !== false;
  const trackRetries = econConfig?.trackRetries !== false;
  const costPerSec =
    econConfig?.optimizerCostPerSecond ??
    (econConfig?.optimizerComputeCostPerMs !== undefined
      ? econConfig.optimizerComputeCostPerMs * 1000
      : 0.001);

  const model = resolvePricingModel(input.activeModel, config);
  const taskProfile = input.taskProfile || {
    ...DEFAULT_TASK_PROFILE,
    minRetentionThreshold: qualityFloor,
  };

  // 1. Baseline token count & USD cost
  const baselineInputTokens = Tokenizer.countTokens(baselineText, filePath);
  const baselineAnalysis = analyzeBaseline({
    model,
    originalCode: baselineText,
    filePath,
    explicitInputTokens: baselineInputTokens,
  });

  // 2. Preflight check
  let preflight: PreflightDecision | undefined;
  if (enablePreflight) {
    preflight = shouldAttemptOptimization({
      baselineInputTokens,
      model,
      estimatedOptimizerLatencyMs: Math.max(1, Math.round(optimizerDurationMs)),
      minimumSavingsUsd: minSavingsUsd,
      minimumSavingsPercent: minSavingsPercent,
    });

    if (!preflight.shouldOptimize) {
      const preflightWarnings = [preflight.reason];
      const receipt = createOptimizationReceipt({
        timestamp: new Date().toISOString(),
        taskId,
        taskType: taskProfile.taskType,
        model,
        originalTokenEstimate: baselineInputTokens,
        finalTokenEstimate: baselineInputTokens,
        compressionRatio: 1.0,
        savingsPct: 0,
        qualityGatePassed: true,
        qualityScore: 1.0,
        evidenceCompleteness: input.evidenceCompleteness ?? 1.0,
        itemsIncluded: input.itemsIncluded ?? 1,
        itemsSummarized: input.itemsSummarized ?? 0,
        itemsOmitted: input.itemsOmitted ?? 0,
        executionTimeMs: Math.round(optimizerDurationMs),
        warnings: preflightWarnings,
        baselineTotalCost: baselineAnalysis.breakdown.totalCost,
        tokenistTotalCost: baselineAnalysis.breakdown.totalCost,
        absoluteSavings: 0,
        optimizerCost: 0,
        isEconomicallyEffective: false,
        economics: {
          optimizationDecision: 'ABSTAINED',
          decisionReason: preflight.reason,
        },
      });

      return {
        decision: 'FALLBACK_BASELINE',
        selectedTier: 'normal',
        outputText: baselineText,
        receipt,
        preflight,
        qualityScore: 1.0,
        qualityPassed: true,
        warnings: preflightWarnings,
      };
    }
  }

  // 3. Optimizer overhead & retry cost
  const optimizerCost = calculateOptimizerCost({
    latencyMs: Math.max(0, optimizerDurationMs),
    mode: econConfig?.optimizerCostMode ?? 'estimated',
    configuredRateMs: costPerSec / 1000,
  });

  const retryKey = taskId || sessionId;
  const retryCost = trackRetries && retryKey ? AttemptTracker.getInstance().calculateRetryCost(retryKey) : 0;

  // 4. Score quality & build Pareto candidates across model-policy-allowed tiers
  const tiers: OptimizableTier[] = ['normal', 'medium', 'aggressive'];
  const candidates: OptimizationCandidate[] = [];
  const qualityMap = new Map<OptimizableTier, QualityGateResult>();
  const allWarnings: string[] = [];

  for (const tier of tiers) {
    const candidateText = candidateOutputs[tier];
    if (candidateText === undefined) continue;

    // Enforce ModelPolicy maxAllowedTier
    if (adjustTierForModel(tier as CompressionTier, model) !== tier) {
      continue;
    }

    let qg: QualityGateResult;
    if (qualityScores?.[tier]) {
      qg = qualityScores[tier]!;
    } else if (config.enableQualityGate === false) {
      qg = {
        passed: true,
        score: 1.0,
        retentionPct: 100,
        warnings: [],
        reason: 'Quality gate disabled in config.',
        signals: {
          symbolScore: 1.0,
          dependencyScore: 1.0,
          signatureScore: 1.0,
          constraintCommentScore: 1.0,
        },
      };
    } else {
      qg = evaluateQualityGate(baselineText, candidateText, taskProfile, tier, qualityFloor);
    }

    qualityMap.set(tier, qg);
    if (qg.warnings.length > 0) {
      allWarnings.push(...qg.warnings);
    }

    const candTokens = Tokenizer.countTokens(candidateText, filePath);
    const estOutputTokens = baselineAnalysis.outputTokens;
    const candModelCost = calculateModelCost({
      model,
      inputTokens: candTokens,
      outputTokens: estOutputTokens,
    });

    const criticalLoss = qg.warnings.some((w) => w.includes('CRITICAL')) ? 1 : 0;

    candidates.push({
      tier,
      inputTokens: candTokens,
      estimatedOutputTokens: estOutputTokens,
      qualityScore: qg.score,
      criticalInformationLoss: criticalLoss,
      dependencyRetention: qg.signals?.dependencyScore ?? 1.0,
      symbolRetention: qg.signals?.symbolScore ?? 1.0,
      evidenceCoverage: input.evidenceCompleteness ?? 1.0,
      estimatedModelCost: candModelCost.totalCost,
      optimizerCost: optimizerCost.cost,
      totalProjectedCost: parseFloat((candModelCost.totalCost + optimizerCost.cost + retryCost).toFixed(6)),
      warnings: qg.warnings,
      compressedContent: candidateText,
    });
  }

  // 5. Pareto tradeoff selection
  const pareto = evaluateParetoTradeoff({
    candidates,
    qualityFloor,
  });

  for (const rej of pareto.rejectedCandidates) {
    allWarnings.push(`[Pareto rejected ${rej.candidate.tier}] ${rej.reason}`);
  }

  // 6. Economic Gate evaluation
  const economicEvaluation = evaluateEconomicGate({
    baseline: baselineAnalysis.breakdown,
    selectedCandidate: pareto.selectedCandidate,
    optimizer: optimizerCost,
    minimumSavingsUsd: minSavingsUsd,
    minimumSavingsPercent: minSavingsPercent,
    retryCost,
    qualityRiskFailed: pareto.selectedCandidate === null,
  });

  if (
    economicEvaluation.decision !== 'OPTIMIZE' ||
    !pareto.selectedCandidate ||
    pareto.selectedCandidate.compressedContent === undefined
  ) {
    const fallbackWarnings = Array.from(new Set([...allWarnings, economicEvaluation.reason]));
    const receipt = createOptimizationReceipt({
      timestamp: new Date().toISOString(),
      taskId,
      taskType: taskProfile.taskType,
      model,
      originalTokenEstimate: baselineInputTokens,
      finalTokenEstimate: baselineInputTokens,
      compressionRatio: 1.0,
      savingsPct: 0,
      qualityGatePassed: pareto.selectedCandidate !== null,
      qualityScore: pareto.selectedCandidate?.qualityScore ?? 1.0,
      evidenceCompleteness: input.evidenceCompleteness ?? 1.0,
      itemsIncluded: input.itemsIncluded ?? 1,
      itemsSummarized: input.itemsSummarized ?? 0,
      itemsOmitted: input.itemsOmitted ?? 0,
      executionTimeMs: Math.round(optimizerDurationMs),
      warnings: fallbackWarnings,
      baselineTotalCost: economicEvaluation.baselineTotalCost,
      tokenistTotalCost: economicEvaluation.baselineTotalCost,
      absoluteSavings: 0,
      optimizerCost: optimizerCost.cost,
      isEconomicallyEffective: false,
      economics: {
        projected: economicEvaluation,
        actual: economicEvaluation,
        optimizationDecision: 'BASELINE',
        decisionReason: economicEvaluation.reason,
      },
    });

    return {
      decision: 'FALLBACK_BASELINE',
      selectedTier: 'normal',
      outputText: baselineText,
      receipt,
      preflight,
      economicEvaluation,
      qualityScore: receipt.qualityScore,
      qualityPassed: receipt.qualityGatePassed,
      warnings: fallbackWarnings,
    };
  }

  const selectedTier = pareto.selectedCandidate.tier as OptimizableTier;
  const selectedText = pareto.selectedCandidate.compressedContent;
  const finalTokens = pareto.selectedCandidate.inputTokens;
  const selectedQuality = qualityMap.get(selectedTier);

  const compressionRatio = finalTokens > 0 ? parseFloat((baselineInputTokens / finalTokens).toFixed(2)) : 1.0;
  const savingsPct =
    baselineInputTokens > 0
      ? parseFloat((((baselineInputTokens - finalTokens) / baselineInputTokens) * 100).toFixed(2))
      : 0;

  const receipt = createOptimizationReceipt({
    timestamp: new Date().toISOString(),
    taskId,
    taskType: taskProfile.taskType,
    model,
    originalTokenEstimate: baselineInputTokens,
    finalTokenEstimate: finalTokens,
    compressionRatio,
    savingsPct,
    qualityGatePassed: selectedQuality ? selectedQuality.passed : true,
    qualityScore: selectedQuality ? selectedQuality.score : pareto.selectedCandidate.qualityScore,
    evidenceCompleteness: input.evidenceCompleteness ?? 1.0,
    itemsIncluded: input.itemsIncluded ?? (selectedTier === 'normal' ? 1 : 0),
    itemsSummarized: input.itemsSummarized ?? (selectedTier === 'normal' ? 0 : 1),
    itemsOmitted: input.itemsOmitted ?? 0,
    executionTimeMs: Math.round(optimizerDurationMs),
    warnings: Array.from(new Set(allWarnings)),
    baselineTotalCost: economicEvaluation.baselineTotalCost,
    tokenistTotalCost: economicEvaluation.tokenistTotalCost,
    absoluteSavings: economicEvaluation.absoluteSavings,
    optimizerCost: optimizerCost.cost,
    isEconomicallyEffective: true,
    economics: {
      projected: economicEvaluation,
      actual: economicEvaluation,
      optimizationDecision: 'OPTIMIZED',
      decisionReason: economicEvaluation.reason,
    },
  });

  return {
    decision: 'OPTIMIZE',
    selectedTier,
    outputText: selectedText,
    receipt,
    preflight,
    economicEvaluation,
    qualityScore: receipt.qualityScore,
    qualityPassed: receipt.qualityGatePassed,
    warnings: receipt.warnings,
  };
}
