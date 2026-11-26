import { calculateModelCost, calculateOptimizerCost, ModelPricingRegistry } from './economicsEngine';

export interface PreflightOptions {
  baselineInputTokens: number;
  model: string;
  provider?: string;
  estimatedCompressionRatio?: number; // e.g. 0.5 means 50% tokens remaining
  estimatedOptimizerLatencyMs?: number;
  minimumSavingsUsd?: number;
  minimumSavingsPercent?: number;
}

export interface PreflightDecision {
  shouldOptimize: boolean;
  projectedBaselineCost?: number;
  projectedOptimizedCost?: number;
  projectedOptimizerCost?: number;
  projectedSavings?: number;
  reason:
    | 'LIKELY_BENEFICIAL'
    | 'TOO_SMALL_REQUEST'
    | 'BASELINE_ALREADY_EFFICIENT'
    | 'PROJECTED_NEGATIVE_SAVINGS'
    | 'UNKNOWN_PRICING';
}

/**
 * Pre-evaluates whether optimization is likely to yield financial savings before running heavy AST compression.
 */
export function shouldAttemptOptimization(options: PreflightOptions): PreflightDecision {
  // Conservative threshold: Requests under 150 tokens are usually too small to benefit
  if (options.baselineInputTokens < 150) {
    return {
      shouldOptimize: false,
      reason: 'TOO_SMALL_REQUEST',
    };
  }

  const registry = ModelPricingRegistry.getInstance();
  const pricingStatus = registry.getPricingStatus(options.provider, options.model);

  if (pricingStatus === 'PRICE_UNAVAILABLE') {
    return {
      shouldOptimize: false,
      reason: 'UNKNOWN_PRICING',
    };
  }

  const estRatio = options.estimatedCompressionRatio ?? 0.5;
  const estLatency = options.estimatedOptimizerLatencyMs ?? 10;
  const minSavingsUsd = options.minimumSavingsUsd ?? 0.00001;
  const minSavingsPct = options.minimumSavingsPercent ?? 2.0;
  const estOutputTokens = Math.max(100, Math.ceil(options.baselineInputTokens * 0.05));

  const baselineEst = calculateModelCost({
    provider: options.provider,
    model: options.model,
    inputTokens: options.baselineInputTokens,
    outputTokens: estOutputTokens,
  });

  const optTokens = Math.ceil(options.baselineInputTokens * estRatio);
  const optimizedEst = calculateModelCost({
    provider: options.provider,
    model: options.model,
    inputTokens: optTokens,
    outputTokens: estOutputTokens,
  });

  const optimizerCostObj = calculateOptimizerCost({ latencyMs: estLatency });

  const projectedBaselineCost = baselineEst.totalCost;
  const projectedOptimizedCost = optimizedEst.totalCost;
  const projectedOptimizerCost = optimizerCostObj.cost;

  const totalTokenistCost = projectedOptimizedCost + projectedOptimizerCost;
  const projectedSavings = parseFloat((projectedBaselineCost - totalTokenistCost).toFixed(6));
  const projectedSavingsPct = projectedBaselineCost > 0 ? (projectedSavings / projectedBaselineCost) * 100 : 0;

  if (projectedSavings <= 0) {
    return {
      shouldOptimize: false,
      projectedBaselineCost,
      projectedOptimizedCost,
      projectedOptimizerCost,
      projectedSavings,
      reason: 'PROJECTED_NEGATIVE_SAVINGS',
    };
  }

  if (projectedSavings < minSavingsUsd || projectedSavingsPct < minSavingsPct) {
    return {
      shouldOptimize: false,
      projectedBaselineCost,
      projectedOptimizedCost,
      projectedOptimizerCost,
      projectedSavings,
      reason: 'BASELINE_ALREADY_EFFICIENT',
    };
  }

  return {
    shouldOptimize: true,
    projectedBaselineCost,
    projectedOptimizedCost,
    projectedOptimizerCost,
    projectedSavings,
    reason: 'LIKELY_BENEFICIAL',
  };
}
