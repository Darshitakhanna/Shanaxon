import * as path from 'path';
import { promises as fs } from 'fs';
import { CodeCompressionEngine } from './parser';
import { WorkspaceIndexer } from './workspaceIndexer';
import { Tokenizer } from './tokenizer';

export interface BenchmarkStats {
  tier: string;
  totalFiles: number;
  rawChars: number;
  compressedChars: number;
  rawTokens: number;
  compressedTokens: number;
  savingsPct: number;
  totalTimeMs: number;
  avgLatencyMs: number;
}

/**
 * Real Codebase Benchmark Suite.
 * Benchmarks Shanaxon AST compression against actual workspace repository files.
 */
export async function runRealBenchmark(workspaceRoot: string): Promise<BenchmarkStats[]> {
  const engine = new CodeCompressionEngine();
  await engine.init();

  const indexer = new WorkspaceIndexer(workspaceRoot);
  const matchedFiles = await indexer.indexWorkspace('src');

  const fileContents: { filePath: string; code: string }[] = [];
  for (const file of matchedFiles) {
    try {
      const code = await fs.readFile(file, 'utf-8');
      fileContents.push({ filePath: file, code });
    } catch {}
  }

  const tiers: ('normal' | 'medium' | 'aggressive')[] = ['normal', 'medium', 'aggressive'];
  const results: BenchmarkStats[] = [];

  for (const tier of tiers) {
    const startTime = Date.now();
    let rawChars = 0;
    let compressedChars = 0;
    let rawTokens = 0;
    let compressedTokens = 0;

    for (const f of fileContents) {
      rawChars += f.code.length;
      rawTokens += Tokenizer.countTokens(f.code, f.filePath);

      const compressed = await engine.compress(f.code, f.filePath, tier);
      compressedChars += compressed.length;
      compressedTokens += Tokenizer.countTokens(compressed, f.filePath);
    }

    const totalTimeMs = Date.now() - startTime;
    const savingsPct = rawTokens > 0 ? ((rawTokens - compressedTokens) / rawTokens) * 100 : 0;

    results.push({
      tier,
      totalFiles: fileContents.length,
      rawChars,
      compressedChars,
      rawTokens,
      compressedTokens,
      savingsPct: Math.round(savingsPct * 100) / 100,
      totalTimeMs,
      avgLatencyMs: Math.round((totalTimeMs / (fileContents.length || 1)) * 100) / 100
    });
  }

  return results;
}

export async function runBenchmarkCli(workspaceRoot = process.cwd()): Promise<void> {
  console.log("===========================================================");
  console.log("SHANAXON REAL CODEBASE COMPRESSION BENCHMARK");
  console.log("===========================================================");
  
  console.log(`Repository Root: ${workspaceRoot}`);

  const results = await runRealBenchmark(workspaceRoot);

  for (const res of results) {
    console.log(`\nTier: ${res.tier.toUpperCase()}`);
    console.log(` - Total Files Processed: ${res.totalFiles}`);
    console.log(` - Raw Code Volume     : ${res.rawChars.toLocaleString()} chars (~${res.rawTokens.toLocaleString()} BPE tokens)`);
    console.log(` - Compressed Volume   : ${res.compressedChars.toLocaleString()} chars (~${res.compressedTokens.toLocaleString()} BPE tokens)`);
    console.log(` - Token Reduction     : ${res.savingsPct}% tokens saved`);
    console.log(` - Total Execution Time: ${res.totalTimeMs}ms (${res.avgLatencyMs}ms/file)`);

    const rawCost = (res.rawTokens / 1000000) * 3.00;
    const compressedCost = (res.compressedTokens / 1000000) * 3.00;
    const savedDollar = rawCost - compressedCost;
    console.log(` - Projected Cost (Claude Sonnet @ $3/1M): $${rawCost.toFixed(4)} → $${compressedCost.toFixed(4)} (Saved $${savedDollar.toFixed(4)}/call)`);
  }

  console.log("\n===========================================================");
  console.log("BENCHMARK COMPLETED SUCCESSFULLY!");
  console.log("===========================================================");
}

if (require.main === module) {
  runBenchmarkCli().catch(err => {
    console.error("Benchmark failed:", err);
    process.exit(1);
  });
}
