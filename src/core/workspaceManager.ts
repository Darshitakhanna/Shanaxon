import * as path from 'path';
import { validatePath } from './guardrails';

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
   */
  findWorkspaceForFile(filePath: string): string {
    const absPath = path.resolve(filePath);
    for (const root of this.workspaces) {
      const rel = path.relative(root, absPath);
      if (!rel.startsWith('..') && !path.isAbsolute(rel)) {
        return root;
      }
    }
    if (path.isAbsolute(absPath)) {
      return absPath;
    }
    return this.primaryRoot;
  }

  /**
   * Validates if a file resides within any of the configured workspaces or valid absolute paths.
   */
  async validateFileAccess(filePath: string): Promise<string | null> {
    const absPath = path.resolve(filePath);
    for (const root of this.workspaces) {
      const isValid = await validatePath(absPath, root);
      if (isValid) {
        return root;
      }
    }
    const isValidTarget = await validatePath(absPath, absPath);
    if (isValidTarget) {
      return absPath;
    }
    return null;
  }

  getWorkspaceRoots(): string[] {
    return this.workspaces;
  }
}
