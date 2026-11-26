import { classifyTask } from '../intelligence/taskUnderstanding';
import { adjustTierForModel, getModelPolicy } from '../intelligence/modelPolicy';
import { deleteMemory, listMemory, recallMemory, storeMemory } from '../intelligence/criticalMemory';
import { scoreContextImportance } from '../intelligence/contextImportanceEngine';
import { evaluateEvidence } from '../intelligence/evidenceLayer';
import { equalizeContext } from '../intelligence/capabilityEqualizer';
import { evaluateQualityGate } from '../intelligence/qualityGate';
import { detectAgentFailure } from '../intelligence/failureDetector';

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
  const mem1 = await storeMemory({
    category: 'decision',
    title: 'Redis Caching Choice',
    content: 'Always use redis for global caching',
    tags: ['cache'],
    priority: 'high'
  }, workspaceRoot);
  const mem2 = await storeMemory({
    category: 'decision',
    title: 'Redis Caching Choice',
    content: 'Never use redis for global caching due to latency',
    tags: ['cache'],
    priority: 'high'
  }, workspaceRoot);
  const recalledContradicted = await recallMemory('Redis Caching Choice', workspaceRoot);
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

  const passedScenarios = results.filter(r => r.passed).length;
  const passRatePct = Number(((passedScenarios / results.length) * 100).toFixed(1));

  return {
    totalScenarios: results.length,
    passedScenarios,
    passRatePct,
    results
  };
}
