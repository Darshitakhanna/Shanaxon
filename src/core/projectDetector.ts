import * as path from 'path';
import { promises as fs } from 'fs';

export interface ProjectInfo {
  projectType: string;
  excludePatterns: string[];
  alwaysInclude: string[];
}

/**
 * Automatically detects the workspace project type (NodeJS, Go, Rust, Python, Generic)
 * and returns recommended exclude and alwaysInclude paths.
 */
export async function detectProject(workspaceRoot: string): Promise<ProjectInfo> {
  const info: ProjectInfo = {
    projectType: 'generic',
    excludePatterns: ['**/node_modules/**', '**/.git/**'],
    alwaysInclude: []
  };

  const hasFile = async (fileName: string) => {
    return fs.stat(path.join(workspaceRoot, fileName)).then(s => s.isFile()).catch(() => false);
  };

  if (await hasFile('package.json')) {
    info.projectType = 'nodejs';
    info.excludePatterns = [
      '**/node_modules/**',
      '**/dist/**',
      '**/build/**',
      '**/.next/**',
      '**/.nuxt/**',
      '**/*.test.ts',
      '**/*.spec.ts',
      '**/*.stories.tsx'
    ];
  } else if (await hasFile('go.mod')) {
    info.projectType = 'go';
    info.excludePatterns = [
      '**/vendor/**',
      '**/*_test.go'
    ];
  } else if (await hasFile('Cargo.toml')) {
    info.projectType = 'rust';
    info.excludePatterns = [
      '**/target/**',
      '**/*.rs.bk'
    ];
  } else if (
    await hasFile('pyproject.toml') ||
    await hasFile('requirements.txt') ||
    await hasFile('setup.py')
  ) {
    info.projectType = 'python';
    info.excludePatterns = [
      '**/__pycache__/**',
      '**/.venv/**',
      '**/venv/**',
      '**/*.pyc',
      '**/.ipynb_checkpoints/**'
    ];
  }

  return info;
}
