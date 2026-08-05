import * as vscode from 'vscode';
import { execFile } from 'child_process';
import * as path from 'path';

export class TokenistRunner {
  private outputChannel: vscode.OutputChannel;

  constructor() {
    this.outputChannel = vscode.window.createOutputChannel('Tokenist');
  }

  public async runInit(workspaceRoot: string): Promise<boolean> {
    this.outputChannel.show(true);
    this.outputChannel.appendLine('[Tokenist] Running workspace setup wizard...');

    return new Promise((resolve) => {
      execFile('npx', ['tokenist', 'init', '--yes'], { cwd: workspaceRoot, shell: true }, (err, stdout, stderr) => {
        if (stdout) this.outputChannel.appendLine(stdout);
        if (stderr) this.outputChannel.appendLine(stderr);

        if (err) {
          vscode.window.showErrorMessage(`Tokenist Init failed: ${err.message}`);
          resolve(false);
        } else {
          vscode.window.showInformationMessage('✓ Tokenist workspace configuration successfully created (.tokenist.json)!');
          resolve(true);
        }
      });
    });
  }

  public async runBenchmark(workspaceRoot: string): Promise<boolean> {
    this.outputChannel.show(true);
    this.outputChannel.appendLine('[Tokenist] Running codebase compression benchmark...');

    return new Promise((resolve) => {
      execFile('npx', ['tokenist', 'benchmark'], { cwd: workspaceRoot, shell: true }, (err, stdout, stderr) => {
        if (stdout) this.outputChannel.appendLine(stdout);
        if (stderr) this.outputChannel.appendLine(stderr);

        if (err) {
          vscode.window.showErrorMessage(`Tokenist Benchmark failed: ${err.message}`);
          resolve(false);
        } else {
          vscode.window.showInformationMessage('✓ Tokenist codebase benchmark completed successfully!');
          resolve(true);
        }
      });
    });
  }

  public dispose() {
    this.outputChannel.dispose();
  }
}
