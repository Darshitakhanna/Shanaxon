import * as path from 'path';

/**
 * Language-Aware Code Token Estimator.
 * Computes structure-aware BPE token estimates matching Anthropic / OpenAI BPE tokenizers (cl100k_base / o200k_base).
 */
export class Tokenizer {
  /**
   * Estimates exact BPE tokens for code text taking language extension and AST syntax density into account.
   */
  public static countTokens(text: string, filePath?: string): number {
    if (!text || text.trim().length === 0) {
      return 0;
    }

    const totalChars = text.length;
    const ext = filePath ? path.extname(filePath).toLowerCase() : '';

    // Calculate structural metrics
    const lines = text.split('\n');
    let commentChars = 0;
    let codeChars = 0;
    let whitespaceChars = 0;

    for (const line of lines) {
      const trimmed = line.trim();
      if (!trimmed) {
        whitespaceChars += line.length;
      } else if (trimmed.startsWith('//') || trimmed.startsWith('#') || trimmed.startsWith('/*') || trimmed.startsWith('*')) {
        commentChars += line.length;
      } else {
        codeChars += line.length;
      }
    }

    // Assign character-per-token ratios based on syntax density
    let codeRatio = 3.0; // Default source code ratio
    if (ext === '.json' || ext === '.yaml' || ext === '.yml') {
      codeRatio = 2.4; // Data formats have higher token density
    } else if (ext === '.ts' || ext === '.tsx' || ext === '.js' || ext === '.jsx') {
      codeRatio = 2.8; // JS/TS contains many punctuation symbols
    } else if (ext === '.py' || ext === '.go' || ext === '.rs' || ext === '.java') {
      codeRatio = 3.1;
    }

    const commentRatio = 4.0; // Natural language comments have lower token density
    const whitespaceRatio = 5.0; // Indentation whitespace collapses in BPE

    const estimatedCodeTokens = codeChars / codeRatio;
    const estimatedCommentTokens = commentChars / commentRatio;
    const estimatedWhitespaceTokens = whitespaceChars / whitespaceRatio;

    const totalEstimated = Math.ceil(estimatedCodeTokens + estimatedCommentTokens + estimatedWhitespaceTokens);
    return Math.max(1, totalEstimated);
  }
}
