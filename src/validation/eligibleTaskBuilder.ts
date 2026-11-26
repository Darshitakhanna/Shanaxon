import * as fs from 'fs';
import * as path from 'path';
import { Tokenizer } from '../core/tokenizer';

export interface EligibleTask {
  id: string;
  title: string;
  prompt: string;
  context: string;
  estimatedInputTokens: number;
  workloadCategory: 'code_large' | 'code_medium' | 'multi_file' | 'dense_architecture';
  groundTruthKeywords: string[];
  filePaths: string[];
}

export class EligibleTaskBuilder {
  private workspaceRoot: string;

  constructor(workspaceRoot: string) {
    this.workspaceRoot = workspaceRoot;
  }

  public buildEligibleTasks(targetCount: number = 50): EligibleTask[] {
    const srcDir = path.resolve(this.workspaceRoot, 'src');
    const sourceFiles = this.getTsFiles(srcDir);
    const tasks: EligibleTask[] = [];

    let idCounter = 1;

    // 1. Single-file tasks for large source files (e.g. server.ts, benchmarkRunner.ts, etc.)
    for (const file of sourceFiles) {
      if (tasks.length >= targetCount) break;

      const content = fs.readFileSync(file, 'utf-8');
      const tokens = Tokenizer.countTokens(content, file);

      // Require tokens >= 500 so preflight (floor 150) never rejects it
      if (tokens < 500) continue;

      const relPath = path.relative(this.workspaceRoot, file);
      const fileName = path.basename(file);
      const keywords = this.extractGroundTruthKeywords(content);

      const category: EligibleTask['workloadCategory'] =
        tokens > 2000 ? 'code_large' : 'code_medium';

      tasks.push({
        id: `ELIGIBLE_TASK_${String(idCounter++).padStart(3, '0')}`,
        title: `Single File: ${fileName}`,
        prompt: `Analyze ${fileName}. Identify all exported interfaces, classes, and primary functions.`,
        context: content,
        estimatedInputTokens: tokens,
        workloadCategory: category,
        groundTruthKeywords: keywords,
        filePaths: [relPath],
      });
    }

    // 2. Multi-file combined tasks (concatenate related source files to form multi-file contexts)
    const fileGroups = this.createMultiFileGroups(sourceFiles);
    for (const group of fileGroups) {
      if (tasks.length >= targetCount) break;

      let combinedContext = '';
      const keywordsSet = new Set<string>();
      const relPaths: string[] = [];

      for (const file of group) {
        const content = fs.readFileSync(file, 'utf-8');
        const rel = path.relative(this.workspaceRoot, file);
        combinedContext += `// ===== FILE: ${rel} =====\n${content}\n\n`;
        relPaths.push(rel);
        this.extractGroundTruthKeywords(content).forEach(k => keywordsSet.add(k));
      }

      const totalTokens = Tokenizer.countTokens(combinedContext, 'multi.ts');
      if (totalTokens < 500) continue;

      const groupName = group.map(f => path.basename(f, '.ts')).join(' + ');

      tasks.push({
        id: `ELIGIBLE_TASK_${String(idCounter++).padStart(3, '0')}`,
        title: `Multi-File Context: ${groupName}`,
        prompt: `Refactor module interaction across ${group.length} files. Ensure types and methods align.`,
        context: combinedContext,
        estimatedInputTokens: totalTokens,
        workloadCategory: 'multi_file',
        groundTruthKeywords: Array.from(keywordsSet).slice(0, 8),
        filePaths: relPaths,
      });
    }

    // 3. Dense architecture tasks (if we still need more tasks to reach targetCount)
    let fillIndex = 0;
    while (tasks.length < targetCount && sourceFiles.length > 0) {
      const file1 = sourceFiles[fillIndex % sourceFiles.length];
      const file2 = sourceFiles[(fillIndex + 1) % sourceFiles.length];
      const content1 = fs.readFileSync(file1, 'utf-8');
      const content2 = fs.readFileSync(file2, 'utf-8');

      const combined = `// ARCHITECTURE SPEC & CODE\n${content1}\n\n// IMPLEMENTATION FILE\n${content2}`;
      const tokens = Tokenizer.countTokens(combined, 'dense.ts');

      const keywords = Array.from(
        new Set([
          ...this.extractGroundTruthKeywords(content1),
          ...this.extractGroundTruthKeywords(content2),
        ])
      ).slice(0, 8);

      tasks.push({
        id: `ELIGIBLE_TASK_${String(idCounter++).padStart(3, '0')}`,
        title: `Architecture Review ${fillIndex + 1}: ${path.basename(file1)} & ${path.basename(file2)}`,
        prompt: `Review architectural alignment between ${path.basename(file1)} and ${path.basename(file2)}.`,
        context: combined,
        estimatedInputTokens: tokens,
        workloadCategory: 'dense_architecture',
        groundTruthKeywords: keywords,
        filePaths: [path.relative(this.workspaceRoot, file1), path.relative(this.workspaceRoot, file2)],
      });

      fillIndex++;
    }

    return tasks.slice(0, targetCount);
  }

  private getTsFiles(dir: string): string[] {
    const results: string[] = [];
    if (!fs.existsSync(dir)) return results;

    const entries = fs.readdirSync(dir, { withFileTypes: true });
    for (const entry of entries) {
      const full = path.join(dir, entry.name);
      if (entry.isDirectory()) {
        results.push(...this.getTsFiles(full));
      } else if (entry.isFile() && (entry.name.endsWith('.ts') || entry.name.endsWith('.tsx'))) {
        results.push(full);
      }
    }
    return results;
  }

  private createMultiFileGroups(files: string[]): string[][] {
    const groups: string[][] = [];
    for (let i = 0; i < files.length - 1; i += 2) {
      groups.push([files[i], files[i + 1]]);
    }
    return groups;
  }

  private extractGroundTruthKeywords(code: string): string[] {
    const keywords: string[] = [];
    const exportMatches = code.match(/export\s+(interface|class|function|type|const|enum)\s+([A-Za-z0-9_]+)/g);

    if (exportMatches) {
      for (const m of exportMatches) {
        const parts = m.split(/\s+/);
        const name = parts[parts.length - 1];
        if (name && name.length > 2 && !keywords.includes(name)) {
          keywords.push(name);
        }
      }
    }

    if (keywords.length === 0) {
      const fnMatches = code.match(/function\s+([A-Za-z0-9_]+)/g);
      if (fnMatches) {
        for (const f of fnMatches) {
          const name = f.replace('function', '').trim();
          if (name && !keywords.includes(name)) keywords.push(name);
        }
      }
    }

    return keywords.slice(0, 8);
  }
}
