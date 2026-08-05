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
exports.MetricsCollector = void 0;
const fs_1 = require("fs");
const path = __importStar(require("path"));
class MetricsCollector {
    ledgerPath;
    constructor(workspaceRoot) {
        this.ledgerPath = path.resolve(workspaceRoot, 'telemetry_ledger.json');
    }
    /**
     * Logs a single optimization pass telemetry metrics.
     * Automatically handles rotation limit by archiving old logs.
     */
    async logMetrics(filePath, rawText, compressedText, tier, latencyMs, rotationLimit = 500) {
        const rawTokens = Math.ceil(rawText.length / 3.5);
        const compressedTokens = Math.ceil(compressedText.length / 3.5);
        const savingsPct = rawTokens > 0 ? ((rawTokens - compressedTokens) / rawTokens) * 100 : 0;
        const record = {
            timestamp: new Date().toISOString(),
            filePath,
            rawTokens,
            compressedTokens,
            tier: tier,
            savingsPct: parseFloat(savingsPct.toFixed(2)),
            latencyMs
        };
        try {
            let records = [];
            try {
                const data = await fs_1.promises.readFile(this.ledgerPath, 'utf-8');
                records = JSON.parse(data);
            }
            catch {
                // File doesn't exist yet
            }
            records.push(record);
            // Perform rotation if limit exceeded
            if (records.length > rotationLimit) {
                const cutoff = Math.floor(rotationLimit / 2);
                const archiveRecords = records.slice(0, cutoff);
                const activeRecords = records.slice(cutoff);
                // Safe filename format for Windows/Linux paths
                const timestamp = new Date().toISOString().replace(/[:.-]/g, '_');
                const archivePath = path.resolve(path.dirname(this.ledgerPath), `telemetry_ledger_archive_${timestamp}.json`);
                await fs_1.promises.writeFile(archivePath, JSON.stringify(archiveRecords, null, 2), 'utf-8');
                records = activeRecords;
            }
            await fs_1.promises.writeFile(this.ledgerPath, JSON.stringify(records, null, 2), 'utf-8');
        }
        catch (err) {
            console.error('Failed to log telemetry metrics:', err);
        }
    }
    /**
     * Formats a quick inline efficiency summary string.
     */
    formatInlineSummary(rawText, compressedText, tier, latencyMs) {
        const raw = Math.ceil(rawText.length / 3.5);
        const comp = Math.ceil(compressedText.length / 3.5);
        const saved = Math.max(0, raw - comp);
        const pct = raw > 0 ? ((saved / raw) * 100).toFixed(1) : '0';
        return `\n─── Tokenist ─ Saved ${saved.toLocaleString()} tokens (${pct}%) in ${latencyMs}ms [${tier} tier] ───\n`;
    }
    /**
     * Fetches all recorded telemetry records from telemetry_ledger.json.
     */
    async getRecords() {
        try {
            const data = await fs_1.promises.readFile(this.ledgerPath, 'utf-8');
            return JSON.parse(data);
        }
        catch {
            return [];
        }
    }
}
exports.MetricsCollector = MetricsCollector;
