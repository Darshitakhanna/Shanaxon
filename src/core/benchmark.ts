import * as path from 'path';
import { promises as fs } from 'fs';
import { WorkspaceIndexer } from './workspaceIndexer';
import { CodeCompressionEngine } from './parser';
import { estimateTokens } from './budgetManager';

async function runBenchmark() {
  const target = process.argv[2] || '.';
  const absoluteTarget = path.resolve(target);
  const workspaceRoot = process.cwd();

  console.log(`=== Dharohar-Context CLI Benchmark Tool ===`);
  console.log(`Target: ${absoluteTarget}`);

  const indexer = new WorkspaceIndexer(workspaceRoot);
  let files: string[] = [];
  try {
    files = await indexer.indexWorkspace(target);
  } catch (err: any) {
    console.error(`Error crawling workspace: ${err.message}`);
    process.exit(1);
  }

  if (files.length === 0) {
    console.log("No supported files found to index.");
    process.exit(0);
  }

  const engine = new CodeCompressionEngine();
  await engine.init();

  let totalRawTokens = 0;
  let totalCompTokens = 0;
  const startOverall = Date.now();

  console.log(`Processing ${files.length} files...`);

  for (const file of files) {
    try {
      const code = await fs.readFile(file, 'utf-8');
      const compressed = await engine.compress(code, file, 'aggressive');
      
      const rawTokens = estimateTokens(code);
      const compTokens = estimateTokens(compressed);

      totalRawTokens += rawTokens;
      totalCompTokens += compTokens;
    } catch (err: any) {
      console.error(`Error processing ${path.basename(file)}: ${err.message}`);
    }
  }

  const duration = Date.now() - startOverall;
  const saved = totalRawTokens - totalCompTokens;
  const pct = totalRawTokens > 0 ? ((saved / totalRawTokens) * 100).toFixed(1) : '0';
  const avgLatency = (duration / files.length).toFixed(1);

  console.log("\n==================================================");
  console.log("BENCHMARK REPORT SUMMARY");
  console.log("==================================================");
  console.log(`Total Files Indexed        : ${files.length}`);
  console.log(`Raw Cumulative Tokens      : ${totalRawTokens.toLocaleString()}`);
  console.log(`Compressed Output Tokens   : ${totalCompTokens.toLocaleString()}`);
  console.log(`Context Tokens Reclaimed   : ${saved.toLocaleString()} Saved`);
  console.log(`Overall Compression Ratio  : ${pct}% reduction`);
  console.log(`Total Duration             : ${duration}ms`);
  console.log(`Average Latency            : ${avgLatency}ms per file`);
  console.log("==================================================");
}

runBenchmark().catch((err) => {
  console.error("Benchmark failed:", err);
  process.exit(1);
});
