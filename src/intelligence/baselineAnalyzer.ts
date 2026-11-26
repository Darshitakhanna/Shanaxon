import { CostBreakdown } from '../types';
import { calculateModelCost } from './economicsEngine';
import { Tokenizer } from '../core/tokenizer';

export interface BaselineAnalysisOptions {
  model: string;
  provider?: string;
  originalCode?: string;
  filePath?: string;
  explicitInputTokens?: number;
  explicitOutputTokens?: number;
  outputTokenRatio?: number;
  confidence?: 'measured' | 'estimated';
}

export interface BaselineAnalysisResult {
  inputTokens: number;
  outputTokens: number;
  breakdown: CostBreakdown;
  confidence: 'measured' | 'estimated';
}

/**
 * Analyzes or estimates the baseline model token usage and financial cost before optimization.
 */
export function analyzeBaseline(options: BaselineAnalysisOptions): BaselineAnalysisResult {
  let inputTokens = options.explicitInputTokens || 0;
  
  if (!options.explicitInputTokens && options.originalCode) {
    inputTokens = Tokenizer.countTokens(options.originalCode, options.filePath);
  }

  let outputTokens = options.explicitOutputTokens;
  if (outputTokens === undefined) {
    // Default estimated output tokens is 5% of input tokens or a minimum of 250 tokens
    const ratio = options.outputTokenRatio ?? 0.05;
    outputTokens = Math.max(250, Math.ceil(inputTokens * ratio));
  }

  const confidence = options.confidence || (options.explicitInputTokens !== undefined ? 'measured' : 'estimated');

  const breakdown = calculateModelCost({
    provider: options.provider,
    model: options.model,
    inputTokens,
    outputTokens,
  });

  return {
    inputTokens,
    outputTokens,
    breakdown,
    confidence,
  };
}
