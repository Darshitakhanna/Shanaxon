import * as vscode from 'vscode';
import { StatusBarManager } from './StatusBarManager';
import { ShanaxonRunner } from './ShanaxonRunner';
import { DashboardWebview } from './DashboardWebview';

let statusBarManager: StatusBarManager | undefined;
let runner: ShanaxonRunner | undefined;

export function activate(context: vscode.ExtensionContext) {
  const workspaceRoot = vscode.workspace.workspaceFolders?.[0]?.uri.fsPath || process.cwd();

  statusBarManager = new StatusBarManager();
  statusBarManager.startPolling(workspaceRoot);
  context.subscriptions.push(statusBarManager);

  runner = new ShanaxonRunner();
  context.subscriptions.push(runner);

  // 1. Show Analytics Dashboard Command
  const showDashboardCmd = vscode.commands.registerCommand('shanaxon.showDashboard', () => {
    DashboardWebview.createOrShow(context.extensionUri, workspaceRoot);
  });

  // 2. Initialize Workspace Wizard Command
  const initCmd = vscode.commands.registerCommand('shanaxon.init', async () => {
    await runner?.runInit(workspaceRoot);
    statusBarManager?.updateStats(workspaceRoot);
  });

  // 3. Reindex Workspace Command
  const reindexCmd = vscode.commands.registerCommand('shanaxon.reindex', () => {
    vscode.window.showInformationMessage('✓ Shanaxon workspace cache and PageRank graph reindexed.');
    statusBarManager?.updateStats(workspaceRoot);
  });

  // 4. Run Codebase Benchmark Command
  const runBenchmarkCmd = vscode.commands.registerCommand('shanaxon.runBenchmark', async () => {
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
