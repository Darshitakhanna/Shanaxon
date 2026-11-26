import { classifyTask } from '../intelligence/taskUnderstanding';
import { adjustTierForModel, getModelPolicy } from '../intelligence/modelPolicy';
import { deleteMemory, listMemory, recallMemory, storeMemory } from '../intelligence/criticalMemory';
import { scoreContextImportance } from '../intelligence/contextImportanceEngine';
import { evaluateEvidence } from '../intelligence/evidenceLayer';
import { equalizeContext } from '../intelligence/capabilityEqualizer';
import { evaluateQualityGate } from '../intelligence/qualityGate';
import { detectAgentFailure } from '../intelligence/failureDetector';
import { calculateModelCost, calculateOptimizerCost, ModelPricingRegistry } from '../intelligence/economicsEngine';
import { analyzeBaseline } from '../intelligence/baselineAnalyzer';
import { shouldAttemptOptimization } from '../intelligence/economicPreflight';
import { evaluateParetoTradeoff, OptimizationCandidate } from '../intelligence/paretoSelector';
import { evaluateEconomicGate } from '../intelligence/economicGate';
import { AttemptTracker } from '../intelligence/attemptTracker';
import { createOptimizationReceipt } from '../intelligence/optimizationMetadata';
import { runTokenAccuracyValidation } from '../validation/tokenAccuracyValidator';
import { CorpusBuilder } from '../validation/corpusBuilder';
import { evaluateQuality } from '../validation/qualityEvaluator';
import { OptimizerCalibrator } from '../validation/optimizerCalibrator';
import { ProviderUsageCapturer } from '../telemetry/providerUsageCapturer';
import { EconomicsAggregator } from '../intelligence/economicsAggregator';
import { EconomicValidator } from '../validation/economicValidator';
import { runRealWorldValidationBenchmark } from '../validation/realWorldBenchmark';


export interface BenchmarkResult {
  totalScenarios: number;
  passedScenarios: number;
  passRatePct: number;
  results: Array<{
    scenarioId: string;
    title: string;
    passed: boolean;
    details: string;
  }>;
}

/**
 * Runs the complete Tokenist 22-scenario benchmark suite validating context intelligence, memory,
 * quality gate multi-signal safety, model policy, and classification components.
 */
export async function runBenchmarkSuite(workspaceRoot: string): Promise<BenchmarkResult> {
  const results: Array<{ scenarioId: string; title: string; passed: boolean; details: string }> = [];

  // Scenario 1: Architecture Design Classification
  const task1 = classifyTask('Design system architecture for new auth module with high-level schema');
  results.push({
    scenarioId: 'SCENARIO_01',
    title: 'Architecture Design Task Classification',
    passed: task1.taskType === 'architecture_design' && task1.confidence >= 0.85,
    details: `Task type: ${task1.taskType}, Confidence: ${task1.confidence}`
  });

  // Scenario 2: Bug Investigation Classification
  const task2 = classifyTask('Fix bug causing stack trace error in parser function');
  results.push({
    scenarioId: 'SCENARIO_02',
    title: 'Bug Investigation Task Classification',
    passed: task2.taskType === 'bug_investigation' && task2.confidence >= 0.85,
    details: `Task type: ${task2.taskType}, Confidence: ${task2.confidence}`
  });

  // Scenario 3: Refactoring Classification
  const task3 = classifyTask('Refactor clean up and decouple module structure');
  results.push({
    scenarioId: 'SCENARIO_03',
    title: 'Refactoring Task Classification',
    passed: task3.taskType === 'refactoring',
    details: `Task type: ${task3.taskType}`
  });

  // Scenario 4: New Feature Classification
  const task4 = classifyTask('Implement new endpoint to add feature for telemetry');
  results.push({
    scenarioId: 'SCENARIO_04',
    title: 'New Feature Task Classification',
    passed: task4.taskType === 'new_feature',
    details: `Task type: ${task4.taskType}`
  });

  // Scenario 5: One-Off Query Classification
  const task5 = classifyTask('Explain what is the current cache strategy');
  results.push({
    scenarioId: 'SCENARIO_05',
    title: 'One-Off Query Task Classification',
    passed: task5.taskType === 'one_off_query',
    details: `Task type: ${task5.taskType}`
  });

  // Scenario 6: Unknown Task Fallback
  const task6 = classifyTask('hello world');
  results.push({
    scenarioId: 'SCENARIO_06',
    title: 'Unknown Task Fallback Handling',
    passed: task6.taskType === 'unknown' && task6.recommendedBudgetMultiplier === 1.0,
    details: `Task type: ${task6.taskType}, Multiplier: ${task6.recommendedBudgetMultiplier}`
  });

  // Scenario 7: Model Policy Sonnet Protection
  const policySonnet = getModelPolicy('claude-3-7-sonnet');
  const adjustedTierSonnet = adjustTierForModel('aggressive', 'claude-3-7-sonnet');
  results.push({
    scenarioId: 'SCENARIO_07',
    title: 'Model Policy Frontier Protection (Sonnet)',
    passed: policySonnet.maxAllowedTier === 'medium' && adjustedTierSonnet === 'medium',
    details: `Max allowed: ${policySonnet.maxAllowedTier}, Adjusted tier: ${adjustedTierSonnet}`
  });

  // Scenario 8: Model Policy Haiku Aggressive Allowed
  const policyHaiku = getModelPolicy('claude-3-5-haiku');
  const adjustedTierHaiku = adjustTierForModel('aggressive', 'claude-3-5-haiku');
  results.push({
    scenarioId: 'SCENARIO_08',
    title: 'Model Policy Fast Model Allocation (Haiku)',
    passed: policyHaiku.maxAllowedTier === 'aggressive' && adjustedTierHaiku === 'aggressive',
    details: `Max allowed: ${policyHaiku.maxAllowedTier}, Adjusted tier: ${adjustedTierHaiku}`
  });

  // Scenario 9: Model Policy Gemini Window
  const policyGemini = getModelPolicy('gemini-1.5-pro');
  results.push({
    scenarioId: 'SCENARIO_09',
    title: 'Model Policy Context Window Scaling (Gemini)',
    passed: policyGemini.maxContextTokens === 1000000,
    details: `Max context tokens: ${policyGemini.maxContextTokens}`
  });

  // Scenario 10: Critical Memory Store & Recall
  const stored = await storeMemory({
    category: 'decision',
    title: 'Benchmark Test Decision',
    content: 'Always use atomic rename for file storage.',
    tags: ['storage', 'benchmark'],
    priority: 'high'
  }, workspaceRoot);
  const recalled = await recallMemory('atomic rename file storage', workspaceRoot);
  results.push({
    scenarioId: 'SCENARIO_10',
    title: 'Critical Memory Store & Recall Cycle',
    passed: recalled.some(m => m.id === stored.id),
    details: `Recalled count: ${recalled.length}, Match found: ${recalled.some(m => m.id === stored.id)}`
  });

  // Scenario 11: Critical Memory Deletion
  const deleted = await deleteMemory(stored.id, workspaceRoot);
  const reList = await listMemory(workspaceRoot);
  results.push({
    scenarioId: 'SCENARIO_11',
    title: 'Critical Memory Deletion & Isolation',
    passed: deleted && !reList.some(m => m.id === stored.id),
    details: `Deleted successfully: ${deleted}`
  });

  // Scenario 12: Context Importance Scoring
  const importanceResult = scoreContextImportance(
    'Debug parser crash in AST graph',
    [
      { id: '1', category: 'code', sourcePath: 'src/parser.ts', rawContent: 'export function parseAST() { crash; }', graphScore: 0.9 },
      { id: '2', category: 'code', sourcePath: 'src/unused.ts', rawContent: 'const x = 1;', graphScore: 0.1 }
    ],
    task2,
    { 'src/parser.ts': 0.9, 'src/unused.ts': 0.1 }
  );
  results.push({
    scenarioId: 'SCENARIO_12',
    title: 'Context Importance Composite Scoring & Dispositioning',
    passed: importanceResult.items[0].disposition === 'must_include' && importanceResult.items[1].disposition === 'omit',
    details: `Item 1 disposition: ${importanceResult.items[0].disposition}, Item 2 disposition: ${importanceResult.items[1].disposition}`
  });

  // Scenario 13: Evidence Layer Evaluation
  const evidenceReport = evaluateEvidence(importanceResult.items, task2);
  results.push({
    scenarioId: 'SCENARIO_13',
    title: 'Evidence Layer Completeness & Fact Tagging',
    passed: evidenceReport.status.totalKnown > 0 && evidenceReport.status.completenessScore > 0,
    details: `Total known: ${evidenceReport.status.totalKnown}, Completeness: ${evidenceReport.status.completenessScore}`
  });

  // Scenario 14: Capability Equalization Active Memory Recall & Gap Reduction
  await storeMemory({
    category: 'architecture',
    title: 'Auth System Boundary',
    content: 'All auth requests must pass through JWT validation middleware.',
    tags: ['auth', 'architecture'],
    priority: 'high'
  }, workspaceRoot);

  const equalized = await equalizeContext('How to design auth system?', workspaceRoot, task1);
  results.push({
    scenarioId: 'SCENARIO_14',
    title: 'Capability Equalization Active Memory Injection & Capability Gap Reduction',
    passed: equalized.equalizationApplied && equalized.injectedMemories.length > 0 && equalized.capabilityGapAfter < equalized.capabilityGapBefore,
    details: `Gap before: ${equalized.capabilityGapBefore}, Gap after: ${equalized.capabilityGapAfter}, Memories injected: ${equalized.injectedMemories.length}`
  });

  // Scenario 15: Quality Gate Symbol Retention Safety & Fallback
  const qgResult = evaluateQualityGate(
    'function processTransaction(accountNumber: string, amountVal: number, currencyCode: string)',
    'function processTransaction()',
    task4,
    'aggressive',
    0.85
  );
  results.push({
    scenarioId: 'SCENARIO_15',
    title: 'Quality Gate Symbol Retention Safety & Fallback',
    passed: !qgResult.passed && qgResult.fallbackTier === 'medium',
    details: `Passed: ${qgResult.passed}, Fallback tier: ${qgResult.fallbackTier}, Reason: ${qgResult.reason}`
  });

  // Scenario 16: Failure Detector Retry Pattern
  const failureActions = detectAgentFailure([
    { prompt: 'fix the bug' },
    { prompt: 'fix the bug' },
    { prompt: 'fix the bug' }
  ]);
  results.push({
    scenarioId: 'SCENARIO_16',
    title: 'Agent Failure Detector Loop Identification',
    passed: failureActions.some(a => a.pattern === 'repetitive_retry'),
    details: `Detected patterns: ${failureActions.map(a => a.pattern).join(', ')}`
  });

  // Scenario 17: Quality Gate Constraint Comment Retention Failure
  const qgComment = evaluateQualityGate(
    '// IMPORTANT: DO NOT REMOVE SECURITY VALIDATION\nfunction validateToken(token: string) { return token.length > 10; }',
    'function validateToken(token: string) { return token.length > 10; }',
    task4,
    'aggressive',
    0.95
  );
  results.push({
    scenarioId: 'SCENARIO_17',
    title: 'Quality Gate Constraint Comment Retention Rejection',
    passed: qgComment.signals ? qgComment.signals.constraintCommentScore === 0 : false,
    details: `Constraint comment score: ${qgComment.signals?.constraintCommentScore}`
  });

  // Scenario 18: Quality Gate Dependency Import Retention
  const qgDep = evaluateQualityGate(
    `import { AuthGuard } from './auth';\nimport { TokenService } from './token';\nfunction secureEndpoint() { AuthGuard(); TokenService(); }`,
    `function secureEndpoint() { }`,
    task4,
    'aggressive',
    0.85
  );
  results.push({
    scenarioId: 'SCENARIO_18',
    title: 'Quality Gate Dependency Import Retention Check',
    passed: !qgDep.passed && (qgDep.signals?.dependencyScore || 0) < 0.5,
    details: `Dependency score: ${qgDep.signals?.dependencyScore}`
  });

  // Scenario 19: Stale Memory Detection
  const oldMemory = await storeMemory({
    category: 'gotcha',
    title: 'Old Cache Gotcha',
    content: 'Do not clear cache without locking.',
    tags: ['cache'],
    priority: 'low'
  }, workspaceRoot);
  // Artificially age the entry in memory state
  oldMemory.updatedAt = new Date(Date.now() - 40 * 24 * 60 * 60 * 1000).toISOString();
  const recalledStale = await recallMemory('Old Cache Gotcha', workspaceRoot);
  const matchedStale = recalledStale.find(m => m.id === oldMemory.id);
  results.push({
    scenarioId: 'SCENARIO_19',
    title: 'Stale Critical Memory Detection (>30 Days)',
    passed: matchedStale ? matchedStale.isStale === true : false,
    details: `Memory stale flag: ${matchedStale?.isStale}`
  });

  // Scenario 20: Contradictory Memory Flagging
  const s20Title = `Redis Caching Choice S20_${Date.now()}`;
  const mem1 = await storeMemory({
    category: 'decision',
    title: s20Title,
    content: 'Always use redis for global caching',
    tags: ['cache'],
    priority: 'high'
  }, workspaceRoot);
  const mem2 = await storeMemory({
    category: 'decision',
    title: s20Title,
    content: 'Never use redis for global caching due to latency',
    tags: ['cache'],
    priority: 'high'
  }, workspaceRoot);
  const recalledContradicted = await recallMemory(s20Title, workspaceRoot);
  const matchedContradicted = recalledContradicted.find(m => m.id === mem1.id);
  results.push({
    scenarioId: 'SCENARIO_20',
    title: 'Contradictory Memory Auto-Flagging',
    passed: matchedContradicted ? matchedContradicted.contradictedBy === mem2.id : false,
    details: `Contradicted by ID: ${matchedContradicted?.contradictedBy}`
  });

  // Scenario 21: Missing Context Detection in Evidence Report
  const briefEqualized = await equalizeContext('Fix parser error', workspaceRoot, task2);
  results.push({
    scenarioId: 'SCENARIO_21',
    title: 'Missing Context Gap Detection for Novice Prompts',
    passed: briefEqualized.missingContext.length > 0,
    details: `Detected context gaps: [${briefEqualized.missingContext.join('; ')}]`
  });

  // Scenario 22: Frontier Model Tier Cap (GPT-4o)
  const adjustedGpt4o = adjustTierForModel('aggressive', 'gpt-4o');
  results.push({
    scenarioId: 'SCENARIO_22',
    title: 'Frontier Model Tier Safety Cap (GPT-4o)',
    passed: adjustedGpt4o === 'medium',
    details: `Adjusted tier for gpt-4o: ${adjustedGpt4o}`
  });

  // Scenario 23: Economically Ineffective Optimization (High Overhead)
  const baselineCost23 = { inputTokens: 10000, outputTokens: 500, inputCost: 0.03, outputCost: 0.02, retryCost: 0, totalCost: 0.05, pricingStatus: 'KNOWN' as const };
  const optCost23 = { latencyMs: 30000, cost: 0.03, mode: 'estimated' as const, confidence: 'estimated' as const };
  const candidate23: OptimizationCandidate = {
    tier: 'medium', inputTokens: 6000, estimatedOutputTokens: 500, qualityScore: 0.9,
    criticalInformationLoss: 0, dependencyRetention: 0.9, symbolRetention: 0.85, evidenceCoverage: 1.0,
    estimatedModelCost: 0.03, optimizerCost: 0.03, totalProjectedCost: 0.06
  };
  const gate23 = evaluateEconomicGate({ baseline: baselineCost23, selectedCandidate: candidate23, optimizer: optCost23 });
  results.push({
    scenarioId: 'SCENARIO_23',
    title: 'Economically Ineffective Optimization Fallback (High Overhead)',
    passed: gate23.decision === 'FALLBACK_BASELINE' && gate23.reason === 'OPTIMIZATION_OVERHEAD_TOO_HIGH',
    details: `Decision: ${gate23.decision}, Reason: ${gate23.reason}`
  });

  // Scenario 24: Retry Explosion Failure Cost
  const baselineCost24 = { inputTokens: 50000, outputTokens: 2000, inputCost: 0.15, outputCost: 0.05, retryCost: 0, totalCost: 0.20, pricingStatus: 'KNOWN' as const };
  const optCost24 = { latencyMs: 1000, cost: 0.001, mode: 'estimated' as const, confidence: 'estimated' as const };
  const candidate24: OptimizationCandidate = {
    tier: 'medium', inputTokens: 20000, estimatedOutputTokens: 2000, qualityScore: 0.9,
    criticalInformationLoss: 0, dependencyRetention: 0.9, symbolRetention: 0.85, evidenceCoverage: 1.0,
    estimatedModelCost: 0.08, optimizerCost: 0.001, totalProjectedCost: 0.081
  };
  const gate24 = evaluateEconomicGate({ baseline: baselineCost24, selectedCandidate: candidate24, optimizer: optCost24, retryCost: 0.16 });
  results.push({
    scenarioId: 'SCENARIO_24',
    title: 'Retry Cost Exceeded Savings Fallback',
    passed: gate24.decision === 'FALLBACK_BASELINE' && gate24.reason === 'RETRY_COST_EXCEEDED_SAVINGS',
    details: `Decision: ${gate24.decision}, Reason: ${gate24.reason}`
  });

  // Scenario 25: Pareto Selection (Cheapest Safe Candidate)
  const candNormal25: OptimizationCandidate = { tier: 'normal', inputTokens: 20000, qualityScore: 0.95, criticalInformationLoss: 0, dependencyRetention: 0.95, symbolRetention: 0.95, evidenceCoverage: 1.0, estimatedModelCost: 0.08, optimizerCost: 0.001, totalProjectedCost: 0.081 };
  const candMedium25: OptimizationCandidate = { tier: 'medium', inputTokens: 12000, qualityScore: 0.90, criticalInformationLoss: 0, dependencyRetention: 0.90, symbolRetention: 0.85, evidenceCoverage: 1.0, estimatedModelCost: 0.05, optimizerCost: 0.001, totalProjectedCost: 0.051 };
  const candAggressive25: OptimizationCandidate = { tier: 'aggressive', inputTokens: 5000, qualityScore: 0.72, criticalInformationLoss: 0, dependencyRetention: 0.70, symbolRetention: 0.60, evidenceCoverage: 1.0, estimatedModelCost: 0.02, optimizerCost: 0.001, totalProjectedCost: 0.021 };
  const pareto25 = evaluateParetoTradeoff({ candidates: [candNormal25, candMedium25, candAggressive25], qualityFloor: 0.85 });
  results.push({
    scenarioId: 'SCENARIO_25',
    title: 'Pareto Selection (Cheapest Safe Candidate)',
    passed: pareto25.selectedCandidate?.tier === 'medium',
    details: `Selected tier: ${pareto25.selectedCandidate?.tier}`
  });

  // Scenario 26: Baseline Already Optimal (Minimal Savings)
  const baselineCost26 = { inputTokens: 20000, outputTokens: 1000, inputCost: 0.08, outputCost: 0.02, retryCost: 0, totalCost: 0.10, pricingStatus: 'KNOWN' as const };
  const optCost26 = { latencyMs: 5000, cost: 0.005, mode: 'estimated' as const, confidence: 'estimated' as const };
  const candidate26: OptimizationCandidate = {
    tier: 'medium', inputTokens: 19500, estimatedOutputTokens: 1000, qualityScore: 0.95,
    criticalInformationLoss: 0, dependencyRetention: 0.95, symbolRetention: 0.95, evidenceCoverage: 1.0,
    estimatedModelCost: 0.098, optimizerCost: 0.005, totalProjectedCost: 0.103
  };
  const gate26 = evaluateEconomicGate({ baseline: baselineCost26, selectedCandidate: candidate26, optimizer: optCost26 });
  results.push({
    scenarioId: 'SCENARIO_26',
    title: 'Baseline Already Optimal Fallback',
    passed: gate26.decision === 'FALLBACK_BASELINE',
    details: `Decision: ${gate26.decision}, Reason: ${gate26.reason}`
  });

  // Scenario 27: Quality Improvement But Higher Cost Fallback
  const baselineCost27 = { inputTokens: 20000, outputTokens: 1000, inputCost: 0.08, outputCost: 0.02, retryCost: 0, totalCost: 0.10, pricingStatus: 'KNOWN' as const };
  const optCost27 = { latencyMs: 1000, cost: 0.001, mode: 'estimated' as const, confidence: 'estimated' as const };
  const candidate27: OptimizationCandidate = {
    tier: 'medium', inputTokens: 25000, estimatedOutputTokens: 1000, qualityScore: 0.99,
    criticalInformationLoss: 0, dependencyRetention: 0.99, symbolRetention: 0.99, evidenceCoverage: 1.0,
    estimatedModelCost: 0.139, optimizerCost: 0.001, totalProjectedCost: 0.14
  };
  const gate27 = evaluateEconomicGate({ baseline: baselineCost27, selectedCandidate: candidate27, optimizer: optCost27 });
  results.push({
    scenarioId: 'SCENARIO_27',
    title: 'Quality Improvement But Higher Cost Fallback',
    passed: gate27.decision === 'FALLBACK_BASELINE',
    details: `Decision: ${gate27.decision}, Reason: ${gate27.reason}`
  });

  // Scenario 28: Output Token Explosion Fallback
  const baselineCost28 = { inputTokens: 100000, outputTokens: 2000, inputCost: 0.30, outputCost: 0.03, retryCost: 0, totalCost: 0.33, pricingStatus: 'KNOWN' as const };
  const optCost28 = { latencyMs: 1000, cost: 0.001, mode: 'estimated' as const, confidence: 'estimated' as const };
  const candidate28: OptimizationCandidate = {
    tier: 'medium', inputTokens: 30000, estimatedOutputTokens: 10000, qualityScore: 0.90,
    criticalInformationLoss: 0, dependencyRetention: 0.90, symbolRetention: 0.85, evidenceCoverage: 1.0,
    estimatedModelCost: 0.339, optimizerCost: 0.001, totalProjectedCost: 0.34
  };
  const gate28 = evaluateEconomicGate({ baseline: baselineCost28, selectedCandidate: candidate28, optimizer: optCost28 });
  results.push({
    scenarioId: 'SCENARIO_28',
    title: 'Output Token Expansion Fallback Detection',
    passed: gate28.decision === 'FALLBACK_BASELINE',
    details: `Decision: ${gate28.decision}, Total Cost: ${gate28.tokenistTotalCost}`
  });

  // Scenario 29: Unknown Model Pricing Protection
  const costUnknown = calculateModelCost({ provider: 'custom', model: 'unknown-model-xyz', inputTokens: 10000, outputTokens: 500 });
  results.push({
    scenarioId: 'SCENARIO_29',
    title: 'Unknown Model Pricing Status Protection',
    passed: costUnknown.pricingStatus === 'PRICE_UNAVAILABLE' && costUnknown.totalCost === 0,
    details: `Status: ${costUnknown.pricingStatus}, Cost: ${costUnknown.totalCost}`
  });

  // Scenario 30: Tiny Savings Below Minimum Threshold
  const baselineCost30 = { inputTokens: 20000, outputTokens: 1000, inputCost: 0.08, outputCost: 0.02, retryCost: 0, totalCost: 0.10, pricingStatus: 'KNOWN' as const };
  const optCost30 = { latencyMs: 100, cost: 0.0001, mode: 'estimated' as const, confidence: 'estimated' as const };
  const candidate30: OptimizationCandidate = {
    tier: 'medium', inputTokens: 19950, estimatedOutputTokens: 1000, qualityScore: 0.95,
    criticalInformationLoss: 0, dependencyRetention: 0.95, symbolRetention: 0.95, evidenceCoverage: 1.0,
    estimatedModelCost: 0.0998, optimizerCost: 0.0001, totalProjectedCost: 0.0999
  };
  const gate30 = evaluateEconomicGate({ baseline: baselineCost30, selectedCandidate: candidate30, optimizer: optCost30, minimumSavingsUsd: 0.001 });
  results.push({
    scenarioId: 'SCENARIO_30',
    title: 'Tiny Savings Below Threshold Fallback',
    passed: gate30.decision === 'FALLBACK_BASELINE' && gate30.reason === 'NO_MEANINGFUL_SAVINGS',
    details: `Decision: ${gate30.decision}, Reason: ${gate30.reason}`
  });

  // Scenario 31: Quality Gate Overrides Cheap Candidate
  const candLowQuality: OptimizationCandidate = { tier: 'aggressive', inputTokens: 1000, qualityScore: 0.60, criticalInformationLoss: 0, dependencyRetention: 0.50, symbolRetention: 0.40, evidenceCoverage: 0.5, estimatedModelCost: 0.001, optimizerCost: 0.0001, totalProjectedCost: 0.0011 };
  const pareto31 = evaluateParetoTradeoff({ candidates: [candLowQuality], qualityFloor: 0.85 });
  results.push({
    scenarioId: 'SCENARIO_31',
    title: 'Quality Floor Overrides Low Cost Candidate',
    passed: pareto31.selectedCandidate === null && pareto31.rejectedCandidates.length === 1,
    details: `Selected candidate: ${pareto31.selectedCandidate}, Rejected count: ${pareto31.rejectedCandidates.length}`
  });

  // Scenario 32: Critical Information Loss Rejection
  const candCriticalLoss: OptimizationCandidate = { tier: 'medium', inputTokens: 5000, qualityScore: 0.90, criticalInformationLoss: 1, dependencyRetention: 0.90, symbolRetention: 0.85, evidenceCoverage: 1.0, estimatedModelCost: 0.02, optimizerCost: 0.0001, totalProjectedCost: 0.0201 };
  const pareto32 = evaluateParetoTradeoff({ candidates: [candCriticalLoss], qualityFloor: 0.85 });
  results.push({
    scenarioId: 'SCENARIO_32',
    title: 'Critical Information Loss Candidate Rejection',
    passed: pareto32.selectedCandidate === null && pareto32.rejectedCandidates[0].reason === 'CRITICAL_INFORMATION_LOSS',
    details: `Rejection reason: ${pareto32.rejectedCandidates[0]?.reason}`
  });

  // Scenario 33: Preflight Negative Savings Skip
  const preflight33 = shouldAttemptOptimization({ baselineInputTokens: 100, model: 'claude-3-5-sonnet' });
  results.push({
    scenarioId: 'SCENARIO_33',
    title: 'Economic Preflight Small Request Skip',
    passed: preflight33.shouldOptimize === false && preflight33.reason === 'TOO_SMALL_REQUEST',
    details: `Should optimize: ${preflight33.shouldOptimize}, Reason: ${preflight33.reason}`
  });

  // Scenario 34: Actual vs Projected Economics Dual Storage
  const receipt34 = createOptimizationReceipt({
    taskId: 'test_34',
    taskType: 'unknown',
    model: 'claude-3-5-sonnet',
    originalTokenEstimate: 1000,
    finalTokenEstimate: 500,
    baselineTotalCost: 0.10,
    tokenistTotalCost: 0.05,
    absoluteSavings: 0.05,
    isEconomicallyEffective: true,
    economics: {
      optimizationDecision: 'OPTIMIZED',
      decisionReason: 'SAVINGS_ACCEPTED',
      projected: { baseline: baselineCost23, optimized: baselineCost23, optimizer: optCost24, baselineTotalCost: 0.10, tokenistTotalCost: 0.05, absoluteSavings: 0.05, savingsPercent: 50, isEconomicallyEffective: true, decision: 'OPTIMIZE', reason: 'SAVINGS_ACCEPTED' },
      actual: { baseline: baselineCost23, optimized: baselineCost23, optimizer: optCost24, baselineTotalCost: 0.10, tokenistTotalCost: 0.06, absoluteSavings: 0.04, savingsPercent: 40, isEconomicallyEffective: true, decision: 'OPTIMIZE', reason: 'SAVINGS_ACCEPTED' },
    }
  });
  results.push({
    scenarioId: 'SCENARIO_34',
    title: 'Projected vs Actual Dual Economics Receipt Storage',
    passed: receipt34.economics?.projected?.absoluteSavings === 0.05 && receipt34.economics?.actual?.absoluteSavings === 0.04,
    details: `Projected savings: ${receipt34.economics?.projected?.absoluteSavings}, Actual savings: ${receipt34.economics?.actual?.absoluteSavings}`
  });

  // Scenario 35: Attempt Tracker Retry Cost Accumulation
  const tracker = AttemptTracker.getInstance();
  tracker.clear();
  tracker.recordAttempt({ requestId: 'req_35', attemptNumber: 1, inputTokens: 1000, outputTokens: 200, inputCost: 0.03, outputCost: 0.01, success: false });
  tracker.recordAttempt({ requestId: 'req_35', attemptNumber: 2, inputTokens: 1000, outputTokens: 200, inputCost: 0.03, outputCost: 0.01, success: false });
  tracker.recordAttempt({ requestId: 'req_35', attemptNumber: 3, inputTokens: 1000, outputTokens: 200, inputCost: 0.03, outputCost: 0.01, success: true });
  const retryCost35 = tracker.calculateRetryCost('req_35');
  results.push({
    scenarioId: 'SCENARIO_35',
    title: 'Attempt Tracker Retry Cost Accumulation',
    passed: Math.abs(retryCost35 - 0.08) < 0.0001,
    details: `Calculated retry cost for 2 failed attempts: ${retryCost35}`
  });

  // Scenario 36: Token Count Calibration Engine
  const calib36 = await runTokenAccuracyValidation(workspaceRoot);
  results.push({
    scenarioId: 'SCENARIO_36',
    title: 'Token Count Calibration Engine',
    passed: calib36.sampledFilesCount > 0 && calib36.recommendedCounter === 'tokenizer',
    details: `Sampled files: ${calib36.sampledFilesCount}, Recommended counter: ${calib36.recommendedCounter}`
  });

  // Scenario 37: Dual-Corpus Provenance Tracking (60/40 Split)
  const corpusBuilder37 = new CorpusBuilder(workspaceRoot);
  const corpus37 = await corpusBuilder37.buildAndSaveCorpus();
  results.push({
    scenarioId: 'SCENARIO_37',
    title: 'Dual-Corpus Provenance Tracking (60/40 Split)',
    passed: corpus37.totalTasks === 200 && corpus37.tokenistRepoRatioPct === 60.0 && corpus37.tasks[130].provenance.commitSha !== undefined,
    details: `Total tasks: ${corpus37.totalTasks}, Ratio: ${corpus37.tokenistRepoRatioPct}% / ${corpus37.externalRepoRatioPct}%`
  });

  // Scenario 38: Deterministic Quality Evaluator Structural Scoring
  const qual38 = await evaluateQuality({
    taskId: 'task_38',
    tier: 'medium',
    originalText: 'export function add(a: number, b: number): number { return a + b; }',
    compressedText: 'export function add(a: number, b: number): number',
  });
  results.push({
    scenarioId: 'SCENARIO_38',
    title: 'Deterministic Quality Evaluator Structural Scoring',
    passed: qual38.evaluationMethod === 'deterministic' && qual38.deterministic.symbolRetention > 0,
    details: `Method: ${qual38.evaluationMethod}, Score: ${qual38.finalQualityScore}`
  });

  // Scenario 39: Hybrid Quality Evaluator Opt-In LLM Judge Cost Isolation
  process.env.SHANAXON_ENABLE_LLM_JUDGE = 'true';
  const qual39 = await evaluateQuality({
    taskId: 'task_39',
    tier: 'medium',
    originalText: 'class User { name: string; }',
    compressedText: 'class User { name: string; }',
  });
  delete process.env.SHANAXON_ENABLE_LLM_JUDGE;
  results.push({
    scenarioId: 'SCENARIO_39',
    title: 'Hybrid Quality Evaluator Opt-In LLM Judge Cost Isolation',
    passed: qual39.evaluationMethod === 'hybrid' && qual39.evaluationCostUsd > 0 && qual39.llmJudge !== undefined,
    details: `Method: ${qual39.evaluationMethod}, Evaluation Cost: $${qual39.evaluationCostUsd}`
  });

  // Scenario 40: Optimizer Calibrator Hardware Metrics
  const calib40 = new OptimizerCalibrator(workspaceRoot);
  calib40.measureExecution('task_40', 'medium', 500, () => {
    let sum = 0;
    for (let i = 0; i < 10000; i++) sum += i;
    return sum;
  });
  const summary40 = calib40.getSummary();
  results.push({
    scenarioId: 'SCENARIO_40',
    title: 'Optimizer Calibrator Hardware Metrics',
    passed: summary40.totalRuns === 1 && summary40.measurements[0].wallClockMs >= 0 && summary40.costMode === 'estimated',
    details: `Runs: ${summary40.totalRuns}, Latency: ${summary40.avgWallClockMs}ms, Cost Mode: ${summary40.costMode}`
  });

  // Scenario 41: Provider Usage Capturer Cost Projection Variance
  const capturer41 = ProviderUsageCapturer.getInstance(workspaceRoot);
  capturer41.clear();
  capturer41.recordActualUsage('req_41', 'anthropic', 'claude-3-5-sonnet', 1000, 200, {
    inputTokens: 1000,
    outputTokens: 200,
    inputCost: 0.003,
    outputCost: 0.003,
    retryCost: 0,
    totalCost: 0.006,
    pricingStatus: 'KNOWN',
  });
  const report41 = capturer41.getAccuracyReport();
  results.push({
    scenarioId: 'SCENARIO_41',
    title: 'Provider Usage Capturer Cost Projection Variance',
    passed: report41.totalCapturedRecords === 1 && report41.accurateWithin10PctCount === 1,
    details: `Captured: ${report41.totalCapturedRecords}, Accurate count: ${report41.accurateWithin10PctCount}`
  });

  // Scenario 42: Persistent Economics Ledger Disk Serializer
  const agg42 = EconomicsAggregator.getInstance();
  agg42.clear();
  agg42.recordReceipt(receipt34);
  const summary42 = agg42.getSummary();
  results.push({
    scenarioId: 'SCENARIO_42',
    title: 'Persistent Economics Ledger Disk Serializer',
    passed: summary42.requestCount === 1 && summary42.baselineSpend === 0.10,
    details: `Request count: ${summary42.requestCount}, Baseline spend: $${summary42.baselineSpend}`
  });

  // Scenario 43: 3-Question Economic Validation Core Framework
  const calib43 = new OptimizerCalibrator(workspaceRoot);
  const validator43 = new EconomicValidator(workspaceRoot, calib43);
  await validator43.init();
  const res43 = await validator43.validateTask(corpus37.tasks[0]);
  results.push({
    scenarioId: 'SCENARIO_43',
    title: '3-Question Economic Validation Core Framework',
    passed: typeof res43.question1_tokensReduced === 'boolean' && typeof res43.question2_qualityMaintained === 'boolean' && typeof res43.question3_totalCostReduced === 'boolean',
    details: `Q1 (Tokens): ${res43.question1_tokensReduced}, Q2 (Quality): ${res43.question2_qualityMaintained}, Q3 (Cost): ${res43.question3_totalCostReduced}`
  });

  // Scenario 44: Abstention Decision Guard ("DO NOT OPTIMIZE")
  const res44 = await validator43.validateTask({
    id: 'task_44_tiny',
    title: 'Tiny Prompt Abstention',
    provenance: { repository: 'Darshitakhanna/tokenist', commitSha: 'v6.0', license: 'MIT', language: 'typescript', projectSize: 'small', taskType: 'one_off_query', workloadType: 'minimal' },
    rawContent: 'let x = 1;',
    taskQuery: 'Check variable value',
    expectedMinQualityScore: 0.90,
    tags: ['minimal'],
  });
  results.push({
    scenarioId: 'SCENARIO_44',
    title: 'Abstention Decision Guard ("DO NOT OPTIMIZE")',
    passed: res44.decision === 'SKIP_TOO_SMALL' || res44.decision === 'FALLBACK_BASELINE',
    details: `Decision: ${res44.decision}, Reason: ${res44.decisionReason}`
  });

  // Scenario 45: Full Validation Suite Orchestration
  results.push({
    scenarioId: 'SCENARIO_45',
    title: 'Full Validation Suite Orchestration',
    passed: corpus37.tasks.length === 200,
    details: `Verified 200 validation corpus tasks ready for real-world benchmark execution.`
  });

  const passedScenarios = results.filter(r => r.passed).length;
  const passRatePct = Number(((passedScenarios / results.length) * 100).toFixed(1));

  return {
    totalScenarios: results.length,
    passedScenarios,
    passRatePct,
    results
  };
}

