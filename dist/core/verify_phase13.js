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
const path = __importStar(require("path"));
const importanceScorer_1 = require("./importanceScorer");
const queryAdapter_1 = require("./queryAdapter");
const hashCache_1 = require("./hashCache");
const platformAdapter_1 = require("../adapters/platformAdapter");
const hybridRanker_1 = require("./hybridRanker");
const cache_1 = require("./cache");
async function runTests() {
    console.log("=== Running Phase 13: Next-Gen Intelligence & Platform Universal Layer Verification ===");
    const workspaceRoot = process.cwd();
    // 1. Verify PageRank Importance Scorer
    console.log("\n1. Testing PageRank Importance Scorer...");
    const mockGraph = {
        getAllNodes: () => new Set([
            path.resolve(workspaceRoot, 'src/server.ts'),
            path.resolve(workspaceRoot, 'src/core/parser.ts'),
            path.resolve(workspaceRoot, 'src/types/index.ts')
        ]),
        getOutEdgesMap: () => new Map([
            [path.resolve(workspaceRoot, 'src/server.ts'), new Set([path.resolve(workspaceRoot, 'src/core/parser.ts'), path.resolve(workspaceRoot, 'src/types/index.ts')])],
            [path.resolve(workspaceRoot, 'src/core/parser.ts'), new Set([path.resolve(workspaceRoot, 'src/types/index.ts')])],
            [path.resolve(workspaceRoot, 'src/types/index.ts'), new Set([])]
        ]),
        getInDegreeMap: () => new Map([
            [path.resolve(workspaceRoot, 'src/types/index.ts'), 2],
            [path.resolve(workspaceRoot, 'src/core/parser.ts'), 1],
            [path.resolve(workspaceRoot, 'src/server.ts'), 0]
        ])
    };
    const scorer = new importanceScorer_1.ImportanceScorer();
    const importanceMap = scorer.calculatePageRank(mockGraph);
    console.log(`PageRank calculated for ${importanceMap.size} nodes.`);
    const typesScore = importanceMap.get(path.resolve(workspaceRoot, 'src/types/index.ts'));
    console.log(`High in-degree file (types/index.ts) recommended tier: ${typesScore?.recommendedTier}`);
    if (typesScore?.recommendedTier !== 'normal') {
        throw new Error("PageRank failed to assign normal tier to high in-degree file!");
    }
    console.log("✓ PageRank Importance Scorer verification passed.");
    // 2. Verify Query-Adaptive Symbol Extractor
    console.log("\n2. Testing Query-Adaptive Symbol Extractor...");
    const queryAdapter = new queryAdapter_1.QueryAdapter();
    const sampleFiles = [
        'src/server.ts',
        'src/core/parser.ts',
        'src/telemetry/metricsCollector.ts'
    ];
    const result = queryAdapter.resolveQueryAdaptivePins('Please fix the metricsCollector latency calculation', sampleFiles);
    console.log(`Extracted symbols: [${result.extractedSymbols.join(', ')}]`);
    console.log(`Pinned files: [${result.pinnedFiles.join(', ')}]`);
    if (result.pinnedFiles.length === 0 || !result.pinnedFiles[0].includes('metricsCollector.ts')) {
        throw new Error("Query adapter failed to extract symbol pin for metricsCollector.ts!");
    }
    console.log("✓ Query-adaptive symbol extraction verification passed.");
    // 3. Verify SHA-256 Content-Hash Cache Engine
    console.log("\n3. Testing SHA-256 Content-Hash Cache...");
    const sampleCode = "function hello() { return 'world'; }";
    const sampleHash = (0, hashCache_1.computeContentHash)(sampleCode);
    console.log(`SHA-256 hash preview: ${sampleHash.slice(0, 16)}...`);
    if (!sampleHash || sampleHash.length !== 64) {
        throw new Error("SHA-256 content hashing failed!");
    }
    const cache = new cache_1.AstCache(50, '.tokenist/cache_hash_test.json');
    const tempFile = path.resolve(workspaceRoot, 'src/core/hashCache.ts');
    await cache.set(tempFile, { normal: 'norm', medium: 'med', aggressive: 'agg' }, sampleCode);
    const hitContent = await cache.get(tempFile, 'aggressive', sampleCode);
    console.log(`Hash cache hit check: ${hitContent}`);
    if (hitContent !== 'agg') {
        throw new Error("SHA-256 cache hit failed!");
    }
    const missContent = await cache.get(tempFile, 'aggressive', sampleCode + " // modified");
    console.log(`Hash cache miss check (expected null): ${missContent}`);
    if (missContent !== null) {
        throw new Error("SHA-256 cache invalidation on code content change failed!");
    }
    console.log("✓ SHA-256 content hash cache verification passed.");
    // 4. Verify Platform Adapter Auto-Detection
    console.log("\n4. Testing Universal Platform Adapter...");
    process.env.CLAUDE_CODE = '1';
    try {
        const platformInfo = platformAdapter_1.PlatformAdapter.detectPlatform();
        console.log(`Detected Platform: ${platformInfo.displayName} (Preset Tier: ${platformInfo.presetTier})`);
        if (platformInfo.platform !== 'claude-code') {
            throw new Error("Platform adapter failed to detect Claude Code platform!");
        }
    }
    finally {
        delete process.env.CLAUDE_CODE;
    }
    console.log("✓ Universal Platform Adapter verification passed.");
    // 5. Verify BM25 + Semantic Hybrid Search Ranker
    console.log("\n5. Testing BM25 + Semantic Hybrid Search Ranker...");
    const hybridRanker = new hybridRanker_1.HybridRanker();
    const mockSemanticResults = [
        { filePath: path.resolve(workspaceRoot, 'src/core/parser.ts'), score: 0.8 },
        { filePath: path.resolve(workspaceRoot, 'src/server.ts'), score: 0.6 }
    ];
    const fileContentsMap = new Map([
        [path.resolve(workspaceRoot, 'src/core/parser.ts'), 'class CodeCompressionEngine { compress() {} }'],
        [path.resolve(workspaceRoot, 'src/server.ts'), 'class McpCompressionServer { setupHandlers() {} }']
    ]);
    const hybridScores = hybridRanker.mergeHybridScores(mockSemanticResults, fileContentsMap, 'CodeCompressionEngine');
    console.log(`Top hybrid match: ${path.basename(hybridScores[0].filePath)} (Score: ${hybridScores[0].hybridScore}, BM25: ${hybridScores[0].bm25Score})`);
    if (!hybridScores[0].filePath.includes('parser.ts') || hybridScores[0].bm25Score === 0) {
        throw new Error("Hybrid ranker BM25 match failed!");
    }
    console.log("✓ BM25 + Semantic Hybrid Search Ranker verification passed.");
    console.log("\n=== All Phase 13 Tests Passed successfully! ===");
}
runTests().catch((err) => {
    console.error("❌ Phase 13 Test Suite Failed:");
    console.error(err);
    process.exit(1);
});
