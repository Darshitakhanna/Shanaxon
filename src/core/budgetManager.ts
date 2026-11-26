import { CodeCompressionEngine } from './parser';
import { Tokenizer } from './tokenizer';
import { CompressionTier, TaskProfile } from '../types';
import { adjustTierForModel } from '../intelligence/modelPolicy';
import { evaluateQualityGate } from '../intelligence/qualityGate';

export interface FileInput {
  filePath: string;
  code: string;
}

export interface BudgetResult {
  filePath: string;
  content: string;
  tier: 'normal' | 'medium' | 'aggressive' | 'omitted';
  estimatedTokens: number;
}

export interface BudgetEnforceOptions {
  activeModel?: string;
  enableQualityGate?: boolean;
  taskProfile?: TaskProfile;
  qualityGateMinRetention?: number;
  initialTiers?: Map<string, CompressionTier>;
}

/**
 * Estimates BPE tokens using language-aware Tokenizer.
 */
export function estimateTokens(text: string, filePath?: string): number {
  return Tokenizer.countTokens(text, filePath);
}

/**
 * Greedily allocates compression tiers to files to stay within maxTokenBudget,
 * respecting optional ModelPolicy tier caps and QualityGate retention thresholds.
 */
export async function enforceBudget(
  files: FileInput[],
  engine: CodeCompressionEngine,
  maxTokenBudget: number,
  importanceScores?: Map<string, number>,
  options?: BudgetEnforceOptions
): Promise<{ results: BudgetResult[]; budgetExceeded: boolean }> {
  const results: BudgetResult[] = [];
  const blockedTiers = new Map<string, Set<CompressionTier>>();

  const isTierAllowed = (filePath: string, candidateTier: 'normal' | 'medium' | 'aggressive'): boolean => {
    if (blockedTiers.get(filePath)?.has(candidateTier)) {
      return false;
    }
    if (options?.activeModel) {
      const adjusted = adjustTierForModel(candidateTier, options.activeModel);
      if (adjusted !== candidateTier) {
        return false;
      }
    }
    return true;
  };

  const passesQuality = (rawCode: string, compressedCode: string, candidateTier: 'normal' | 'medium' | 'aggressive'): boolean => {
    if (options?.enableQualityGate === false || !options?.taskProfile) {
      return true;
    }
    const qg = evaluateQualityGate(
      rawCode,
      compressedCode,
      options.taskProfile,
      candidateTier,
      options.qualityGateMinRetention
    );
    return qg.passed;
  };

  for (const file of files) {
    const initialTier = options?.initialTiers?.get(file.filePath);
    if (initialTier === 'omitted') {
      const omittedText = `[Omitted by Shanaxon Context Intelligence Engine]`;
      results.push({
        filePath: file.filePath,
        content: omittedText,
        tier: 'omitted',
        estimatedTokens: estimateTokens(omittedText, file.filePath)
      });
      continue;
    }

    let startTier: 'normal' | 'medium' | 'aggressive' =
      initialTier === 'medium' || initialTier === 'aggressive' ? initialTier : 'normal';
    if (options?.activeModel && startTier !== 'normal') {
      const adjusted = adjustTierForModel(startTier, options.activeModel);
      startTier = adjusted === 'omitted' ? 'normal' : adjusted;
    }

    let content = await engine.compress(file.code, file.filePath, startTier);
    if (startTier !== 'normal' && !passesQuality(file.code, content, startTier)) {
      startTier = 'normal';
      content = await engine.compress(file.code, file.filePath, 'normal');
    }

    const tokens = estimateTokens(content, file.filePath);
    results.push({
      filePath: file.filePath,
      content,
      tier: startTier,
      estimatedTokens: tokens
    });
  }

  let totalTokens = results.reduce((sum, r) => sum + r.estimatedTokens, 0);
  if (totalTokens <= maxTokenBudget) {
    return { results, budgetExceeded: false };
  }

  // 1. Escalate to Medium (Greedily escalate largest normal file to medium)
  while (totalTokens > maxTokenBudget) {
    const normalFiles = results.filter((r) => r.tier === 'normal' && isTierAllowed(r.filePath, 'medium'));
    if (normalFiles.length === 0) break;

    normalFiles.sort((a, b) => b.estimatedTokens - a.estimatedTokens);
    const target = normalFiles[0];

    const fileInput = files.find((f) => f.filePath === target.filePath)!;
    const mediumContent = await engine.compress(fileInput.code, fileInput.filePath, 'medium');

    if (!passesQuality(fileInput.code, mediumContent, 'medium')) {
      const set = blockedTiers.get(target.filePath) || new Set<CompressionTier>();
      set.add('medium');
      blockedTiers.set(target.filePath, set);
      continue;
    }

    const newTokens = estimateTokens(mediumContent, fileInput.filePath);
    target.content = mediumContent;
    target.tier = 'medium';
    target.estimatedTokens = newTokens;

    totalTokens = results.reduce((sum, r) => sum + r.estimatedTokens, 0);
  }

  if (totalTokens <= maxTokenBudget) {
    return { results, budgetExceeded: false };
  }

  // 2. Escalate to Aggressive (Greedily escalate largest medium file to aggressive)
  while (totalTokens > maxTokenBudget) {
    const mediumFiles = results.filter((r) => r.tier === 'medium' && isTierAllowed(r.filePath, 'aggressive'));
    if (mediumFiles.length === 0) break;

    mediumFiles.sort((a, b) => b.estimatedTokens - a.estimatedTokens);
    const target = mediumFiles[0];

    const fileInput = files.find((f) => f.filePath === target.filePath)!;
    const aggressiveContent = await engine.compress(fileInput.code, fileInput.filePath, 'aggressive');

    if (!passesQuality(fileInput.code, aggressiveContent, 'aggressive')) {
      const set = blockedTiers.get(target.filePath) || new Set<CompressionTier>();
      set.add('aggressive');
      blockedTiers.set(target.filePath, set);
      continue;
    }

    const newTokens = estimateTokens(aggressiveContent, fileInput.filePath);
    target.content = aggressiveContent;
    target.tier = 'aggressive';
    target.estimatedTokens = newTokens;

    totalTokens = results.reduce((sum, r) => sum + r.estimatedTokens, 0);
  }

  if (totalTokens <= maxTokenBudget) {
    return { results, budgetExceeded: false };
  }

  // 3. Drop files (Omit lowest importance / highest token impact files first)
  // Sort candidates by importance ascending (lowest PageRank score dropped first),
  // then by estimatedTokens descending (largest token hog dropped first).
  const dropCandidates = results
    .filter(r => r.tier !== 'omitted')
    .sort((a, b) => {
      const importanceA = importanceScores?.get(a.filePath) ?? 0.5;
      const importanceB = importanceScores?.get(b.filePath) ?? 0.5;
      if (importanceA !== importanceB) {
        return importanceA - importanceB; // Lowest importance first
      }
      return b.estimatedTokens - a.estimatedTokens; // Highest token count first
    });

  for (const fileToOmit of dropCandidates) {
    if (totalTokens <= maxTokenBudget) {
      break;
    }

    const target = results.find(r => r.filePath === fileToOmit.filePath)!;
    totalTokens -= target.estimatedTokens;
    target.content = `[File "${target.filePath}" omitted to stay within token budget]`;
    target.tier = 'omitted';
    target.estimatedTokens = estimateTokens(target.content, target.filePath);
    totalTokens += target.estimatedTokens;
  }

  return {
    results,
    budgetExceeded: totalTokens > maxTokenBudget
  };
}
