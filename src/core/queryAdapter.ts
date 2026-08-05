import * as path from 'path';

export interface QueryAdaptiveResult {
  extractedSymbols: string[];
  pinnedFiles: string[];
}

/**
 * Extracts key symbols and file paths mentioned in an active user prompt query
 * and resolves corresponding workspace files to temporarily pin at full fidelity ('normal' tier).
 */
export class QueryAdapter {
  /**
   * Tokenizes user prompt, identifies symbols/filenames, and resolves matching workspace files.
   */
  public resolveQueryAdaptivePins(
    activePrompt: string,
    workspaceFiles: string[]
  ): QueryAdaptiveResult {
    if (!activePrompt || !activePrompt.trim()) {
      return { extractedSymbols: [], pinnedFiles: [] };
    }

    // 1. Extract potential code symbols (words, camelCase, snake_case, identifiers, file basenames)
    const rawTokens = activePrompt.match(/[a-zA-Z_0-9./\\]+/g) || [];
    const extractedSymbols = new Set<string>();

    for (const token of rawTokens) {
      if (token.length >= 3) {
        extractedSymbols.add(token.toLowerCase());
        // Handle camelCase splitting (e.g. authService -> auth, service)
        const camelParts = token.replace(/([a-z])([A-Z])/g, '$1 $2').split(' ');
        if (camelParts.length > 1) {
          camelParts.forEach(p => p.length >= 3 && extractedSymbols.add(p.toLowerCase()));
        }
      }
    }

    // 2. Match symbols against workspace files
    const pinnedFilesSet = new Set<string>();

    for (const file of workspaceFiles) {
      const absPath = path.resolve(file);
      const baseName = path.basename(absPath).toLowerCase();
      const baseNameNoExt = path.basename(absPath, path.extname(absPath)).toLowerCase();
      const relPath = file.toLowerCase().replace(/\\/g, '/');

      // Check if any extracted symbol matches file basename or path segment
      for (const symbol of extractedSymbols) {
        if (
          baseName === symbol ||
          baseNameNoExt === symbol ||
          relPath.includes(symbol)
        ) {
          pinnedFilesSet.add(absPath);
          break;
        }
      }
    }

    return {
      extractedSymbols: Array.from(extractedSymbols),
      pinnedFiles: Array.from(pinnedFilesSet)
    };
  }
}
