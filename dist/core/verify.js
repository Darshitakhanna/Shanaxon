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
const guardrails_1 = require("./guardrails");
async function runTests() {
    console.log("=== Running Cross-Platform Path Guardrail Tests ===");
    const workspaceRoot = path.resolve(__dirname, '../../');
    console.log(`Workspace Root: ${workspaceRoot}`);
    // Test 1: normalizePath
    const tests = [
        { input: 'src/core/guardrails.ts', expected: path.join('src', 'core', 'guardrails.ts') },
        { input: 'src\\core\\guardrails.ts', expected: path.join('src', 'core', 'guardrails.ts') },
        { input: 'src/core\\guardrails.ts', expected: path.join('src', 'core', 'guardrails.ts') },
    ];
    for (const t of tests) {
        const output = (0, guardrails_1.normalizePath)(t.input);
        if (output !== t.expected) {
            throw new Error(`normalizePath failed for: "${t.input}". Expected: "${t.expected}", Got: "${output}"`);
        }
        console.log(`✓ normalizePath successfully normalized "${t.input}" -> "${output}"`);
    }
    // Test 2: validatePath with a valid existing file in the workspace
    const validFile = path.join(workspaceRoot, 'package.json');
    const isValid = await (0, guardrails_1.validatePath)(validFile, workspaceRoot);
    if (!isValid) {
        throw new Error(`validatePath failed: "${validFile}" was marked invalid but it is a valid file within base.`);
    }
    console.log(`✓ validatePath successfully validated valid file: "${validFile}"`);
    // Test 3: validatePath with directory traversal outside workspace
    const traversalFile = path.join(workspaceRoot, '../nonexistent_file_xyz.txt');
    const isTraversalValid = await (0, guardrails_1.validatePath)(traversalFile, workspaceRoot);
    if (isTraversalValid) {
        throw new Error(`validatePath failed: Traversal path "${traversalFile}" was marked valid but it is outside base.`);
    }
    console.log(`✓ validatePath successfully blocked traversal path: "${traversalFile}"`);
    // Test 4: validatePath for nonexistent file inside workspace (should return false because of fs.stat check)
    const nonexistentInside = path.join(workspaceRoot, 'nonexistent_file_123.txt');
    const isNonexistentValid = await (0, guardrails_1.validatePath)(nonexistentInside, workspaceRoot);
    if (isNonexistentValid) {
        throw new Error(`validatePath failed: Nonexistent file "${nonexistentInside}" was marked valid.`);
    }
    console.log(`✓ validatePath successfully blocked nonexistent file: "${nonexistentInside}"`);
    console.log("=== All Tests Passed Successfully! ===");
}
runTests().catch((err) => {
    console.error("❌ Test Suite Failed:");
    console.error(err);
    process.exit(1);
});
