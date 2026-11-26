import { FailureMitigationAction, FailurePattern } from '../types';

export interface HistoryTurn {
  role?: string;
  prompt: string;
  response?: string;
}

const MISSING_DEP_PATTERNS = [
  // Node / JS / TS
  /Cannot find module/i,
  /MODULE_NOT_FOUND/i,
  /ERR_MODULE_NOT_FOUND/i,
  /ReferenceError:\s*\w+\s*is not defined/i,
  /TypeError:\s*.*is not a function/i,
  // Python
  /ImportError:/i,
  /ModuleNotFoundError:/i,
  /NameError:\s*name\s*['"]\w+['"]\s*is not defined/i,
  /AttributeError:\s*module\s*['"]\w+['"]\s*has no attribute/i,
  // Rust
  /cannot find (?:function|value|struct|type|macro|value|module)\s*`[^`]+`\s*in this scope/i,
  /unresolved import/i,
  // Go
  /undefined:\s*\w+/i,
  /could not import/i,
  /package\s+[\w/.-]+\s+is not in GOROOT/i,
  // Java / C / C++
  /cannot find symbol/i,
  /undefined reference to/i,
  /UnsatisfiedLinkError/i
];

/**
 * Detects agent failure patterns (repetitive retries, context exhaustion, missing dependency hallucination, conflicting constraints)
 * across Node.js, Python, Rust, Go, Java, and C++ runtimes and returns actionable mitigation steps.
 */
export function detectAgentFailure(history: HistoryTurn[]): FailureMitigationAction[] {
  const actions: FailureMitigationAction[] = [];
  if (!history || history.length < 2) return actions;

  // 1. Check Repetitive Retry Pattern
  const recentPrompts = history.slice(-4).map(h => h.prompt.trim().toLowerCase());
  let retryCount = 0;
  for (let i = 1; i < recentPrompts.length; i++) {
    if (recentPrompts[i] === recentPrompts[i - 1] || recentPrompts[i].includes(recentPrompts[i - 1])) {
      retryCount++;
    }
  }

  if (retryCount >= 2) {
    actions.push({
      pattern: 'repetitive_retry',
      detectedCount: retryCount,
      mitigationApplied: 'Enforced prompt variance and auto-recalled critical memory constraints.',
      recommendedAction: 'Rephrase request or fetch active file diff context before retrying.'
    });
  }

  // 2. Check Context Exhaustion Pattern
  const totalLength = history.reduce((acc, h) => acc + (h.prompt.length + (h.response?.length || 0)), 0);
  if (totalLength > 150000) {
    actions.push({
      pattern: 'context_exhaustion',
      detectedCount: Math.floor(totalLength / 50000),
      mitigationApplied: 'Applied aggressive pruning to past turns.',
      recommendedAction: 'Use prune_chat_history tool to clear stale turns.'
    });
  }

  // 3. Check Multi-Runtime Missing Dependency Hallucination
  const lastTurn = history[history.length - 1];
  if (lastTurn.response) {
    const matched = MISSING_DEP_PATTERNS.some(pattern => pattern.test(lastTurn.response || ''));
    if (matched) {
      actions.push({
        pattern: 'missing_dependency_hallucination',
        detectedCount: 1,
        mitigationApplied: 'Identified missing module / symbol error in last response.',
        recommendedAction: 'Use get_blast_radius or read_optimized_file to inspect dependency definition.'
      });
    }
  }

  // 4. Check Conflicting Constraints
  const allPromptsText = history.map(h => h.prompt).join(' ');
  if (
    (/must not modify|do not change|never edit/i.test(allPromptsText)) &&
    (/please update|refactor|modify|change/i.test(allPromptsText))
  ) {
    actions.push({
      pattern: 'conflicting_constraints',
      detectedCount: 1,
      mitigationApplied: 'Flagged potential directive contradiction in prompt history.',
      recommendedAction: 'Clarify immutable boundaries vs requested edits.'
    });
  }

  return actions;
}
