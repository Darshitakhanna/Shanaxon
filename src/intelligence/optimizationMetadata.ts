import { OptimizationReceipt, TaskType } from '../types';

let lastReceipt: OptimizationReceipt | null = null;

/**
 * Creates and stores a structured OptimizationReceipt.
 */
export function createOptimizationReceipt(data: Partial<OptimizationReceipt>): OptimizationReceipt {
  const receipt: OptimizationReceipt = {
    timestamp: data.timestamp || new Date().toISOString(),
    taskId: data.taskId || `task_${Date.now()}`,
    taskType: data.taskType || 'unknown',
    model: data.model || 'claude-3-7-sonnet',
    originalTokenEstimate: data.originalTokenEstimate || 0,
    finalTokenEstimate: data.finalTokenEstimate || 0,
    compressionRatio: data.compressionRatio || (data.originalTokenEstimate ? Number((data.finalTokenEstimate / data.originalTokenEstimate).toFixed(2)) : 1.0),
    savingsPct: data.savingsPct || (data.originalTokenEstimate ? Number(((1 - data.finalTokenEstimate / data.originalTokenEstimate) * 100).toFixed(1)) : 0),
    qualityGatePassed: data.qualityGatePassed ?? true,
    qualityScore: data.qualityScore ?? 1.0,
    evidenceCompleteness: data.evidenceCompleteness ?? 1.0,
    itemsIncluded: data.itemsIncluded || 0,
    itemsSummarized: data.itemsSummarized || 0,
    itemsOmitted: data.itemsOmitted || 0,
    executionTimeMs: data.executionTimeMs || 0,
    warnings: data.warnings || []
  };

  lastReceipt = receipt;
  return receipt;
}

/**
 * Retrieves the last generated optimization receipt.
 */
export function getLastOptimizationReceipt(): OptimizationReceipt | null {
  return lastReceipt;
}
