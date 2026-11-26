import * as path from 'path';
import { promises as fs } from 'fs';

const SENSITIVE_EXACT_NAMES = new Set([
  '.env',
  'id_rsa',
  'id_ed25519',
]);

const SENSITIVE_EXTENSIONS = new Set([
  '.pem',
  '.key',
  '.p12',
  '.pfx',
]);

/**
 * Normalizes a raw path string, resolving redundant segments and
 * standardizing on system-native separators (slashes or backslashes).
 */
export function normalizePath(rawPath: string): string {
  if (!rawPath) return '';
  return path.normalize(rawPath);
}

/**
 * Checks whether a path targets a sensitive file or credential artifact
 * (.env, .env.*, *.pem, *.key, *.p12, *.pfx, id_rsa, id_ed25519, *secret*, *credential*).
 */
export function isSensitiveFile(targetPath: string): boolean {
  if (!targetPath) return false;
  const normalized = targetPath.replace(/\\/g, '/');
  const segments = normalized.split('/').filter(Boolean);
  const baseName = path.basename(normalized).toLowerCase();

  if (
    SENSITIVE_EXACT_NAMES.has(baseName) ||
    baseName.startsWith('.env.') ||
    baseName.startsWith('id_rsa.') ||
    baseName.startsWith('id_ed25519.')
  ) {
    return true;
  }

  const ext = path.extname(baseName);
  if (SENSITIVE_EXTENSIONS.has(ext)) {
    return true;
  }

  for (const seg of segments) {
    const lower = seg.toLowerCase();
    if (lower.includes('secret') || lower.includes('credential')) {
      return true;
    }
  }

  return false;
}

function isContainedInBase(resolvedBase: string, resolvedTarget: string): boolean {
  const relative = path.relative(resolvedBase, resolvedTarget);
  // Empty string means identical paths (valid directory match)
  return !relative.startsWith('..') && !path.isAbsolute(relative);
}

/**
 * Validates a target path. Ensures:
 * 1. The target path is not a sensitive/secret file.
 * 2. The target path resides within the base directory (lexical + symlink realpath containment).
 * 3. The path exists and is readable using language-level fs abstractions.
 *
 * @param targetPath Path to validate.
 * @param baseDir Base directory boundary (defaults to process.cwd() or current workspace root).
 */
export async function validatePath(targetPath: string, baseDir?: string): Promise<boolean> {
  try {
    const resolvedTarget = path.resolve(targetPath);
    const resolvedBase = path.resolve(baseDir || process.cwd());

    if (isSensitiveFile(resolvedTarget)) {
      return false;
    }

    // 1. Lexical Directory Traversal Guardrail
    if (!isContainedInBase(resolvedBase, resolvedTarget)) {
      return false;
    }

    // 2. Local Permission / Existence Check using fs.promises.stat & access
    await fs.stat(resolvedTarget);
    await fs.access(resolvedTarget, fs.constants.R_OK);

    // 3. Symlink Containment Check via fs.realpath
    const realBase = await fs.realpath(resolvedBase);
    const realTarget = await fs.realpath(resolvedTarget);
    if (!isContainedInBase(realBase, realTarget)) {
      return false;
    }

    return true;
  } catch {
    return false;
  }
}
