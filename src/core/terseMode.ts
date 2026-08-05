export type VerbosityLevel = 'minimal' | 'compact' | 'standard';

export interface TersePrompt {
  systemInstruction: string;
  level: VerbosityLevel;
  estimatedOutputReduction: string;
}

/**
 * Output Token Optimization Layer (Caveman-Style Compression).
 * Generates system prompt instructions that constrain the LLM to output concise,
 * filler-free technical responses, reducing output tokens by 30–75%.
 */
export function getTersePrompt(level: VerbosityLevel = 'compact'): TersePrompt {
  switch (level) {
    case 'minimal':
      return {
        level: 'minimal',
        estimatedOutputReduction: '60–75% output tokens saved',
        systemInstruction: `[SYSTEM DIRECTIVE: TERSE MODE MINIMAL]
You MUST optimize for extreme output token brevity:
- Zero pleasantries, zero fluff, zero introductory or concluding sentences.
- Use telegraphic/caveman style for explanations (omit articles "a", "an", "the").
- Provide raw code solutions directly. Keep inline comments minimal.
- Format answers with bullet points or raw markdown blocks only.`,
      };

    case 'compact':
      return {
        level: 'compact',
        estimatedOutputReduction: '30–50% output tokens saved',
        systemInstruction: `[SYSTEM DIRECTIVE: TERSE MODE COMPACT]
Respond concisely and direct-to-the-point:
- Avoid repetitive summary paragraphs or conversational filler.
- Focus output on raw code blocks, diffs, and essential technical bullet points.
- State reasons briefly before code snippets; omit step-by-step rewording of obvious logic.`,
      };

    case 'standard':
    default:
      return {
        level: 'standard',
        estimatedOutputReduction: '0% (Standard verbosity)',
        systemInstruction: `[SYSTEM DIRECTIVE: STANDARD MODE]
Respond normally with complete explanations, formatted markdown, and standard conversational tone.`,
      };
  }
}
