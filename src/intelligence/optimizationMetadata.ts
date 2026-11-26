import { OptimizationReceipt, TaskType } from '../types';

let lastReceipt: OptimizationReceipt | null = null;

/**
 * Creates and stores a structured OptimizationReceipt.
 */
export function createOptimizationReceipt(data: Partial<OptimizationReceipt>): OptimizationReceipt {
  const orig = data.originalTokenEstimate || 0;
  const finalTokens = data.finalTokenEstimate || 0;

  const receipt: OptimizationReceipt = {
    timestamp: data.timestamp || new Date().toISOString(),
    taskId: data.taskId || `task_${Date.now()}`,
    taskType: data.taskType || 'unknown',
    model: data.model || 'claude-3-7-sonnet',
    originalTokenEstimate: orig,
    finalTokenEstimate: finalTokens,
    compressionRatio: data.compressionRatio || (orig > 0 ? Number((finalTokens / orig).toFixed(2)) : 1.0),
    savingsPct: data.savingsPct || (orig > 0 ? Number(((1 - finalTokens / orig) * 100).toFixed(1)) : 0),
    qualityGatePassed: data.qualityGatePassed ?? true,
    qualityScore: data.qualityScore ?? 1.0,
    evidenceCompleteness: data.evidenceCompleteness ?? 1.0,
    itemsIncluded: data.itemsIncluded || 0,
    itemsSummarized: data.itemsSummarized || 0,
    itemsOmitted: data.itemsOmitted || 0,
    executionTimeMs: data.executionTimeMs || 0,
    warnings: data.warnings || [],

    // Financial and Economics additions
    baselineTotalCost: data.baselineTotalCost,
    tokenistTotalCost: data.tokenistTotalCost,
    absoluteSavings: data.absoluteSavings,
    optimizerCost: data.optimizerCost,
    isEconomicallyEffective: data.isEconomicallyEffective,
    economics: data.economics
  };

  lastReceipt = receipt;
  return receipt;
}

/**
 * Stores a pre-built OptimizationReceipt as the latest session receipt.
 */
export function setLastOptimizationReceipt(receipt: OptimizationReceipt): void {
  lastReceipt = receipt;
}

/**
 * Retrieves the last generated optimization receipt.
 */
export function getLastOptimizationReceipt(): OptimizationReceipt | null {
  return lastReceipt;
}
