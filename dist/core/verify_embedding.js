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
const embeddingRanker_1 = require("./embeddingRanker");
const metricsCollector_1 = require("../telemetry/metricsCollector");
const terminalConsole_1 = require("../telemetry/terminalConsole");
const AUTH_CONTENT = "User login authentication, registration, JWT token generation, passwords hashing and validation, sessions management.";
const DB_CONTENT = "Relational database connection pool, query execution, transaction handling, table migrations, SQL queries helper.";
const BUTTON_CONTENT = "React UI Button component, dynamic themes, disabled state, hover and focus transitions, styled border radius.";
async function runTests() {
    console.log("=== Running Embedding Semantic Ranker & Telemetry Verification ===");
    const ranker = new embeddingRanker_1.EmbeddingRanker();
    console.log("Initializing ONNX embedding model (this may take a few seconds on first run)...");
    await ranker.init();
    const authFile = 'authService.ts';
    const dbFile = 'database.ts';
    const btnFile = 'uiButton.tsx';
    // 1. Index files
    console.log("\nIndexing file signatures...");
    await ranker.indexFile(authFile, AUTH_CONTENT);
    await ranker.indexFile(dbFile, DB_CONTENT);
    await ranker.indexFile(btnFile, BUTTON_CONTENT);
    // 2. Rank query
    console.log("\nRanking files for semantic query: 'auth token login'...");
    const results = await ranker.rankFiles("auth token login", 3);
    console.log("Semantic search results:");
    results.forEach((r, idx) => console.log(` [${idx + 1}] File: ${r.filePath}, Score: ${r.score.toFixed(4)}`));
    if (results[0].filePath !== authFile) {
        throw new Error(`Semantic search ranked ${results[0].filePath} as #1 instead of ${authFile}!`);
    }
    // Check that the best result has significantly higher score than the rest
    if (results[0].score < results[1].score || results[0].score < results[2].score) {
        throw new Error("Rank #1 does not have the highest score!");
    }
    console.log("✓ Semantic ranking queries checks passed.");
    // 3. Telemetry Collector and Dashboard Renderer check
    console.log("\nTesting Telemetry Metrics Ledger & Console Dashboard...");
    const tempLedger = path.resolve(process.cwd(), 'telemetry_ledger_test.json');
    // Mock collector using temp ledger path
    const collector = new metricsCollector_1.MetricsCollector(process.cwd());
    // Temporarily swap ledgerPath
    collector.ledgerPath = tempLedger;
    // Cleanup old test file
    await fs_1.promises.unlink(tempLedger).catch(() => { });
    try {
        const sampleRaw = "const x = 10;\nconst y = 20;\nconsole.log(x + y);";
        const sampleComp = "const x = 10; ...";
        await collector.logMetrics('fileA.ts', sampleRaw, sampleComp, 'aggressive', 45);
        await collector.logMetrics('fileB.py', "def foo():\n    pass", "def foo(): ...", 'medium', 12);
        const records = await collector.getRecords();
        console.log(`Logged ${records.length} metrics records.`);
        if (records.length !== 2) {
            throw new Error("Telemetry record length mismatch!");
        }
        const dashboardOutput = (0, terminalConsole_1.renderDashboard)(records);
        console.log("Dashboard output:\n" + dashboardOutput);
        if (!dashboardOutput.includes("TOKENIST OPTIMIZATION LEDGER") || !dashboardOutput.includes("System Efficiency Rating")) {
            throw new Error("Telemetry dashboard formatting is incorrect!");
        }
        console.log("✓ Telemetry metrics logging and dashboard rendering checks passed.");
    }
    finally {
        // Cleanup temporary ledger file
        await fs_1.promises.unlink(tempLedger).catch(() => { });
    }
    console.log("\n=== All Embedding & Telemetry Tests Passed! ===");
}
runTests().catch((err) => {
    console.error("❌ Test Suite Failed:");
    console.error(err);
    process.exit(1);
});
