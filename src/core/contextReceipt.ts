import { getConfig } from './configLoader';
import { ModelPricingRegistry } from '../intelligence/economicsEngine';

export interface FileReceiptEntry {
  filePath: string;
  tier: string;
  rawTokens: number;
  compressedTokens: number;
  savingsPct: number;
  hasRetrieveMarker?: boolean;
}

export interface ContextReceipt {
  requestId: string;
  timestamp: string;
  toolName: string;
  filesIncluded: FileReceiptEntry[];
  filesOmitted: string[];
  totalRawTokens: number;
  totalCompressedTokens: number;
  totalSavingsPct: number;
  budgetUsed: number | null;
  budgetLimit: number | null;
}

/**
 * Context Receipt & Token Audit Generator.
 * Provides transparent FinOps tracking for every LLM request and session-wide token expenditure.
 */
export class ContextReceiptGenerator {
  private sessionReceipts: ContextReceipt[] = [];

  /**
   * Generates a single request receipt and appends it to session audit trail.
   */
  generate(
    toolName: string,
    filesIncluded: FileReceiptEntry[],
    filesOmitted: string[] = [],
    budgetLimit: number | null = null
  ): ContextReceipt {
    const requestId = Math.random().toString(36).substring(2, 9);
    const timestamp = new Date().toISOString();

    let totalRawTokens = 0;
    let totalCompressedTokens = 0;

    for (const f of filesIncluded) {
      totalRawTokens += f.rawTokens;
      totalCompressedTokens += f.compressedTokens;
    }

    const totalSavingsPct =
      totalRawTokens > 0
        ? parseFloat((((totalRawTokens - totalCompressedTokens) / totalRawTokens) * 100).toFixed(2))
        : 0;

    const receipt: ContextReceipt = {
      requestId,
      timestamp,
      toolName,
      filesIncluded,
      filesOmitted,
      totalRawTokens,
      totalCompressedTokens,
      totalSavingsPct,
      budgetUsed: totalCompressedTokens,
      budgetLimit,
    };

    this.sessionReceipts.push(receipt);
    return receipt;
  }

  /**
   * Formats a receipt as a compact text footer appended to tool outputs.
   */
  formatAsFooter(receipt: ContextReceipt): string {
    const lines: string[] = [];
    lines.push('\n\n==================================================');
    lines.push(`[Shanaxon Context Receipt #${receipt.requestId}] ${receipt.timestamp}`);
    lines.push(
      `Files: ${receipt.filesIncluded.length} included (${receipt.filesOmitted.length} omitted) | ` +
        `Tokens: ${receipt.totalRawTokens.toLocaleString()} → ${receipt.totalCompressedTokens.toLocaleString()} ` +
        `(${receipt.totalSavingsPct}% saved)`
    );

    if (receipt.budgetLimit) {
      lines.push(`Budget Utilization: ${receipt.budgetUsed}/${receipt.budgetLimit} tokens`);
    }

    const ccrCount = receipt.filesIncluded.filter((f) => f.hasRetrieveMarker).length;
    if (ccrCount > 0) {
      lines.push(`Reversible CCR Markers: ${ccrCount} active`);
    }
    lines.push('==================================================');

    return lines.join('\n');
  }

  /**
   * Returns formatted session-wide FinOps audit report.
   */
  formatSessionSummary(): string {
    if (this.sessionReceipts.length === 0) {
      return '[Shanaxon FinOps Audit] No tool invocations recorded in this session yet.';
    }

    let sessionRaw = 0;
    let sessionCompressed = 0;

    for (const r of this.sessionReceipts) {
      sessionRaw += r.totalRawTokens;
      sessionCompressed += r.totalCompressedTokens;
    }

    const sessionSavingsPct =
      sessionRaw > 0 ? parseFloat((((sessionRaw - sessionCompressed) / sessionRaw) * 100).toFixed(2)) : 0;
    const config = getConfig();
    const activeModel = config.activeModel || config.pricingModel || 'claude-sonnet-4';
    const registry = ModelPricingRegistry.getInstance();
    const { pricing, isFallback } = registry.getPricingWithFallback(undefined, activeModel, 'claude-sonnet-4');
    const dollarsSaved = ((sessionRaw - sessionCompressed) / 1_000_000) * pricing.inputCostPerMillion;
    const pricingLabel = registry.formatDisplayLabel(pricing, isFallback);

    const lines: string[] = [];
    lines.push('==================================================');
    lines.push('SHANAXON SESSION FINOPS AUDIT & CONTEXT RECEIPTS');
    lines.push('==================================================');
    lines.push(`Total Requests Audited : ${this.sessionReceipts.length}`);
    lines.push(`Cumulative Raw Tokens  : ${sessionRaw.toLocaleString()}`);
    lines.push(`Cumulative Compressed  : ${sessionCompressed.toLocaleString()}`);
    lines.push(`Cumulative Savings     : ${sessionSavingsPct}% tokens saved`);
    lines.push(`Estimated Cost Savings : ~$${dollarsSaved.toFixed(4)} USD (${pricingLabel})`);
    lines.push('--------------------------------------------------');
    lines.push('Recent Request Log:');

    for (const r of this.sessionReceipts.slice(-5)) {
      lines.push(
        ` - [#${r.requestId}] ${r.toolName}: ${r.filesIncluded.length} files, ` +
          `${r.totalRawTokens}→${r.totalCompressedTokens} tokens (${r.totalSavingsPct}% saved)`
      );
    }
    lines.push('==================================================');

    return lines.join('\n');
  }

  getSessionAudit(): ContextReceipt[] {
    return this.sessionReceipts;
  }
}
