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
const fs_1 = require("fs");
const workspaceIndexer_1 = require("./workspaceIndexer");
const parser_1 = require("./parser");
const budgetManager_1 = require("./budgetManager");
async function runBenchmark() {
    const target = process.argv[2] || '.';
    const absoluteTarget = path.resolve(target);
    const workspaceRoot = process.cwd();
    console.log(`=== Dharohar-Context CLI Benchmark Tool ===`);
    console.log(`Target: ${absoluteTarget}`);
    const indexer = new workspaceIndexer_1.WorkspaceIndexer(workspaceRoot);
    let files = [];
    try {
        files = await indexer.indexWorkspace(target);
    }
    catch (err) {
        console.error(`Error crawling workspace: ${err.message}`);
        process.exit(1);
    }
    if (files.length === 0) {
        console.log("No supported files found to index.");
        process.exit(0);
    }
    const engine = new parser_1.CodeCompressionEngine();
    await engine.init();
    let totalRawTokens = 0;
    let totalCompTokens = 0;
    const startOverall = Date.now();
    console.log(`Processing ${files.length} files...`);
    for (const file of files) {
        try {
            const code = await fs_1.promises.readFile(file, 'utf-8');
            const compressed = await engine.compress(code, file, 'aggressive');
            const rawTokens = (0, budgetManager_1.estimateTokens)(code);
            const compTokens = (0, budgetManager_1.estimateTokens)(compressed);
            totalRawTokens += rawTokens;
            totalCompTokens += compTokens;
        }
        catch (err) {
            console.error(`Error processing ${path.basename(file)}: ${err.message}`);
        }
    }
    const duration = Date.now() - startOverall;
    const saved = totalRawTokens - totalCompTokens;
    const pct = totalRawTokens > 0 ? ((saved / totalRawTokens) * 100).toFixed(1) : '0';
    const avgLatency = (duration / files.length).toFixed(1);
    console.log("\n==================================================");
    console.log("BENCHMARK REPORT SUMMARY");
    console.log("==================================================");
    console.log(`Total Files Indexed        : ${files.length}`);
    console.log(`Raw Cumulative Tokens      : ${totalRawTokens.toLocaleString()}`);
    console.log(`Compressed Output Tokens   : ${totalCompTokens.toLocaleString()}`);
    console.log(`Context Tokens Reclaimed   : ${saved.toLocaleString()} Saved`);
    console.log(`Overall Compression Ratio  : ${pct}% reduction`);
    console.log(`Total Duration             : ${duration}ms`);
    console.log(`Average Latency            : ${avgLatency}ms per file`);
    console.log("==================================================");
}
runBenchmark().catch((err) => {
    console.error("Benchmark failed:", err);
    process.exit(1);
});
