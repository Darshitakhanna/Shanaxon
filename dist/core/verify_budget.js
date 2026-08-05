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
const parser_1 = require("./parser");
const budgetManager_1 = require("./budgetManager");
const importGraph_1 = require("./importGraph");
const cache_1 = require("./cache");
const promptRouter_1 = require("../middleware/promptRouter");
const SAMPLE_A = `import { helper } from './verify_budget_sampleB';
export function runCalculation(x: number) {
  if (x > 10) {
    return helper(x) * 2;
  }
  return x;
}
`;
const SAMPLE_B = `export function helper(v: number) {
  return v + 42;
}
`;
async function runTests() {
    console.log("=== Running Token Budget, Dependency Graph, & Cache Verification ===");
    const fileA = path.resolve(process.cwd(), 'src/core/verify_budget_sampleA.ts');
    const fileB = path.resolve(process.cwd(), 'src/core/verify_budget_sampleB.ts');
    // Write temporary sample files
    await fs_1.promises.writeFile(fileA, SAMPLE_A, 'utf-8');
    await fs_1.promises.writeFile(fileB, SAMPLE_B, 'utf-8');
    const engine = new parser_1.CodeCompressionEngine();
    await engine.init();
    try {
        // 1. Verify BPE Token Estimation
        console.log("\n1. Testing BPE Token Estimation...");
        const tokensA = (0, budgetManager_1.estimateTokens)(SAMPLE_A);
        console.log(`SAMPLE_A estimated tokens: ${tokensA} (chars: ${SAMPLE_A.length})`);
        if (tokensA <= 0 || tokensA > SAMPLE_A.length) {
            throw new Error("Token estimation returned invalid value!");
        }
        console.log("✓ BPE token estimation bounds check passed.");
        // 2. Verify Adaptive Budget Escalation
        console.log("\n2. Testing Adaptive Budget Escalation...");
        const fileInputs = [
            { filePath: fileA, code: SAMPLE_A },
            { filePath: fileB, code: SAMPLE_B }
        ];
        // Set a budget that fits normal
        const normalBudget = 1000;
        const resNormal = await (0, budgetManager_1.enforceBudget)(fileInputs, engine, normalBudget);
        console.log(`Normal budget target (${normalBudget} tokens) results:`);
        resNormal.results.forEach(r => console.log(` - File: ${path.basename(r.filePath)}, Tier: ${r.tier}, Tokens: ${r.estimatedTokens}`));
        if (resNormal.results.some(r => r.tier !== 'normal')) {
            throw new Error("Tiers escalated even when budget was sufficient!");
        }
        // Set a very strict budget that requires aggressive or omission
        const tightBudget = 30;
        const resTight = await (0, budgetManager_1.enforceBudget)(fileInputs, engine, tightBudget);
        console.log(`\nTight budget target (${tightBudget} tokens) results:`);
        resTight.results.forEach(r => console.log(` - File: ${path.basename(r.filePath)}, Tier: ${r.tier}, Tokens: ${r.estimatedTokens}`));
        if (resTight.results.every(r => r.tier === 'normal')) {
            throw new Error("Tiers failed to escalate under tight budget constraints!");
        }
        console.log("✓ Adaptive budget escalation checks passed.");
        // 3. Verify Import Graph Dependency Tracking
        console.log("\n3. Testing Dependency Graph Tracking...");
        const graph = new importGraph_1.ImportGraph(engine.getParser());
        await graph.parseFileImports(fileA, SAMPLE_A, engine.getLoadedLanguages());
        await graph.parseFileImports(fileB, SAMPLE_B, engine.getLoadedLanguages());
        const depsA = await graph.getDirectDependencies(fileA);
        console.log(`Direct dependencies of verify_budget_sampleA.ts:`, depsA.map(p => path.basename(p)));
        if (depsA.length !== 1 || !depsA[0].includes('verify_budget_sampleB.ts')) {
            throw new Error("Failed to detect relative import path inside SAMPLE_A!");
        }
        console.log("✓ AST import graph parser check passed.");
        // 4. Verify promptRouter.ts 1-hop Dependency Resolution
        console.log("\n4. Testing Prompt Router 1-hop Dependency Ingestion...");
        // Let's mimic files array for prompt router
        const fileData = [
            {
                filePath: fileA,
                signatures: await engine.compress(SAMPLE_A, fileA, 'aggressive'),
                rawCode: SAMPLE_A
            },
            {
                filePath: fileB,
                signatures: await engine.compress(SAMPLE_B, fileB, 'aggressive'),
                rawCode: SAMPLE_B
            }
        ];
        const getDeps = (filePath) => {
            // Mock synchronous dep resolver for prompt router using resolved graph
            if (filePath === fileA)
                return [fileB];
            return [];
        };
        // Prompt indicating edit/write intent on fileA
        const query = "Edit verify_budget_sampleA.ts and change runCalculation to add 5";
        const routeResults = (0, promptRouter_1.routePrompt)(query, fileData, getDeps);
        console.log("Prompt routing results:");
        routeResults.forEach(r => console.log(` - File: ${path.basename(r.filePath)}, Swapped (Raw): ${r.swapped}, IsDependency (Signature): ${r.isDependency}`));
        const targetA = routeResults.find(r => r.filePath === fileA);
        const targetB = routeResults.find(r => r.filePath === fileB);
        if (!targetA.swapped || targetA.content !== SAMPLE_A) {
            throw new Error("Target file was not swapped to raw code!");
        }
        if (targetB.swapped || !targetB.isDependency) {
            throw new Error("Imported file B was not flagged as 1-hop dependency signature!");
        }
        console.log("✓ Prompt router 1-hop dependency tagging passed.");
        // 5. Verify AST Cache & Expiry
        console.log("\n5. Testing In-Memory Cache & Modtime Expiry...");
        const cache = new cache_1.AstCache(10);
        const compressions = {
            normal: await engine.compress(SAMPLE_B, fileB, 'normal'),
            medium: await engine.compress(SAMPLE_B, fileB, 'medium'),
            aggressive: await engine.compress(SAMPLE_B, fileB, 'aggressive')
        };
        await cache.set(fileB, compressions);
        // Warm hit check
        const cachedNormal = await cache.get(fileB, 'normal');
        if (cachedNormal !== compressions.normal) {
            throw new Error("Cache return value mismatch!");
        }
        console.log("✓ Cache lookup hit passed.");
        // Cache invalidation check: modify fileB stat mtime or write to it
        console.log("Modifying fileB to test cache invalidation...");
        const modifiedSampleB = SAMPLE_B + "\n// modified";
        await fs_1.promises.writeFile(fileB, modifiedSampleB, 'utf-8');
        const cacheAfterModification = await cache.get(fileB, 'normal');
        if (cacheAfterModification !== null) {
            throw new Error("Cache failed to invalidate stale entry after file edit!");
        }
        console.log("✓ Cache mtime modification expiry passed.");
    }
    finally {
        // Cleanup temporary sample files
        await fs_1.promises.unlink(fileA).catch(() => { });
        await fs_1.promises.unlink(fileB).catch(() => { });
    }
    console.log("\n=== All Budget, Dependency, & Cache Tests Passed! ===");
}
runTests().catch((err) => {
    console.error("❌ Test Suite Failed:");
    console.error(err);
    process.exit(1);
});
