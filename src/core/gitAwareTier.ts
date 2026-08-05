import { exec } from 'child_process';
import * as path from 'path';

function runGitCommand(cmd: string, cwd: string): Promise<string> {
  return new Promise((resolve) => {
    exec(cmd, { cwd }, (err, stdout) => {
      if (err) {
        resolve('');
      } else {
        resolve(stdout.trim());
      }
    });
  });
}

/**
 * Dynamically resolves file tier based on modification history.
 * - Recently modified/uncommitted files get full detail (normal).
 * - Untouched files (> 30 days) get optimized detail (aggressive).
 */
export async function getGitAwareTier(
  filePath: string,
  workspaceRoot: string,
  defaultTier: 'normal' | 'medium' | 'aggressive'
): Promise<'normal' | 'medium' | 'aggressive'> {
  try {
    const absPath = path.resolve(filePath);
    const relPath = path.relative(workspaceRoot, absPath).replace(/\\/g, '/');

    // 1. Check if uncommitted, modified, or staged
    const statusOutput = await runGitCommand(`git status --porcelain "${relPath}"`, workspaceRoot);
    if (statusOutput.length > 0) {
      return 'normal';
    }

    // 2. Check if modified in last 24 hours
    const last24hLog = await runGitCommand(`git log --since="24 hours ago" --name-only --format=format: -- "${relPath}"`, workspaceRoot);
    if (last24hLog.length > 0) {
      return 'normal';
    }

    // 3. Check if modified in last 30 days
    const last30dLog = await runGitCommand(`git log --since="30 days ago" --name-only --format=format: -- "${relPath}"`, workspaceRoot);
    if (last30dLog.length === 0) {
      // Confirm file is tracked to avoid categorizing new files as aggressive
      const isTracked = await runGitCommand(`git ls-files "${relPath}"`, workspaceRoot);
      if (isTracked.length > 0) {
        return 'aggressive';
      }
    }
  } catch {
    // Fail silently using fallback
  }

  return defaultTier;
}
