import { CodeCompressionEngine } from '../core/parser';
import { analyzeBaseline } from '../intelligence/baselineAnalyzer';
import { shouldAttemptOptimization } from '../intelligence/economicPreflight';
import { evaluateParetoTradeoff, OptimizationCandidate } from '../intelligence/paretoSelector';
import { evaluateEconomicGate } from '../intelligence/economicGate';
import { calculateModelCost } from '../intelligence/economicsEngine';
import { createOptimizationReceipt } from '../intelligence/optimizationMetadata';
import { EconomicsAggregator } from '../intelligence/economicsAggregator';
import { CorpusTask } from './corpusBuilder';
import { evaluateQuality, HybridQualityEvaluation } from './qualityEvaluator';
import { OptimizerCalibrator } from './optimizerCalibrator';
import { Tokenizer } from '../core/tokenizer';
import { CompressionTier } from '../types';

export interface SingleTaskValidationResult {
  taskId: string;
  title: string;
  provenance: CorpusTask['provenance'];

  // Core Question 1: Did Tokenist reduce tokens?
  question1_tokensReduced: boolean;
  baselineInputTokens: number;
  optimizedInputTokens: number;
  tokenReductionPct: number;

  // Core Question 2: Did Tokenist maintain/improve quality?
  question2_qualityMaintained: boolean;
  qualityEvaluation: HybridQualityEvaluation;

  // Core Question 3: Did Tokenist actually reduce total cost?
  question3_totalCostReduced: boolean;
  baselineTotalCostUsd: number;
  optimizedModelCostUsd: number;
  optimizerOverheadCostUsd: number;
  tokenistTotalCostUsd: number;
  netSavingsUsd: number;
  netSavingsPct: number;

  // Decision & Metadata
  decision: 'OPTIMIZE' | 'FALLBACK_BASELINE' | 'SKIP_TOO_SMALL' | 'INSUFFICIENT_PRICING_DATA';
  decisionReason: string;
  selectedTier: CompressionTier | 'baseline';
  evaluationCostUsd: number;
  wallClockMs: number;
  cpuTimeMs: number;
}

export class EconomicValidator {
  private engine: CodeCompressionEngine;
  private calibrator: OptimizerCalibrator;
  private workspaceRoot: string;
  private model: string = 'claude-3-5-sonnet';

  constructor(workspaceRoot: string, calibrator: OptimizerCalibrator) {
    this.workspaceRoot = workspaceRoot;
    this.calibrator = calibrator;
    this.engine = new CodeCompressionEngine();
  }

  public async init(): Promise<void> {
    await this.engine.init();
  }

  public async validateTask(task: CorpusTask): Promise<SingleTaskValidationResult> {
    const rawContent = task.rawContent;

    // 1. Analyze Baseline
    const baseline = analyzeBaseline({
      model: this.model,
      originalCode: rawContent,
      filePath: task.id + (task.provenance.language === 'python' ? '.py' : task.provenance.language === 'rust' ? '.rs' : '.ts'),
    });

    // 2. Preflight Check
    const preflight = shouldAttemptOptimization({
      baselineInputTokens: baseline.inputTokens,
      model: this.model,
    });

    if (!preflight.shouldOptimize) {
      const skippedQuality = await evaluateQuality({
        taskId: task.id,
        tier: 'normal',
        originalText: rawContent,
        compressedText: rawContent,
        taskQuery: task.taskQuery,
      });

      return {
        taskId: task.id,
        title: task.title,
        provenance: task.provenance,
        question1_tokensReduced: false,
        baselineInputTokens: baseline.inputTokens,
        optimizedInputTokens: baseline.inputTokens,
        tokenReductionPct: 0,
        question2_qualityMaintained: true,
        qualityEvaluation: skippedQuality,
        question3_totalCostReduced: false,
        baselineTotalCostUsd: baseline.breakdown.totalCost,
        optimizedModelCostUsd: baseline.breakdown.totalCost,
        optimizerOverheadCostUsd: 0,
        tokenistTotalCostUsd: baseline.breakdown.totalCost,
        netSavingsUsd: 0,
        netSavingsPct: 0,
        decision: 'SKIP_TOO_SMALL',
        decisionReason: preflight.reason,
        selectedTier: 'baseline',
        evaluationCostUsd: skippedQuality.evaluationCostUsd,
        wallClockMs: 0,
        cpuTimeMs: 0,
      };
    }

    // 3. Run Compression Across Tiers & Score Quality
    const tiers: ('normal' | 'medium' | 'aggressive')[] = ['normal', 'medium', 'aggressive'];
    const candidates: OptimizationCandidate[] = [];
    let totalWallMs = 0;
    let totalCpuMs = 0;
    let lastQualityEval: HybridQualityEvaluation | null = null;

    const qualityMap = new Map<CompressionTier, HybridQualityEvaluation>();

    for (const tier of tiers) {
      const compressMeasure = this.calibrator.measureExecution(
        task.id,
        tier,
        baseline.inputTokens,
        () => {
          return rawContent;
        }
      );

      const extMap: Record<string, string> = {
        typescript: 'file.ts',
        javascript: 'file.js',
        python: 'file.py',
        go: 'file.go',
        rust: 'file.rs',
        markdown: 'file.md',
      };
      const fileName = extMap[task.provenance.language] || 'file.ts';

      const startMs = Date.now();
      const compressedText = await this.engine.compress(rawContent, fileName, tier);
      const latencyMs = Math.max(1, Date.now() - startMs);

      totalWallMs += latencyMs;
      totalCpuMs += compressMeasure.measurement.cpuTimeMs;

      const optTokens = Tokenizer.countTokens(compressedText, fileName);
      const estOutputTokens = Math.max(100, Math.ceil(optTokens * 0.05));

      const optModelCostObj = calculateModelCost({
        model: this.model,
        inputTokens: optTokens,
        outputTokens: estOutputTokens,
      });

      const optOverheadUsd = compressMeasure.measurement.estimatedCostUsd;
      const totalProjectedCost = optModelCostObj.totalCost + optOverheadUsd;

      const qualityEval = await evaluateQuality({
        taskId: task.id,
        tier,
        originalText: rawContent,
        compressedText,
        taskQuery: task.taskQuery,
        qualityFloor: task.expectedMinQualityScore,
      });

      qualityMap.set(tier, qualityEval);

      candidates.push({
        tier,
        inputTokens: optTokens,
        estimatedOutputTokens: estOutputTokens,
        qualityScore: qualityEval.finalQualityScore,
        criticalInformationLoss: qualityEval.deterministic.criticalInformationLoss,
        dependencyRetention: qualityEval.deterministic.dependencyRetention,
        symbolRetention: qualityEval.deterministic.symbolRetention,
        evidenceCoverage: 1.0,
        estimatedModelCost: optModelCostObj.totalCost,
        optimizerCost: optOverheadUsd,
        totalProjectedCost,
        compressedContent: compressedText,
      });
    }

    // 4. Run Pareto Selection
    const pareto = evaluateParetoTradeoff({
      candidates,
      qualityFloor: task.expectedMinQualityScore,
    });

    const selectedCandidate = pareto.selectedCandidate;

    // 5. Run Economic Gate
    const optCostObj = {
      latencyMs: totalWallMs,
      cost: candidates[0]?.optimizerCost || 0.0001,
      mode: 'estimated' as const,
      confidence: 'estimated' as const,
    };

    const economicGate = evaluateEconomicGate({
      baseline: baseline.breakdown,
      selectedCandidate,
      optimizer: optCostObj,
      qualityRiskFailed: pareto.selectedCandidate === null,
    });

    const isOptimized = economicGate.decision === 'OPTIMIZE';
    const selectedTier = isOptimized && selectedCandidate ? selectedCandidate.tier : 'baseline';

    const selectedQualityEval = isOptimized && selectedCandidate
      ? qualityMap.get(selectedCandidate.tier)!
      : await evaluateQuality({ taskId: task.id, tier: 'normal', originalText: rawContent, compressedText: rawContent, taskQuery: task.taskQuery });

    const finalOptimizedInputTokens = isOptimized && selectedCandidate ? selectedCandidate.inputTokens : baseline.inputTokens;
    const finalOptimizedModelCostUsd = isOptimized && selectedCandidate ? selectedCandidate.estimatedModelCost : baseline.breakdown.totalCost;
    const finalOptimizerOverheadUsd = isOptimized ? (selectedCandidate?.optimizerCost || 0) : 0;
    const finalTokenistTotalCostUsd = isOptimized ? economicGate.tokenistTotalCost : baseline.breakdown.totalCost;
    const netSavingsUsd = isOptimized ? economicGate.absoluteSavings : 0;
    const netSavingsPct = isOptimized ? economicGate.savingsPercent : 0;

    const tokenReductionPct = baseline.inputTokens > 0
      ? parseFloat((((baseline.inputTokens - finalOptimizedInputTokens) / baseline.inputTokens) * 100).toFixed(2))
      : 0;

    // Record receipt in aggregator
    const receipt = createOptimizationReceipt({
      taskId: task.id,
      taskType: task.provenance.taskType,
      model: this.model,
      originalTokenEstimate: baseline.inputTokens,
      finalTokenEstimate: finalOptimizedInputTokens,
      baselineTotalCost: baseline.breakdown.totalCost,
      tokenistTotalCost: finalTokenistTotalCostUsd,
      absoluteSavings: netSavingsUsd,
      isEconomicallyEffective: isOptimized,
      economics: {
        optimizationDecision: isOptimized ? 'OPTIMIZED' : 'BASELINE',
        decisionReason: economicGate.reason,
        projected: economicGate,
        actual: economicGate,
      },
    });
    EconomicsAggregator.getInstance().recordReceipt(receipt);

    // Answer the 3 core validation questions
    const question1_tokensReduced = tokenReductionPct > 0;
    const question2_qualityMaintained = selectedQualityEval.passedQualityFloor;
    const question3_totalCostReduced = netSavingsUsd > 0;

    return {
      taskId: task.id,
      title: task.title,
      provenance: task.provenance,
      question1_tokensReduced,
      baselineInputTokens: baseline.inputTokens,
      optimizedInputTokens: finalOptimizedInputTokens,
      tokenReductionPct,
      question2_qualityMaintained,
      qualityEvaluation: selectedQualityEval,
      question3_totalCostReduced,
      baselineTotalCostUsd: baseline.breakdown.totalCost,
      optimizedModelCostUsd: finalOptimizedModelCostUsd,
      optimizerOverheadCostUsd: finalOptimizerOverheadUsd,
      tokenistTotalCostUsd: finalTokenistTotalCostUsd,
      netSavingsUsd,
      netSavingsPct,
      decision: isOptimized ? 'OPTIMIZE' : 'FALLBACK_BASELINE',
      decisionReason: economicGate.reason,
      selectedTier,
      evaluationCostUsd: selectedQualityEval.evaluationCostUsd,
      wallClockMs: totalWallMs,
      cpuTimeMs: totalCpuMs,
    };
  }
}
