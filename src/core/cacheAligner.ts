export interface AlignResult {
  stablePrefix: string;
  dynamicSuffix: string;
  dynamicCount: number;
  estimatedCacheSavings: string;
}

/**
 * Cache-Aligned Prompt Stabilizer.
 * Reorganizes system prompts and context by relocating volatile dynamic values
 * (timestamps, UUIDs, random hashes, process IDs, timestamps) into a suffix block.
 * Allows Anthropic and OpenAI KV Caching to hit >90% prefix cache rates.
 */
export class CacheAligner {
  /**
   * Main entry point: stabilizes prompt text by separating static prefix from dynamic values.
   */
  align(prompt: string): AlignResult {
    let stablePrefix = prompt;
    const dynamicValues: { original: string; placeholder: string }[] = [];

    // 1. ISO Timestamps (e.g. 2026-08-01T05:22:40Z or 2026-08-01 05:22:40)
    const isoTimestampRegex = /\b\d{4}-\d{2}-\d{2}[T\s]\d{2}:\d{2}:\d{2}(?:\.\d+)?(?:Z|[+-]\d{2}:?\d{2})?\b/g;
    stablePrefix = stablePrefix.replace(isoTimestampRegex, (match) => {
      const placeholder = `{{DYN_TIMESTAMP_${dynamicValues.length + 1}}}`;
      dynamicValues.push({ original: match, placeholder });
      return placeholder;
    });

    // 2. UUIDs (e.g. 465c4a12-27fc-4bab-821d-4b8bbd3f2f79)
    const uuidRegex = /\b[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}\b/g;
    stablePrefix = stablePrefix.replace(uuidRegex, (match) => {
      const placeholder = `{{DYN_UUID_${dynamicValues.length + 1}}}`;
      dynamicValues.push({ original: match, placeholder });
      return placeholder;
    });

    // 3. Process IDs / Hex hashes (e.g. ProcessId: 14968, sha256 64-hex, commit hashes 40-hex)
    const shaHexRegex = /\b[0-9a-fA-F]{40,64}\b/g;
    stablePrefix = stablePrefix.replace(shaHexRegex, (match) => {
      const placeholder = `{{DYN_HASH_${dynamicValues.length + 1}}}`;
      dynamicValues.push({ original: match, placeholder });
      return placeholder;
    });

    // 4. Dynamic Process ID / Port assignments
    const pidRegex = /\b(?:PID|ProcessId|port):\s*\d+\b/gi;
    stablePrefix = stablePrefix.replace(pidRegex, (match) => {
      const placeholder = `{{DYN_ENV_${dynamicValues.length + 1}}}`;
      dynamicValues.push({ original: match, placeholder });
      return placeholder;
    });

    const dynamicCount = dynamicValues.length;
    let dynamicSuffix = '';

    if (dynamicCount > 0) {
      dynamicSuffix = dynamicValues
        .map((item) => `${item.placeholder} = "${item.original}"`)
        .join('\n');
    }

    const estimatedCacheSavings =
      dynamicCount > 0
        ? `~90% KV Cache discount on ${Math.round((stablePrefix.length / (prompt.length || 1)) * 100)}% of prompt prefix`
        : '0% (No dynamic variables detected)';

    return {
      stablePrefix,
      dynamicSuffix,
      dynamicCount,
      estimatedCacheSavings,
    };
  }
}
