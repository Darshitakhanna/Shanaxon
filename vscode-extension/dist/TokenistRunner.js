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
exports.TokenistRunner = void 0;
const vscode = __importStar(require("vscode"));
const child_process_1 = require("child_process");
class TokenistRunner {
    outputChannel;
    constructor() {
        this.outputChannel = vscode.window.createOutputChannel('Tokenist');
    }
    async runInit(workspaceRoot) {
        this.outputChannel.show(true);
        this.outputChannel.appendLine('[Tokenist] Running workspace setup wizard...');
        return new Promise((resolve) => {
            (0, child_process_1.execFile)('npx', ['tokenist', 'init', '--yes'], { cwd: workspaceRoot, shell: true }, (err, stdout, stderr) => {
                if (stdout)
                    this.outputChannel.appendLine(stdout);
                if (stderr)
                    this.outputChannel.appendLine(stderr);
                if (err) {
                    vscode.window.showErrorMessage(`Tokenist Init failed: ${err.message}`);
                    resolve(false);
                }
                else {
                    vscode.window.showInformationMessage('✓ Tokenist workspace configuration successfully created (.tokenist.json)!');
                    resolve(true);
                }
            });
        });
    }
    async runBenchmark(workspaceRoot) {
        this.outputChannel.show(true);
        this.outputChannel.appendLine('[Tokenist] Running codebase compression benchmark...');
        return new Promise((resolve) => {
            (0, child_process_1.execFile)('npx', ['tokenist', 'benchmark'], { cwd: workspaceRoot, shell: true }, (err, stdout, stderr) => {
                if (stdout)
                    this.outputChannel.appendLine(stdout);
                if (stderr)
                    this.outputChannel.appendLine(stderr);
                if (err) {
                    vscode.window.showErrorMessage(`Tokenist Benchmark failed: ${err.message}`);
                    resolve(false);
                }
                else {
                    vscode.window.showInformationMessage('✓ Tokenist codebase benchmark completed successfully!');
                    resolve(true);
                }
            });
        });
    }
    dispose() {
        this.outputChannel.dispose();
    }
}
exports.TokenistRunner = TokenistRunner;
//# sourceMappingURL=TokenistRunner.js.map