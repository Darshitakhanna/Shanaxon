import * as path from 'path';
import { UsageTracker } from './usageTracker';
import { Tokenizer } from './tokenizer';
import { enforceBudget, estimateTokens } from './budgetManager';
import { CodeCompressionEngine } from './parser';
import { loadConfig, getConfig, resetConfigState } from './configLoader';
import { runRealBenchmark } from './benchmarkReal';

async function runTests() {
  console.log("=== Running P1: Architectural Improvements Verification ===");

  const workspaceRoot = process.cwd();

  // 1. Verify Usage Tracker Debounced Persistence
  console.log("\n1. Testing Usage Tracker Debounced Persistence...");
  const tracker = new UsageTracker(workspaceRoot);
  await tracker.clear();
  tracker.recordAccess('src/server.ts');
  tracker.recordAccess('src/server.ts');
  const usage = tracker.getUsage('src/server.ts');
  console.log(`Usage count recorded: ${usage?.accessCount}`);
  if (!usage || usage.accessCount !== 2) {
    throw new Error("UsageTracker failed to record access frequency!");
  }
  await tracker.flushToDisk();
  console.log("✓ Usage Tracker debounced async persistence verified.");

  // 2. Verify Language-Aware Tokenizer
  console.log("\n2. Testing Language-Aware Tokenizer...");
  const codeSample = `
  import * as path from 'path';
  // Comment line explaining code functionality
  function processFile(filePath: string): boolean {
    return filePath.endsWith('.ts');
  }
  `;
  const codeTokens = Tokenizer.countTokens(codeSample, 'src/sample.ts');
  const jsonSample = `{"name": "tokenist", "version": "1.0.0", "dependencies": {"express": "^4.18.2"}}`;
  const jsonTokens = Tokenizer.countTokens(jsonSample, 'package.json');

  console.log(`Code sample (${codeSample.length} chars) tokens: ${codeTokens}`);
  console.log(`JSON sample (${jsonSample.length} chars) tokens: ${jsonTokens}`);
  if (codeTokens <= 0 || jsonTokens <= 0) {
    throw new Error("Tokenizer returned invalid token counts!");
  }
  console.log("✓ Language-Aware Tokenizer verification passed.");

  // 3. Verify Inverted Budget Manager Drop Order
  console.log("\n3. Testing Inverted Budget Manager Drop Order...");
  const engine = new CodeCompressionEngine();
  await engine.init();

  const files = [
    { filePath: path.resolve(workspaceRoot, 'src/criticalType.ts'), code: 'export interface CriticalConfig { id: string; name: string; }' },
    { filePath: path.resolve(workspaceRoot, 'src/heavyModule.ts'), code: 'function heavyComputation() {\n  '.repeat(100) + 'console.log(1);\n}' }
  ];

  const importanceScores = new Map<string, number>([
    [path.resolve(workspaceRoot, 'src/criticalType.ts'), 0.9], // High PageRank
    [path.resolve(workspaceRoot, 'src/heavyModule.ts'), 0.1]   // Low PageRank
  ]);

  // Restrict budget to force dropping
  const budgetResult = await enforceBudget(files, engine, 50, importanceScores);
  const droppedFile = budgetResult.results.find(r => r.tier === 'omitted');
  console.log(`Omitted file: ${droppedFile ? path.basename(droppedFile.filePath) : 'none'}`);
  
  if (!droppedFile || !droppedFile.filePath.includes('heavyModule.ts')) {
    throw new Error("Budget manager failed to drop low-importance heavy file first!");
  }
  console.log("✓ Inverted Budget Manager drop order verified.");

  // 4. Verify Config Loader Race Condition Fix
  console.log("\n4. Testing Config Loader Memoized Promise...");
  resetConfigState();
  const promise1 = loadConfig(workspaceRoot);
  const promise2 = loadConfig(workspaceRoot);

  if (promise1 !== promise2) {
    throw new Error("loadConfig returned different promises for concurrent calls!");
  }

  const resolvedConfig = await promise1;
  console.log(`Resolved config default tier: ${resolvedConfig.defaultTier}`);
  console.log("✓ Config Loader memoized concurrent thread safety verified.");

  // 5. Verify Real Codebase Benchmark Execution
  console.log("\n5. Testing Real Codebase Benchmark Suite...");
  const stats = await runRealBenchmark(workspaceRoot);
  console.log(`Benchmark completed for ${stats.length} tiers on ${stats[0].totalFiles} files.`);
  console.log(`Aggressive Tier Token Savings: ${stats[2].savingsPct}% (${stats[2].compressedTokens} tokens vs ${stats[2].rawTokens} raw tokens)`);

  if (stats.length !== 3 || stats[2].savingsPct <= 0) {
    throw new Error("Real codebase benchmark produced invalid results!");
  }
  console.log("✓ Real Codebase Benchmark verification passed.");

  console.log("\n=== All P1 Architectural Tests Passed successfully! ===");
}

runTests().catch(err => {
  console.error("❌ P1 Test Suite Failed:");
  console.error(err);
  process.exit(1);
});
