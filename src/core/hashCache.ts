import * as crypto from 'crypto';

export interface HashCacheEntry {
  hash: string;
  normal: string;
  medium: string;
  aggressive: string;
  lastAccessed: number;
}

/**
 * SHA-256 cryptographic content-hash utility for rock-solid cache validation.
 */
export function computeContentHash(content: string): string {
  return crypto.createHash('sha256').update(content, 'utf-8').digest('hex');
}
