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
exports.StatusBarManager = void 0;
const vscode = __importStar(require("vscode"));
const path = __importStar(require("path"));
const fs = __importStar(require("fs"));
class StatusBarManager {
    statusBarItem;
    updateInterval = null;
    constructor() {
        this.statusBarItem = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Right, 100);
        this.statusBarItem.command = 'tokenist.showDashboard';
        this.statusBarItem.tooltip = 'Click to open Tokenist Analytics Dashboard';
        this.statusBarItem.text = '$(zap) Tokenist: Ready';
        this.statusBarItem.show();
    }
    startPolling(workspaceRoot) {
        this.updateStats(workspaceRoot);
        if (!this.updateInterval) {
            this.updateInterval = setInterval(() => {
                this.updateStats(workspaceRoot);
            }, 5000); // Refresh status bar every 5 seconds
        }
    }
    updateStats(workspaceRoot) {
        const metrics = this.readTelemetry(workspaceRoot);
        if (!metrics || metrics.totalRawTokens === 0) {
            this.statusBarItem.text = '$(zap) Tokenist: Active';
            return;
        }
        const pct = metrics.savingsPct.toFixed(1);
        const savedDollar = metrics.totalDollarSaved.toFixed(2);
        this.statusBarItem.text = `$(zap) Tokenist: ${pct}% Saved ($${savedDollar})`;
    }
    readTelemetry(workspaceRoot) {
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
        }
        catch {
            return null;
        }
    }
    dispose() {
        if (this.updateInterval) {
            clearInterval(this.updateInterval);
            this.updateInterval = null;
        }
        this.statusBarItem.dispose();
    }
}
exports.StatusBarManager = StatusBarManager;
//# sourceMappingURL=StatusBarManager.js.map