import { CompressionTier } from '../types';

export interface OptimizationCandidate {
  tier: CompressionTier;
  inputTokens: number;
  estimatedOutputTokens?: number;
  qualityScore: number;
  criticalInformationLoss: number;
  dependencyRetention: number;
  symbolRetention: number;
  evidenceCoverage: number;
  hallucinationRisk?: number;
  estimatedModelCost: number;
  optimizerCost: number;
  totalProjectedCost: number;
  warnings?: string[];
  compressedContent?: string;
}

export interface ParetoSelectorOptions {
  candidates: OptimizationCandidate[];
  qualityFloor?: number;
  minDependencyRetention?: number;
  minSymbolRetention?: number;
}

export interface ParetoSelectorResult {
  selectedCandidate: OptimizationCandidate | null;
  rejectedCandidates: Array<{ candidate: OptimizationCandidate; reason: string }>;
}

/**
 * Evaluates candidate optimization tiers and selects the cheapest candidate that strictly satisfies quality and safety boundaries.
 */
export function evaluateParetoTradeoff(options: ParetoSelectorOptions): ParetoSelectorResult {
  const qualityFloor = options.qualityFloor ?? 0.85;
  const minDependencyRetention = options.minDependencyRetention ?? 0.80;
  const minSymbolRetention = options.minSymbolRetention ?? 0.70;

  const validCandidates: OptimizationCandidate[] = [];
  const rejectedCandidates: Array<{ candidate: OptimizationCandidate; reason: string }> = [];

  for (const candidate of options.candidates) {
    if (candidate.criticalInformationLoss > 0) {
      rejectedCandidates.push({ candidate, reason: 'CRITICAL_INFORMATION_LOSS' });
      continue;
    }

    if (candidate.qualityScore < qualityFloor) {
      rejectedCandidates.push({
        candidate,
        reason: `Quality score ${candidate.qualityScore.toFixed(2)} is below floor ${qualityFloor}`,
      });
      continue;
    }

    if (candidate.dependencyRetention < minDependencyRetention) {
      rejectedCandidates.push({
        candidate,
        reason: `Dependency retention ${candidate.dependencyRetention.toFixed(2)} is below threshold ${minDependencyRetention}`,
      });
      continue;
    }

    if (candidate.symbolRetention < minSymbolRetention) {
      rejectedCandidates.push({
        candidate,
        reason: `Symbol retention ${candidate.symbolRetention.toFixed(2)} is below threshold ${minSymbolRetention}`,
      });
      continue;
    }

    validCandidates.push(candidate);
  }

  if (validCandidates.length === 0) {
    return { selectedCandidate: null, rejectedCandidates };
  }

  // Sort valid candidates by totalProjectedCost ascending.
  // If costs match, pick higher quality score.
  validCandidates.sort((a, b) => {
    if (Math.abs(a.totalProjectedCost - b.totalProjectedCost) > 0.000001) {
      return a.totalProjectedCost - b.totalProjectedCost;
    }
    return b.qualityScore - a.qualityScore;
  });

  return {
    selectedCandidate: validCandidates[0],
    rejectedCandidates,
  };
}
