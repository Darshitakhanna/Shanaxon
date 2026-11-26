import { TaskProfile, TaskType } from '../types';

interface TaskPatternRule {
  taskType: TaskType;
  keywords: RegExp[];
  complexityScore: number;
  recommendedBudgetMultiplier: number;
  minRetentionThreshold: number;
  description: string;
}

const TASK_RULES: TaskPatternRule[] = [
  {
    taskType: 'architecture_design',
    keywords: [
      /\barchitecture\b/i,
      /\bdesign\s+system\b/i,
      /\bcomponent\s+structure\b/i,
      /\bsystem\s+design\b/i,
      /\bhigh[- ]level\b/i,
      /\bschema\s+design\b/i,
      /\bmodule\s+boundary\b/i,
      /\bhandoff\b/i,
      /\bhandbook\b/i,
      /\bblueprint\b/i,
      /\barchitectural\b/i
    ],
    complexityScore: 0.9,
    recommendedBudgetMultiplier: 1.5,
    minRetentionThreshold: 0.95,
    description: 'High-level architectural design or system structuring request.'
  },
  {
    taskType: 'bug_investigation',
    keywords: [
      /\bbug\b/i,
      /\bfix\b/i,
      /\berror\b/i,
      /\bexception\b/i,
      /\bcrash\b/i,
      /\bfailing\b/i,
      /\bstack\s*trace\b/i,
      /\bdebug\b/i,
      /\broot\s+cause\b/i,
      /\binvestigate\b/i,
      /\bbroken\b/i,
      /\bregressed\b/i,
      /\bregression\b/i
    ],
    complexityScore: 0.8,
    recommendedBudgetMultiplier: 1.3,
    minRetentionThreshold: 0.90,
    description: 'Debugging, failure diagnosis, or error resolution request.'
  },
  {
    taskType: 'refactoring',
    keywords: [
      /\brefactor\b/i,
      /\bclean\s*up\b/i,
      /\brestructure\b/i,
      /\bdecouple\b/i,
      /\bextract\s+function\b/i,
      /\boptimize\s+code\b/i,
      /\brename\b/i,
      /\bsimplify\b/i,
      /\bmodularize\b/i
    ],
    complexityScore: 0.7,
    recommendedBudgetMultiplier: 1.1,
    minRetentionThreshold: 0.85,
    description: 'Code quality enhancement, restructuring, or decoupling.'
  },
  {
    taskType: 'new_feature',
    keywords: [
      /\badd\s+feature\b/i,
      /\bimplement\b/i,
      /\bcreate\s+new\b/i,
      /\bbuild\b/i,
      /\badd\s+support\b/i,
      /\bextend\b/i,
      /\bnew\s+endpoint\b/i,
      /\bnew\s+tool\b/i,
      /\badd\s+new\b/i,
      /\bfeature\b/i
    ],
    complexityScore: 0.75,
    recommendedBudgetMultiplier: 1.2,
    minRetentionThreshold: 0.85,
    description: 'New feature implementation or capability extension.'
  },
  {
    taskType: 'one_off_query',
    keywords: [
      /\bexplain\b/i,
      /\bwhat\s+is\b/i,
      /\bhow\s+does\b/i,
      /\bwhere\s+is\b/i,
      /\bcount\b/i,
      /\blist\s+all\b/i,
      /\bshow\s+me\b/i,
      /\bfind\b/i,
      /\bsearch\s+for\b/i
    ],
    complexityScore: 0.3,
    recommendedBudgetMultiplier: 0.7,
    minRetentionThreshold: 0.70,
    description: 'Information retrieval, query, or explanation request.'
  }
];

/**
 * Classifies a user prompt into a structured TaskProfile using deterministic keyword matching.
 * Requires zero LLM calls, operates in under 1 millisecond.
 */
export function classifyTask(userPrompt: string): TaskProfile {
  if (!userPrompt || userPrompt.trim().length === 0) {
    return {
      taskType: 'unknown',
      complexityScore: 0.5,
      confidence: 0.5,
      detectedKeywords: [],
      recommendedBudgetMultiplier: 1.0,
      minRetentionThreshold: 0.85,
      reasoning: 'Empty prompt provided, using default fallback profile.'
    };
  }

  const matches: Array<{ rule: TaskPatternRule; matchedKeywords: string[]; count: number }> = [];

  for (const rule of TASK_RULES) {
    const matchedKeywords: string[] = [];
    for (const regex of rule.keywords) {
      const match = userPrompt.match(regex);
      if (match) {
        matchedKeywords.push(match[0].toLowerCase());
      }
    }
    if (matchedKeywords.length > 0) {
      matches.push({
        rule,
        matchedKeywords,
        count: matchedKeywords.length
      });
    }
  }

  if (matches.length === 0) {
    return {
      taskType: 'unknown',
      complexityScore: 0.5,
      confidence: 0.5,
      detectedKeywords: [],
      recommendedBudgetMultiplier: 1.0,
      minRetentionThreshold: 0.85,
      reasoning: 'No specific task type keywords matched; defaulted to general task profile.'
    };
  }

  // Sort by highest match count first, then by higher rule complexity score (priority tie-breaker)
  matches.sort((a, b) => {
    if (b.count !== a.count) return b.count - a.count;
    return b.rule.complexityScore - a.rule.complexityScore;
  });
  const bestMatch = matches[0];

  const uniqueKeywords = Array.from(new Set(bestMatch.matchedKeywords));
  let confidence = 0.75;
  if (uniqueKeywords.length >= 3) {
    confidence = 0.95;
  } else if (uniqueKeywords.length === 2) {
    confidence = 0.85;
  }

  return {
    taskType: bestMatch.rule.taskType,
    complexityScore: bestMatch.rule.complexityScore,
    confidence,
    detectedKeywords: uniqueKeywords,
    recommendedBudgetMultiplier: bestMatch.rule.recommendedBudgetMultiplier,
    minRetentionThreshold: bestMatch.rule.minRetentionThreshold,
    reasoning: `Matched ${bestMatch.rule.taskType} profile based on keywords: [${uniqueKeywords.join(', ')}]. ${bestMatch.rule.description}`
  };
}
