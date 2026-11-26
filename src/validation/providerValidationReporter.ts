import * as fs from 'fs';
import * as path from 'path';
import { RealExperimentAggregateSummary } from './realProviderExperiment';

export class ProviderValidationReporter {
  private workspaceRoot: string;

  constructor(workspaceRoot: string) {
    this.workspaceRoot = workspaceRoot;
  }

  public generateReport(summary: RealExperimentAggregateSummary): string {
    const reportPath = path.resolve(this.workspaceRoot, 'PROVIDER_VALIDATION_REPORT.md');

    const mockNotice = summary.isMockMode
      ? `> [!IMPORTANT]\n> **MOCK MODE NOTICE**: This experiment ran using simulated LLM provider responses (no API key was supplied). Actual LLM token counts and costs use Shanaxon BPE token counting and published provider pricing rates.`
      : `> [!NOTE]\n> **REAL PROVIDER MODE**: This experiment ran using live LLM provider API responses (${summary.provider} / ${summary.model}). Token counts and costs are derived directly from actual HTTP response usage headers.`;

    const reasonsList = Object.entries(summary.diagnostic.decisionReasonsBreakdown)
      .map(([r, count]) => `- \`${r}\`: **${count} tasks**`)
      .join('\n');

    const recsList = summary.diagnostic.recommendations.map(r => `- ${r}`).join('\n');

    const mdContent = `# SHANAXON v6.1.0 — REAL PROVIDER VALIDATION REPORT

${mockNotice}

## Executive Comparison Summary

| Metric Dimension | Baseline LLM Call | Shanaxon Optimized Call | Variance / Savings |
|---|---|---|---|
| **Total Test Tasks** | ${summary.totalTasks} tasks | ${summary.totalTasks} tasks | — |
| **Provider / Model** | \`${summary.provider}\` / \`${summary.model}\` | \`${summary.provider}\` / \`${summary.model}\` | — |
| **Input Tokens** | ${summary.totalBaselineInputTokens.toLocaleString()} tokens | ${summary.totalTokenistInputTokens.toLocaleString()} tokens | **-${summary.totalInputTokensReduced.toLocaleString()} tokens** (${summary.avgInputTokenReductionPct}%) |
| **Model API Bill** | $${summary.totalBaselineCostUsd.toFixed(6)} | $${summary.totalTokenistModelCostUsd.toFixed(6)} | -$${(summary.totalBaselineCostUsd - summary.totalTokenistModelCostUsd).toFixed(6)} |
| **Optimizer Overhead** | $0.000000 | $${summary.totalOptimizerOverheadUsd.toFixed(6)} | +$${summary.totalOptimizerOverheadUsd.toFixed(6)} |
| **Total User Spend** | $${summary.totalBaselineCostUsd.toFixed(6)} | **$${summary.totalTokenistTotalSpendUsd.toFixed(6)}** | **Net Savings: $${summary.netFinancialSavingsUsd.toFixed(6)}** (${summary.netFinancialSavingsPct}%) |
| **Quality Retention** | 100.0% baseline | **${summary.qualityMaintainedRatePct}%** | Safe quality floor |
| **Task Success Rate** | Baseline ground truth | **${summary.overallTaskSuccessRatePct}%** | Net savings + quality preserved |

---

## Decision Diagnostic & Optimization Rate Audit

- **Total Tasks Analyzed**: ${summary.diagnostic.totalTasksAnalyzed}
- **Optimized (OPTIMIZE)**: **${summary.optimizedCount} tasks** (${summary.optimizationRatePct}%)
- **Fell Back to Baseline (FALLBACK_BASELINE)**: **${summary.fallbackCount} tasks**
- **Skipped at Preflight (SKIP_TOO_SMALL)**: **${summary.skipCount} tasks**

### Decision Reason Breakdown
${reasonsList}

### Context Size Distribution
- **Under 150 Tokens**: ${summary.diagnostic.contextSizeDistribution.under150Tokens} tasks (Preflight floor skipped)
- **150 to 500 Tokens**: ${summary.diagnostic.contextSizeDistribution.tokens150To500} tasks
- **500 to 2,000 Tokens**: ${summary.diagnostic.contextSizeDistribution.tokens500To2000} tasks
- **Over 2,000 Tokens**: ${summary.diagnostic.contextSizeDistribution.over2000Tokens} tasks (Optimal compression yield)

### Fallback Reasons Breakdown
- **Quality Risk Floor Failed**: ${summary.diagnostic.fallbackCategoryBreakdown.qualityRiskFailed} tasks
- **No Meaningful Net Savings**: ${summary.diagnostic.fallbackCategoryBreakdown.noMeaningfulSavings} tasks
- **Optimizer Overhead Exceeded Savings**: ${summary.diagnostic.fallbackCategoryBreakdown.overheadTooHigh} tasks
- **Baseline Already Optimal**: ${summary.diagnostic.fallbackCategoryBreakdown.baselineAlreadyOptimal} tasks

---

## Systematic Diagnostic Recommendations

${recsList}

---

## Detailed Task Results (First 15 Tasks)

| Task ID | Workload | Baseline Tokens | Shanaxon Tokens | Decision | Reason | Net Savings ($) |
|---|---|---|---|---|---|---|
${summary.taskResults
  .slice(0, 15)
  .map(
    t =>
      `| \`${t.taskId}\` | ${t.workloadCategory} | ${t.baseline.inputTokens} | ${t.tokenist.inputTokens} | \`${t.optimizer.decision}\` | \`${t.optimizer.decisionReason}\` | $${t.economics.netSavingsUsd.toFixed(6)} |`
  )
  .join('\n')}

---

*Report generated automatically by Shanaxon ProviderValidationReporter v6.1.1 on ${summary.runTimestamp}.*
`;

    fs.writeFileSync(reportPath, mdContent, 'utf-8');
    return reportPath;
  }
}
