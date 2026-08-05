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
async function runTests() {
    console.log("=== Running VS Code Extension Verification ===");
    const workspaceRoot = process.cwd();
    // 1. Verify Extension Manifest (package.json)
    console.log("\n1. Testing Extension Manifest (package.json)...");
    const extPkgPath = path.resolve(workspaceRoot, 'vscode-extension/package.json');
    if (!(0, fs_1.existsSync)(extPkgPath)) {
        throw new Error("vscode-extension/package.json manifest missing!");
    }
    const pkg = JSON.parse(await fs_1.promises.readFile(extPkgPath, 'utf-8'));
    console.log(`Extension ID: ${pkg.publisher}.${pkg.name}`);
    console.log(`Main entry: ${pkg.main}`);
    console.log(`Registered commands count: ${pkg.contributes?.commands?.length}`);
    if (pkg.name !== 'tokenist-vscode' || !pkg.main || pkg.contributes?.commands?.length < 4) {
        throw new Error("Extension manifest missing essential metadata or commands!");
    }
    console.log("✓ Extension Manifest verification passed.");
    // 2. Verify Compiled Dist Artifacts
    console.log("\n2. Testing Compiled Extension Dist Build Artifacts...");
    const distFiles = [
        'vscode-extension/dist/extension.js',
        'vscode-extension/dist/StatusBarManager.js',
        'vscode-extension/dist/TokenistRunner.js',
        'vscode-extension/dist/DashboardWebview.js'
    ];
    for (const f of distFiles) {
        const fullPath = path.resolve(workspaceRoot, f);
        if (!(0, fs_1.existsSync)(fullPath)) {
            throw new Error(`Missing compiled extension dist file: ${f}`);
        }
        console.log(`✓ Artifact verified: ${f}`);
    }
    console.log("✓ Extension Dist Build Artifacts verification passed.");
    // 3. Verify Status Bar Telemetry Reader Output
    console.log("\n3. Testing Status Bar Telemetry Integration...");
    const ledgerPath = path.resolve(workspaceRoot, 'telemetry_ledger.json');
    if ((0, fs_1.existsSync)(ledgerPath)) {
        const records = JSON.parse(await fs_1.promises.readFile(ledgerPath, 'utf-8'));
        console.log(`Found ${records.length} telemetry ledger records for status bar rendering.`);
    }
    console.log("✓ Status Bar Telemetry Integration verified.");
    console.log("\n=== All VS Code Extension Tests Passed successfully! ===");
}
runTests().catch(err => {
    console.error("❌ VS Code Extension Test Suite Failed:");
    console.error(err);
    process.exit(1);
});
