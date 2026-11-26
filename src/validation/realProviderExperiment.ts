import * as fs from 'fs';
import * as path from 'path';
import { RealLLMClient, RealLLMResponse } from './realLLMClient';
import { EligibleTaskBuilder, EligibleTask } from './eligibleTaskBuilder';
import { CodeCompressionEngine } from '../core/parser';
import { analyzeBaseline } from '../intelligence/baselineAnalyzer';
import { shouldAttemptOptimization } from '../intelligence/economicPreflight';
import { evaluateParetoTradeoff, OptimizationCandidate } from '../intelligence/paretoSelector';
import { evaluateEconomicGate } from '../intelligence/economicGate';
import { OptimizerCalibrator } from './optimizerCalibrator';
import { Tokenizer } from '../core/tokenizer';
import { evaluateQuality, HybridQualityEvaluation } from './qualityEvaluator';
import { ProviderUsageCapturer } from '../telemetry/providerUsageCapturer';
import { DecisionDiagnosticEngine, DecisionDiagnosticReport } from './decisionDiagnostic';
import { ProviderValidationReporter } from './providerValidationReporter';
import { calculateModelCost } from '../intelligence/economicsEngine';
import { CompressionTier } from '../types';

export interface RealProviderTaskResult {
  taskId: string;
  title: string;
  workloadCategory: EligibleTask['workloadCategory'];
  filePaths: string[];

  // Baseline Call (Actual LLM Call)
  baseline: {
    inputTokens: number;
    outputTokens: number;
    costUsd: number;
    latencyMs: number;
    response: string;
    correctnessScore: number; // 0.0 to 1.0 based on keyword retention
    isMockMode: boolean;
  };

  // Tokenist Optimizer Step
  optimizer: {
    decision: 'OPTIMIZE' | 'FALLBACK_BASELINE' | 'SKIP_TOO_SMALL';
    decisionReason: string;
    selectedTier: 'normal' | 'medium' | 'aggressive' | 'baseline';
    baselineTokens: number;
    compressedTokens: number;
    tokenReductionPct: number;
    optimizerOverheadMs: number;
    optimizerOverheadUsd: number;
  };

  // Tokenist Call (Actual LLM Call with compressed or baseline context)
  tokenist: {
    inputTokens: number;
    outputTokens: number;
    costUsd: number;
    latencyMs: number;
    response: string;
    correctnessScore: number;
    isMockMode: boolean;
  };

  // Financial & Quality Summary
  economics: {
    netSavingsUsd: number;
    netSavingsPct: number;
    qualityMaintained: boolean;
    isOverallSuccess: boolean; // Net savings > 0 AND quality maintained
  };
}

export interface RealExperimentAggregateSummary {
  runTimestamp: string;
  totalTasks: number;
  provider: string;
  model: string;
  isMockMode: boolean;

  // Actual LLM Billing Totals
  totalBaselineInputTokens: number;
  totalTokenistInputTokens: number;
  totalInputTokensReduced: number;
  avgInputTokenReductionPct: number;

  totalBaselineCostUsd: number;
  totalTokenistModelCostUsd: number;
  totalOptimizerOverheadUsd: number;
  totalTokenistTotalSpendUsd: number;
  netFinancialSavingsUsd: number;
  netFinancialSavingsPct: number;

  // Optimization Performance
  optimizedCount: number;
  fallbackCount: number;
  skipCount: number;
  optimizationRatePct: number;
  qualityMaintainedRatePct: number;
  overallTaskSuccessRatePct: number;

  diagnostic: DecisionDiagnosticReport;
  taskResults: RealProviderTaskResult[];
}

export class RealProviderExperiment {
  private workspaceRoot: string;
  private llmClient: RealLLMClient;
  private engine: CodeCompressionEngine;
  private calibrator: OptimizerCalibrator;

  constructor(workspaceRoot: string) {
    this.workspaceRoot = workspaceRoot;
    this.llmClient = new RealLLMClient();
    this.engine = new CodeCompressionEngine();
    this.calibrator = new OptimizerCalibrator(workspaceRoot);
  }

  public async init(): Promise<void> {
    await this.engine.init();
  }

  public async runExperiment(taskCount: number = 50): Promise<RealExperimentAggregateSummary> {
    console.log('===========================================================');
    console.log('SHANAXON v6.1.0 — REAL PROVIDER EXPERIMENT RUNNER');
    console.log(`Provider Mode: ${this.llmClient.isMockMode() ? 'MOCK MODE (No API key set)' : 'REAL LLM API MODE'}`);
    console.log('===========================================================');

    // 1. Build Eligible Tasks (≥500 tokens)
    const taskBuilder = new EligibleTaskBuilder(this.workspaceRoot);
    const tasks = taskBuilder.buildEligibleTasks(taskCount);
    console.log(`Generated ${tasks.length} optimization-eligible tasks (all ≥ 500 tokens)...\n`);

    const taskResults: RealProviderTaskResult[] = [];
    const providerCapturer = ProviderUsageCapturer.getInstance(this.workspaceRoot);

    for (let i = 0; i < tasks.length; i++) {
      const task = tasks[i];
      console.log(`[${i + 1}/${tasks.length}] Running task: ${task.id} (${task.title})...`);

      // STEP A: Baseline LLM Call
      const baselineLLMRes = await this.llmClient.call({
        prompt: task.prompt,
        context: task.context,
        filePath: task.filePaths[0],
      });

      const baselineCorrectness = this.checkKeywordMatch(baselineLLMRes.content, task.groundTruthKeywords);

      // STEP B: Tokenist Optimizer Pipeline
      const baselineAnalysis = analyzeBaseline({
        model: baselineLLMRes.model,
        provider: baselineLLMRes.provider,
        originalCode: task.context,
        filePath: task.filePaths[0] || 'file.ts',
      });

      const preflight = shouldAttemptOptimization({
        baselineInputTokens: baselineAnalysis.inputTokens,
        model: baselineLLMRes.model,
        provider: baselineLLMRes.provider,
      });

      let optimizerDecision: 'OPTIMIZE' | 'FALLBACK_BASELINE' | 'SKIP_TOO_SMALL' = 'FALLBACK_BASELINE';
      let decisionReason = '';
      let selectedTier: 'normal' | 'medium' | 'aggressive' | 'baseline' = 'baseline';
      let compressedText = task.context;
      let optOverheadMs = 0;
      let optOverheadUsd = 0;
      let compressedTokens = baselineAnalysis.inputTokens;

      if (!preflight.shouldOptimize) {
        optimizerDecision = 'SKIP_TOO_SMALL';
        decisionReason = preflight.reason;
      } else {
        // Compress across tiers
        const tiers: ('normal' | 'medium' | 'aggressive')[] = ['normal', 'medium', 'aggressive'];
        const candidates: OptimizationCandidate[] = [];

        for (const tier of tiers) {
          const startMs = Date.now();
          const compResult = await this.engine.compress(task.context, task.filePaths[0] || 'file.ts', tier);
          const elapsedMs = Math.max(1, Date.now() - startMs);

          optOverheadMs += elapsedMs;
          const measurement = this.calibrator.measureExecution(
            task.id,
            tier,
            baselineAnalysis.inputTokens,
            () => compResult
          );
          optOverheadUsd += measurement.measurement.estimatedCostUsd;

          const tokens = Tokenizer.countTokens(compResult, task.filePaths[0] || 'file.ts');
          const qualityEval = await evaluateQuality({
            taskId: task.id,
            tier,
            originalText: task.context,
            compressedText: compResult,
            taskQuery: task.prompt,
          });

          const optModelCostObj = calculateModelCost({
            provider: baselineLLMRes.provider,
            model: baselineLLMRes.model,
            inputTokens: tokens,
            outputTokens: baselineAnalysis.outputTokens,
          });

          candidates.push({
            tier,
            inputTokens: tokens,
            estimatedOutputTokens: baselineAnalysis.outputTokens,
            qualityScore: qualityEval.finalQualityScore,
            criticalInformationLoss: qualityEval.deterministic.criticalInformationLoss,
            dependencyRetention: qualityEval.deterministic.dependencyRetention,
            symbolRetention: qualityEval.deterministic.symbolRetention,
            evidenceCoverage: 1.0,
            estimatedModelCost: optModelCostObj.totalCost,
            optimizerCost: measurement.measurement.estimatedCostUsd,
            totalProjectedCost: optModelCostObj.totalCost + measurement.measurement.estimatedCostUsd,
            compressedContent: compResult,
          });
        }

        // Pareto Tradeoff Selection
        const pareto = evaluateParetoTradeoff({
          candidates,
          qualityFloor: 0.85,
        });

        const selectedCandidate = pareto.selectedCandidate;

        // Economic Gate
        const economicGate = evaluateEconomicGate({
          baseline: baselineAnalysis.breakdown,
          selectedCandidate,
          optimizer: {
            latencyMs: optOverheadMs,
            cost: optOverheadUsd,
            mode: 'estimated',
            confidence: 'estimated',
          },
          qualityRiskFailed: selectedCandidate === null,
        });

        if (economicGate.decision === 'OPTIMIZE' && selectedCandidate && selectedCandidate.compressedContent) {
          optimizerDecision = 'OPTIMIZE';
          decisionReason = economicGate.reason;
          selectedTier = selectedCandidate.tier as any;
          compressedText = selectedCandidate.compressedContent;
          compressedTokens = selectedCandidate.inputTokens;
        } else {
          optimizerDecision = 'FALLBACK_BASELINE';
          decisionReason = economicGate.reason;
          selectedTier = 'baseline';
          compressedText = task.context;
          compressedTokens = baselineAnalysis.inputTokens;
        }
      }

      const tokenReductionPct =
        baselineAnalysis.inputTokens > 0
          ? parseFloat((((baselineAnalysis.inputTokens - compressedTokens) / baselineAnalysis.inputTokens) * 100).toFixed(2))
          : 0;

      // STEP C: Tokenist LLM Call
      let tokenistLLMRes: RealLLMResponse;
      if (optimizerDecision === 'OPTIMIZE') {
        tokenistLLMRes = await this.llmClient.call({
          prompt: task.prompt,
          context: compressedText,
          filePath: task.filePaths[0],
        });
      } else {
        // Fallback baseline call (re-uses baseline or makes parity call)
        tokenistLLMRes = {
          ...baselineLLMRes,
          requestId: `req_fallback_${Date.now()}`,
        };
      }

      const tokenistCorrectness = this.checkKeywordMatch(tokenistLLMRes.content, task.groundTruthKeywords);

      // Record in ProviderUsageCapturer telemetry
      providerCapturer.recordActualUsage(
        baselineLLMRes.requestId,
        baselineLLMRes.provider,
        baselineLLMRes.model,
        baselineLLMRes.inputTokens,
        baselineLLMRes.outputTokens,
        baselineAnalysis.breakdown
      );

      // STEP D: Economics Calculation
      const tokenistTotalSpendUsd = parseFloat((tokenistLLMRes.costUsd + (optimizerDecision === 'OPTIMIZE' ? optOverheadUsd : 0)).toFixed(6));
      const netSavingsUsd = parseFloat((baselineLLMRes.costUsd - tokenistTotalSpendUsd).toFixed(6));
      const netSavingsPct = baselineLLMRes.costUsd > 0 ? parseFloat(((netSavingsUsd / baselineLLMRes.costUsd) * 100).toFixed(2)) : 0;
      const qualityMaintained = tokenistCorrectness >= baselineCorrectness * 0.8;
      const isOverallSuccess = optimizerDecision === 'OPTIMIZE' && netSavingsUsd > 0 && qualityMaintained;

      taskResults.push({
        taskId: task.id,
        title: task.title,
        workloadCategory: task.workloadCategory,
        filePaths: task.filePaths,
        baseline: {
          inputTokens: baselineLLMRes.inputTokens,
          outputTokens: baselineLLMRes.outputTokens,
          costUsd: baselineLLMRes.costUsd,
          latencyMs: baselineLLMRes.latencyMs,
          response: baselineLLMRes.content,
          correctnessScore: baselineCorrectness,
          isMockMode: baselineLLMRes.isMockMode,
        },
        optimizer: {
          decision: optimizerDecision,
          decisionReason,
          selectedTier,
          baselineTokens: baselineAnalysis.inputTokens,
          compressedTokens,
          tokenReductionPct,
          optimizerOverheadMs: optOverheadMs,
          optimizerOverheadUsd: optOverheadUsd,
        },
        tokenist: {
          inputTokens: tokenistLLMRes.inputTokens,
          outputTokens: tokenistLLMRes.outputTokens,
          costUsd: tokenistLLMRes.costUsd,
          latencyMs: tokenistLLMRes.latencyMs,
          response: tokenistLLMRes.content,
          correctnessScore: tokenistCorrectness,
          isMockMode: tokenistLLMRes.isMockMode,
        },
        economics: {
          netSavingsUsd,
          netSavingsPct,
          qualityMaintained,
          isOverallSuccess,
        },
      });
    }

    // STEP E: Compute Aggregate Experiment Summary
    const diagnosticEngine = new DecisionDiagnosticEngine();
    const diagnostic = diagnosticEngine.analyze(taskResults);

    let totalBaselineInputTokens = 0;
    let totalTokenistInputTokens = 0;
    let totalBaselineCostUsd = 0;
    let totalTokenistModelCostUsd = 0;
    let totalOptimizerOverheadUsd = 0;
    let qualityMaintainedCount = 0;
    let overallSuccessCount = 0;

    for (const r of taskResults) {
      totalBaselineInputTokens += r.baseline.inputTokens;
      totalTokenistInputTokens += r.tokenist.inputTokens;
      totalBaselineCostUsd += r.baseline.costUsd;
      totalTokenistModelCostUsd += r.tokenist.costUsd;

      if (r.optimizer.decision === 'OPTIMIZE') {
        totalOptimizerOverheadUsd += r.optimizer.optimizerOverheadUsd;
      }

      if (r.economics.qualityMaintained) qualityMaintainedCount++;
      if (r.economics.isOverallSuccess) overallSuccessCount++;
    }

    const totalInputTokensReduced = totalBaselineInputTokens - totalTokenistInputTokens;
    const avgInputTokenReductionPct =
      totalBaselineInputTokens > 0
        ? parseFloat(((totalInputTokensReduced / totalBaselineInputTokens) * 100).toFixed(2))
        : 0;

    const totalTokenistTotalSpendUsd = parseFloat((totalTokenistModelCostUsd + totalOptimizerOverheadUsd).toFixed(6));
    const netFinancialSavingsUsd = parseFloat((totalBaselineCostUsd - totalTokenistTotalSpendUsd).toFixed(6));
    const netFinancialSavingsPct =
      totalBaselineCostUsd > 0 ? parseFloat(((netFinancialSavingsUsd / totalBaselineCostUsd) * 100).toFixed(2)) : 0;

    const summary: RealExperimentAggregateSummary = {
      runTimestamp: new Date().toISOString(),
      totalTasks: taskResults.length,
      provider: taskResults[0]?.baseline.isMockMode ? 'mock' : process.env.SHANAXON_PROVIDER || 'openai',
      model: process.env.SHANAXON_MODEL || 'gpt-4o-mini',
      isMockMode: taskResults[0]?.baseline.isMockMode ?? true,
      totalBaselineInputTokens,
      totalTokenistInputTokens,
      totalInputTokensReduced,
      avgInputTokenReductionPct,
      totalBaselineCostUsd: parseFloat(totalBaselineCostUsd.toFixed(6)),
      totalTokenistModelCostUsd: parseFloat(totalTokenistModelCostUsd.toFixed(6)),
      totalOptimizerOverheadUsd: parseFloat(totalOptimizerOverheadUsd.toFixed(6)),
      totalTokenistTotalSpendUsd,
      netFinancialSavingsUsd,
      netFinancialSavingsPct,
      optimizedCount: diagnostic.optimizedCount,
      fallbackCount: diagnostic.fallbackBaselineCount,
      skipCount: diagnostic.skipTooSmallCount,
      optimizationRatePct: diagnostic.optimizationRatePct,
      qualityMaintainedRatePct: parseFloat(((qualityMaintainedCount / taskResults.length) * 100).toFixed(1)),
      overallTaskSuccessRatePct: parseFloat(((overallSuccessCount / taskResults.length) * 100).toFixed(1)),
      diagnostic,
      taskResults,
    };

    // Save report JSON
    const reportDir = path.resolve(this.workspaceRoot, 'validation', 'reports');
    if (!fs.existsSync(reportDir)) fs.mkdirSync(reportDir, { recursive: true });

    const jsonPath = path.resolve(reportDir, `real_provider_experiment_${Date.now()}.json`);
    fs.writeFileSync(jsonPath, JSON.stringify(summary, null, 2), 'utf-8');

    // Generate Markdown Report
    const reporter = new ProviderValidationReporter(this.workspaceRoot);
    const mdPath = reporter.generateReport(summary);

    console.log('\n===========================================================');
    console.log(`Experiment Complete! Report written to ${mdPath}`);
    console.log(`JSON Result: ${jsonPath}`);
    console.log('===========================================================');

    return summary;
  }

  private checkKeywordMatch(text: string, keywords: string[]): number {
    if (keywords.length === 0) return 1.0;
    let found = 0;
    const lower = text.toLowerCase();
    for (const k of keywords) {
      if (lower.includes(k.toLowerCase())) found++;
    }
    return parseFloat((found / keywords.length).toFixed(2));
  }
}

if (require.main === module) {
  const runner = new RealProviderExperiment(process.cwd());
  const count = parseInt(process.env.SHANAXON_REAL_TASK_COUNT || '50', 10);
  runner.init().then(() => runner.runExperiment(count));
}
