"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.HybridRanker = void 0;
/**
 * BM25 Keyword Search + Vector Cosine Similarity Hybrid Search Ranker.
 * Merges exact keyword/symbol matches with semantic conceptual embeddings.
 */
class HybridRanker {
    k1 = 1.5;
    b = 0.75;
    /**
     * Computes BM25 score for a query against a document string.
     */
    calculateBM25(query, documentText, avgDocLength = 500) {
        if (!query || !documentText)
            return 0;
        const queryTerms = query.toLowerCase().match(/[a-zA-Z_0-9]+/g) || [];
        const docTerms = documentText.toLowerCase().match(/[a-zA-Z_0-9]+/g) || [];
        if (queryTerms.length === 0 || docTerms.length === 0)
            return 0;
        const docLength = docTerms.length;
        const termFreqs = new Map();
        for (const term of docTerms) {
            termFreqs.set(term, (termFreqs.get(term) || 0) + 1);
        }
        let score = 0;
        for (const qTerm of queryTerms) {
            const freq = termFreqs.get(qTerm) || 0;
            if (freq > 0) {
                // IDF approximation factor for code search
                const idf = Math.log(1 + 10 / (1 + (termFreqs.has(qTerm) ? 1 : 0)));
                const numerator = freq * (this.k1 + 1);
                const denominator = freq + this.k1 * (1 - this.b + this.b * (docLength / avgDocLength));
                score += idf * (numerator / denominator);
            }
        }
        // Normalize BM25 score to [0.0, 1.0] range
        return Math.min(1.0, score / 10.0);
    }
    /**
     * Merges semantic scores and BM25 scores into unified hybrid scores.
     * Formula: 0.6 * semantic + 0.4 * BM25
     */
    mergeHybridScores(semanticResults, fileContentsMap, query) {
        const results = [];
        // Calculate average doc length across file contents
        let totalLen = 0;
        for (const [, text] of fileContentsMap.entries()) {
            totalLen += text.length;
        }
        const avgLen = fileContentsMap.size > 0 ? totalLen / fileContentsMap.size : 500;
        for (const item of semanticResults) {
            const content = fileContentsMap.get(item.filePath) || '';
            const bm25 = this.calculateBM25(query, content, avgLen);
            const semantic = Math.max(0, item.score);
            const hybrid = Math.round((0.6 * semantic + 0.4 * bm25) * 10000) / 10000;
            results.push({
                filePath: item.filePath,
                hybridScore: hybrid,
                semanticScore: Math.round(semantic * 10000) / 10000,
                bm25Score: Math.round(bm25 * 10000) / 10000
            });
        }
        // Sort descending by hybrid score
        results.sort((a, b) => b.hybridScore - a.hybridScore);
        return results;
    }
}
exports.HybridRanker = HybridRanker;
