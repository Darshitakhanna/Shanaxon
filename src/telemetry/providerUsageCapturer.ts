import * as fs from 'fs';
import * as path from 'path';
import { CostBreakdown } from '../types';
import { calculateModelCost } from '../intelligence/economicsEngine';

export interface ProviderUsageRecord {
  requestId: string;
  provider: 'anthropic' | 'openai' | 'google' | string;
  model: string;
  actualInputTokens: number;
  actualOutputTokens: number;
  actualModelCost: number;
  projectedInputTokens?: number;
  projectedOutputTokens?: number;
  projectedModelCost?: number;
  projectionErrorPct?: number; // % variance between projected and actual
  timestamp: string;
}

export interface ProjectionAccuracyReport {
  totalCapturedRecords: number;
  meanTokenProjectionErrorPct: number;
  meanCostProjectionErrorPct: number;
  maxProjectionErrorPct: number;
  underEstimationCount: number;
  overEstimationCount: number;
  accurateWithin10PctCount: number;
  records: ProviderUsageRecord[];
}

/**
 * Captures actual model provider token usage payloads (from Anthropic/OpenAI/Google responses)
 * and evaluates Tokenist preflight/projected estimation accuracy vs real billing.
 */
export class ProviderUsageCapturer {
  private static instance: ProviderUsageCapturer;
  private records: Map<string, ProviderUsageRecord> = new Map();
  private ledgerPath: string;

  private constructor(workspaceRoot?: string) {
    const root = workspaceRoot || process.cwd();
    this.ledgerPath = path.resolve(root, '.shanaxon', 'provider_usage_ledger.json');
    this.loadLedger();
  }

  public static getInstance(workspaceRoot?: string): ProviderUsageCapturer {
    if (!ProviderUsageCapturer.instance) {
      ProviderUsageCapturer.instance = new ProviderUsageCapturer(workspaceRoot);
    }
    return ProviderUsageCapturer.instance;
  }

  /**
   * Captures actual LLM API usage response and computes cost variance against projected cost breakdown.
   */
  public recordActualUsage(
    requestId: string,
    provider: string,
    model: string,
    actualInputTokens: number,
    actualOutputTokens: number,
    projectedBreakdown?: CostBreakdown
  ): ProviderUsageRecord {
    const actualCostObj = calculateModelCost({
      provider,
      model,
      inputTokens: actualInputTokens,
      outputTokens: actualOutputTokens,
    });

    const actualModelCost = actualCostObj.totalCost;
    let projectedInputTokens = projectedBreakdown?.inputTokens;
    let projectedOutputTokens = projectedBreakdown?.outputTokens;
    let projectedModelCost = projectedBreakdown?.totalCost;
    let projectionErrorPct = 0;

    if (projectedModelCost !== undefined && projectedModelCost > 0) {
      const diff = Math.abs(projectedModelCost - actualModelCost);
      projectionErrorPct = parseFloat(((diff / actualModelCost) * 100).toFixed(2));
    }

    const record: ProviderUsageRecord = {
      requestId,
      provider,
      model,
      actualInputTokens,
      actualOutputTokens,
      actualModelCost,
      projectedInputTokens,
      projectedOutputTokens,
      projectedModelCost,
      projectionErrorPct,
      timestamp: new Date().toISOString(),
    };

    this.records.set(requestId, record);
    this.persistLedger();
    return record;
  }

  public getAccuracyReport(): ProjectionAccuracyReport {
    const list = Array.from(this.records.values());
    if (list.length === 0) {
      return {
        totalCapturedRecords: 0,
        meanTokenProjectionErrorPct: 0,
        meanCostProjectionErrorPct: 0,
        maxProjectionErrorPct: 0,
        underEstimationCount: 0,
        overEstimationCount: 0,
        accurateWithin10PctCount: 0,
        records: [],
      };
    }

    let sumCostError = 0;
    let maxError = 0;
    let underCount = 0;
    let overCount = 0;
    let accurateCount = 0;

    for (const r of list) {
      const err = r.projectionErrorPct || 0;
      sumCostError += err;
      if (err > maxError) maxError = err;

      if (err <= 10) accurateCount++;

      if (r.projectedModelCost !== undefined) {
        if (r.projectedModelCost < r.actualModelCost) underCount++;
        else if (r.projectedModelCost > r.actualModelCost) overCount++;
      }
    }

    return {
      totalCapturedRecords: list.length,
      meanTokenProjectionErrorPct: parseFloat((sumCostError / list.length).toFixed(2)),
      meanCostProjectionErrorPct: parseFloat((sumCostError / list.length).toFixed(2)),
      maxProjectionErrorPct: parseFloat(maxError.toFixed(2)),
      underEstimationCount: underCount,
      overEstimationCount: overCount,
      accurateWithin10PctCount: accurateCount,
      records: list,
    };
  }

  public clear(): void {
    this.records.clear();
  }

  private loadLedger(): void {
    try {
      if (fs.existsSync(this.ledgerPath)) {
        const raw = fs.readFileSync(this.ledgerPath, 'utf-8');
        const list: ProviderUsageRecord[] = JSON.parse(raw);
        for (const item of list) {
          this.records.set(item.requestId, item);
        }
      }
    } catch {}
  }

  private persistLedger(): void {
    try {
      const dir = path.dirname(this.ledgerPath);
      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
      }
      fs.writeFileSync(this.ledgerPath, JSON.stringify(Array.from(this.records.values()), null, 2), 'utf-8');
    } catch {}
  }
}
