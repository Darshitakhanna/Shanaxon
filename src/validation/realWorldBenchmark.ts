import * as fs from 'fs';
import * as path from 'path';
import { CorpusBuilder, CorpusDefinition } from './corpusBuilder';
import { OptimizerCalibrator } from './optimizerCalibrator';
import { EconomicValidator, SingleTaskValidationResult } from './economicValidator';
import { runTokenAccuracyValidation } from './tokenAccuracyValidator';
import { ProviderUsageCapturer } from '../telemetry/providerUsageCapturer';
import { ValidationReporter } from '../reporting/validationReporter';

export interface AggregateValidationRunSummary {
  runDate: string;
  totalCorpusTasks: number;

  // Question 1 Summary: Token Reduction
  q1_tokensReducedCount: number;
  q1_avgTokenReductionPct: number;

  // Question 2 Summary: Quality Retention
  q2_qualityMaintainedCount: number;
  q2_qualityMaintainedRatePct: number;
  q2_falseOptimizationCount: number; // Optimized when quality failed (Target: 0)

  // Question 3 Summary: Total Economic Cost Reduction
  q3_costReducedCount: number;
  q3_correctAbstentionCount: number;  // Correctly fell back to baseline when savings <= 0
  q3_totalBaselineSpendUsd: number;
  q3_totalTokenistSpendUsd: number;
  q3_totalOptimizerOverheadUsd: number;
  q3_netSavingsUsd: number;
  q3_netSavingsPct: number;
  q3_overallTaskSuccessRatePct: number; // Net savings > 0 AND quality maintained

  // Evaluation & Provenance Metadata
  totalEvaluationCostUsd: number;
  tokenistRepoTaskCount: number;
  externalRepoTaskCount: number;
  results: SingleTaskValidationResult[];
}

export async function runRealWorldValidationBenchmark(workspaceRoot: string): Promise<AggregateValidationRunSummary> {
  console.log('===========================================================');
  console.log('SHANAXON v6.1 — REAL-WORLD ECONOMIC & QUALITY VALIDATION');
  console.log('===========================================================');

  // 1. Build or Load Dual-Corpus (60% Tokenist / 40% External Pinned Repos)
  const corpusBuilder = new CorpusBuilder(workspaceRoot);
  let corpus: CorpusDefinition;
  try {
    corpus = corpusBuilder.loadCorpus();
  } catch {
    console.log('Building initial 200-task corpus (60% Tokenist / 40% External Pinned)...');
    corpus = await corpusBuilder.buildAndSaveCorpus();
  }

  // 2. Initialize Calibration & Validation Engines
  const calibrator = new OptimizerCalibrator(workspaceRoot);
  const validator = new EconomicValidator(workspaceRoot, calibrator);
  await validator.init();

  console.log(`Executing validation across ${corpus.totalTasks} corpus tasks...`);
  const results: SingleTaskValidationResult[] = [];

  for (const task of corpus.tasks) {
    const res = await validator.validateTask(task);
    results.push(res);
  }

  // 3. Generate Calibration Report
  calibrator.generateCalibrationReport();

  // 4. Compute Aggregate Metrics for the 3 Fundamental Questions
  let q1_reducedTokensCount = 0;
  let sumTokenReductionPct = 0;

  let q2_qualityMaintainedCount = 0;
  let q2_falseOptimizationCount = 0;

  let q3_costReducedCount = 0;
  let q3_correctAbstentionCount = 0;
  let totalBaselineSpend = 0;
  let totalTokenistSpend = 0;
  let totalOptimizerOverhead = 0;
  let totalEvaluationCostUsd = 0;
  let overallSuccessCount = 0;

  let tokenistRepoTaskCount = 0;
  let externalRepoTaskCount = 0;

  for (const r of results) {
    if (r.provenance.repository === 'Darshitakhanna/tokenist') {
      tokenistRepoTaskCount++;
    } else {
      externalRepoTaskCount++;
    }

    totalEvaluationCostUsd += r.evaluationCostUsd;

    if (r.question1_tokensReduced) {
      q1_reducedTokensCount++;
      sumTokenReductionPct += r.tokenReductionPct;
    }

    if (r.question2_qualityMaintained) {
      q2_qualityMaintainedCount++;
    }

    if (r.decision === 'OPTIMIZE' && !r.question2_qualityMaintained) {
      q2_falseOptimizationCount++;
    }

    totalBaselineSpend += r.baselineTotalCostUsd;
    totalTokenistSpend += r.tokenistTotalCostUsd;
    totalOptimizerOverhead += r.optimizerOverheadCostUsd;

    if (r.question3_totalCostReduced) {
      q3_costReducedCount++;
    }

    if (r.decision === 'FALLBACK_BASELINE' || r.decision === 'SKIP_TOO_SMALL') {
      q3_correctAbstentionCount++;
    }

    if (r.decision === 'OPTIMIZE' && r.question3_totalCostReduced && r.question2_qualityMaintained) {
      overallSuccessCount++;
    }
  }

  const netSavingsUsd = parseFloat((totalBaselineSpend - totalTokenistSpend).toFixed(6));
  const netSavingsPct = totalBaselineSpend > 0 ? parseFloat(((netSavingsUsd / totalBaselineSpend) * 100).toFixed(2)) : 0;
  const avgTokenReductionPct = q1_reducedTokensCount > 0 ? parseFloat((sumTokenReductionPct / q1_reducedTokensCount).toFixed(2)) : 0;
  const qualityMaintainedRatePct = parseFloat(((q2_qualityMaintainedCount / results.length) * 100).toFixed(1));
  const overallTaskSuccessRatePct = parseFloat(((overallSuccessCount / results.length) * 100).toFixed(1));

  const summary: AggregateValidationRunSummary = {
    runDate: new Date().toISOString(),
    totalCorpusTasks: results.length,
    q1_tokensReducedCount: q1_reducedTokensCount,
    q1_avgTokenReductionPct: avgTokenReductionPct,
    q2_qualityMaintainedCount,
    q2_qualityMaintainedRatePct: qualityMaintainedRatePct,
    q2_falseOptimizationCount,
    q3_costReducedCount,
    q3_correctAbstentionCount,
    q3_totalBaselineSpendUsd: parseFloat(totalBaselineSpend.toFixed(6)),
    q3_totalTokenistSpendUsd: parseFloat(totalTokenistSpend.toFixed(6)),
    q3_totalOptimizerOverheadUsd: parseFloat(totalOptimizerOverhead.toFixed(6)),
    q3_netSavingsUsd: netSavingsUsd,
    q3_netSavingsPct: netSavingsPct,
    q3_overallTaskSuccessRatePct: overallTaskSuccessRatePct,
    totalEvaluationCostUsd: parseFloat(totalEvaluationCostUsd.toFixed(6)),
    tokenistRepoTaskCount,
    externalRepoTaskCount,
    results,
  };

  // Save report JSON
  const reportDir = path.resolve(workspaceRoot, 'validation', 'reports');
  if (!fs.existsSync(reportDir)) {
    fs.mkdirSync(reportDir, { recursive: true });
  }

  const dateStr = new Date().toISOString().split('T')[0];
  const reportPath = path.resolve(reportDir, `validation_run_${dateStr}.json`);
  fs.writeFileSync(reportPath, JSON.stringify(summary, null, 2), 'utf-8');

  // Generate Markdown Reports
  const reporter = new ValidationReporter(workspaceRoot);
  const auditPath = reporter.generateAuditReport(summary);
  const econPath = reporter.generateEconomicValidationReport(summary);

  console.log(`Validation Complete! JSON written to ${reportPath}`);
  console.log(`Audit Report: ${auditPath}`);
  console.log(`Economic Validation Report: ${econPath}`);
  return summary;
}

if (require.main === module) {
  runRealWorldValidationBenchmark(process.cwd()).then(s => {
    console.log(`\nValidation Summary:`);
    console.log(`- Total Tasks: ${s.totalCorpusTasks}`);
    console.log(`- Overall Task Success Rate: ${s.q3_overallTaskSuccessRatePct}%`);
    console.log(`- Net Financial Savings: $${s.q3_netSavingsUsd} (${s.q3_netSavingsPct}%)`);
    console.log(`- False Optimization Rate: ${s.q2_falseOptimizationCount}`);
  });
}
