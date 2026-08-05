import * as path from 'path';

export interface LanguageInfo {
  grammarName: string; // e.g. 'typescript', 'python'
  wasmFile: string;    // e.g. 'tree-sitter-typescript.wasm'
}

export const LANGUAGE_REGISTRY: Record<string, LanguageInfo> = {
  '.ts': { grammarName: 'typescript', wasmFile: 'tree-sitter-typescript.wasm' },
  '.tsx': { grammarName: 'tsx', wasmFile: 'tree-sitter-tsx.wasm' },
  '.js': { grammarName: 'javascript', wasmFile: 'tree-sitter-javascript.wasm' },
  '.jsx': { grammarName: 'javascript', wasmFile: 'tree-sitter-javascript.wasm' },
  '.py': { grammarName: 'python', wasmFile: 'tree-sitter-python.wasm' },
  '.go': { grammarName: 'go', wasmFile: 'tree-sitter-go.wasm' },
  '.rs': { grammarName: 'rust', wasmFile: 'tree-sitter-rust.wasm' },
  '.java': { grammarName: 'java', wasmFile: 'tree-sitter-java.wasm' },
  '.cs': { grammarName: 'c_sharp', wasmFile: 'tree-sitter-c_sharp.wasm' }
};

/**
 * Returns the language registry info based on file path extension.
 */
export function getLanguageInfoForFile(filePath: string): LanguageInfo | null {
  const ext = path.extname(filePath).toLowerCase();
  return LANGUAGE_REGISTRY[ext] || null;
}
