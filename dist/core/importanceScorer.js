"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.ImportanceScorer = void 0;
const path = __importStar(require("path"));
/**
 * Calculates PageRank-style centrality scores for files based on the import dependency graph.
 * High-centrality files (imported by many central components) are recommended for lower compression tiers.
 */
class ImportanceScorer {
    /**
     * Runs PageRank power iteration over the import graph.
     * @param graph The workspace ImportGraph instance
     * @param dampingFactor PageRank damping factor (default: 0.85)
     * @param maxIterations Number of iterations (default: 20)
     */
    calculatePageRank(graph, dampingFactor = 0.85, maxIterations = 20) {
        const nodes = Array.from(graph.getAllNodes());
        const N = nodes.length;
        const scoresMap = new Map();
        if (N === 0) {
            return scoresMap;
        }
        // Initial uniform probability distribution
        let rank = new Map();
        for (const node of nodes) {
            rank.set(node, 1.0 / N);
        }
        const outEdgesMap = graph.getOutEdgesMap();
        // Power iteration
        for (let iter = 0; iter < maxIterations; iter++) {
            const newRank = new Map();
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
                    for (const v of targets) {
                        if (newRank.has(v)) {
                            newRank.set(v, newRank.get(v) + share);
                        }
                    }
                }
                else {
                    // Dangling node handling: distribute rank evenly to all nodes
                    const share = (dampingFactor * currentRank) / N;
                    for (const v of nodes) {
                        newRank.set(v, newRank.get(v) + share);
                    }
                }
            }
            rank = newRank;
        }
        // Find max score for normalization
        let maxScore = 0;
        for (const [, s] of rank.entries()) {
            if (s > maxScore)
                maxScore = s;
        }
        if (maxScore === 0)
            maxScore = 1;
        for (const node of nodes) {
            const normalized = (rank.get(node) || 0) / maxScore;
            let recommendedTier = 'aggressive';
            if (normalized > 0.15) {
                recommendedTier = 'normal';
            }
            else if (normalized > 0.05) {
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
exports.ImportanceScorer = ImportanceScorer;
