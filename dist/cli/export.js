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
const fs = __importStar(require("fs"));
const path = __importStar(require("path"));
/**
 * CLI command to export optimization logs to CSV or JSON formats.
 * Usage: npx ts-node src/cli/export.ts --format csv --out audit_logs.csv
 */
async function runExport() {
    const args = process.argv.slice(2);
    const formatIndex = args.indexOf('--format');
    const format = formatIndex !== -1 ? args[formatIndex + 1].toLowerCase() : 'json';
    const outIndex = args.indexOf('--out');
    const outPath = outIndex !== -1 ? args[outIndex + 1] : undefined;
    const workspaceRoot = process.cwd();
    const ledgerPath = path.resolve(workspaceRoot, 'telemetry_ledger.json');
    if (!fs.existsSync(ledgerPath)) {
        console.warn("No telemetry ledger found to export.");
        process.exit(0);
    }
    const rawData = fs.readFileSync(ledgerPath, 'utf-8');
    const records = JSON.parse(rawData);
    let outputContent = '';
    if (format === 'csv') {
        const headers = ['Timestamp', 'FilePath', 'RawTokens', 'CompressedTokens', 'Tier', 'SavingsPct', 'LatencyMs'];
        const rows = records.map((r) => [
            r.timestamp,
            r.filePath.replace(/"/g, '""'),
            r.rawTokens,
            r.compressedTokens,
            r.tier,
            r.savingsPct,
            r.latencyMs
        ]);
        outputContent = [headers.join(','), ...rows.map((row) => row.map(val => `"${val}"`).join(','))].join('\n');
    }
    else {
        outputContent = JSON.stringify(records, null, 2);
    }
    if (outPath) {
        const targetPath = path.resolve(workspaceRoot, outPath);
        // Automatically create parent folders
        fs.mkdirSync(path.dirname(targetPath), { recursive: true });
        fs.writeFileSync(targetPath, outputContent, 'utf-8');
        console.log(`✓ Audit logs exported successfully to: ${targetPath}`);
    }
    else {
        console.log(outputContent);
    }
}
runExport().catch(err => {
    console.error("Export command failed:", err);
    process.exit(1);
});
