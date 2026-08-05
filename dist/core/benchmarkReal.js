"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.runRealBenchmark = runRealBenchmark;
const fs_1 = require("fs");
const parser_1 = require("./parser");
const workspaceIndexer_1 = require("./workspaceIndexer");
const tokenizer_1 = require("./tokenizer");
/**
 * Real Codebase Benchmark Suite.
 * Benchmarks Tokenist AST compression against actual workspace repository files.
 */
async function runRealBenchmark(workspaceRoot) {
    const engine = new parser_1.CodeCompressionEngine();
    await engine.init();
    const indexer = new workspaceIndexer_1.WorkspaceIndexer(workspaceRoot);
    const matchedFiles = await indexer.indexWorkspace('src');
    const fileContents = [];
    for (const file of matchedFiles) {
        try {
            const code = await fs_1.promises.readFile(file, 'utf-8');
            fileContents.push({ filePath: file, code });
        }
        catch { }
    }
    const tiers = ['normal', 'medium', 'aggressive'];
    const results = [];
    for (const tier of tiers) {
        const startTime = Date.now();
        let rawChars = 0;
        let compressedChars = 0;
        let rawTokens = 0;
        let compressedTokens = 0;
        for (const f of fileContents) {
            rawChars += f.code.length;
            rawTokens += tokenizer_1.Tokenizer.countTokens(f.code, f.filePath);
            const compressed = await engine.compress(f.code, f.filePath, tier);
            compressedChars += compressed.length;
            compressedTokens += tokenizer_1.Tokenizer.countTokens(compressed, f.filePath);
        }
        const totalTimeMs = Date.now() - startTime;
        const savingsPct = rawTokens > 0 ? ((rawTokens - compressedTokens) / rawTokens) * 100 : 0;
        results.push({
            tier,
            totalFiles: fileContents.length,
            rawChars,
            compressedChars,
            rawTokens,
            compressedTokens,
            savingsPct: Math.round(savingsPct * 100) / 100,
            totalTimeMs,
            avgLatencyMs: Math.round((totalTimeMs / (fileContents.length || 1)) * 100) / 100
        });
    }
    return results;
}
async function main() {
    console.log("===========================================================");
    console.log("TOKENIST REAL CODEBASE COMPRESSION BENCHMARK");
    console.log("===========================================================");
    const workspaceRoot = process.cwd();
    console.log(`Repository Root: ${workspaceRoot}`);
    const results = await runRealBenchmark(workspaceRoot);
    for (const res of results) {
        console.log(`\nTier: ${res.tier.toUpperCase()}`);
        console.log(` - Total Files Processed: ${res.totalFiles}`);
        console.log(` - Raw Code Volume     : ${res.rawChars.toLocaleString()} chars (~${res.rawTokens.toLocaleString()} BPE tokens)`);
        console.log(` - Compressed Volume   : ${res.compressedChars.toLocaleString()} chars (~${res.compressedTokens.toLocaleString()} BPE tokens)`);
        console.log(` - Token Reduction     : ${res.savingsPct}% tokens saved`);
        console.log(` - Total Execution Time: ${res.totalTimeMs}ms (${res.avgLatencyMs}ms/file)`);
        const rawCost = (res.rawTokens / 1000000) * 3.00;
        const compressedCost = (res.compressedTokens / 1000000) * 3.00;
        const savedDollar = rawCost - compressedCost;
        console.log(` - Projected Cost (Claude Sonnet @ $3/1M): $${rawCost.toFixed(4)} → $${compressedCost.toFixed(4)} (Saved $${savedDollar.toFixed(4)}/call)`);
    }
    console.log("\n===========================================================");
    console.log("BENCHMARK COMPLETED SUCCESSFULLY!");
    console.log("===========================================================");
}
if (require.main === module) {
    main().catch(err => {
        console.error("Benchmark failed:", err);
        process.exit(1);
    });
}
