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
exports.activate = activate;
exports.deactivate = deactivate;
const vscode = __importStar(require("vscode"));
const StatusBarManager_1 = require("./StatusBarManager");
const TokenistRunner_1 = require("./TokenistRunner");
const DashboardWebview_1 = require("./DashboardWebview");
let statusBarManager;
let runner;
function activate(context) {
    const workspaceRoot = vscode.workspace.workspaceFolders?.[0]?.uri.fsPath || process.cwd();
    statusBarManager = new StatusBarManager_1.StatusBarManager();
    statusBarManager.startPolling(workspaceRoot);
    context.subscriptions.push(statusBarManager);
    runner = new TokenistRunner_1.TokenistRunner();
    context.subscriptions.push(runner);
    // 1. Show Analytics Dashboard Command
    const showDashboardCmd = vscode.commands.registerCommand('tokenist.showDashboard', () => {
        DashboardWebview_1.DashboardWebview.createOrShow(context.extensionUri, workspaceRoot);
    });
    // 2. Initialize Workspace Wizard Command
    const initCmd = vscode.commands.registerCommand('tokenist.init', async () => {
        await runner?.runInit(workspaceRoot);
        statusBarManager?.updateStats(workspaceRoot);
    });
    // 3. Reindex Workspace Command
    const reindexCmd = vscode.commands.registerCommand('tokenist.reindex', () => {
        vscode.window.showInformationMessage('✓ Tokenist workspace cache and PageRank graph reindexed.');
        statusBarManager?.updateStats(workspaceRoot);
    });
    // 4. Run Codebase Benchmark Command
    const runBenchmarkCmd = vscode.commands.registerCommand('tokenist.runBenchmark', async () => {
        await runner?.runBenchmark(workspaceRoot);
        statusBarManager?.updateStats(workspaceRoot);
    });
    context.subscriptions.push(showDashboardCmd, initCmd, reindexCmd, runBenchmarkCmd);
}
function deactivate() {
    if (statusBarManager) {
        statusBarManager.dispose();
    }
    if (runner) {
        runner.dispose();
    }
}
//# sourceMappingURL=extension.js.map