import { CostBreakdown, EconomicEvaluation, OptimizerCost } from '../types';
import { OptimizationCandidate } from './paretoSelector';

export interface EvaluateEconomicGateOptions {
  baseline: CostBreakdown;
  selectedCandidate: OptimizationCandidate | null;
  optimizer: OptimizerCost;
  minimumSavingsUsd?: number;
  minimumSavingsPercent?: number;
  retryCost?: number;
  qualityRiskFailed?: boolean;
  criticalLossFailed?: boolean;
}

/**
 * Evaluates whether an optimization candidate is economically beneficial compared to the baseline.
 * Enforces hard rules: quality checks, minimum savings thresholds, optimizer overhead inclusion, and retry costs.
 */
export function evaluateEconomicGate(options: EvaluateEconomicGateOptions): EconomicEvaluation {
  const minSavingsUsd = options.minimumSavingsUsd ?? 0.00001;
  const minSavingsPct = options.minimumSavingsPercent ?? 2.0;
  const retryCost = options.retryCost || 0;

  const baselineTotalCost = parseFloat(options.baseline.totalCost.toFixed(6));

  if (options.criticalLossFailed) {
    return createEvaluation({
      baseline: options.baseline,
      optimized: emptyBreakdown(),
      optimizer: options.optimizer,
      baselineTotalCost,
      tokenistTotalCost: baselineTotalCost,
      absoluteSavings: 0,
      savingsPercent: 0,
      isEconomicallyEffective: false,
      decision: 'FALLBACK_BASELINE',
      reason: 'CRITICAL_INFORMATION_LOSS',
    });
  }

  if (options.qualityRiskFailed || !options.selectedCandidate) {
    return createEvaluation({
      baseline: options.baseline,
      optimized: emptyBreakdown(),
      optimizer: options.optimizer,
      baselineTotalCost,
      tokenistTotalCost: baselineTotalCost,
      absoluteSavings: 0,
      savingsPercent: 0,
      isEconomicallyEffective: false,
      decision: 'FALLBACK_BASELINE',
      reason: 'QUALITY_RISK_TOO_HIGH',
    });
  }

  if (options.baseline.pricingStatus === 'PRICE_UNAVAILABLE') {
    return createEvaluation({
      baseline: options.baseline,
      optimized: {
        inputTokens: options.selectedCandidate.inputTokens,
        outputTokens: options.selectedCandidate.estimatedOutputTokens || 0,
        inputCost: 0,
        outputCost: 0,
        retryCost: 0,
        totalCost: 0,
        pricingStatus: 'PRICE_UNAVAILABLE',
      },
      optimizer: options.optimizer,
      baselineTotalCost: 0,
      tokenistTotalCost: 0,
      absoluteSavings: 0,
      savingsPercent: 0,
      isEconomicallyEffective: false,
      decision: 'INSUFFICIENT_PRICING_DATA',
      reason: 'UNKNOWN_MODEL_PRICING',
    });
  }

  const optimizedModelCost = options.selectedCandidate.estimatedModelCost;
  const tokenistTotalCost = parseFloat((optimizedModelCost + options.optimizer.cost + retryCost).toFixed(6));
  const absoluteSavings = parseFloat((baselineTotalCost - tokenistTotalCost).toFixed(6));
  const savingsPercent = baselineTotalCost > 0 ? parseFloat(((absoluteSavings / baselineTotalCost) * 100).toFixed(2)) : 0;

  const optimizedBreakdown: CostBreakdown = {
    inputTokens: options.selectedCandidate.inputTokens,
    outputTokens: options.selectedCandidate.estimatedOutputTokens || 0,
    inputCost: parseFloat((options.selectedCandidate.estimatedModelCost * 0.7).toFixed(6)), // approx breakdown
    outputCost: parseFloat((options.selectedCandidate.estimatedModelCost * 0.3).toFixed(6)),
    retryCost,
    totalCost: tokenistTotalCost,
    pricingStatus: 'KNOWN',
  };

  // Check retry cost explicitly
  if (retryCost > 0 && retryCost >= (baselineTotalCost - (optimizedModelCost + options.optimizer.cost))) {
    return createEvaluation({
      baseline: options.baseline,
      optimized: optimizedBreakdown,
      optimizer: options.optimizer,
      baselineTotalCost,
      tokenistTotalCost,
      absoluteSavings,
      savingsPercent,
      isEconomicallyEffective: false,
      decision: 'FALLBACK_BASELINE',
      reason: 'RETRY_COST_EXCEEDED_SAVINGS',
    });
  }

  // Check total cost vs baseline
  if (tokenistTotalCost >= baselineTotalCost) {
    let reason: EconomicEvaluation['reason'] = 'NO_MEANINGFUL_SAVINGS';
    if (optimizedModelCost < options.baseline.totalCost && tokenistTotalCost >= baselineTotalCost) {
      reason = 'OPTIMIZATION_OVERHEAD_TOO_HIGH';
    } else if (baselineTotalCost > 0 && Math.abs(absoluteSavings) < 0.0001) {
      reason = 'BASELINE_ALREADY_OPTIMAL';
    }

    return createEvaluation({
      baseline: options.baseline,
      optimized: optimizedBreakdown,
      optimizer: options.optimizer,
      baselineTotalCost,
      tokenistTotalCost,
      absoluteSavings,
      savingsPercent,
      isEconomicallyEffective: false,
      decision: 'FALLBACK_BASELINE',
      reason,
    });
  }

  // Check minimum meaningful savings threshold
  if (absoluteSavings < minSavingsUsd || savingsPercent < minSavingsPct) {
    return createEvaluation({
      baseline: options.baseline,
      optimized: optimizedBreakdown,
      optimizer: options.optimizer,
      baselineTotalCost,
      tokenistTotalCost,
      absoluteSavings,
      savingsPercent,
      isEconomicallyEffective: false,
      decision: 'FALLBACK_BASELINE',
      reason: 'NO_MEANINGFUL_SAVINGS',
    });
  }

  return createEvaluation({
    baseline: options.baseline,
    optimized: optimizedBreakdown,
    optimizer: options.optimizer,
    baselineTotalCost,
    tokenistTotalCost,
    absoluteSavings,
    savingsPercent,
    isEconomicallyEffective: true,
    decision: 'OPTIMIZE',
    reason: 'SAVINGS_ACCEPTED',
  });
}

function emptyBreakdown(): CostBreakdown {
  return {
    inputTokens: 0,
    outputTokens: 0,
    inputCost: 0,
    outputCost: 0,
    retryCost: 0,
    totalCost: 0,
    pricingStatus: 'PRICE_UNAVAILABLE',
  };
}

function createEvaluation(data: EconomicEvaluation): EconomicEvaluation {
  return {
    ...data,
    projectedSavings: data.absoluteSavings,
    projectedSavingsPercent: data.savingsPercent,
  };
}
