import * as vscode from 'vscode';
import { execFile } from 'child_process';

export class ShanaxonRunner {
  private outputChannel: vscode.OutputChannel;

  constructor() {
    this.outputChannel = vscode.window.createOutputChannel('Shanaxon');
  }

  public async runInit(workspaceRoot: string): Promise<boolean> {
    this.outputChannel.show(true);
    this.outputChannel.appendLine('[Shanaxon] Running workspace setup wizard...');

    return new Promise((resolve) => {
      execFile('npx', ['shanaxon', 'init', '--yes'], { cwd: workspaceRoot, shell: true }, (err, stdout, stderr) => {
        if (stdout) this.outputChannel.appendLine(stdout);
        if (stderr) this.outputChannel.appendLine(stderr);

        if (err) {
          vscode.window.showErrorMessage(`Shanaxon Init failed: ${err.message}`);
          resolve(false);
        } else {
          vscode.window.showInformationMessage('✓ Shanaxon workspace configuration successfully created (.shanaxon.json)!');
          resolve(true);
        }
      });
    });
  }

  public async runBenchmark(workspaceRoot: string): Promise<boolean> {
    this.outputChannel.show(true);
    this.outputChannel.appendLine('[Shanaxon] Running codebase compression benchmark...');

    return new Promise((resolve) => {
      execFile('npx', ['shanaxon', 'benchmark'], { cwd: workspaceRoot, shell: true }, (err, stdout, stderr) => {
        if (stdout) this.outputChannel.appendLine(stdout);
        if (stderr) this.outputChannel.appendLine(stderr);

        if (err) {
          vscode.window.showErrorMessage(`Shanaxon Benchmark failed: ${err.message}`);
          resolve(false);
        } else {
          vscode.window.showInformationMessage('✓ Shanaxon codebase benchmark completed successfully!');
          resolve(true);
        }
      });
    });
  }

  public dispose() {
    this.outputChannel.dispose();
  }
}
