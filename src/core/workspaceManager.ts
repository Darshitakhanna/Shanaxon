import * as path from 'path';
import { isSensitiveFile, validatePath } from './guardrails';

/**
 * Manages multiple workspace roots in polyrepo or monorepo environments.
 * Validates path traversal guardrails across all registered workspaces.
 */
export class WorkspaceManager {
  private primaryRoot: string;
  private workspaces: string[] = [];

  constructor(primaryRoot: string, configuredWorkspaces: string[] = []) {
    this.primaryRoot = path.resolve(primaryRoot);
    this.workspaces = [
      this.primaryRoot,
      ...configuredWorkspaces.map((w) => path.resolve(this.primaryRoot, w)),
    ];
  }

  /**
   * Finds the matching workspace root directory for a given file path.
   * Falls back to primaryRoot if the path is outside configured workspaces.
   */
  findWorkspaceForFile(filePath: string): string {
    const absPath = path.resolve(this.primaryRoot, filePath);
    for (const root of this.workspaces) {
      const rel = path.relative(root, absPath);
      if (!rel.startsWith('..') && !path.isAbsolute(rel)) {
        return root;
      }
    }
    return this.primaryRoot;
  }

  /**
   * Validates if a file or directory resides strictly within one of the configured workspaces
   * and is not a sensitive/secret file.
   */
  async validateFileAccess(filePath: string): Promise<string | null> {
    const absPath = path.isAbsolute(filePath)
      ? path.resolve(filePath)
      : path.resolve(this.primaryRoot, filePath);

    if (isSensitiveFile(absPath)) {
      return null;
    }

    for (const root of this.workspaces) {
      const isValid = await validatePath(absPath, root);
      if (isValid) {
        return root;
      }
    }
    return null;
  }

  getWorkspaceRoots(): string[] {
    return this.workspaces;
  }
}
