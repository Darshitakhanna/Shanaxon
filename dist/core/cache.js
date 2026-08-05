"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.AstCache = void 0;
const fs_1 = require("fs");
const path = __importStar(require("path"));
const hashCache_1 = require("./hashCache");
class AstCache {
    cache = new Map();
    maxEntries;
    cacheDiskPath;
    flushTimeout = null;
    constructor(maxEntries = 200, cacheDiskPath = '.tokenist/cache.json') {
        this.maxEntries = maxEntries;
        this.cacheDiskPath = path.resolve(cacheDiskPath);
    }
    /**
     * Loads cached results from disk.
     */
    async loadFromDisk() {
        try {
            const data = await fs_1.promises.readFile(this.cacheDiskPath, 'utf-8');
            const parsed = JSON.parse(data);
            this.cache.clear();
            for (const [key, value] of Object.entries(parsed)) {
                const val = value;
                this.cache.set(path.resolve(key), val);
            }
        }
        catch {
            // Fail silently if cache file is missing or invalid
        }
    }
    /**
     * Serializes and writes cache map to disk.
     */
    async flushToDisk() {
        try {
            const dir = path.dirname(this.cacheDiskPath);
            await fs_1.promises.mkdir(dir, { recursive: true });
            const obj = {};
            for (const [key, val] of this.cache.entries()) {
                obj[key] = val;
            }
            const tempPath = `${this.cacheDiskPath}.${Date.now()}.${Math.random().toString(36).substring(2, 7)}.tmp`;
            await fs_1.promises.writeFile(tempPath, JSON.stringify(obj, null, 2), 'utf-8');
            await fs_1.promises.rename(tempPath, this.cacheDiskPath);
        }
        catch (err) {
            console.error('Failed to flush AST cache to disk:', err);
        }
    }
    scheduleFlush() {
        if (this.flushTimeout)
            return;
        this.flushTimeout = setTimeout(async () => {
            this.flushTimeout = null;
            await this.flushToDisk();
        }, 2000); // 2 second debounce is highly optimal
    }
    /**
     * Clears in-memory and disk cache.
     */
    async clear() {
        this.cache.clear();
        await this.flushToDisk();
    }
    /**
     * Gets cached compression tier if file content hash or modification time has not changed.
     */
    async get(filePath, tier, currentCodeContent) {
        const absPath = path.resolve(filePath);
        const entry = this.cache.get(absPath);
        if (!entry)
            return null;
        try {
            if (currentCodeContent !== undefined && entry.hash) {
                const currentHash = (0, hashCache_1.computeContentHash)(currentCodeContent);
                if (currentHash !== entry.hash) {
                    this.cache.delete(absPath);
                    this.scheduleFlush();
                    return null;
                }
            }
            else {
                const stat = await fs_1.promises.stat(absPath);
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
        }
        catch {
            this.cache.delete(absPath);
            this.scheduleFlush();
            return null;
        }
    }
    /**
     * Updates cached compression tiers and triggers debounced flush.
     */
    async set(filePath, values, codeContent) {
        const absPath = path.resolve(filePath);
        try {
            const stat = await fs_1.promises.stat(absPath).catch(() => ({ mtimeMs: Date.now() }));
            const hash = codeContent ? (0, hashCache_1.computeContentHash)(codeContent) : undefined;
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
        }
        catch {
            // Ignore failures
        }
    }
}
exports.AstCache = AstCache;
