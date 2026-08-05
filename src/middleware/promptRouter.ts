import * as path from 'path';

export interface FileData {
  filePath: string; // E.g., 'src/core/guardrails.ts'
  signatures: string; // The AST compressed signatures
  rawCode: string; // The actual full raw code
}

export interface RouteResult {
  filePath: string;
  content: string;
  swapped: boolean; // True if raw code was swapped in
  isDependency?: boolean; // True if it is a 1-hop dependency signature
}

/**
 * Dynamic Data Swapping Matrix
 * Intercepts query and decides which files should expose full raw code versus compressed signatures.
 * Automatically resolves and tags 1-hop dependency signatures when a target is selected for edits.
 * 
 * @param query The user's query/prompt instructions.
 * @param files Collection of files in context with their signatures and raw content.
 * @param getDependencies Optional helper to fetch dependency paths of a given file path.
 */
export function routePrompt(
  query: string,
  files: FileData[],
  getDependencies?: (filePath: string) => string[]
): RouteResult[] {
  const lowercaseQuery = query.toLowerCase();
  
  // Action keywords suggesting write/update intents
  const actionKeywords = ['edit', 'write', 'update', 'modify', 'change', 'patch', 'replace', 'fix', 'implement'];
  
  const hasUpdateIntent = actionKeywords.some((keyword) => lowercaseQuery.includes(keyword));

  // Determine targeted files by checking if the query references the file name/path
  const targetFiles = new Set<string>();
  const dependencyFiles = new Set<string>();

  if (hasUpdateIntent) {
    for (const file of files) {
      const baseName = path.basename(file.filePath).toLowerCase();
      const relativePath = file.filePath.toLowerCase();
      
      // Check if user query mentions either the relative path or the base name of the file
      if (lowercaseQuery.includes(relativePath) || lowercaseQuery.includes(baseName)) {
        targetFiles.add(file.filePath);

        // Fetch dependencies if helper is provided
        if (getDependencies) {
          const deps = getDependencies(file.filePath);
          for (const dep of deps) {
            if (path.resolve(dep) !== path.resolve(file.filePath)) {
              dependencyFiles.add(path.resolve(dep));
            }
          }
        }
      }
    }
  }

  // Map each file to its output content
  return files.map((file) => {
    const isTarget = targetFiles.has(file.filePath);
    
    // Check if the current file resolves to any path in the dependencyFiles set
    const isDependency = !isTarget && Array.from(dependencyFiles).some(dep => 
      path.resolve(dep) === path.resolve(file.filePath)
    );

    return {
      filePath: file.filePath,
      content: isTarget ? file.rawCode : file.signatures,
      swapped: isTarget,
      isDependency: isDependency
    };
  });
}
