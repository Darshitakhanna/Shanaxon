import * as fs from 'fs';
import * as path from 'path';
import { Tokenizer } from '../core/tokenizer';

export interface TokenCalibrationResult {
  sampledFilesCount: number;
  totalCharacters: number;
  heuristicTotalTokens: number;
  tokenizerTotalTokens: number;
  heuristicMeanErrorPct: number;
  tokenizerMeanErrorPct: number;
  recommendedCounter: 'tokenizer' | 'heuristic';
  correctionFactor: number;
  samples: Array<{
    filePath: string;
    chars: number;
    heuristicTokens: number;
    tokenizerTokens: number;
    variancePct: number;
  }>;
}

/**
 * Validates token count accuracy across source code files and prose documentation,
 * comparing generic character division (`chars / 3.8`) against structure-aware BPE counting.
 */
export async function runTokenAccuracyValidation(workspaceRoot: string): Promise<TokenCalibrationResult> {
  const sampleDir = path.resolve(workspaceRoot, 'src');
  const files: string[] = [];

  function scan(dir: string) {
    if (!fs.existsSync(dir)) return;
    const entries = fs.readdirSync(dir, { withFileTypes: true });
    for (const entry of entries) {
      const fullPath = path.join(dir, entry.name);
      if (entry.isDirectory()) {
        scan(fullPath);
      } else if (entry.isFile() && (entry.name.endsWith('.ts') || entry.name.endsWith('.tsx') || entry.name.endsWith('.json') || entry.name.endsWith('.md'))) {
        files.push(fullPath);
      }
    }
  }

  scan(sampleDir);
  // Also include README if it exists
  const readmePath = path.resolve(workspaceRoot, 'README.md');
  if (fs.existsSync(readmePath)) {
    files.push(readmePath);
  }

  let totalChars = 0;
  let heuristicTotal = 0;
  let tokenizerTotal = 0;
  const samples: TokenCalibrationResult['samples'] = [];

  for (const file of files) {
    try {
      const text = fs.readFileSync(file, 'utf-8');
      if (!text || text.trim().length === 0) continue;

      const chars = text.length;
      totalChars += chars;

      const heuristicTokens = Math.ceil(chars / 3.8);
      const tokenizerTokens = Tokenizer.countTokens(text, file);

      heuristicTotal += heuristicTokens;
      tokenizerTotal += tokenizerTokens;

      const diff = Math.abs(heuristicTokens - tokenizerTokens);
      const variancePct = tokenizerTokens > 0 ? parseFloat(((diff / tokenizerTokens) * 100).toFixed(2)) : 0;

      samples.push({
        filePath: path.relative(workspaceRoot, file).replace(/\\/g, '/'),
        chars,
        heuristicTokens,
        tokenizerTokens,
        variancePct,
      });
    } catch {}
  }

  const correctionFactor = tokenizerTotal > 0 ? parseFloat((totalChars / tokenizerTotal).toFixed(2)) : 3.8;
  const meanVariance = samples.length > 0
    ? parseFloat((samples.reduce((acc, s) => acc + s.variancePct, 0) / samples.length).toFixed(2))
    : 0;

  return {
    sampledFilesCount: samples.length,
    totalCharacters: totalChars,
    heuristicTotalTokens: heuristicTotal,
    tokenizerTotalTokens: tokenizerTotal,
    heuristicMeanErrorPct: meanVariance,
    tokenizerMeanErrorPct: 0, // Tokenizer is our reference baseline
    recommendedCounter: 'tokenizer',
    correctionFactor,
    samples,
  };
}
