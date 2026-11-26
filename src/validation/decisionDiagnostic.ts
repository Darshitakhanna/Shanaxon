import { RealProviderTaskResult } from './realProviderExperiment';

export interface DecisionDiagnosticReport {
  totalTasksAnalyzed: number;

  // Decision Counts
  optimizedCount: number;
  fallbackBaselineCount: number;
  skipTooSmallCount: number;
  optimizationRatePct: number;

  // Breakdown by Decision Reason
  decisionReasonsBreakdown: Record<string, number>;

  // Context Size Distribution
  contextSizeDistribution: {
    under150Tokens: number;
    tokens150To500: number;
    tokens500To2000: number;
    over2000Tokens: number;
  };

  // Why FALLBACK_BASELINE Occurred
  fallbackCategoryBreakdown: {
    qualityRiskFailed: number;
    noMeaningfulSavings: number;
    overheadTooHigh: number;
    baselineAlreadyOptimal: number;
    retryExceededSavings: number;
    unknownPricing: number;
  };

  // Recommendations
  recommendations: string[];
}

export class DecisionDiagnosticEngine {
  public analyze(results: RealProviderTaskResult[]): DecisionDiagnosticReport {
    let optimizedCount = 0;
    let fallbackBaselineCount = 0;
    let skipTooSmallCount = 0;

    const reasonsMap: Record<string, number> = {};

    let under150 = 0;
    let tokens150To500 = 0;
    let tokens500To2000 = 0;
    let over2000 = 0;

    const fallbackCat = {
      qualityRiskFailed: 0,
      noMeaningfulSavings: 0,
      overheadTooHigh: 0,
      baselineAlreadyOptimal: 0,
      retryExceededSavings: 0,
      unknownPricing: 0,
    };

    for (const r of results) {
      const decision = r.optimizer.decision;
      const reason = r.optimizer.decisionReason;

      if (decision === 'OPTIMIZE') {
        optimizedCount++;
      } else if (decision === 'SKIP_TOO_SMALL') {
        skipTooSmallCount++;
      } else {
        fallbackBaselineCount++;
      }

      reasonsMap[reason] = (reasonsMap[reason] || 0) + 1;

      // Token distribution based on preflight / baseline tokens
      const bTokens = r.baseline.inputTokens;
      if (bTokens < 150) under150++;
      else if (bTokens < 500) tokens150To500++;
      else if (bTokens <= 2000) tokens500To2000++;
      else over2000++;

      // Categorize fallback reason
      if (decision === 'FALLBACK_BASELINE') {
        if (reason.includes('QUALITY')) fallbackCat.qualityRiskFailed++;
        else if (reason.includes('OVERHEAD')) fallbackCat.overheadTooHigh++;
        else if (reason.includes('OPTIMAL')) fallbackCat.baselineAlreadyOptimal++;
        else if (reason.includes('RETRY')) fallbackCat.retryExceededSavings++;
        else if (reason.includes('PRICING')) fallbackCat.unknownPricing++;
        else fallbackCat.noMeaningfulSavings++;
      }
    }

    const total = results.length;
    const optimizationRatePct = total > 0 ? parseFloat(((optimizedCount / total) * 100).toFixed(2)) : 0;

    const recommendations: string[] = [];

    if (under150 > total * 0.3) {
      recommendations.push(
        `High percentage of tasks (${under150}/${total}) are under 150 tokens. The preflight gate correctly skips optimization on tiny requests.`
      );
    }

    if (fallbackCat.overheadTooHigh > 0) {
      recommendations.push(
        `${fallbackCat.overheadTooHigh} tasks were rejected because optimizer wall-clock overhead ($0.001/sec) exceeded projected token savings. Consider caching AST trees for repeat files.`
      );
    }

    if (fallbackCat.noMeaningfulSavings > 0) {
      recommendations.push(
        `${fallbackCat.noMeaningfulSavings} tasks failed the minimum savings threshold ($0.00001 or 2% default). On low-cost models like gpt-4o-mini, larger context sizes or higher compression yield are required for net financial savings.`
      );
    }

    if (optimizationRatePct > 40) {
      recommendations.push(
        `Optimization rate is strong (${optimizationRatePct}%). The Economic Gate safely accepted high-yield candidates.`
      );
    } else {
      recommendations.push(
        `Optimization rate is ${optimizationRatePct}%. Tokenist strictly enforces financial safety (net savings > $0), protecting users from paying more for optimizer overhead than they save on LLM tokens.`
      );
    }

    return {
      totalTasksAnalyzed: total,
      optimizedCount,
      fallbackBaselineCount,
      skipTooSmallCount,
      optimizationRatePct,
      decisionReasonsBreakdown: reasonsMap,
      contextSizeDistribution: {
        under150Tokens: under150,
        tokens150To500: tokens150To500,
        tokens500To2000: tokens500To2000,
        over2000Tokens: over2000,
      },
      fallbackCategoryBreakdown: fallbackCat,
      recommendations,
    };
  }
}
