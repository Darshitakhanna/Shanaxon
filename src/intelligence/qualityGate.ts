import { CompressionTier, TaskProfile } from '../types';

export interface QualityGateResult {
  passed: boolean;
  score: number;          // 0.0 - 1.0
  retentionPct: number;   // 0.0 - 100.0
  warnings: string[];
  fallbackTier?: CompressionTier;
  reason: string;
  signals?: {
    symbolScore: number;
    dependencyScore: number;
    signatureScore: number;
    constraintCommentScore: number;
  };
}

const CODE_KEYWORDS = new Set([
  'function', 'return', 'const', 'let', 'var', 'import', 'export', 'class',
  'interface', 'type', 'async', 'await', 'from', 'default', 'public', 'private',
  'protected', 'extends', 'implements', 'static', 'readonly', 'false', 'true',
  'null', 'undefined', 'void', 'number', 'string', 'boolean', 'any', 'object',
  'if', 'else', 'for', 'while', 'switch', 'case', 'break', 'continue', 'try', 'catch', 'throw'
]);

/**
 * Extracts key technical identifiers (code symbols, camelCase, snake_case, uppercase constants) from text,
 * filtering out standard programming language reserved keywords.
 */
function extractIdentifiers(text: string): Set<string> {
  const matches = text.match(/[A-Za-z_][A-Za-z0-9_]{2,}/g) || [];
  const filtered = matches
    .map(m => m.toLowerCase())
    .filter(m => !CODE_KEYWORDS.has(m));
  return new Set(filtered);
}

/**
 * Extracts dependency import module names.
 */
function extractDependencies(text: string): Set<string> {
  const deps = new Set<string>();
  const importMatches = text.matchAll(/(?:from|require\()\s*['"]([^'"]+)['"]/g);
  for (const match of importMatches) {
    if (match[1]) deps.add(match[1].toLowerCase());
  }
  return deps;
}

/**
 * Extracts parameter names from function signatures.
 */
function extractSignatureParams(text: string): Set<string> {
  const params = new Set<string>();
  const sigMatches = text.matchAll(/(?:function\s+\w*|\w+)\s*\(([^)]*)\)/g);
  for (const match of sigMatches) {
    if (match[1]) {
      const args = match[1].split(',');
      for (const arg of args) {
        const clean = arg.trim().split(/[:=]/)[0].trim().replace(/^[...]/, '');
        if (clean && clean.length > 1 && !CODE_KEYWORDS.has(clean.toLowerCase())) {
          params.add(clean.toLowerCase());
        }
      }
    }
  }
  return params;
}

/**
 * Extracts constraint comment keywords.
 */
function extractConstraintComments(text: string): Set<string> {
  const constraints = new Set<string>();
  const commentLines = text.match(/\/\/[^\n]*|\/\*[\s\S]*?\*\//g) || [];
  for (const comment of commentLines) {
    if (/IMPORTANT|CRITICAL|DO NOT|MUST|WARNING|SECURITY/i.test(comment)) {
      const words = comment.match(/[A-Za-z_][A-Za-z0-9_]{2,}/g) || [];
      for (const w of words) {
        if (/IMPORTANT|CRITICAL|DO NOT|MUST|WARNING|SECURITY/i.test(w)) {
          constraints.add(w.toLowerCase());
        }
      }
    }
  }
  return constraints;
}

/**
 * Evaluates whether an optimization output meets multi-signal quality gate safety criteria.
 * Signals assessed: Symbol Retention (40%), Dependency Retention (25%), Signature Retention (25%), Constraint Comments (10%).
 */
export function evaluateQualityGate(
  originalContent: string,
  compressedContent: string,
  taskProfile: TaskProfile,
  requestedTier: CompressionTier = 'aggressive',
  minRetentionScore?: number
): QualityGateResult {
  const warnings: string[] = [];
  const threshold = minRetentionScore ?? taskProfile.minRetentionThreshold ?? 0.85;

  if (!originalContent || originalContent.trim().length === 0) {
    return {
      passed: true,
      score: 1.0,
      retentionPct: 100,
      warnings: [],
      reason: 'Empty original content, quality gate passed by default.'
    };
  }

  const origIdentifiers = extractIdentifiers(originalContent);
  const compIdentifiers = extractIdentifiers(compressedContent);

  // If content has no code identifiers (e.g. log output, non-code text), abstain from quality gate check
  if (origIdentifiers.size === 0) {
    return {
      passed: true,
      score: 1.0,
      retentionPct: 100,
      warnings: [],
      reason: 'Abstained: No technical identifiers found in source content (non-code document).'
    };
  }

  // 1. Symbol Score
  let retainedSymbols = 0;
  for (const id of origIdentifiers) {
    if (compIdentifiers.has(id)) retainedSymbols++;
  }
  const symbolScore = retainedSymbols / origIdentifiers.size;

  // 2. Dependency Score
  const origDeps = extractDependencies(originalContent);
  const compDeps = extractDependencies(compressedContent);
  let dependencyScore = 1.0;
  if (origDeps.size > 0) {
    let retainedDeps = 0;
    for (const d of origDeps) {
      if (compDeps.has(d) || compressedContent.toLowerCase().includes(d)) retainedDeps++;
    }
    dependencyScore = retainedDeps / origDeps.size;
  }

  // 3. Signature Score
  const origParams = extractSignatureParams(originalContent);
  let signatureScore = 1.0;
  if (origParams.size > 0) {
    let retainedParams = 0;
    for (const p of origParams) {
      if (compIdentifiers.has(p)) retainedParams++;
    }
    signatureScore = retainedParams / origParams.size;
  }

  // 4. Constraint Comment Score
  const origConstraints = extractConstraintComments(originalContent);
  let constraintCommentScore = 1.0;
  if (origConstraints.size > 0) {
    let retainedConstraints = 0;
    for (const c of origConstraints) {
      if (compressedContent.toLowerCase().includes(c)) retainedConstraints++;
    }
    constraintCommentScore = retainedConstraints / origConstraints.size;
  }

  // Composite Weighted Score
  const score = Number((
    0.40 * symbolScore +
    0.25 * dependencyScore +
    0.25 * signatureScore +
    0.10 * constraintCommentScore
  ).toFixed(4));

  const retentionPct = Number((score * 100).toFixed(1));

  // Determine fallback tier if failed
  let fallbackTier: CompressionTier | undefined = undefined;
  if (requestedTier === 'aggressive') {
    fallbackTier = 'medium';
  } else if (requestedTier === 'medium') {
    fallbackTier = 'normal';
  }

  const passed = score >= threshold;

  let reason = `Quality gate passed (Score: ${score}, Threshold: ${threshold}). Symbol retention: ${Math.round(symbolScore * 100)}%, Dependency retention: ${Math.round(dependencyScore * 100)}%, Signature retention: ${Math.round(signatureScore * 100)}%, Constraint comments: ${Math.round(constraintCommentScore * 100)}%.`;
  
  if (!passed) {
    reason = `Quality gate REJECTED optimization (Score: ${score} < ${threshold}). Symbol retention: ${Math.round(symbolScore * 100)}%, Dependency retention: ${Math.round(dependencyScore * 100)}%, Signature retention: ${Math.round(signatureScore * 100)}%, Constraint comments: ${Math.round(constraintCommentScore * 100)}%. Escalating tier to '${fallbackTier || 'normal'}'.`;
    warnings.push(reason);
  }

  return {
    passed,
    score,
    retentionPct,
    warnings,
    fallbackTier: passed ? undefined : fallbackTier,
    reason,
    signals: {
      symbolScore: Number(symbolScore.toFixed(4)),
      dependencyScore: Number(dependencyScore.toFixed(4)),
      signatureScore: Number(signatureScore.toFixed(4)),
      constraintCommentScore: Number(constraintCommentScore.toFixed(4))
    }
  };
}
