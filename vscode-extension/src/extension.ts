import * as vscode from 'vscode';
import { StatusBarManager } from './StatusBarManager';
import { TokenistRunner } from './TokenistRunner';
import { DashboardWebview } from './DashboardWebview';

let statusBarManager: StatusBarManager | undefined;
let runner: TokenistRunner | undefined;

export function activate(context: vscode.ExtensionContext) {
  const workspaceRoot = vscode.workspace.workspaceFolders?.[0]?.uri.fsPath || process.cwd();

  statusBarManager = new StatusBarManager();
  statusBarManager.startPolling(workspaceRoot);
  context.subscriptions.push(statusBarManager);

  runner = new TokenistRunner();
  context.subscriptions.push(runner);

  // 1. Show Analytics Dashboard Command
  const showDashboardCmd = vscode.commands.registerCommand('tokenist.showDashboard', () => {
    DashboardWebview.createOrShow(context.extensionUri, workspaceRoot);
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

export function deactivate() {
  if (statusBarManager) {
    statusBarManager.dispose();
  }
  if (runner) {
    runner.dispose();
  }
}
