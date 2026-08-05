import * as path from 'path';
import { promises as fs } from 'fs';
import ignore from 'ignore';
import { validatePath } from './guardrails';
import { getLanguageInfoForFile } from './languageRegistry';

export class WorkspaceIndexer {
  private workspaceRoot: string;
  private maxDepth: number;
  private maxFiles: number;

  constructor(workspaceRoot: string, maxDepth = 8, maxFiles = 5000) {
    this.workspaceRoot = path.resolve(workspaceRoot);
    this.maxDepth = maxDepth;
    this.maxFiles = maxFiles;
  }

  /**
   * Crawls the workspace concurrently, respects gitignore and tokenistignore patterns,
   * enforces depth and max file caps to prevent heap OOM crashes in giant monorepos.
   */
  async indexWorkspace(targetDir: string): Promise<string[]> {
    const absoluteTarget = path.isAbsolute(targetDir)
      ? path.resolve(targetDir)
      : path.resolve(this.workspaceRoot, targetDir);

    const isValid = await validatePath(absoluteTarget, absoluteTarget);
    if (!isValid) {
      throw new Error(`Access Denied: target directory "${targetDir}" is outside the workspace.`);
    }

    const effectiveRoot = absoluteTarget;

    // Initialize gitignore parser
    const ig = ignore();

    ig.add([
      'node_modules',
      '.git',
      'dist',
      'build',
      '.gemini',
      'telemetry_ledger.json'
    ]);

    const gitignorePath = path.join(effectiveRoot, '.gitignore');
    try {
      const gitignoreContent = await fs.readFile(gitignorePath, 'utf-8');
      ig.add(gitignoreContent);
    } catch {}

    for (const ignoreFileName of ['.tokenistignore', '.dharoharignore']) {
      const ignoreFilePath = path.join(effectiveRoot, ignoreFileName);
      try {
        const ignoreContent = await fs.readFile(ignoreFilePath, 'utf-8');
        ig.add(ignoreContent);
      } catch {}
    }

    const matchedFiles: string[] = [];

    const walk = async (currentDir: string, currentDepth: number) => {
      if (currentDepth > this.maxDepth || matchedFiles.length >= this.maxFiles) {
        return;
      }

      let entries;
      try {
        entries = await fs.readdir(currentDir, { withFileTypes: true });
      } catch {
        return;
      }

      const tasks = entries.map(async (entry) => {
        if (matchedFiles.length >= this.maxFiles) return;

        const fullPath = path.join(currentDir, entry.name);
        const relativeToRoot = path.relative(effectiveRoot, fullPath);
        const normalizedRelPath = relativeToRoot.replace(/\\/g, '/');
        const checkPath = entry.isDirectory() ? `${normalizedRelPath}/` : normalizedRelPath;

        if (ig.ignores(checkPath)) {
          return;
        }

        if (entry.isDirectory()) {
          await walk(fullPath, currentDepth + 1);
        } else if (entry.isFile()) {
          const langInfo = getLanguageInfoForFile(fullPath);
          if (langInfo && matchedFiles.length < this.maxFiles) {
            matchedFiles.push(fullPath);
          }
        }
      });

      await Promise.all(tasks);
    };

    await walk(absoluteTarget, 0);

    matchedFiles.sort((a, b) => a.localeCompare(b));
    return matchedFiles;
  }
}
