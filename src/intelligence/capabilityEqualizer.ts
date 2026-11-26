import { promises as fs } from 'fs';
import * as path from 'path';
import { MemoryEntry, TaskProfile } from '../types';
import { recallMemory } from './criticalMemory';

export interface EqualizedContextResult {
  originalPrompt: string;
  enrichedPrompt: string;
  injectedMemories: MemoryEntry[];
  suggestedFiles: string[];
  missingContext: string[];
  warnings: string[];
  equalizationApplied: boolean;
  capabilityGapBefore: number; // 0 - 100
  capabilityGapAfter: number;  // 0 - 100
}

/**
 * Automatically bridges capability gaps by augmenting novice prompts with relevant architectural constraints,
 * critical memories, and real workspace file context that an expert engineer would manually supply.
 */
export async function equalizeContext(
  userPrompt: string,
  workspaceRoot: string,
  taskProfile: TaskProfile
): Promise<EqualizedContextResult> {
  const warnings: string[] = [];
  const suggestedFiles: string[] = [];
  const missingContext: string[] = [];
  const contextAdditions: string[] = [];

  // Calculate Initial Capability Gap (0 - 100)
  let capabilityGapBefore = 0;

  // 1. Check prompt completeness / brevity
  if (userPrompt.trim().length < 50) {
    capabilityGapBefore += 35;
    missingContext.push('Prompt is extremely brief (< 50 chars); lacks explicit task constraints and target file pointers.');
  } else if (userPrompt.trim().length < 120) {
    capabilityGapBefore += 20;
    missingContext.push('Prompt is moderately brief; lacks detailed execution context.');
  }

  // 2. Check task-specific missing context
  if (taskProfile.taskType === 'bug_investigation') {
    if (!/stack|trace|error|exception|fail|line/i.test(userPrompt)) {
      capabilityGapBefore += 30;
      missingContext.push('Bug report prompt missing runtime exception or stack trace details.');
    }
  } else if (taskProfile.taskType === 'architecture_design') {
    if (!/interface|schema|api|pattern|boundary|contract/i.test(userPrompt)) {
      capabilityGapBefore += 25;
      missingContext.push('Architecture design prompt missing explicit boundary / contract requirements.');
    }
  } else if (taskProfile.taskType === 'code_refactoring') {
    if (!/test|spec|verify|benchmark/i.test(userPrompt)) {
      capabilityGapBefore += 20;
      missingContext.push('Refactoring prompt missing verification test criteria or regression safeguards.');
    }
  }

  // 3. Recall relevant critical memories from persistent memory store
  const relevantMemories = await recallMemory(userPrompt, workspaceRoot, { limit: 5 });

  // 4. Identify potential file paths mentioned in prompt and verify on disk
  const pathMatches = userPrompt.match(/[\w/.-]+\.(?:ts|js|py|go|rs|json|md|sql|html|css)/gi) || [];
  const verifiedFileContexts: { path: string; summary: string }[] = [];

  for (const rawMatch of pathMatches) {
    const candidatePath = path.isAbsolute(rawMatch) ? rawMatch : path.join(workspaceRoot, rawMatch);
    try {
      const stats = await fs.stat(candidatePath);
      if (stats.isFile()) {
        if (!suggestedFiles.includes(rawMatch)) {
          suggestedFiles.push(rawMatch);
        }
        // Extract top-level exports/signatures from real file
        const content = await fs.readFile(candidatePath, 'utf-8');
        const lines = content.split('\n').slice(0, 30);
        const sigs = lines.filter(l => /^(?:export|class|function|interface|type|const|let|var)\s/.test(l.trim()));
        if (sigs.length > 0) {
          verifiedFileContexts.push({
            path: rawMatch,
            summary: sigs.slice(0, 5).join('\n')
          });
        }
      }
    } catch {
      // File path in prompt does not exist on disk
      warnings.push(`Mentioned file "${rawMatch}" was not found on disk.`);
    }
  }

  if (suggestedFiles.length === 0) {
    capabilityGapBefore += 15;
    missingContext.push('No target workspace files explicitly referenced in user prompt.');
  }

  capabilityGapBefore = Math.min(100, capabilityGapBefore);

  // 5. Construct Enriched Prompt with Real Context
  let equalizationApplied = false;

  if (relevantMemories.length > 0) {
    equalizationApplied = true;
    contextAdditions.push('### Recalled Architectural Context & Constraints:');
    for (const mem of relevantMemories) {
      contextAdditions.push(`- **[${mem.category.toUpperCase()}] ${mem.title}**: ${mem.content}`);
    }
  }

  if (verifiedFileContexts.length > 0) {
    equalizationApplied = true;
    contextAdditions.push('### Workspace Target File Signatures:');
    for (const fileCtx of verifiedFileContexts) {
      contextAdditions.push(`#### \`${fileCtx.path}\` Key Signatures:\n\`\`\`typescript\n${fileCtx.summary}\n\`\`\``);
    }
  }

  if (missingContext.length > 0) {
    equalizationApplied = true;
    contextAdditions.push('### Detected Context Gaps & Equalization Guidelines:');
    for (const gap of missingContext) {
      contextAdditions.push(`- **[ATTENTION]**: ${gap}`);
    }
  }

  let enrichedPrompt = userPrompt;
  if (equalizationApplied && contextAdditions.length > 0) {
    enrichedPrompt = `${userPrompt}\n\n---\n[TOKENIST CONTEXT EQUALIZER AUTOMATIC AUGMENTATION]\n${contextAdditions.join('\n')}\n---`;
  }

  // Calculate Final Capability Gap after Equalization
  let capabilityGapAfter = capabilityGapBefore;
  if (equalizationApplied) {
    // Each recalled memory reduces gap by 15%
    capabilityGapAfter -= relevantMemories.length * 15;
    // Verified files reduce gap by 20%
    capabilityGapAfter -= verifiedFileContexts.length * 20;
    // Missing context guidelines reduce gap by 10%
    if (missingContext.length > 0) capabilityGapAfter -= 10;
  }

  capabilityGapAfter = Math.max(0, Math.round(capabilityGapAfter));

  return {
    originalPrompt: userPrompt,
    enrichedPrompt,
    injectedMemories: relevantMemories,
    suggestedFiles,
    missingContext,
    warnings,
    equalizationApplied,
    capabilityGapBefore,
    capabilityGapAfter
  };
}
