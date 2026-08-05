"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const historyPruner_1 = require("../middleware/historyPruner");
const promptRouter_1 = require("../middleware/promptRouter");
function runHistoryPrunerTests() {
    console.log("\n--- Testing historyPruner.ts ---");
    const testMessages = [
        { role: 'system', content: 'You are an AI assistant.' },
        // Turn 1 (Old) - has a stack trace. Should collapse.
        { role: 'user', content: 'I got this error:\nError: Connection failed\n    at Socket.connect (net.js:123:4)\n    at processTicksAndRejections (task_queues:82:21)\nCan you help?' },
        { role: 'assistant', content: 'Yes, it looks like a network timeout.' },
        // Turn 2 (Old) - has a long terminal dump. Should be replaced.
        { role: 'user', content: 'Here is the build trace:\nnpm ERR! code ELIFECYCLE\nnpm ERR! errno 1\nnpm ERR! dharohar@1.0.0 build: `tsc`\nnpm ERR! Exit status 1\nnode:internal/modules/cjs/loader:936\nFullyQualifiedErrorId: BuildFailed\n' + 'a'.repeat(250) },
        { role: 'assistant', content: 'The compilation failed. Try resolving types.' },
        // Turn 3 (Recent - Protected) - has a stack trace. MUST be kept intact.
        { role: 'user', content: 'Error: Verification failed\n    at verify (verify.js:12:3)\n    at main (main.js:5:2)' },
        { role: 'assistant', content: 'Let me look at verify.js.' },
        // Turn 4 (Recent - Protected)
        { role: 'user', content: 'What is the current status?' },
        { role: 'assistant', content: 'We are on Phase 4.' }
    ];
    // We prune history with maxTurns = 2 (meaning the last 4 non-system messages are protected)
    const pruned = (0, historyPruner_1.pruneHistory)(testMessages, 2);
    // Assertion 1: System prompt is preserved
    if (pruned[0].role !== 'system') {
        throw new Error("System message was lost!");
    }
    // Assertion 2: Old Turn 1 stack trace is collapsed
    const oldTurn1 = pruned.find(m => m.content.includes("Connection failed"));
    if (!oldTurn1)
        throw new Error("Old Turn 1 was lost!");
    if (!oldTurn1.content.includes("[Stack trace collapsed]") || oldTurn1.content.includes("processTicksAndRejections")) {
        throw new Error("Old Turn 1 stack trace was not collapsed correctly! Output: " + oldTurn1.content);
    }
    // Assertion 3: Old Turn 2 long terminal dump is pruned
    const oldTurn2 = pruned.find(m => m.content.includes("removed to save context tokens"));
    if (!oldTurn2) {
        throw new Error("Old Turn 2 terminal dump was not replaced!");
    }
    // Assertion 4: Recent Turn 3 stack trace is preserved intact
    const recentTurn3 = pruned.find(m => m.content.includes("Verification failed"));
    if (!recentTurn3)
        throw new Error("Recent protected Turn 3 was lost!");
    if (!recentTurn3.content.includes("verify.js:12:3")) {
        throw new Error("Protected turn was modified! Output: " + recentTurn3.content);
    }
    console.log("✓ All historyPruner tests passed successfully.");
}
function runPromptRouterTests() {
    console.log("\n--- Testing promptRouter.ts ---");
    const files = [
        {
            filePath: 'src/core/guardrails.ts',
            signatures: 'export function validatePath(...)',
            rawCode: 'export function validatePath(path) { return true; } // RAW GUARDRAILS'
        },
        {
            filePath: 'src/core/parser.ts',
            signatures: 'export class CodeCompressionEngine(...)',
            rawCode: 'export class CodeCompressionEngine { ... } // RAW PARSER'
        }
    ];
    // Test 1: Non-edit intent query
    const query1 = "explain how guardrails.ts works";
    const result1 = (0, promptRouter_1.routePrompt)(query1, files);
    if (result1.some(r => r.swapped)) {
        throw new Error("Test 1 failed: Swapped files on a read-only query!");
    }
    if (result1[0].content !== files[0].signatures) {
        throw new Error("Test 1 failed: Content did not match signatures!");
    }
    // Test 2: Edit intent query
    const query2 = "update src/core/guardrails.ts to allow absolute paths";
    const result2 = (0, promptRouter_1.routePrompt)(query2, files);
    const guardrailsRes = result2.find(r => r.filePath === 'src/core/guardrails.ts');
    const parserRes = result2.find(r => r.filePath === 'src/core/parser.ts');
    if (!guardrailsRes.swapped || guardrailsRes.content !== files[0].rawCode) {
        throw new Error("Test 2 failed: guardrails.ts was not swapped with raw code!");
    }
    if (parserRes.swapped || parserRes.content !== files[1].signatures) {
        throw new Error("Test 2 failed: parser.ts was incorrectly swapped!");
    }
    // Test 3: Edit intent using base name
    const query3 = "modify parser.ts please";
    const result3 = (0, promptRouter_1.routePrompt)(query3, files);
    const guardrailsRes3 = result3.find(r => r.filePath === 'src/core/guardrails.ts');
    const parserRes3 = result3.find(r => r.filePath === 'src/core/parser.ts');
    if (guardrailsRes3.swapped) {
        throw new Error("Test 3 failed: guardrails.ts was incorrectly swapped!");
    }
    if (!parserRes3.swapped || parserRes3.content !== files[1].rawCode) {
        throw new Error("Test 3 failed: parser.ts was not swapped using its base name!");
    }
    console.log("✓ All promptRouter tests passed successfully.");
}
console.log("=== Running Dharohar Prompt Middleware Tests ===");
try {
    runHistoryPrunerTests();
    runPromptRouterTests();
    console.log("\n=== All Middleware Verification Tests Passed Successfully! ===");
    process.exit(0);
}
catch (error) {
    console.error("❌ Middleware Verification Tests Failed:");
    console.error(error);
    process.exit(1);
}
