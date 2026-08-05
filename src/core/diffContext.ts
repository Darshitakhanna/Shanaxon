import { execFile } from 'child_process';
import * as path from 'path';
import * as fs from 'fs';

/**
 * Returns only the changed git hunks of a file (with configurable context lines)
 * rather than sending the full file. Safe against missing git CLI binaries & non-git directories.
 */
export function getFileDiffContext(
  filePath: string,
  workspaceRoot: string,
  contextLines = 10
): Promise<string> {
  return new Promise((resolve) => {
    const absPath = path.resolve(filePath);
    const relPath = path.relative(workspaceRoot, absPath).replace(/\\/g, '/');

    const gitDir = path.join(workspaceRoot, '.git');
    if (!fs.existsSync(gitDir)) {
      resolve(`[Tokenist Diff Mode] Git repository uninitialized in workspace.`);
      return;
    }

    const safeContextLines = Math.max(0, Math.floor(Number(contextLines) || 10));
    const args = ['diff', `-U${safeContextLines}`, '--', relPath];

    execFile('git', args, { cwd: workspaceRoot }, (err, stdout) => {
      if (err) {
        if ((err as any).code === 'ENOENT') {
          resolve(`[Tokenist Diff Mode] Git executable not found on system PATH.`);
        } else {
          resolve(`[Tokenist Diff Mode] No uncommitted changes detected for: ${relPath}`);
        }
      } else if (!stdout || !stdout.trim()) {
        resolve(`[Tokenist Diff Mode] No uncommitted changes detected for: ${relPath}`);
      } else {
        resolve(stdout.trim());
      }
    });
  });
}
