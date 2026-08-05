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
exports.DashboardWebview = void 0;
const vscode = __importStar(require("vscode"));
const path = __importStar(require("path"));
const fs = __importStar(require("fs"));
class DashboardWebview {
    static currentPanel;
    static createOrShow(extensionUri, workspaceRoot) {
        const column = vscode.window.activeTextEditor
            ? vscode.window.activeTextEditor.viewColumn
            : undefined;
        if (DashboardWebview.currentPanel) {
            DashboardWebview.currentPanel.reveal(column);
            return;
        }
        const panel = vscode.window.createWebviewPanel('tokenistDashboard', '⚡ Tokenist Analytics', column || vscode.ViewColumn.One, {
            enableScripts: true,
            localResourceRoots: [extensionUri]
        });
        DashboardWebview.currentPanel = panel;
        DashboardWebview.updateContent(panel, workspaceRoot);
        panel.onDidDispose(() => {
            DashboardWebview.currentPanel = undefined;
        }, null);
    }
    static updateContent(panel, workspaceRoot) {
        let records = [];
        try {
            const ledgerPath = path.join(workspaceRoot, 'telemetry_ledger.json');
            if (fs.existsSync(ledgerPath)) {
                records = JSON.parse(fs.readFileSync(ledgerPath, 'utf-8'));
            }
        }
        catch { }
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
exports.DashboardWebview = DashboardWebview;
//# sourceMappingURL=DashboardWebview.js.map