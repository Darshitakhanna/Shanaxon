// @ts-ignore
import { pipeline } from '@xenova/transformers';
import { promises as fs } from 'fs';
import * as path from 'path';
import { computeContentHash } from './hashCache';

export interface PersistedEmbedding {
  hash: string;
  vector: number[];
}

export class EmbeddingRanker {
  private extractor: any = null;
  private isInitialized = false;
  private isAvailable = true;
  private embeddings = new Map<string, number[]>();
  private contentHashes = new Map<string, string>();
  private diskPath: string;
  private saveTimeout: NodeJS.Timeout | null = null;

  constructor(workspaceRoot = process.cwd()) {
    this.diskPath = path.resolve(workspaceRoot, '.tokenist/embeddings.json');
  }

  /**
   * Initializes the ONNX model pipeline lazily and loads cached embeddings from disk.
   */
  async init() {
    if (this.isInitialized) return;

    await this.loadFromDisk();

    try {
      // Load local ONNX sentence transformer (all-MiniLM-L6-v2)
      try {
        this.extractor = await pipeline('feature-extraction', 'Xenova/all-MiniLM-L6-v2');
      } catch {
        this.extractor = await pipeline('embeddings', 'Xenova/all-MiniLM-L6-v2');
      }
      this.isAvailable = true;
    } catch (err) {
      console.warn("Tokenist EmbeddingRanker warning: ONNX model loading failed. Semantic ranking falls back to default sorting.", err);
      this.isAvailable = false;
    } finally {
      this.isInitialized = true;
    }
  }

  /**
   * Loads cached embeddings and hashes from disk.
   */
  async loadFromDisk() {
    try {
      const data = await fs.readFile(this.diskPath, 'utf-8');
      const parsed: Record<string, PersistedEmbedding> = JSON.parse(data);
      this.embeddings.clear();
      this.contentHashes.clear();

      for (const [filePath, entry] of Object.entries(parsed)) {
        const absPath = path.resolve(filePath);
        this.embeddings.set(absPath, entry.vector);
        this.contentHashes.set(absPath, entry.hash);
      }
    } catch {
      // Ignore missing or corrupted cache
    }
  }

  /**
   * Serializes and writes embeddings to disk atomically using temporary file rename.
   */
  async flushToDisk(): Promise<void> {
    try {
      const dir = path.dirname(this.diskPath);
      await fs.mkdir(dir, { recursive: true });

      const obj: Record<string, PersistedEmbedding> = {};
      for (const [key, vector] of this.embeddings.entries()) {
        const hash = this.contentHashes.get(key) || '';
        obj[key] = { hash, vector };
      }

      const tempPath = `${this.diskPath}.${Date.now()}.${Math.random().toString(36).substring(2, 7)}.tmp`;
      await fs.writeFile(tempPath, JSON.stringify(obj), 'utf-8');
      await fs.rename(tempPath, this.diskPath);
    } catch (err) {
      console.error('Failed to flush embeddings to disk:', err);
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
   * Clears the in-memory index and disk store.
   */
  async clear() {
    this.embeddings.clear();
    this.contentHashes.clear();
    await this.flushToDisk();
  }

  /**
   * Generates a 384-dimensional normalized embedding vector for the text.
   */
  async getEmbedding(text: string): Promise<number[]> {
    if (!this.isInitialized) {
      await this.init();
    }

    if (!this.isAvailable || !this.extractor) {
      return [];
    }

    try {
      const output = await this.extractor(text, { pooling: 'mean', normalize: true });
      return Array.from(output.data);
    } catch {
      return [];
    }
  }

  /**
   * Embeds and indexes a file signature. Skips inference if content hash matches cached entry.
   */
  async indexFile(filePath: string, text: string) {
    if (!this.isInitialized) {
      await this.init();
    }

    const absPath = path.resolve(filePath);
    const hash = computeContentHash(text);

    // Skip inference if hash matches cached embedding
    if (this.contentHashes.get(absPath) === hash && this.embeddings.has(absPath)) {
      return;
    }

    if (!this.isAvailable) {
      // Fallback mode when model is offline or unavailable
      this.contentHashes.set(absPath, hash);
      this.embeddings.set(absPath, [1.0, 0.0, 0.0]);
      this.scheduleSave();
      return;
    }

    try {
      const vector = await this.getEmbedding(text);
      if (vector.length > 0) {
        this.embeddings.set(absPath, vector);
        this.contentHashes.set(absPath, hash);
        this.scheduleSave();
      }
    } catch (err) {
      console.error(`Failed to generate embedding for ${filePath}:`, err);
    }
  }

  /**
   * Ranks all indexed files by cosine similarity to the query string.
   */
  async rankFiles(query: string, topK = 5): Promise<{ filePath: string; score: number }[]> {
    if (!this.isInitialized) {
      await this.init();
    }
    if (!this.isAvailable || this.embeddings.size === 0) {
      return [];
    }

    const queryVector = await this.getEmbedding(query);
    if (queryVector.length === 0) return [];

    const results: { filePath: string; score: number }[] = [];

    for (const [filePath, fileVector] of this.embeddings.entries()) {
      const score = cosineSimilarity(queryVector, fileVector);
      results.push({ filePath, score });
    }

    results.sort((a, b) => b.score - a.score);
    return results.slice(0, topK);
  }
}

/**
 * Computes cosine similarity between two vectors.
 */
function cosineSimilarity(vecA: number[], vecB: number[]): number {
  if (vecA.length === 0 || vecB.length === 0) return 0;
  let dotProduct = 0.0;
  let normA = 0.0;
  let normB = 0.0;
  for (let i = 0; i < vecA.length; i++) {
    dotProduct += vecA[i] * vecB[i];
    normA += vecA[i] * vecA[i];
    normB += vecB[i] * vecB[i];
  }
  if (normA === 0 || normB === 0) return 0;
  return dotProduct / (Math.sqrt(normA) * Math.sqrt(normB));
}
