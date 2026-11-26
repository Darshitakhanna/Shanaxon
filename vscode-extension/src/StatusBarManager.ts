import * as vscode from 'vscode';
import * as path from 'path';
import * as fs from 'fs';

export interface TelemetryMetrics {
  totalRawTokens: number;
  totalCompressedTokens: number;
  savingsPct: number;
  totalDollarSaved: number;
}

export class StatusBarManager {
  private statusBarItem: vscode.StatusBarItem;
  private updateInterval: NodeJS.Timeout | null = null;

  constructor() {
    this.statusBarItem = vscode.window.createStatusBarItem(
      vscode.StatusBarAlignment.Right,
      100
    );
    this.statusBarItem.command = 'shanaxon.showDashboard';
    this.statusBarItem.tooltip = 'Click to open Shanaxon Analytics Dashboard';
    this.statusBarItem.text = '$(zap) Shanaxon: Ready';
    this.statusBarItem.show();
  }

  public startPolling(workspaceRoot: string) {
    this.updateStats(workspaceRoot);
    if (!this.updateInterval) {
      this.updateInterval = setInterval(() => {
        this.updateStats(workspaceRoot);
      }, 5000); // Refresh status bar every 5 seconds
    }
  }

  public updateStats(workspaceRoot: string) {
    const metrics = this.readTelemetry(workspaceRoot);
    if (!metrics || metrics.totalRawTokens === 0) {
      this.statusBarItem.text = '$(zap) Shanaxon: Active';
      return;
    }

    const pct = metrics.savingsPct.toFixed(1);
    const savedDollar = metrics.totalDollarSaved.toFixed(2);
    this.statusBarItem.text = `$(zap) Shanaxon: ${pct}% Saved ($${savedDollar})`;
  }

  private readTelemetry(workspaceRoot: string): TelemetryMetrics | null {
    try {
      const ledgerPath = path.join(workspaceRoot, 'telemetry_ledger.json');
      if (!fs.existsSync(ledgerPath)) {
        return null;
      }

      const rawData = fs.readFileSync(ledgerPath, 'utf-8');
      const records = JSON.parse(rawData);
      if (!Array.isArray(records) || records.length === 0) {
        return null;
      }

      let totalRaw = 0;
      let totalCompressed = 0;

      for (const rec of records) {
        totalRaw += rec.rawTokens || 0;
        totalCompressed += rec.compressedTokens || 0;
      }

      const savedTokens = Math.max(0, totalRaw - totalCompressed);
      const savingsPct = totalRaw > 0 ? (savedTokens / totalRaw) * 100 : 0;
      // Claude Sonnet pricing baseline ($3.00/1M tokens)
      const totalDollarSaved = (savedTokens / 1000000) * 3.00;

      return {
        totalRawTokens: totalRaw,
        totalCompressedTokens: totalCompressed,
        savingsPct,
        totalDollarSaved
      };
    } catch {
      return null;
    }
  }

  public dispose() {
    if (this.updateInterval) {
      clearInterval(this.updateInterval);
      this.updateInterval = null;
    }
    this.statusBarItem.dispose();
  }
}
