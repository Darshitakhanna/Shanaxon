import * as vscode from 'vscode';
import * as path from 'path';
import * as fs from 'fs';

export class DashboardWebview {
  public static currentPanel: vscode.WebviewPanel | undefined;

  public static createOrShow(extensionUri: vscode.Uri, workspaceRoot: string) {
    const column = vscode.window.activeTextEditor
      ? vscode.window.activeTextEditor.viewColumn
      : undefined;

    if (DashboardWebview.currentPanel) {
      DashboardWebview.currentPanel.reveal(column);
      return;
    }

    const panel = vscode.window.createWebviewPanel(
      'tokenistDashboard',
      '⚡ Tokenist Analytics',
      column || vscode.ViewColumn.One,
      {
        enableScripts: true,
        localResourceRoots: [extensionUri]
      }
    );

    DashboardWebview.currentPanel = panel;
    DashboardWebview.updateContent(panel, workspaceRoot);

    panel.onDidDispose(() => {
      DashboardWebview.currentPanel = undefined;
    }, null);
  }

  private static updateContent(panel: vscode.WebviewPanel, workspaceRoot: string) {
    let records: any[] = [];
    try {
      const ledgerPath = path.join(workspaceRoot, 'telemetry_ledger.json');
      if (fs.existsSync(ledgerPath)) {
        records = JSON.parse(fs.readFileSync(ledgerPath, 'utf-8'));
      }
    } catch {}

    let totalRaw = 0;
    let totalCompressed = 0;
    for (const r of records) {
      totalRaw += r.rawTokens || 0;
      totalCompressed += r.compressedTokens || 0;
    }

    const savedTokens = Math.max(0, totalRaw - totalCompressed);
    const savingsPct = totalRaw > 0 ? ((savedTokens / totalRaw) * 100).toFixed(1) : '0.0';
    const savedDollar = ((savedTokens / 1000000) * 3.00).toFixed(4);

    panel.webview.html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <title>Tokenist Analytics Dashboard</title>
  <style>
    body {
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
      padding: 24px;
      color: var(--vscode-foreground);
      background-color: var(--vscode-editor-background);
    }
    .grid {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(220px, 1fr));
      gap: 16px;
      margin-bottom: 24px;
    }
    .card {
      background: var(--vscode-editor-inactiveSelectionBackground);
      padding: 16px;
      border-radius: 8px;
      border: 1px solid var(--vscode-widget-border);
    }
    .card-title {
      font-size: 12px;
      text-transform: uppercase;
      opacity: 0.7;
      margin-bottom: 8px;
    }
    .card-value {
      font-size: 24px;
      font-weight: bold;
      color: #38bdf8;
    }
    table {
      width: 100%;
      border-collapse: collapse;
      margin-top: 16px;
    }
    th, td {
      text-align: left;
      padding: 8px 12px;
      border-bottom: 1px solid var(--vscode-widget-border);
    }
    th {
      background: var(--vscode-editor-inactiveSelectionBackground);
    }
  </style>
</head>
<body>
  <h2>⚡ Tokenist Analytics Ledger</h2>
  
  <div class="grid">
    <div class="card">
      <div class="card-title">Token Efficiency</div>
      <div class="card-value">${savingsPct}%</div>
    </div>
    <div class="card">
      <div class="card-title">Tokens Saved</div>
      <div class="card-value">${savedTokens.toLocaleString()}</div>
    </div>
    <div class="card">
      <div class="card-title">Estimated Cash Saved</div>
      <div class="card-value">$${savedDollar}</div>
    </div>
    <div class="card">
      <div class="card-title">Total Processed Calls</div>
      <div class="card-value">${records.length}</div>
    </div>
  </div>

  <h3>Recent Interceptions</h3>
  <table>
    <thead>
      <tr>
        <th>Timestamp</th>
        <th>File Path</th>
        <th>Tier</th>
        <th>Raw Tokens</th>
        <th>Compressed</th>
        <th>Savings</th>
      </tr>
    </thead>
    <tbody>
      ${records.slice(-10).reverse().map(r => `
        <tr>
          <td>${new Date(r.timestamp).toLocaleTimeString()}</td>
          <td>${r.filePath}</td>
          <td><code>${r.tier}</code></td>
          <td>${r.rawTokens}</td>
          <td>${r.compressedTokens}</td>
          <td>${r.savingsPct}%</td>
        </tr>
      `).join('')}
    </tbody>
  </table>
</body>
</html>`;
  }
}
