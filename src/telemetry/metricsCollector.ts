import { promises as fs } from 'fs';
import * as path from 'path';
import { TelemetryRecord } from '../types';

export class MetricsCollector {
  private ledgerPath: string;

  constructor(workspaceRoot: string) {
    this.ledgerPath = path.resolve(workspaceRoot, 'telemetry_ledger.json');
  }

  /**
   * Logs a single optimization pass telemetry metrics.
   * Automatically handles rotation limit by archiving old logs.
   */
  async logMetrics(
    filePath: string,
    rawText: string,
    compressedText: string,
    tier: string,
    latencyMs: number,
    rotationLimit = 500
  ): Promise<void> {
    const rawTokens = Math.ceil(rawText.length / 3.5);
    const compressedTokens = Math.ceil(compressedText.length / 3.5);
    const savingsPct = rawTokens > 0 ? ((rawTokens - compressedTokens) / rawTokens) * 100 : 0;

    const record: TelemetryRecord = {
      timestamp: new Date().toISOString(),
      filePath,
      rawTokens,
      compressedTokens,
      tier: tier as any,
      savingsPct: parseFloat(savingsPct.toFixed(2)),
      latencyMs
    };

    try {
      let records: TelemetryRecord[] = [];
      try {
        const data = await fs.readFile(this.ledgerPath, 'utf-8');
        records = JSON.parse(data);
      } catch {
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
        const archivePath = path.resolve(
          path.dirname(this.ledgerPath),
          `telemetry_ledger_archive_${timestamp}.json`
        );
        await fs.writeFile(archivePath, JSON.stringify(archiveRecords, null, 2), 'utf-8');
        records = activeRecords;
      }

      await fs.writeFile(this.ledgerPath, JSON.stringify(records, null, 2), 'utf-8');
    } catch (err) {
      console.error('Failed to log telemetry metrics:', err);
    }
  }

  /**
   * Formats a quick inline efficiency summary string.
   */
  formatInlineSummary(rawText: string, compressedText: string, tier: string, latencyMs: number): string {
    const raw = Math.ceil(rawText.length / 3.5);
    const comp = Math.ceil(compressedText.length / 3.5);
    const saved = Math.max(0, raw - comp);
    const pct = raw > 0 ? ((saved / raw) * 100).toFixed(1) : '0';
    return `\n─── Tokenist ─ Saved ${saved.toLocaleString()} tokens (${pct}%) in ${latencyMs}ms [${tier} tier] ───\n`;
  }

  /**
   * Fetches all recorded telemetry records from telemetry_ledger.json.
   */
  async getRecords(): Promise<TelemetryRecord[]> {
    try {
      const data = await fs.readFile(this.ledgerPath, 'utf-8');
      return JSON.parse(data);
    } catch {
      return [];
    }
  }
}
