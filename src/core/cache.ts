import { promises as fs } from 'fs';
import * as path from 'path';
import { computeContentHash } from './hashCache';

export interface CacheValue {
  normal: string;
  medium: string;
  aggressive: string;
  mtimeMs: number;
  hash?: string;
}

export class AstCache {
  private cache = new Map<string, CacheValue>();
  private maxEntries: number;
  private cacheDiskPath: string;
  private flushTimeout: NodeJS.Timeout | null = null;

  constructor(maxEntries = 200, cacheDiskPath = '.tokenist/cache.json') {
    this.maxEntries = maxEntries;
    this.cacheDiskPath = path.resolve(cacheDiskPath);
  }

  /**
   * Loads cached results from disk.
   */
  async loadFromDisk(): Promise<void> {
    try {
      const data = await fs.readFile(this.cacheDiskPath, 'utf-8');
      const parsed = JSON.parse(data);
      this.cache.clear();

      for (const [key, value] of Object.entries(parsed)) {
        const val = value as CacheValue;
        this.cache.set(path.resolve(key), val);
      }
    } catch {
      // Fail silently if cache file is missing or invalid
    }
  }

  /**
   * Serializes and writes cache map to disk.
   */
  async flushToDisk(): Promise<void> {
    try {
      const dir = path.dirname(this.cacheDiskPath);
      await fs.mkdir(dir, { recursive: true });

      const obj: Record<string, CacheValue> = {};
      for (const [key, val] of this.cache.entries()) {
        obj[key] = val;
      }

      const tempPath = `${this.cacheDiskPath}.${Date.now()}.${Math.random().toString(36).substring(2, 7)}.tmp`;
      await fs.writeFile(tempPath, JSON.stringify(obj, null, 2), 'utf-8');
      await fs.rename(tempPath, this.cacheDiskPath);
    } catch (err) {
      console.error('Failed to flush AST cache to disk:', err);
    }
  }

  private scheduleFlush() {
    if (this.flushTimeout) return;
    this.flushTimeout = setTimeout(async () => {
      this.flushTimeout = null;
      await this.flushToDisk();
    }, 2000); // 2 second debounce is highly optimal
  }

  /**
   * Clears in-memory and disk cache.
   */
  async clear(): Promise<void> {
    this.cache.clear();
    await this.flushToDisk();
  }

  /**
   * Gets cached compression tier if file content hash or modification time has not changed.
   */
  async get(filePath: string, tier: 'normal' | 'medium' | 'aggressive', currentCodeContent?: string): Promise<string | null> {
    const absPath = path.resolve(filePath);
    const entry = this.cache.get(absPath);
    if (!entry) return null;

    try {
      if (currentCodeContent !== undefined && entry.hash) {
        const currentHash = computeContentHash(currentCodeContent);
        if (currentHash !== entry.hash) {
          this.cache.delete(absPath);
          this.scheduleFlush();
          return null;
        }
      } else {
        const stat = await fs.stat(absPath);
        if (stat.mtimeMs !== entry.mtimeMs) {
          this.cache.delete(absPath);
          this.scheduleFlush();
          return null;
        }
      }

      // LRU refresh: reinsert
      this.cache.delete(absPath);
      this.cache.set(absPath, entry);

      return entry[tier];
    } catch {
      this.cache.delete(absPath);
      this.scheduleFlush();
      return null;
    }
  }

  /**
   * Updates cached compression tiers and triggers debounced flush.
   */
  async set(filePath: string, values: { normal: string; medium: string; aggressive: string }, codeContent?: string): Promise<void> {
    const absPath = path.resolve(filePath);
    try {
      const stat = await fs.stat(absPath).catch(() => ({ mtimeMs: Date.now() }));
      const hash = codeContent ? computeContentHash(codeContent) : undefined;

      if (this.cache.size >= this.maxEntries) {
        const oldestKey = this.cache.keys().next().value;
        if (oldestKey) {
          this.cache.delete(oldestKey);
        }
      }

      this.cache.set(absPath, {
        ...values,
        mtimeMs: stat.mtimeMs,
        hash
      });

      this.scheduleFlush();
    } catch {
      // Ignore failures
    }
  }
}
