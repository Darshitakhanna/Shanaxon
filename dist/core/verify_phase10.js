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
const projectDetector_1 = require("./projectDetector");
const gitAwareTier_1 = require("./gitAwareTier");
const configLoader_1 = require("./configLoader");
const terminalConsole_1 = require("../telemetry/terminalConsole");
// Simple glob match helper to verify pinning
function globToRegex(pattern) {
    const regexStr = '^' + pattern
        .replace(/[.+^${}()|[\]\\]/g, '\\$&')
        .replace(/\*\*/g, '__DOUBLE_STAR__')
        .replace(/\*/g, '[^/]*')
        .replace(/__DOUBLE_STAR__/g, '.*') + '$';
    return new RegExp(regexStr);
}
function isPinned(filePath, alwaysInclude, workspaceRoot) {
    const relPath = path.relative(workspaceRoot, filePath).replace(/\\/g, '/');
    return alwaysInclude.some((pattern) => {
        const regex = globToRegex(pattern);
        return regex.test(relPath);
    });
}
async function runTests() {
    console.log("=== Running Phase 10: Distribution, Adoption & Developer Intelligence Verification ===");
    const workspaceRoot = process.cwd();
    // 1. Verify Project Detector
    console.log("\n1. Testing Project Detector...");
    const projInfo = await (0, projectDetector_1.detectProject)(workspaceRoot);
    console.log(`Detected type: ${projInfo.projectType}`);
    console.log("Recommended exclusions:", projInfo.excludePatterns);
    if (projInfo.projectType !== 'nodejs') {
        throw new Error("Project detector failed to recognize package.json as NodeJS!");
    }
    console.log("✓ Project detector verification passed.");
    // 2. Verify Git-Aware Compression Tiers
    console.log("\n2. Testing Git-Aware Tiers...");
    const resolvedTier = await (0, gitAwareTier_1.getGitAwareTier)('package.json', workspaceRoot, 'aggressive');
    console.log(`Git resolved tier for package.json (fallback context): "${resolvedTier}"`);
    if (!['normal', 'medium', 'aggressive'].includes(resolvedTier)) {
        throw new Error("Git aware tier returned invalid value!");
    }
    console.log("✓ Git-aware tiers verification passed.");
    // 3. Verify Context Pinning Glob Matcher
    console.log("\n3. Testing Context Pinning matcher...");
    const pinnedPaths = ['src/types/index.ts', 'src/types/sub/types.d.ts'];
    const testPatterns = ['src/types/**'];
    for (const p of pinnedPaths) {
        if (!isPinned(path.resolve(workspaceRoot, p), testPatterns, workspaceRoot)) {
            throw new Error(`File ${p} was not matched by glob ${testPatterns[0]}`);
        }
    }
    console.log("✓ Context pinning glob verification passed.");
    // 4. Verify Environment Variable Overrides
    console.log("\n4. Testing Environment Variable Config Overrides...");
    const tempConfigPath = path.resolve(workspaceRoot, '.tokenist.json');
    // Write a clean temporary .tokenist.json
    await fs_1.promises.writeFile(tempConfigPath, JSON.stringify({ defaultTier: 'normal', maxTokenBudget: 4000 }), 'utf-8');
    // Setup ENV variables
    process.env.TOKENIST_DEFAULT_TIER = 'aggressive';
    process.env.TOKENIST_MAX_BUDGET = '9999';
    process.env.TOKENIST_SHOW_INLINE_SUMMARY = 'false';
    process.env.TOKENIST_PRICING_MODEL = 'gemini-2.5-pro';
    try {
        const config = await (0, configLoader_1.loadConfig)(workspaceRoot);
        console.log(`Resolved defaultTier (expecting ENV aggressive): ${config.defaultTier}`);
        console.log(`Resolved maxTokenBudget (expecting ENV 9999): ${config.maxTokenBudget}`);
        console.log(`Resolved showInlineSummary (expecting ENV false): ${config.showInlineSummary}`);
        console.log(`Resolved pricingModel (expecting ENV gemini-2.5-pro): ${config.pricingModel}`);
        if (config.defaultTier !== 'aggressive' || config.maxTokenBudget !== 9999 || config.showInlineSummary !== false || config.pricingModel !== 'gemini-2.5-pro') {
            throw new Error("Environment overrides were not applied correctly!");
        }
    }
    finally {
        // Cleanup env overrides
        delete process.env.TOKENIST_DEFAULT_TIER;
        delete process.env.TOKENIST_MAX_BUDGET;
        delete process.env.TOKENIST_SHOW_INLINE_SUMMARY;
        delete process.env.TOKENIST_PRICING_MODEL;
        (0, configLoader_1.resetConfigState)();
        // Cleanup temporary config
        await fs_1.promises.unlink(tempConfigPath).catch(() => { });
    }
    console.log("✓ Environment variable overrides verification passed.");
    // 5. Verify Dollar Cost Estimator
    console.log("\n5. Testing Dollar Cost Estimation telemetry format...");
    // Temporary configuration setting
    process.env.TOKENIST_PRICING_MODEL = 'gpt-4o';
    (0, configLoader_1.resetConfigState)();
    await (0, configLoader_1.loadConfig)(workspaceRoot);
    const mockRecords = [
        {
            timestamp: new Date().toISOString(),
            filePath: 'test.ts',
            rawTokens: 100000,
            compressedTokens: 20000,
            tier: 'aggressive',
            savingsPct: 80.00,
            latencyMs: 12
        }
    ];
    const report = (0, terminalConsole_1.renderDashboard)(mockRecords);
    console.log("Telemetry Dashboard output:\n" + report);
    if (!report.includes("Raw Context Cost (Est.)") || !report.includes("Estimated Cash Saved") || !report.includes("GPT-4o")) {
        throw new Error("Cost estimation telemetry dashboard output does not contain expected dollar calculations!");
    }
    // Cleanup ENV override
    delete process.env.TOKENIST_PRICING_MODEL;
    await (0, configLoader_1.loadConfig)(workspaceRoot);
    console.log("✓ Dollar cost estimation verification passed.");
    console.log("\n=== All Phase 10 Tests Passed successfully! ===");
}
runTests().catch((err) => {
    console.error("❌ Phase 10 Test Suite Failed:");
    console.error(err);
    process.exit(1);
});
