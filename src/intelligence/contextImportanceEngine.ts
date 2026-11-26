import { ContextImportanceResult, ContextItem, ContextItemDisposition, EvidenceType, MemoryEntry, TaskProfile } from '../types';

export interface RawContextInput {
  id: string;
  category: 'architecture' | 'code' | 'memory' | 'history' | 'schema' | 'dependency';
  sourcePath?: string;
  rawContent: string;
  mtimeMs?: number;
  graphScore?: number;
  metadata?: Record<string, any>;
}

/**
 * Calculates composite relevance score of text content against a set of keywords and query terms.
 */
function calculateTextRelevance(content: string, terms: string[]): number {
  if (terms.length === 0 || !content) return 0.5;
  const contentLower = content.toLowerCase();
  let matches = 0;
  
  for (const term of terms) {
    if (contentLower.includes(term.toLowerCase())) {
      matches++;
    }
  }

  const ratio = matches / terms.length;
  return Math.min(1.0, 0.2 + ratio * 0.8);
}

export interface ImportanceScoringWeights {
  taskRelevance: number;      // default 0.40
  graphCentrality: number;    // default 0.25
  semanticSimilarity: number; // default 0.20
  recency: number;            // default 0.10
  memoryBoost: number;        // default 0.05
}

/**
 * Computes exact importance scores and assigns tier dispositions for all candidate context items.
 */
export function scoreContextImportance(
  userPrompt: string,
  rawItems: RawContextInput[],
  taskProfile: TaskProfile,
  graphCentralityMap: Record<string, number> = {},
  criticalMemories: MemoryEntry[] = [],
  customWeights?: Partial<ImportanceScoringWeights>
): ContextImportanceResult {
  const weights: ImportanceScoringWeights = {
    taskRelevance: customWeights?.taskRelevance ?? 0.40,
    graphCentrality: customWeights?.graphCentrality ?? 0.25,
    semanticSimilarity: customWeights?.semanticSimilarity ?? 0.20,
    recency: customWeights?.recency ?? 0.10,
    memoryBoost: customWeights?.memoryBoost ?? 0.05
  };
  const queryTerms = userPrompt.toLowerCase().split(/\W+/).filter(t => t.length > 2);
  const now = Date.now();

  const memorySourcePaths = new Set(
    criticalMemories.flatMap(m => [m.title, m.content]).join(' ').match(/[\w/-]+\.\w+/g) || []
  );

  const items: ContextItem[] = rawItems.map(item => {
    // 1. Task Relevance (weight: 0.40)
    const taskRelevance = calculateTextRelevance(
      item.rawContent,
      [...queryTerms, ...taskProfile.detectedKeywords]
    );

    // 2. Graph Centrality (weight: 0.25)
    let graphCentrality = item.graphScore ?? 0;
    if (item.sourcePath && graphCentralityMap[item.sourcePath] !== undefined) {
      graphCentrality = graphCentralityMap[item.sourcePath];
    }
    graphCentrality = Math.min(1.0, Math.max(0.0, graphCentrality));

    // 3. Semantic Similarity / Keyword Match (weight: 0.20)
    const semanticSimilarity = calculateTextRelevance(item.rawContent, queryTerms);

    // 4. Recency (weight: 0.10)
    let recency = 0.5;
    if (item.mtimeMs) {
      const ageHours = (now - item.mtimeMs) / (1000 * 60 * 60);
      if (ageHours < 1) recency = 1.0;
      else if (ageHours < 24) recency = 0.8;
      else if (ageHours < 168) recency = 0.6;
      else recency = 0.3;
    }

    // 5. Memory Boost (weight: 0.05)
    let memoryBoost = 0.0;
    if (item.category === 'memory') {
      memoryBoost = 1.0;
    } else if (item.sourcePath && memorySourcePaths.has(item.sourcePath)) {
      memoryBoost = 0.8;
    }

    // Composite importance score
    const importanceScore = Number((
      weights.taskRelevance * taskRelevance +
      weights.graphCentrality * graphCentrality +
      weights.semanticSimilarity * semanticSimilarity +
      weights.recency * recency +
      weights.memoryBoost * memoryBoost
    ).toFixed(4));

    // Determine disposition
    let disposition: ContextItemDisposition = 'normal';
    if (importanceScore >= 0.75 || memoryBoost >= 0.8 || graphCentrality >= 0.85) {
      disposition = 'must_include';
    } else if (importanceScore >= 0.50) {
      disposition = 'normal';
    } else if (importanceScore >= 0.25) {
      disposition = 'summarize';
    } else {
      disposition = 'omit';
    }

    // Determine evidence type tag
    let evidenceType: EvidenceType = 'known_fact';
    if (item.category === 'memory') {
      evidenceType = 'known_fact';
    } else if (item.category === 'dependency') {
      evidenceType = 'inferred_fact';
    } else if (importanceScore < 0.35) {
      evidenceType = 'uncertain_assumption';
    }

    return {
      id: item.id,
      category: item.category,
      sourcePath: item.sourcePath,
      rawContent: item.rawContent,
      importanceScore,
      scoreBreakdown: {
        taskRelevance: Number(taskRelevance.toFixed(3)),
        graphCentrality: Number(graphCentrality.toFixed(3)),
        semanticSimilarity: Number(semanticSimilarity.toFixed(3)),
        recency: Number(recency.toFixed(3)),
        memoryBoost: Number(memoryBoost.toFixed(3))
      },
      disposition,
      evidenceType,
      metadata: item.metadata
    };
  });

  // Sort items descending by importance score
  items.sort((a, b) => b.importanceScore - a.importanceScore);

  const totalItems = items.length;
  const topItemsCount = items.filter(i => i.disposition === 'must_include' || i.disposition === 'normal').length;
  const avgImportance = totalItems > 0 
    ? items.reduce((acc, i) => acc + i.importanceScore, 0) / totalItems 
    : 0;

  return {
    items,
    totalItems,
    topItemsCount,
    averageImportance: Number(avgImportance.toFixed(4))
  };
}
