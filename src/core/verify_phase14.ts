import * as path from 'path';
import { runBenchmarkSuite } from '../benchmark/benchmarkRunner';
import { classifyTask } from '../intelligence/taskUnderstanding';
import { getModelPolicy, adjustTierForModel } from '../intelligence/modelPolicy';
import { storeMemory, recallMemory, listMemory, deleteMemory } from '../intelligence/criticalMemory';
import { evaluateQualityGate } from '../intelligence/qualityGate';
import { createOptimizationReceipt } from '../intelligence/optimizationMetadata';

async function main() {
  console.log('====================================================');
  console.log('SHANAXON v6.0 CONTEXT INTELLIGENCE VERIFICATION SUITE');
  console.log('====================================================\n');

  const workspaceRoot = path.resolve(process.cwd());

  // 1. Task Classification Verification
  console.log('[1/6] Verifying Task Classification Engine...');
  const prompt1 = 'Design high-level architecture system for authentication module';
  const profile1 = classifyTask(prompt1);
  console.log(`  - Prompt: "${prompt1}"`);
  console.log(`  - Task Type: ${profile1.taskType} (Confidence: ${profile1.confidence})`);
  console.log(`  - Recommended Budget Multiplier: ${profile1.recommendedBudgetMultiplier}`);

  if (profile1.taskType !== 'architecture_design' || profile1.confidence < 0.85) {
    throw new Error(`Task classification failed for prompt1! Received: ${profile1.taskType}`);
  }
  console.log('  -> Task Classification PASSED\n');

  // 2. Model Policy Verification
  console.log('[2/6] Verifying Model Policy Engine...');
  const policySonnet = getModelPolicy('claude-3-7-sonnet');
  const adjustedSonnet = adjustTierForModel('aggressive', 'claude-3-7-sonnet');
  console.log(`  - Model: ${policySonnet.modelName}`);
  console.log(`  - Max Context Tokens: ${policySonnet.maxContextTokens}`);
  console.log(`  - Max Allowed Tier: ${policySonnet.maxAllowedTier}`);
  console.log(`  - Adjusted Tier from 'aggressive': ${adjustedSonnet}`);

  if (adjustedSonnet !== 'medium') {
    throw new Error(`Model policy failed! Expected 'medium', got '${adjustedSonnet}'`);
  }
  console.log('  -> Model Policy PASSED\n');

  // 3. Critical Memory Lifecycle Verification
  console.log('[3/6] Verifying Critical Memory Persistent Storage...');
  const mem = await storeMemory({
    category: 'constraint',
    title: 'Verification Test Constraint',
    content: 'All API routes must enforce strict rate limiting.',
    priority: 'high',
    tags: ['api', 'rate-limit']
  }, workspaceRoot);
  console.log(`  - Stored Memory ID: ${mem.id}`);

  const recalled = await recallMemory('rate limiting API routes', workspaceRoot);
  console.log(`  - Recalled Memories Count: ${recalled.length}`);

  if (!recalled.some(m => m.id === mem.id)) {
    throw new Error('Critical memory recall failed to retrieve stored entry!');
  }

  const deleted = await deleteMemory(mem.id, workspaceRoot);
  console.log(`  - Memory Deletion Success: ${deleted}`);
  console.log('  -> Critical Memory Lifecycle PASSED\n');

  // 4. Quality Gate Verification
  console.log('[4/6] Verifying Quality Gate Safety & Retention Fallback...');
  const originalCode = 'function calculateTotalBudget(userRate: number, tokenCount: number): number { return userRate * tokenCount; }';
  const strippedCode = 'function calculateTotalBudget() { return 0; }';

  const qg = evaluateQualityGate(originalCode, strippedCode, profile1, 'aggressive', 0.85);
  console.log(`  - Quality Gate Passed: ${qg.passed}`);
  console.log(`  - Retention Score: ${qg.retentionPct}%`);
  console.log(`  - Fallback Tier Recommended: ${qg.fallbackTier}`);

  if (qg.passed || qg.fallbackTier !== 'medium') {
    throw new Error('Quality gate safety fallback failed to trigger expected rejection!');
  }
  console.log('  -> Quality Gate Safety PASSED\n');

  // 5. Receipt Metadata Verification
  console.log('[5/6] Verifying Optimization Receipt Generation...');
  const receipt = createOptimizationReceipt({
    taskId: 'task_verify_001',
    taskType: 'architecture_design',
    model: 'claude-3-7-sonnet',
    originalTokenEstimate: 10000,
    finalTokenEstimate: 3500,
    qualityGatePassed: true,
    qualityScore: 0.92,
    executionTimeMs: 45
  });
  console.log(`  - Generated Receipt Task ID: ${receipt.taskId}`);
  console.log(`  - Compression Ratio: ${receipt.compressionRatio}`);
  console.log(`  - Savings: ${receipt.savingsPct}%`);

  if (receipt.savingsPct !== 65) {
    throw new Error(`Receipt savings calculation mismatch! Got ${receipt.savingsPct}`);
  }
  console.log('  -> Receipt Metadata PASSED\n');

  // 6. Complete 16-Scenario Benchmark Suite
  console.log('[6/6] Executing Complete 16-Scenario Benchmark Suite...');
  const bench = await runBenchmarkSuite(workspaceRoot);
  console.log(`  - Total Scenarios: ${bench.totalScenarios}`);
  console.log(`  - Passed Scenarios: ${bench.passedScenarios}`);
  console.log(`  - Overall Pass Rate: ${bench.passRatePct}%`);

  for (const res of bench.results) {
    console.log(`    [${res.scenarioId}] ${res.title}: ${res.passed ? 'PASS' : 'FAIL'} (${res.details})`);
  }

  if (bench.passRatePct < 100) {
    throw new Error(`Benchmark suite had failures! Pass rate: ${bench.passRatePct}%`);
  }

  console.log('\n====================================================');
  console.log('ALL SHANAXON v6.0 VERIFICATION CHECKS PASSED (100%)');
  console.log('====================================================');
}

main().catch(err => {
  console.error('\nVerification Error:', err);
  process.exit(1);
});
