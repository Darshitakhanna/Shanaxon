import { promises as fs, existsSync, readFileSync } from 'fs';
import * as path from 'path';

export interface FileUsage {
  accessCount: number;
  lastAccessed: string;
}

/**
 * Tracks usage frequencies and access timestamps to power auto-tuning strategies.
 * Uses atomic async disk persistence (.tmp -> rename) to prevent file corruption.
 */
export class UsageTracker {
  private usagePath: string;
  private usage: Record<string, FileUsage> = {};
  private saveTimeout: NodeJS.Timeout | null = null;

  constructor(workspaceRoot: string) {
    this.usagePath = path.resolve(workspaceRoot, '.tokenist/usage.json');
    this.loadUsage();
  }

  private loadUsage() {
    try {
      if (existsSync(this.usagePath)) {
        const data = readFileSync(this.usagePath, 'utf-8');
        this.usage = JSON.parse(data);
      }
    } catch {
      this.usage = {};
    }
  }

  private scheduleSave() {
    if (this.saveTimeout) return;
    this.saveTimeout = setTimeout(async () => {
      this.saveTimeout = null;
      await this.flushToDisk();
    }, 2000);
  }

  /**
   * Serializes and writes usage metrics to disk using atomic temp file renaming.
   */
  async flushToDisk(): Promise<void> {
    try {
      const dir = path.dirname(this.usagePath);
      await fs.mkdir(dir, { recursive: true });
      const tempPath = `${this.usagePath}.${Date.now()}.${Math.random().toString(36).substring(2, 7)}.tmp`;
      await fs.writeFile(tempPath, JSON.stringify(this.usage, null, 2), 'utf-8');
      await fs.rename(tempPath, this.usagePath);
    } catch {
      // Fail silently
    }
  }

  recordAccess(filePath: string) {
    const absPath = path.resolve(filePath);
    const entry = this.usage[absPath] || { accessCount: 0, lastAccessed: '' };
    entry.accessCount++;
    entry.lastAccessed = new Date().toISOString();
    this.usage[absPath] = entry;
    this.scheduleSave();
  }

  getUsage(filePath: string): FileUsage | null {
    const absPath = path.resolve(filePath);
    return this.usage[absPath] || null;
  }

  async clear(): Promise<void> {
    this.usage = {};
    await this.flushToDisk();
  }
}
