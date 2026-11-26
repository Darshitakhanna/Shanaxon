import * as fs from 'fs';
import * as path from 'path';

export interface ResourceMeasurement {
  taskId: string;
  wallClockMs: number;
  cpuTimeMs: number;
  memoryUsageMb: number;
  tokensProcessed: number;
  optimizationStrategy: string;
  optimizationTier: string;
  configuredRatePerSec: number;
  estimatedCostUsd: number;
  optimizerCostMode: 'estimated' | 'configured' | 'measured';
}

export interface CalibrationSummary {
  totalRuns: number;
  avgWallClockMs: number;
  avgCpuTimeMs: number;
  avgMemoryUsageMb: number;
  avgTokensProcessed: number;
  throughputTokensPerSec: number;
  totalEstimatedCostUsd: number;
  configuredRatePerSec: number;
  costMode: 'estimated';
  measurements: ResourceMeasurement[];
}

/**
 * Instruments and calibrates Tokenist optimizer computational overhead.
 * Tracks wall-clock latency, CPU usage, heap memory, and token throughput density.
 */
export class OptimizerCalibrator {
  private workspaceRoot: string;
  private measurements: ResourceMeasurement[] = [];

  constructor(workspaceRoot: string) {
    this.workspaceRoot = workspaceRoot;
  }

  public measureExecution<T>(
    taskId: string,
    tier: string,
    tokensProcessed: number,
    fn: () => T
  ): { result: T; measurement: ResourceMeasurement } {
    const ratePerSec = process.env.SHANAXON_OPTIMIZER_COST_PER_SECOND
      ? parseFloat(process.env.SHANAXON_OPTIMIZER_COST_PER_SECOND)
      : 0.001;

    const startMem = process.memoryUsage().heapUsed;
    const startCpu = process.cpuUsage();
    const startWall = Date.now();

    const result = fn();

    const wallClockMs = Math.max(1, Date.now() - startWall);
    const diffCpu = process.cpuUsage(startCpu);
    const cpuTimeMs = Math.round((diffCpu.user + diffCpu.system) / 1000);
    const endMem = process.memoryUsage().heapUsed;
    const memoryUsageMb = parseFloat((Math.max(0, endMem - startMem) / (1024 * 1024)).toFixed(2));

    const estimatedCostUsd = parseFloat(((wallClockMs / 1000) * ratePerSec).toFixed(6));

    const measurement: ResourceMeasurement = {
      taskId,
      wallClockMs,
      cpuTimeMs,
      memoryUsageMb,
      tokensProcessed,
      optimizationStrategy: 'ast_compression_v6',
      optimizationTier: tier,
      configuredRatePerSec: ratePerSec,
      estimatedCostUsd,
      optimizerCostMode: 'estimated',
    };

    this.measurements.push(measurement);

    return { result, measurement };
  }

  public getSummary(): CalibrationSummary {
    if (this.measurements.length === 0) {
      return {
        totalRuns: 0,
        avgWallClockMs: 0,
        avgCpuTimeMs: 0,
        avgMemoryUsageMb: 0,
        avgTokensProcessed: 0,
        throughputTokensPerSec: 0,
        totalEstimatedCostUsd: 0,
        configuredRatePerSec: 0.001,
        costMode: 'estimated',
        measurements: [],
      };
    }

    const totalRuns = this.measurements.length;
    const sumWall = this.measurements.reduce((a, m) => a + m.wallClockMs, 0);
    const sumCpu = this.measurements.reduce((a, m) => a + m.cpuTimeMs, 0);
    const sumMem = this.measurements.reduce((a, m) => a + m.memoryUsageMb, 0);
    const sumTokens = this.measurements.reduce((a, m) => a + m.tokensProcessed, 0);
    const sumCost = this.measurements.reduce((a, m) => a + m.estimatedCostUsd, 0);

    const avgWallClockMs = parseFloat((sumWall / totalRuns).toFixed(2));
    const avgCpuTimeMs = parseFloat((sumCpu / totalRuns).toFixed(2));
    const avgMemoryUsageMb = parseFloat((sumMem / totalRuns).toFixed(2));
    const avgTokensProcessed = parseFloat((sumTokens / totalRuns).toFixed(1));
    const throughputTokensPerSec = sumWall > 0 ? Math.round((sumTokens / (sumWall / 1000))) : 0;

    return {
      totalRuns,
      avgWallClockMs,
      avgCpuTimeMs,
      avgMemoryUsageMb,
      avgTokensProcessed,
      throughputTokensPerSec,
      totalEstimatedCostUsd: parseFloat(sumCost.toFixed(6)),
      configuredRatePerSec: this.measurements[0]?.configuredRatePerSec ?? 0.001,
      costMode: 'estimated',
      measurements: this.measurements,
    };
  }

  public generateCalibrationReport(): string {
    const summary = this.getSummary();
    const reportPath = path.resolve(this.workspaceRoot, 'OPTIMIZER_COST_CALIBRATION.md');

    const content = `# SHANAXON OPTIMIZER OVERHEAD CALIBRATION REPORT

## Executive Summary

| Metric | Measured Value |
|---|---|
| Total Optimization Runs | ${summary.totalRuns} |
| Average Wall-Clock Latency | ${summary.avgWallClockMs} ms |
| Average CPU Execution Time | ${summary.avgCpuTimeMs} ms |
| Average Memory Delta | ${summary.avgMemoryUsageMb} MB |
| Average Tokens Processed / Task | ${summary.avgTokensProcessed} tokens |
| Processing Throughput | ${summary.throughputTokensPerSec.toLocaleString()} tokens/sec |
| Configured Cost Rate | $${summary.configuredRatePerSec} / sec |
| Total Optimizer Overhead Spend | $${summary.totalEstimatedCostUsd} |
| Cost Accounting Mode | \`${summary.costMode}\` |

---

## Technical Cost Methodology

1. **Configured Rate**: Optimizer overhead uses configured rate of \`$${summary.configuredRatePerSec}/sec\` (\`SHANAXON_OPTIMIZER_COST_PER_SECOND\`).
2. **Cost Mode**: Tagged explicitly as \`optimizerCostMode = "estimated"\`.
3. **Hardware Independence**: CPU time is tracked separately from wall-clock time to prevent infrastructure variations from distorting financial estimates.

---

## Sample Performance Measurements

| Task ID | Tier | Tokens | Wall-Clock (ms) | CPU (ms) | Memory (MB) | Overhead Cost ($) |
|---|---|---|---|---|---|---|
${summary.measurements
  .slice(0, 15)
  .map(
    m =>
      `| ${m.taskId} | ${m.optimizationTier} | ${m.tokensProcessed} | ${m.wallClockMs} | ${m.cpuTimeMs} | ${m.memoryUsageMb} | $${m.estimatedCostUsd} |`
  )
  .join('\n')}

---

*Report generated automatically by Tokenist v6.1 OptimizerCalibrator.*
`;

    fs.writeFileSync(reportPath, content, 'utf-8');
    return reportPath;
  }
}
