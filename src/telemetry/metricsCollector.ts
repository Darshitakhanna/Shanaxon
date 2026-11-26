import { promises as fs } from 'fs';
import * as path from 'path';
import { TelemetryRecord } from '../types';
import { Tokenizer } from '../core/tokenizer';

export class MetricsCollector {
  private static writeQueues = new Map<string, Promise<void>>();
  private ledgerPath: string;

  constructor(workspaceRoot: string) {
    this.ledgerPath = path.resolve(workspaceRoot, 'telemetry_ledger.json');
  }

  private enqueueWrite(targetPath: string, task: () => Promise<void>): Promise<void> {
    const prev = MetricsCollector.writeQueues.get(targetPath) || Promise.resolve();
    const next = prev.catch(() => {}).then(task);
    MetricsCollector.writeQueues.set(targetPath, next);
    return next;
  }

  /**
   * Logs a single optimization pass telemetry metrics.
   * Serializes writes per ledger path and uses atomic temp-file renames to prevent concurrent clobbering.
   */
  async logMetrics(
    filePath: string,
    rawText: string,
    compressedText: string,
    tier: string,
    latencyMs: number,
    rotationLimit = 500
  ): Promise<void> {
    const rawTokens = Tokenizer.countTokens(rawText, filePath);
    const compressedTokens = Tokenizer.countTokens(compressedText, filePath);
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

    const targetLedgerPath = this.ledgerPath;
    await this.enqueueWrite(targetLedgerPath, async () => {
      try {
        let records: TelemetryRecord[] = [];
        try {
          const data = await fs.readFile(targetLedgerPath, 'utf-8');
          const parsed = JSON.parse(data);
          if (Array.isArray(parsed)) {
            records = parsed;
          }
        } catch {
          // File doesn't exist yet or is empty
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
            path.dirname(targetLedgerPath),
            `telemetry_ledger_archive_${timestamp}.json`
          );
          await fs.writeFile(archivePath, JSON.stringify(archiveRecords, null, 2), 'utf-8');
          records = activeRecords;
        }

        const dir = path.dirname(targetLedgerPath);
        await fs.mkdir(dir, { recursive: true });
        const tempPath = `${targetLedgerPath}.${Date.now()}.${Math.random().toString(36).substring(2, 7)}.tmp`;
        try {
          await fs.writeFile(tempPath, JSON.stringify(records, null, 2), 'utf-8');
          await fs.rename(tempPath, targetLedgerPath);
        } catch (writeErr) {
          await fs.unlink(tempPath).catch(() => {});
          throw writeErr;
        }
      } catch (err) {
        console.error('Failed to log telemetry metrics:', err);
      }
    });
  }

  /**
   * Formats a quick inline efficiency summary string.
   */
  formatInlineSummary(rawText: string, compressedText: string, tier: string, latencyMs: number, filePath?: string): string {
    const raw = Tokenizer.countTokens(rawText, filePath);
    const comp = Tokenizer.countTokens(compressedText, filePath);
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
