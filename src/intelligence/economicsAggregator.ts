import * as fs from 'fs';
import * as path from 'path';
import { EconomicEvaluation, OptimizationReceipt } from '../types';

export interface CumulativeEconomics {
  baselineSpend: number;
  tokenistSpend: number;
  optimizerSpend: number;
  netSavings: number;
  savingsPercent: number;
  requestCount: number;
  optimizedRequestCount: number;
  abstainedRequestCount: number;
  economicallyEffectiveRate: number; // 0 - 100
  averageSavings: number;
  medianSavings: number;
  retryRate: number;
}

/**
 * Aggregates economic evaluations across requests for telemetry reporting and FinOps integration.
 * Supports disk persistence to .shanaxon/economics_ledger.json.
 */
export class EconomicsAggregator {
  private static instance: EconomicsAggregator;
  private records: OptimizationReceipt[] = [];
  private ledgerPath: string = path.resolve(process.cwd(), '.shanaxon', 'economics_ledger.json');

  private constructor() {
    this.loadFromDisk();
  }

  public static getInstance(): EconomicsAggregator {
    if (!EconomicsAggregator.instance) {
      EconomicsAggregator.instance = new EconomicsAggregator();
    }
    return EconomicsAggregator.instance;
  }

  public recordReceipt(receipt: OptimizationReceipt): void {
    this.records.push(receipt);
    this.persistToDisk();
  }

  public getSummary(): CumulativeEconomics {
    if (this.records.length === 0) {
      return {
        baselineSpend: 0,
        tokenistSpend: 0,
        optimizerSpend: 0,
        netSavings: 0,
        savingsPercent: 0,
        requestCount: 0,
        optimizedRequestCount: 0,
        abstainedRequestCount: 0,
        economicallyEffectiveRate: 0,
        averageSavings: 0,
        medianSavings: 0,
        retryRate: 0,
      };
    }

    let baselineSpend = 0;
    let tokenistSpend = 0;
    let optimizerSpend = 0;
    let optimizedCount = 0;
    let abstainedCount = 0;
    let effectiveCount = 0;
    const savingsList: number[] = [];
    let retryCount = 0;

    for (const r of this.records) {
      const bCost = r.baselineTotalCost || 0;
      const tCost = r.tokenistTotalCost || 0;
      const optCost = r.optimizerCost || 0;
      const savings = r.absoluteSavings || 0;

      baselineSpend += bCost;
      tokenistSpend += tCost;
      optimizerSpend += optCost;
      savingsList.push(savings);

      const decision = r.economics?.optimizationDecision;
      if (decision === 'OPTIMIZED') {
        optimizedCount++;
      } else if (decision === 'BASELINE' || decision === 'ABSTAINED') {
        abstainedCount++;
      }

      if (r.isEconomicallyEffective) {
        effectiveCount++;
      }

      if (r.economics?.actual?.optimized.retryCost && r.economics.actual.optimized.retryCost > 0) {
        retryCount++;
      }
    }

    const netSavings = parseFloat((baselineSpend - tokenistSpend).toFixed(6));
    const savingsPercent = baselineSpend > 0 ? parseFloat(((netSavings / baselineSpend) * 100).toFixed(2)) : 0;
    const averageSavings = parseFloat((netSavings / this.records.length).toFixed(6));

    savingsList.sort((a, b) => a - b);
    const mid = Math.floor(savingsList.length / 2);
    const medianSavings = savingsList.length % 2 !== 0 ? savingsList[mid] : (savingsList[mid - 1] + savingsList[mid]) / 2;

    return {
      baselineSpend: parseFloat(baselineSpend.toFixed(6)),
      tokenistSpend: parseFloat(tokenistSpend.toFixed(6)),
      optimizerSpend: parseFloat(optimizerSpend.toFixed(6)),
      netSavings,
      savingsPercent,
      requestCount: this.records.length,
      optimizedRequestCount: optimizedCount,
      abstainedRequestCount: abstainedCount,
      economicallyEffectiveRate: parseFloat(((effectiveCount / this.records.length) * 100).toFixed(1)),
      averageSavings,
      medianSavings: parseFloat(medianSavings.toFixed(6)),
      retryRate: parseFloat(((retryCount / this.records.length) * 100).toFixed(1)),
    };
  }

  public getRecords(): OptimizationReceipt[] {
    return [...this.records];
  }

  public clear(): void {
    this.records = [];
    this.persistToDisk();
  }

  public setLedgerPath(customPath: string): void {
    this.ledgerPath = customPath;
    this.loadFromDisk();
  }

  private loadFromDisk(): void {
    try {
      if (fs.existsSync(this.ledgerPath)) {
        const raw = fs.readFileSync(this.ledgerPath, 'utf-8');
        this.records = JSON.parse(raw);
      }
    } catch {}
  }

  private persistToDisk(): void {
    try {
      const dir = path.dirname(this.ledgerPath);
      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
      }
      fs.writeFileSync(this.ledgerPath, JSON.stringify(this.records, null, 2), 'utf-8');
    } catch {}
  }
}
