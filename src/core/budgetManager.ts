import { CodeCompressionEngine } from './parser';
import { Tokenizer } from './tokenizer';

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

/**
 * Estimates BPE tokens using language-aware Tokenizer.
 */
export function estimateTokens(text: string, filePath?: string): number {
  return Tokenizer.countTokens(text, filePath);
}

/**
 * Greedily allocates compression tiers to files to stay within maxTokenBudget.
 */
export async function enforceBudget(
  files: FileInput[],
  engine: CodeCompressionEngine,
  maxTokenBudget: number,
  importanceScores?: Map<string, number>
): Promise<{ results: BudgetResult[]; budgetExceeded: boolean }> {
  // Initialize all files as normal tier
  const results: BudgetResult[] = [];
  
  for (const file of files) {
    const normalContent = await engine.compress(file.code, file.filePath, 'normal');
    const tokens = estimateTokens(normalContent, file.filePath);
    results.push({
      filePath: file.filePath,
      content: normalContent,
      tier: 'normal',
      estimatedTokens: tokens
    });
  }

  let totalTokens = results.reduce((sum, r) => sum + r.estimatedTokens, 0);
  if (totalTokens <= maxTokenBudget) {
    return { results, budgetExceeded: false };
  }

  // 1. Escalate to Medium (Greedily escalate largest normal file to medium)
  while (totalTokens > maxTokenBudget) {
    const normalFiles = results.filter((r) => r.tier === 'normal');
    if (normalFiles.length === 0) break;

    normalFiles.sort((a, b) => b.estimatedTokens - a.estimatedTokens);
    const target = normalFiles[0];

    const fileInput = files.find((f) => f.filePath === target.filePath)!;
    const mediumContent = await engine.compress(fileInput.code, fileInput.filePath, 'medium');
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
    const mediumFiles = results.filter((r) => r.tier === 'medium');
    if (mediumFiles.length === 0) break;

    mediumFiles.sort((a, b) => b.estimatedTokens - a.estimatedTokens);
    const target = mediumFiles[0];

    const fileInput = files.find((f) => f.filePath === target.filePath)!;
    const aggressiveContent = await engine.compress(fileInput.code, fileInput.filePath, 'aggressive');
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
