import * as path from 'path';
import { promises as fs } from 'fs';
import { EmbeddingRanker } from './embeddingRanker';
import { MetricsCollector } from '../telemetry/metricsCollector';
import { renderDashboard } from '../telemetry/terminalConsole';

const AUTH_CONTENT = "User login authentication, registration, JWT token generation, passwords hashing and validation, sessions management.";
const DB_CONTENT = "Relational database connection pool, query execution, transaction handling, table migrations, SQL queries helper.";
const BUTTON_CONTENT = "React UI Button component, dynamic themes, disabled state, hover and focus transitions, styled border radius.";

async function runTests() {
  console.log("=== Running Embedding Semantic Ranker & Telemetry Verification ===");

  const ranker = new EmbeddingRanker();
  console.log("Initializing ONNX embedding model (this may take a few seconds on first run)...");
  await ranker.init();

  const authFile = 'authService.ts';
  const dbFile = 'database.ts';
  const btnFile = 'uiButton.tsx';

  // 1. Index files
  console.log("\nIndexing file signatures...");
  await ranker.indexFile(authFile, AUTH_CONTENT);
  await ranker.indexFile(dbFile, DB_CONTENT);
  await ranker.indexFile(btnFile, BUTTON_CONTENT);

  // 2. Rank query
  console.log("\nRanking files for semantic query: 'auth token login'...");
  const results = await ranker.rankFiles("auth token login", 3);
  console.log("Semantic search results:");
  results.forEach((r, idx) => console.log(` [${idx + 1}] File: ${r.filePath}, Score: ${r.score.toFixed(4)}`));

  if (results[0].filePath !== authFile) {
    throw new Error(`Semantic search ranked ${results[0].filePath} as #1 instead of ${authFile}!`);
  }
  // Check that the best result has significantly higher score than the rest
  if (results[0].score < results[1].score || results[0].score < results[2].score) {
    throw new Error("Rank #1 does not have the highest score!");
  }
  console.log("✓ Semantic ranking queries checks passed.");

  // 3. Telemetry Collector and Dashboard Renderer check
  console.log("\nTesting Telemetry Metrics Ledger & Console Dashboard...");
  const tempLedger = path.resolve(process.cwd(), 'telemetry_ledger_test.json');
  // Mock collector using temp ledger path
  const collector = new MetricsCollector(process.cwd());
  // Temporarily swap ledgerPath
  (collector as any).ledgerPath = tempLedger;

  // Cleanup old test file
  await fs.unlink(tempLedger).catch(() => {});

  try {
    const sampleRaw = "const x = 10;\nconst y = 20;\nconsole.log(x + y);";
    const sampleComp = "const x = 10; ...";

    await collector.logMetrics('fileA.ts', sampleRaw, sampleComp, 'aggressive', 45);
    await collector.logMetrics('fileB.py', "def foo():\n    pass", "def foo(): ...", 'medium', 12);

    const records = await collector.getRecords();
    console.log(`Logged ${records.length} metrics records.`);
    if (records.length !== 2) {
      throw new Error("Telemetry record length mismatch!");
    }

    const dashboardOutput = renderDashboard(records);
    console.log("Dashboard output:\n" + dashboardOutput);

    if (!dashboardOutput.includes("SHANAXON OPTIMIZATION LEDGER") || !dashboardOutput.includes("System Efficiency Rating")) {
      throw new Error("Telemetry dashboard formatting is incorrect!");
    }
    console.log("✓ Telemetry metrics logging and dashboard rendering checks passed.");

  } finally {
    // Cleanup temporary ledger file
    await fs.unlink(tempLedger).catch(() => {});
  }

  console.log("\n=== All Embedding & Telemetry Tests Passed! ===");
}

runTests().catch((err) => {
  console.error("❌ Test Suite Failed:");
  console.error(err);
  process.exit(1);
});
