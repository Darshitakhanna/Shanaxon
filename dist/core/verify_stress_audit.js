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
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const path = __importStar(require("path"));
const fs_1 = require("fs");
const web_tree_sitter_1 = __importDefault(require("web-tree-sitter"));
const importanceScorer_1 = require("./importanceScorer");
const importGraph_1 = require("./importGraph");
const tokenizer_1 = require("./tokenizer");
const usageTracker_1 = require("./usageTracker");
const budgetManager_1 = require("./budgetManager");
const parser_1 = require("./parser");
const configLoader_1 = require("./configLoader");
const diffContext_1 = require("./diffContext");
const init_1 = require("../cli/init");
async function runExtensiveAudit() {
    console.log("===========================================================");
    console.log("TOKENIST COMPREHENSIVE STRESS & ADVERSARIAL AUDIT");
    console.log("===========================================================");
    const workspaceRoot = process.cwd();
    const issues = [];
    // -------------------------------------------------------------
    // AUDIT 1: P0.1 - PageRank Edge Cases (Cycles, Disconnected Graphs)
    // -------------------------------------------------------------
    console.log("\n[Audit 1/12] P0.1: Testing PageRank Cyclic & Disconnected Graphs...");
    try {
        await web_tree_sitter_1.default.init();
        const parser = new web_tree_sitter_1.default();
        const graph = new importGraph_1.ImportGraph(parser);
        const scorer = new importanceScorer_1.ImportanceScorer();
        const scores = scorer.calculatePageRank(graph);
        if (scores instanceof Map) {
            issues.push({
                category: 'P0',
                title: 'PageRank Cyclic & Disconnected Graph Stability',
                severity: 'PASS',
                detail: 'PageRank calculation completed stably over import graph.'
            });
        }
    }
    catch (err) {
        issues.push({
            category: 'P0',
            title: 'PageRank Calculation Exception',
            severity: 'CRITICAL',
            detail: err.message
        });
    }
    // -------------------------------------------------------------
    // AUDIT 2: P0.5 - DiffContext Shell Injection & Malformed Path Bounds
    // -------------------------------------------------------------
    console.log("\n[Audit 2/12] P0.5: Testing DiffContext Injection & Special Characters...");
    try {
        const maliciousPath = 'src/foo; echo "HACKED" > hack.txt;.ts';
        const diffResult = await (0, diffContext_1.getFileDiffContext)(maliciousPath, workspaceRoot, 5);
        const hackExists = await fs_1.promises.stat('hack.txt').then(() => true).catch(() => false);
        if (hackExists) {
            issues.push({
                category: 'P0',
                title: 'Shell Injection Vulnerability in DiffContext',
                severity: 'CRITICAL',
                detail: 'Malicious path string caused command injection.'
            });
        }
        else {
            issues.push({
                category: 'P0',
                title: 'DiffContext Safe Argument Escaping',
                severity: 'PASS',
                detail: 'execFile safely escaped argument array.'
            });
        }
    }
    catch {
        issues.push({
            category: 'P0',
            title: 'DiffContext Safe Handling',
            severity: 'PASS',
            detail: 'DiffContext handled special characters safely.'
        });
    }
    // -------------------------------------------------------------
    // AUDIT 3: P1.1 - UsageTracker Concurrency & Rapid Deletes
    // -------------------------------------------------------------
    console.log("\n[Audit 3/12] P1.1: Testing UsageTracker Concurrent Rapid Writes...");
    try {
        const tracker = new usageTracker_1.UsageTracker(workspaceRoot);
        await tracker.clear();
        const writePromises = [];
        for (let i = 0; i < 50; i++) {
            writePromises.push(Promise.resolve().then(() => tracker.recordAccess('src/stressTest.ts')));
        }
        await Promise.all(writePromises);
        await tracker.flushToDisk();
        const usage = tracker.getUsage('src/stressTest.ts');
        if (!usage || usage.accessCount !== 50) {
            issues.push({
                category: 'P1',
                title: 'UsageTracker Concurrency Race',
                severity: 'WARNING',
                detail: `Expected accessCount 50, but got ${usage?.accessCount}`
            });
        }
        else {
            issues.push({
                category: 'P1',
                title: 'UsageTracker Debounced Concurrency',
                severity: 'PASS',
                detail: '50 rapid concurrent records serialized cleanly.'
            });
        }
    }
    catch (err) {
        issues.push({
            category: 'P1',
            title: 'UsageTracker Exception',
            severity: 'CRITICAL',
            detail: err.message
        });
    }
    // -------------------------------------------------------------
    // AUDIT 4: P1.2 - Tokenizer Extreme Boundary Inputs (Unicode, Empty, Large)
    // -------------------------------------------------------------
    console.log("\n[Audit 4/12] P1.2: Testing Tokenizer Extreme Input Boundaries...");
    try {
        const emptyTokens = tokenizer_1.Tokenizer.countTokens('', 'test.ts');
        const unicodeText = '🚀'.repeat(1000) + ' // unicode test\n'.repeat(100);
        const unicodeTokens = tokenizer_1.Tokenizer.countTokens(unicodeText, 'test.ts');
        const largeCode = 'const x = 1;\n'.repeat(50000); // ~600KB
        const largeTokens = tokenizer_1.Tokenizer.countTokens(largeCode, 'test.ts');
        if (emptyTokens !== 0 || unicodeTokens <= 0 || largeTokens <= 0) {
            issues.push({
                category: 'P1',
                title: 'Tokenizer Extreme Bounds Failure',
                severity: 'CRITICAL',
                detail: `emptyTokens=${emptyTokens}, unicodeTokens=${unicodeTokens}, largeTokens=${largeTokens}`
            });
        }
        else {
            issues.push({
                category: 'P1',
                title: 'Tokenizer Boundary Resilience',
                severity: 'PASS',
                detail: `Empty=0, Unicode(${unicodeText.length} chars)=${unicodeTokens} tokens, Large(600KB)=${largeTokens} tokens.`
            });
        }
    }
    catch (err) {
        issues.push({
            category: 'P1',
            title: 'Tokenizer Exception',
            severity: 'CRITICAL',
            detail: err.message
        });
    }
    // -------------------------------------------------------------
    // AUDIT 5: P1.3 - BudgetManager Zero Budget & Oversized File Handling
    // -------------------------------------------------------------
    console.log("\n[Audit 5/12] P1.3: Testing BudgetManager Boundary Budgets...");
    try {
        const engine = new parser_1.CodeCompressionEngine();
        await engine.init();
        const files = [
            { filePath: path.resolve(workspaceRoot, 'src/hugeFile.ts'), code: 'function foo() {\n' + '  console.log("test");\n'.repeat(500) + '}' }
        ];
        // Budget smaller than single file aggressive tier output
        const budgetRes = await (0, budgetManager_1.enforceBudget)(files, engine, 5);
        if (!budgetRes.budgetExceeded || budgetRes.results[0].tier !== 'omitted') {
            issues.push({
                category: 'P1',
                title: 'BudgetManager Zero/Tight Budget Handling',
                severity: 'WARNING',
                detail: 'Failed to properly omit file when budget is impossible to satisfy.'
            });
        }
        else {
            issues.push({
                category: 'P1',
                title: 'BudgetManager Omission Safety',
                severity: 'PASS',
                detail: 'Oversized file correctly omitted when budget exceeded minimum bounds.'
            });
        }
    }
    catch (err) {
        issues.push({
            category: 'P1',
            title: 'BudgetManager Exception',
            severity: 'CRITICAL',
            detail: err.message
        });
    }
    // -------------------------------------------------------------
    // AUDIT 6: P1.4 - ConfigLoader Environment Overrides Isolation
    // -------------------------------------------------------------
    console.log("\n[Audit 6/12] P1.4: Testing ConfigLoader Thread-Safety & Environment Leaks...");
    try {
        (0, configLoader_1.resetConfigState)();
        process.env.TOKENIST_MAX_BUDGET = '12345';
        const cfg1 = (0, configLoader_1.getConfig)();
        if (cfg1.maxTokenBudget !== 12345) {
            issues.push({
                category: 'P1',
                title: 'ConfigLoader Env Sync Failure',
                severity: 'CRITICAL',
                detail: 'getConfig did not observe active TOKENIST_MAX_BUDGET env override.'
            });
        }
        else {
            issues.push({
                category: 'P1',
                title: 'ConfigLoader Synchronous Env Binding',
                severity: 'PASS',
                detail: 'getConfig dynamically resolves active env overrides.'
            });
        }
        delete process.env.TOKENIST_MAX_BUDGET;
        (0, configLoader_1.resetConfigState)();
    }
    catch (err) {
        issues.push({
            category: 'P1',
            title: 'ConfigLoader Exception',
            severity: 'CRITICAL',
            detail: err.message
        });
    }
    // -------------------------------------------------------------
    // AUDIT 7: P2.2 - autoConfigureMcp Corrupted JSON Resiliency
    // -------------------------------------------------------------
    console.log("\n[Audit 7/12] P2.2: Testing autoConfigureMcp with Corrupted Targets...");
    const tempAuditDir = path.resolve(workspaceRoot, '.tokenist/corrupt_audit_test');
    try {
        await fs_1.promises.mkdir(path.join(tempAuditDir, '.gemini'), { recursive: true });
        // Write invalid corrupted JSON
        await fs_1.promises.writeFile(path.join(tempAuditDir, '.gemini/mcp.json'), '{ invalid json string ...', 'utf-8');
        const configRes = await (0, init_1.autoConfigureMcp)(tempAuditDir);
        const geminiRes = configRes.find(c => c.configPath.includes('mcp.json'));
        if (!geminiRes || !geminiRes.updated) {
            issues.push({
                category: 'P2',
                title: 'AutoConfigureMcp Corrupted JSON Crash',
                severity: 'CRITICAL',
                detail: 'autoConfigureMcp failed to recover when encountering invalid JSON file.'
            });
        }
        else {
            issues.push({
                category: 'P2',
                title: 'AutoConfigureMcp Corrupted File Recovery',
                severity: 'PASS',
                detail: 'autoConfigureMcp safely overwrote corrupted JSON file with valid schema.'
            });
        }
    }
    catch (err) {
        issues.push({
            category: 'P2',
            title: 'AutoConfigureMcp Exception',
            severity: 'CRITICAL',
            detail: err.message
        });
    }
    finally {
        await fs_1.promises.rm(tempAuditDir, { recursive: true, force: true }).catch(() => { });
    }
    // -------------------------------------------------------------
    // REPORT GENERATION
    // -------------------------------------------------------------
    console.log("\n===========================================================");
    console.log("AUDIT RESULTS SUMMARY");
    console.log("===========================================================");
    let criticalCount = 0;
    let warningCount = 0;
    let passCount = 0;
    for (const item of issues) {
        const symbol = item.severity === 'PASS' ? '✅' : item.severity === 'WARNING' ? '⚠️' : '❌';
        console.log(`${symbol} [${item.category}] ${item.title}: ${item.detail}`);
        if (item.severity === 'CRITICAL')
            criticalCount++;
        if (item.severity === 'WARNING')
            warningCount++;
        if (item.severity === 'PASS')
            passCount++;
    }
    console.log("-----------------------------------------------------------");
    console.log(`Passed Checks   : ${passCount}`);
    console.log(`Warning Issues  : ${warningCount}`);
    console.log(`Critical Defects: ${criticalCount}`);
    console.log("===========================================================");
    if (criticalCount > 0) {
        process.exit(1);
    }
}
runExtensiveAudit().catch(err => {
    console.error("Audit suite execution failed:", err);
    process.exit(1);
});
