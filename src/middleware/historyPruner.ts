export interface Message {
  role: 'user' | 'assistant' | 'system';
  content: string;
}

/**
 * Prunes conversational history to minimize tokens in multi-turn conversations.
 * @param messages Array of history messages.
 * @param maxTurns Maximum turns (pairs of user/assistant messages) to keep fully intact (default: 5).
 */
export function pruneHistory(messages: Message[], maxTurns = 5): Message[] {
  if (messages.length === 0) return [];

  const pruned: Message[] = [];
  const nonSystemMessages = messages.filter((m) => m.role !== 'system');
  const keepCount = maxTurns * 2;
  const cutoffIndex = nonSystemMessages.length - keepCount;

  // Track how many non-system messages we've processed
  let nonSystemCount = 0;

  for (const msg of messages) {
    if (msg.role === 'system') {
      pruned.push(msg);
      continue;
    }

    const isProtected = nonSystemCount >= cutoffIndex;
    nonSystemCount++;

    if (isProtected) {
      // Keep recent turns fully intact
      pruned.push(msg);
    } else {
      // Apply pruning filters to older turns
      const prunedContent = cleanContent(msg.content);
      if (prunedContent.trim().length > 0) {
        pruned.push({
          role: msg.role,
          content: prunedContent,
        });
      }
    }
  }

  return pruned;
}

/**
 * Filter out repetitive debug/crash traces or collapse stack traces.
 */
function cleanContent(content: string): string {
  // Regex to match typical stack trace blocks
  // e.g. "Error: ... \n    at ... \n    at ..."
  const stackTraceRegex = /(Error: [^\n]+)\n(?:\s+at [^\n]+\n?)+/g;

  let cleaned = content;

  // Replace stack traces with collapsed placeholder
  cleaned = cleaned.replace(stackTraceRegex, '$1\n[Stack trace collapsed]');

  // Drop terminal dumps if they are very long and contain repetitive warnings/errors
  const isTerminalDump =
    (cleaned.includes('npm ERR!') ||
      cleaned.includes('node:internal') ||
      cleaned.includes('CategoryInfo') ||
      cleaned.includes('FullyQualifiedErrorId')) &&
    cleaned.length > 300;

  if (isTerminalDump) {
    return '[Long terminal build/debug dump removed to save context tokens]';
  }

  return cleaned;
}
