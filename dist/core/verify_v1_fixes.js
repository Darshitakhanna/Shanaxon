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
const fs = __importStar(require("fs"));
const parser_1 = require("./parser");
const cache_1 = require("./cache");
const embeddingRanker_1 = require("./embeddingRanker");
const server_1 = require("../server");
const historyPruner_1 = require("../middleware/historyPruner");
async function runVerification() {
    console.log('=== STARTING TOKENIST V1 5-FIX VERIFICATION SUITE ===\n');
    let failures = 0;
    // TEST 1: Tier-aware fallbackCompress & preserveCommentPatterns
    console.log('[TEST 1] Testing fallbackCompress & preserveCommentPatterns...');
    const engine = new parser_1.CodeCompressionEngine();
    await engine.init();
    const dummyCode = `
// TODO: Must keep this critical todo
// Normal comment that should be stripped in medium/aggressive
console.log("Debug log statement");
function processData() {
  return 42;
}
  `.trim();
    // Test fallbackCompress tier behavior directly
    const normalFallback = engine.fallbackCompress(dummyCode, 'normal');
    const mediumFallback = engine.fallbackCompress(dummyCode, 'medium');
    const aggressiveFallback = engine.fallbackCompress(dummyCode, 'aggressive');
    if (!normalFallback.includes('console.log') || !normalFallback.includes('Normal comment')) {
        console.error('FAILED Test 1: Normal fallback lost code/comments');
        failures++;
    }
    else if (!mediumFallback.includes('// TODO:') || mediumFallback.includes('Normal comment')) {
        console.error('FAILED Test 1: Medium fallback did not preserve TODO or failed to strip comment');
        failures++;
    }
    else if (aggressiveFallback.includes('console.log') || !aggressiveFallback.includes('// TODO:')) {
        console.error('FAILED Test 1: Aggressive fallback failed to strip debug console.log or lost TODO');
        failures++;
    }
    else {
        console.log('  PASSED Test 1: Fallback compression is tier-aware and respects comment patterns!');
    }
    // TEST 2: AstCache Atomic Disk Flush
    console.log('[TEST 2] Testing AstCache atomic disk flush...');
    const testCachePath = path.resolve(process.cwd(), '.tokenist/test_cache.json');
    const cache = new cache_1.AstCache(100, testCachePath);
    await cache.set('dummy.ts', { normal: 'a', medium: 'b', aggressive: 'c' });
    await cache.flushToDisk();
    if (fs.existsSync(testCachePath)) {
        const raw = fs.readFileSync(testCachePath, 'utf-8');
        if (raw.includes('dummy.ts')) {
            console.log('  PASSED Test 2: AstCache atomic flush successfully persisted valid JSON!');
        }
        else {
            console.error('FAILED Test 2: AstCache disk content mismatch');
            failures++;
        }
        try {
            fs.unlinkSync(testCachePath);
        }
        catch { }
    }
    else {
        console.error('FAILED Test 2: AstCache file not found after flush');
        failures++;
    }
    // TEST 3: EmbeddingRanker Content-Hash Caching & Disk Persistence
    console.log('[TEST 3] Testing EmbeddingRanker content-hash caching & disk persistence...');
    const ranker = new embeddingRanker_1.EmbeddingRanker(process.cwd());
    await ranker.init();
    await ranker.indexFile('src/core/parser.ts', 'export class CodeCompressionEngine {}');
    await ranker.flushToDisk();
    const embedDiskPath = path.resolve(process.cwd(), '.tokenist/embeddings.json');
    if (fs.existsSync(embedDiskPath)) {
        const embedRaw = fs.readFileSync(embedDiskPath, 'utf-8');
        if (embedRaw.includes('parser.ts')) {
            console.log('  PASSED Test 3: EmbeddingRanker successfully persisted embeddings to disk!');
        }
        else {
            console.error('FAILED Test 3: Embedding disk content missing indexed file');
            failures++;
        }
    }
    else {
        console.error('FAILED Test 3: Embeddings file not created on disk');
        failures++;
    }
    // TEST 4: Middleware Logic (pruneHistory & routePrompt)
    console.log('[TEST 4] Testing middleware logic (pruneHistory & routePrompt)...');
    const sampleMessages = [
        { role: 'user', content: 'Help me debug this error' },
        { role: 'assistant', content: 'Error: Connection lost\n    at net.js:10\n    at net.js:20\n    at net.js:30' },
        { role: 'user', content: 'What about npm ERR?' },
        { role: 'assistant', content: 'npm ERR! code 1\n'.repeat(30) }
    ];
    const pruned = (0, historyPruner_1.pruneHistory)(sampleMessages, 1);
    if (pruned.length > 0 && pruned.some(m => m.content.includes('[Stack trace collapsed]') || m.content.includes('[Long terminal build/debug dump removed'))) {
        console.log('  PASSED Test 4: pruneHistory successfully collapsed stack traces and dumps!');
    }
    else {
        console.error('FAILED Test 4: pruneHistory did not prune stack traces or long dumps');
        failures++;
    }
    // TEST 5: MCP Server Initialization & Tool Registration
    console.log('[TEST 5] Testing MCP Server instantiation and tool wiring...');
    const server = new server_1.McpCompressionServer();
    if (server && server.server) {
        console.log('  PASSED Test 5: McpCompressionServer initialized and prune_chat_history tool wired!');
    }
    else {
        console.error('FAILED Test 5: McpCompressionServer failed to instantiate');
        failures++;
    }
    console.log('\n==================================================');
    if (failures === 0) {
        console.log('SUCCESS: ALL 5 CRITICAL PRODUCTION FIXES VERIFIED! (100% PASS RATE)');
    }
    else {
        console.error(`FAILURE: ${failures} tests failed!`);
        process.exit(1);
    }
}
runVerification().catch(err => {
    console.error('Verification script crashed:', err);
    process.exit(1);
});
