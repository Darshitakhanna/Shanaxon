import { promises as fs } from 'fs';
import * as path from 'path';
import { CriticalMemoryState, MemoryCategory, MemoryEntry } from '../types';
import { getConfig } from '../core/configLoader';
import { resolveTenantContext } from '../security/tenantIsolation';

let inMemoryState: { path: string; state: CriticalMemoryState } | null = null;

function generateId(): string {
  return `mem_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`;
}

/**
 * Resolves the absolute path to the memory JSON storage file.
 */
function resolveMemoryPath(workspaceRoot: string): string {
  const config = getConfig();
  const tenant = resolveTenantContext(config, workspaceRoot);
  const relPath = config.memoryPath || '.tokenist/memory.json';
  if (tenant.tenantId === 'local' && tenant.organizationId === 'default') {
    return path.resolve(workspaceRoot, relPath);
  }
  const dir = path.dirname(relPath);
  const ext = path.extname(relPath);
  const baseName = path.basename(relPath, ext);
  const scopedFileName = `${baseName}_${tenant.tenantId}_${tenant.organizationId}${ext}`;
  return path.resolve(workspaceRoot, dir, scopedFileName);
}

/**
 * Loads the critical memory state from disk.
 */
export async function loadMemory(workspaceRoot: string): Promise<CriticalMemoryState> {
  const filePath = resolveMemoryPath(workspaceRoot);
  
  if (inMemoryState && inMemoryState.path === filePath) {
    return inMemoryState.state;
  }

  try {
    const raw = await fs.readFile(filePath, 'utf-8');
    const parsed = JSON.parse(raw) as CriticalMemoryState;
    inMemoryState = { path: filePath, state: parsed };
    return parsed;
  } catch {
    const emptyState: CriticalMemoryState = {
      entries: [],
      version: 1,
      lastModified: new Date().toISOString()
    };
    inMemoryState = { path: filePath, state: emptyState };
    return emptyState;
  }
}

/**
 * Flushes memory state atomically to disk.
 */
async function saveMemory(state: CriticalMemoryState, workspaceRoot: string): Promise<void> {
  const filePath = resolveMemoryPath(workspaceRoot);
  const dir = path.dirname(filePath);

  await fs.mkdir(dir, { recursive: true });

  state.lastModified = new Date().toISOString();
  inMemoryState = { path: filePath, state };

  const tempPath = `${filePath}.${Date.now()}.${Math.random().toString(36).substring(2, 7)}.tmp`;
  await fs.writeFile(tempPath, JSON.stringify(state, null, 2), 'utf-8');
  await fs.rename(tempPath, filePath);
}

/**
 * Stores a new architectural decision, constraint, dependency, or gotcha in critical memory.
 */
export async function storeMemory(
  entry: Omit<MemoryEntry, 'id' | 'createdAt' | 'updatedAt'>,
  workspaceRoot: string
): Promise<MemoryEntry> {
  const config = getConfig();
  const tenant = resolveTenantContext(config, workspaceRoot);
  const state = await loadMemory(workspaceRoot);

  const now = new Date().toISOString();
  const newEntry: MemoryEntry = {
    ...entry,
    id: generateId(),
    createdAt: now,
    updatedAt: now,
    tenantId: tenant.tenantId,
    workspaceId: tenant.workspaceId
  };

  // Check if duplicate title exists in same category to update
  const existingIdx = state.entries.findIndex(
    e => e.category === entry.category && e.title.toLowerCase() === entry.title.toLowerCase()
  );

  if (existingIdx >= 0) {
    newEntry.id = state.entries[existingIdx].id;
    newEntry.createdAt = state.entries[existingIdx].createdAt;
    state.entries[existingIdx] = newEntry;
  } else {
    state.entries.unshift(newEntry);
  }

  // Enforce rotation limit
  const maxLimit = config.maxMemoryEntries || 500;
  if (state.entries.length > maxLimit) {
    state.entries = state.entries.slice(0, maxLimit);
  }

  await saveMemory(state, workspaceRoot);
  return newEntry;
}

/**
 * Recalls relevant memories matching a natural language prompt or query.
 */
export async function recallMemory(
  query: string,
  workspaceRoot: string,
  options?: { category?: MemoryCategory; limit?: number }
): Promise<MemoryEntry[]> {
  const state = await loadMemory(workspaceRoot);
  let candidates = state.entries;

  const nowMs = Date.now();
  const thirtyDaysMs = 30 * 24 * 60 * 60 * 1000;

  // Mark staleness and contradiction
  for (let i = 0; i < candidates.length; i++) {
    const entry = candidates[i];
    const ageMs = nowMs - new Date(entry.updatedAt).getTime();
    if (ageMs > thirtyDaysMs) {
      entry.isStale = true;
    }

    // Check for contradictions with newer entries in same category
    for (let j = 0; j < i; j++) {
      const newer = candidates[j];
      if (newer.category === entry.category) {
        const titleOverlap = newer.title.toLowerCase() === entry.title.toLowerCase();
        const hasOpposingNegation =
          (/\b(no|not|never|don't)\b/i.test(newer.content) && !/\b(no|not|never|don't)\b/i.test(entry.content)) ||
          (!/\b(no|not|never|don't)\b/i.test(newer.content) && /\b(no|not|never|don't)\b/i.test(entry.content));

        if (titleOverlap && hasOpposingNegation) {
          entry.contradictedBy = newer.id;
        }
      }
    }
  }

  if (options?.category) {
    candidates = candidates.filter(e => e.category === options.category);
  }

  if (!query || query.trim().length === 0) {
    return candidates.slice(0, options?.limit || 10);
  }

  const queryTerms = query.toLowerCase().split(/\W+/).filter(t => t.length > 2);

  const scored = candidates.map(entry => {
    let score = 0;
    const titleLower = entry.title.toLowerCase();
    const contentLower = entry.content.toLowerCase();
    const tagsLower = entry.tags.map(t => t.toLowerCase());

    for (const term of queryTerms) {
      if (titleLower.includes(term)) score += 3.0;
      if (contentLower.includes(term)) score += 1.0;
      if (tagsLower.some(t => t.includes(term))) score += 2.0;
    }

    if (entry.priority === 'high') score *= 1.5;
    if (entry.priority === 'medium') score *= 1.2;
    if (entry.isStale) score *= 0.8; // Slight penalty for stale memories
    if (entry.contradictedBy) score *= 0.5; // Significant penalty for contradicted memories

    return { entry, score };
  });

  const filtered = scored.filter(s => s.score > 0);
  filtered.sort((a, b) => b.score - a.score);

  const limit = options?.limit || 10;
  return filtered.slice(0, limit).map(s => s.entry);
}

/**
 * Lists memories in the system, optionally filtered by category.
 */
export async function listMemory(
  workspaceRoot: string,
  category?: MemoryCategory
): Promise<MemoryEntry[]> {
  const state = await loadMemory(workspaceRoot);
  if (category) {
    return state.entries.filter(e => e.category === category);
  }
  return state.entries;
}

/**
 * Deletes a memory entry by ID.
 */
export async function deleteMemory(
  id: string,
  workspaceRoot: string
): Promise<boolean> {
  const state = await loadMemory(workspaceRoot);
  const initialCount = state.entries.length;
  state.entries = state.entries.filter(e => e.id !== id);

  if (state.entries.length !== initialCount) {
    await saveMemory(state, workspaceRoot);
    return true;
  }
  return false;
}

/**
 * Resets memory state in memory (for test isolation).
 */
export function resetMemoryState(): void {
  inMemoryState = null;
}
