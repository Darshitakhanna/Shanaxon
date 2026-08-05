import * as crypto from 'crypto';
import { promises as fs } from 'fs';
import * as path from 'path';

export interface RetrieveCacheEntry {
  original: string;
  filePath: string;
  tier: string;
  createdAt: number;
}

/**
 * Compress-Cache-Retrieve (CCR) Storage Layer.
 * Stores original uncompressed file content indexed by a short SHA-256 hash.
 * Supports disk persistence (.tokenist/retrieve_cache.json) for cross-session recovery.
 */
export class RetrieveCache {
  private storeMap = new Map<string, RetrieveCacheEntry>();
  private readonly ttlMs: number;
  private readonly maxEntries: number;
  private readonly diskPath: string;
  private flushTimeout: NodeJS.Timeout | null = null;

  constructor(
    ttlMs = 30 * 60 * 1000,
    maxEntries = 500,
    diskPath = '.tokenist/retrieve_cache.json'
  ) {
    this.ttlMs = ttlMs;
    this.maxEntries = maxEntries;
    this.diskPath = path.resolve(diskPath);
    this.loadFromDisk();
  }

  /**
   * Loads cached entries from disk.
   */
  async loadFromDisk(): Promise<void> {
    try {
      const data = await fs.readFile(this.diskPath, 'utf-8');
      const parsed: Record<string, RetrieveCacheEntry> = JSON.parse(data);
      const now = Date.now();

      this.storeMap.clear();
      for (const [hash, entry] of Object.entries(parsed)) {
        if (now - entry.createdAt <= this.ttlMs) {
          this.storeMap.set(hash, entry);
        }
      }
    } catch {
      // Ignore missing disk cache
    }
  }

  /**
   * Serializes and writes cache to disk atomically using temporary file rename.
   */
  async flushToDisk(): Promise<void> {
    try {
      const dir = path.dirname(this.diskPath);
      await fs.mkdir(dir, { recursive: true });

      const obj: Record<string, RetrieveCacheEntry> = {};
      for (const [hash, entry] of this.storeMap.entries()) {
        obj[hash] = entry;
      }

      const tempPath = `${this.diskPath}.${Date.now()}.${Math.random().toString(36).substring(2, 7)}.tmp`;
      await fs.writeFile(tempPath, JSON.stringify(obj, null, 2), 'utf-8');
      await fs.rename(tempPath, this.diskPath);
    } catch {
      // Fail silently
    }
  }

  private scheduleFlush(): void {
    if (this.flushTimeout) return;
    this.flushTimeout = setTimeout(async () => {
      this.flushTimeout = null;
      await this.flushToDisk();
    }, 2000);
  }

  /**
   * Stores original content and returns an 8-character hash key.
   */
  store(original: string, filePath: string, tier: string): string {
    this.evictExpired();

    const hash = crypto
      .createHash('sha256')
      .update(`${filePath}:${original}`, 'utf-8')
      .digest('hex')
      .substring(0, 8);

    if (this.storeMap.size >= this.maxEntries) {
      const oldestKey = this.storeMap.keys().next().value;
      if (oldestKey) {
        this.storeMap.delete(oldestKey);
      }
    }

    this.storeMap.set(hash, {
      original,
      filePath,
      tier,
      createdAt: Date.now(),
    });

    this.scheduleFlush();
    return hash;
  }

  /**
   * Retrieves original content by hash key.
   * Returns null if expired or not found.
   */
  retrieve(hash: string): RetrieveCacheEntry | null {
    this.evictExpired();
    const entry = this.storeMap.get(hash);
    if (!entry) return null;
    return entry;
  }

  /**
   * Injects retrieve markers into compressed output.
   * Appends `[tokenist:retrieve hash=<hash>]` footer after compressed content.
   * Only injects for 'medium', 'aggressive', or custom compressed tiers.
   */
  injectMarker(compressed: string, original: string, filePath: string, tier: string): string {
    if (tier === 'normal') {
      return compressed;
    }

    const hash = this.store(original, filePath, tier);
    const marker = `\n\n/* [tokenist:retrieve hash=${hash}] — Use retrieve_original tool with this hash if full uncompressed source is required */`;
    return `${compressed}${marker}`;
  }

  /**
   * Evicts expired entries based on TTL.
   */
  private evictExpired(): void {
    const now = Date.now();
    for (const [hash, entry] of this.storeMap.entries()) {
      if (now - entry.createdAt > this.ttlMs) {
        this.storeMap.delete(hash);
      }
    }
  }

  /**
   * Returns current cache statistics.
   */
  getStats(): { entries: number; totalOriginalBytes: number } {
    let totalOriginalBytes = 0;
    for (const entry of this.storeMap.values()) {
      totalOriginalBytes += entry.original.length;
    }
    return {
      entries: this.storeMap.size,
      totalOriginalBytes,
    };
  }
}
