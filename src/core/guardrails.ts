import * as path from 'path';
import { promises as fs } from 'fs';

/**
 * Normalizes a raw path string, resolving redundant segments and 
 * standardizing on system-native separators (slashes or backslashes).
 */
export function normalizePath(rawPath: string): string {
  if (!rawPath) return '';
  return path.normalize(rawPath);
}

/**
 * Validates a target path. Ensures:
 * 1. The target path resides within the base directory (preventing directory traversal outside the workspace).
 * 2. The path exists and has valid permissions (readable) using language-level fs abstractions.
 * 3. Does not spawn external processes.
 * 
 * @param targetPath Path to validate.
 * @param baseDir Base directory boundary (defaults to process.cwd() or current workspace root).
 */
export async function validatePath(targetPath: string, baseDir?: string): Promise<boolean> {
  try {
    const resolvedTarget = path.resolve(targetPath);
    const resolvedBase = path.resolve(baseDir || process.cwd());

    // 1. Directory Traversal Guardrail: Ensure target is nested inside base directory
    const relative = path.relative(resolvedBase, resolvedTarget);
    const isInside = relative && !relative.startsWith('..') && !path.isAbsolute(relative);
    
    // Also check if they are identical (e.g. if target is the base directory itself)
    const isSame = resolvedTarget === resolvedBase;

    if (!isInside && !isSame) {
      return false;
    }

    // 2. Local Permission / Existence Check using fs.promises.stat
    const stats = await fs.stat(resolvedTarget);
    
    // 3. Readability check using fs.promises.access
    await fs.access(resolvedTarget, fs.constants.R_OK);

    return true;
  } catch (error) {
    return false;
  }
}
