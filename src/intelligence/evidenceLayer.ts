import { ContextItem, EvidenceItem, EvidenceReport, EvidenceStatus, TaskProfile } from '../types';

/**
 * Analyzes context items and evaluates the overall evidence quality, tagging facts and identifying missing context.
 */
export function evaluateEvidence(
  items: ContextItem[],
  taskProfile: TaskProfile
): EvidenceReport {
  const evidenceItems: EvidenceItem[] = [];
  const warnings: string[] = [];
  const recommendations: string[] = [];

  let totalKnown = 0;
  let totalInferred = 0;
  let totalUncertain = 0;
  let totalMissing = 0;

  for (const item of items) {
    if (item.disposition === 'omit') continue;

    let statement = item.sourcePath 
      ? `Source file: ${item.sourcePath}`
      : (item.rawContent.substring(0, 100).replace(/\s+/g, ' ') + '...');

    if (item.evidenceType === 'known_fact') {
      totalKnown++;
      evidenceItems.push({
        id: item.id,
        type: 'known_fact',
        statement: `[Known Fact] ${statement}`,
        source: item.sourcePath,
        confidence: 0.95,
        impact: 'high'
      });
    } else if (item.evidenceType === 'inferred_fact') {
      totalInferred++;
      evidenceItems.push({
        id: item.id,
        type: 'inferred_fact',
        statement: `[Inferred Dependency] ${statement}`,
        source: item.sourcePath,
        confidence: 0.80,
        impact: 'medium'
      });
    } else if (item.evidenceType === 'uncertain_assumption') {
      totalUncertain++;
      evidenceItems.push({
        id: item.id,
        type: 'uncertain_assumption',
        statement: `[Low Confidence] ${statement}`,
        source: item.sourcePath,
        confidence: 0.45,
        impact: 'low'
      });
    }
  }

  // Check for missing context based on task type
  if (taskProfile.taskType === 'bug_investigation' && totalKnown === 0) {
    totalMissing++;
    warnings.push('Bug investigation requested without direct error log or target file context.');
    recommendations.push('Provide active file stack trace or failing test output.');
  }

  if (taskProfile.taskType === 'architecture_design' && totalKnown < 2) {
    totalMissing++;
    warnings.push('Architectural design requested with sparse workspace context.');
    recommendations.push('Recall architectural memories or fetch top-level repository map.');
  }

  const total = totalKnown + totalInferred + totalUncertain + totalMissing;
  const completenessScore = total > 0 
    ? (totalKnown * 1.0 + totalInferred * 0.7 + totalUncertain * 0.3) / total 
    : 0.5;

  const status: EvidenceStatus = {
    totalKnown,
    totalInferred,
    totalUncertain,
    totalMissing,
    completenessScore: Number(completenessScore.toFixed(2)),
    warnings
  };

  return {
    items: evidenceItems,
    status,
    recommendations
  };
}
