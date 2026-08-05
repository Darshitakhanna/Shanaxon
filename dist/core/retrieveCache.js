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
exports.RetrieveCache = void 0;
const crypto = __importStar(require("crypto"));
const fs_1 = require("fs");
const path = __importStar(require("path"));
/**
 * Compress-Cache-Retrieve (CCR) Storage Layer.
 * Stores original uncompressed file content indexed by a short SHA-256 hash.
 * Supports disk persistence (.tokenist/retrieve_cache.json) for cross-session recovery.
 */
class RetrieveCache {
    storeMap = new Map();
    ttlMs;
    maxEntries;
    diskPath;
    flushTimeout = null;
    constructor(ttlMs = 30 * 60 * 1000, maxEntries = 500, diskPath = '.tokenist/retrieve_cache.json') {
        this.ttlMs = ttlMs;
        this.maxEntries = maxEntries;
        this.diskPath = path.resolve(diskPath);
        this.loadFromDisk();
    }
    /**
     * Loads cached entries from disk.
     */
    async loadFromDisk() {
        try {
            const data = await fs_1.promises.readFile(this.diskPath, 'utf-8');
            const parsed = JSON.parse(data);
            const now = Date.now();
            this.storeMap.clear();
            for (const [hash, entry] of Object.entries(parsed)) {
                if (now - entry.createdAt <= this.ttlMs) {
                    this.storeMap.set(hash, entry);
                }
            }
        }
        catch {
            // Ignore missing disk cache
        }
    }
    /**
     * Serializes and writes cache to disk atomically using temporary file rename.
     */
    async flushToDisk() {
        try {
            const dir = path.dirname(this.diskPath);
            await fs_1.promises.mkdir(dir, { recursive: true });
            const obj = {};
            for (const [hash, entry] of this.storeMap.entries()) {
                obj[hash] = entry;
            }
            const tempPath = `${this.diskPath}.${Date.now()}.${Math.random().toString(36).substring(2, 7)}.tmp`;
            await fs_1.promises.writeFile(tempPath, JSON.stringify(obj, null, 2), 'utf-8');
            await fs_1.promises.rename(tempPath, this.diskPath);
        }
        catch {
            // Fail silently
        }
    }
    scheduleFlush() {
        if (this.flushTimeout)
            return;
        this.flushTimeout = setTimeout(async () => {
            this.flushTimeout = null;
            await this.flushToDisk();
        }, 2000);
    }
    /**
     * Stores original content and returns an 8-character hash key.
     */
    store(original, filePath, tier) {
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
    retrieve(hash) {
        this.evictExpired();
        const entry = this.storeMap.get(hash);
        if (!entry)
            return null;
        return entry;
    }
    /**
     * Injects retrieve markers into compressed output.
     * Appends `[tokenist:retrieve hash=<hash>]` footer after compressed content.
     * Only injects for 'medium', 'aggressive', or custom compressed tiers.
     */
    injectMarker(compressed, original, filePath, tier) {
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
    evictExpired() {
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
    getStats() {
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
exports.RetrieveCache = RetrieveCache;
