import * as path from 'path';
import { ImportGraph } from './importGraph';

export interface ImportanceScore {
  filePath: string;
  score: number; // PageRank score normalized [0.0, 1.0]
  recommendedTier: 'normal' | 'medium' | 'aggressive';
}

/**
 * Calculates PageRank-style centrality scores for files based on the import dependency graph.
 * High-centrality files (imported by many central components) are recommended for lower compression tiers.
 */
export class ImportanceScorer {
  /**
   * Runs PageRank power iteration over the import graph.
   * @param graph The workspace ImportGraph instance
   * @param dampingFactor PageRank damping factor (default: 0.85)
   * @param maxIterations Number of iterations (default: 20)
   */
  public calculatePageRank(
    graph: ImportGraph,
    dampingFactor = 0.85,
    maxIterations = 20
  ): Map<string, ImportanceScore> {
    const nodes = Array.from(graph.getAllNodes());
    const N = nodes.length;
    const scoresMap = new Map<string, ImportanceScore>();

    if (N === 0) {
      return scoresMap;
    }

    // Initial uniform probability distribution
    let rank = new Map<string, number>();
    for (const node of nodes) {
      rank.set(node, 1.0 / N);
    }

    const outEdgesMap = graph.getOutEdgesMap();

    // Power iteration
    for (let iter = 0; iter < maxIterations; iter++) {
      const newRank = new Map<string, number>();
      const teleport = (1.0 - dampingFactor) / N;

      for (const node of nodes) {
        newRank.set(node, teleport);
      }

      for (const u of nodes) {
        const currentRank = rank.get(u) || 0;
        const targets = outEdgesMap.get(u);
        const outDegree = targets ? targets.size : 0;

        if (outDegree > 0) {
          const share = (dampingFactor * currentRank) / outDegree;
          for (const v of targets!) {
            if (newRank.has(v)) {
              newRank.set(v, newRank.get(v)! + share);
            }
          }
        } else {
          // Dangling node handling: distribute rank evenly to all nodes
          const share = (dampingFactor * currentRank) / N;
          for (const v of nodes) {
            newRank.set(v, newRank.get(v)! + share);
          }
        }
      }

      rank = newRank;
    }

    // Find max score for normalization
    let maxScore = 0;
    for (const [, s] of rank.entries()) {
      if (s > maxScore) maxScore = s;
    }
    if (maxScore === 0) maxScore = 1;

    for (const node of nodes) {
      const normalized = (rank.get(node) || 0) / maxScore;
      let recommendedTier: 'normal' | 'medium' | 'aggressive' = 'aggressive';
      
      if (normalized > 0.15) {
        recommendedTier = 'normal';
      } else if (normalized > 0.05) {
        recommendedTier = 'medium';
      }

      scoresMap.set(path.resolve(node), {
        filePath: path.resolve(node),
        score: Math.round(normalized * 1000) / 1000,
        recommendedTier
      });
    }

    return scoresMap;
  }
}
