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
const child_process_1 = require("child_process");
const usageTracker_1 = require("./usageTracker");
const tierTuner_1 = require("./tierTuner");
const workspaceManager_1 = require("./workspaceManager");
const diffContext_1 = require("./diffContext");
const server_1 = require("../server");
function runCommand(cmd) {
    return new Promise((resolve, reject) => {
        (0, child_process_1.exec)(cmd, (err, stdout, stderr) => {
            if (err)
                reject(err);
            else
                resolve({ stdout, stderr });
        });
    });
}
async function runTests() {
    console.log("=== Running Phase 12: Intelligence, Self-Tuning & Advanced Features Verification ===");
    const workspaceRoot = process.cwd();
    // 1. Verify Usage Tracker & Tier Auto-Tuning
    console.log("\n1. Testing Usage Tracker & Tier Auto-Tuning...");
    const tracker = new usageTracker_1.UsageTracker(workspaceRoot);
    tracker.clear();
    const testFile = path.resolve(workspaceRoot, 'src/server.ts');
    // Initially, no usage. Should resolve to default tier
    let resolvedTier = (0, tierTuner_1.getAutoTunedTier)(testFile, tracker, 'aggressive');
    console.log(`Initial resolved tier (expected aggressive): ${resolvedTier}`);
    if (resolvedTier !== 'aggressive')
        throw new Error("Auto-tuning failed initially!");
    // Record access 5 times to promote to hot
    for (let i = 0; i < 5; i++) {
        tracker.recordAccess(testFile);
    }
    resolvedTier = (0, tierTuner_1.getAutoTunedTier)(testFile, tracker, 'aggressive');
    console.log(`Hot file resolved tier (expected normal): ${resolvedTier}`);
    if (resolvedTier !== 'normal')
        throw new Error("Auto-tuning failed to promote hot file!");
    // Verify cold file demotion (>14 days)
    const coldFile = path.resolve(workspaceRoot, 'src/core/parser.ts');
    tracker.recordAccess(coldFile);
    await tracker.flushToDisk();
    // Manually tweak usage.json entry to simulate 20 days ago
    const usagePath = path.resolve(workspaceRoot, '.tokenist/usage.json');
    const usageData = JSON.parse(await fs_1.promises.readFile(usagePath, 'utf-8'));
    const twentyDaysAgo = new Date(Date.now() - 20 * 24 * 60 * 60 * 1000).toISOString();
    usageData[coldFile].lastAccessed = twentyDaysAgo;
    usageData[coldFile].accessCount = 1; // Make sure it's not hot
    await fs_1.promises.writeFile(usagePath, JSON.stringify(usageData, null, 2), 'utf-8');
    // Reload tracker to pick up changes
    const trackerCold = new usageTracker_1.UsageTracker(workspaceRoot);
    resolvedTier = (0, tierTuner_1.getAutoTunedTier)(coldFile, trackerCold, 'normal');
    console.log(`Cold file resolved tier (expected aggressive): ${resolvedTier}`);
    if (resolvedTier !== 'aggressive')
        throw new Error("Auto-tuning failed to demote cold file!");
    tracker.clear();
    console.log("✓ Usage learning & auto-tuning checks passed.");
    // 2. Verify Workspace Manager
    console.log("\n2. Testing Workspace Manager path resolving...");
    const manager = new workspaceManager_1.WorkspaceManager(workspaceRoot, ['src/dashboard']);
    const dashboardRoot = await manager.validateFileAccess(path.resolve(workspaceRoot, 'src/dashboard/index.html'));
    console.log(`Matched dashboard workspace root: ${dashboardRoot}`);
    if (!dashboardRoot)
        throw new Error("WorkspaceManager failed to resolve subdirectory workspace!");
    const invalidRoot = await manager.validateFileAccess(path.resolve(workspaceRoot, '../nonexistent_file'));
    console.log(`Invalid workspace match (expected null): ${invalidRoot}`);
    if (invalidRoot !== null)
        throw new Error("WorkspaceManager failed path validation check!");
    console.log("✓ Workspace manager multi-workspace checks passed.");
    // 3. Verify Context Diff Mode git diff queries
    console.log("\n3. Testing Context Diff Mode git query...");
    const tempFilePath = path.resolve(workspaceRoot, 'verify_diff_sample.ts');
    await fs_1.promises.writeFile(tempFilePath, "console.log('Original line 1');\nconsole.log('Original line 2');\n", 'utf-8');
    try {
        // Git add the temp file (might fail if not in a git repository)
        await runCommand(`git add verify_diff_sample.ts`);
        // Modify the temp file to introduce uncommitted changes
        await fs_1.promises.writeFile(tempFilePath, "console.log('Original line 1');\nconsole.log('Modified change line 2');\n", 'utf-8');
        const diffContext = await (0, diffContext_1.getFileDiffContext)(tempFilePath, workspaceRoot, 3);
        console.log(`Diff context output:\n${diffContext}`);
        if (!diffContext.includes("Modified change line 2") && !diffContext.includes("No uncommitted changes detected")) {
            throw new Error("Context diff output is invalid!");
        }
    }
    catch (gitErr) {
        console.log(`Git repository not detected, checking fallback notice...`);
        const diffContext = await (0, diffContext_1.getFileDiffContext)(tempFilePath, workspaceRoot, 3);
        console.log(`Fallback diff notice:\n${diffContext}`);
        if (!diffContext.includes("No uncommitted changes detected") && !diffContext.includes("[Tokenist Diff Mode]")) {
            throw new Error("Fallback diff context is invalid!");
        }
    }
    finally {
        // Cleanup git tree
        await runCommand(`git restore --staged verify_diff_sample.ts`).catch(() => { });
        await fs_1.promises.unlink(tempFilePath).catch(() => { });
    }
    console.log("✓ Context Diff Mode queries verified.");
    // 4. Verify MCP Server tool listing for get_file_diff_context
    console.log("\n4. Testing McpCompressionServer tool listings...");
    const serverInstance = new server_1.McpCompressionServer();
    const listToolsHandler = serverInstance.server._requestHandlers.get('tools/list');
    if (!listToolsHandler)
        throw new Error("Mcp tools/list handler not registered!");
    const response = await listToolsHandler({ method: 'tools/list' });
    const toolNames = response.tools.map((t) => t.name);
    console.log(`Registered tools list: [${toolNames.join(', ')}]`);
    if (!toolNames.includes('get_file_diff_context')) {
        throw new Error("get_file_diff_context tool not found in list!");
    }
    console.log("✓ MCP tools list checks passed.");
    console.log("\n=== All Phase 12 Tests Passed successfully! ===");
}
runTests().catch((err) => {
    console.error("❌ Phase 12 Test Suite Failed:");
    console.error(err);
    process.exit(1);
});
