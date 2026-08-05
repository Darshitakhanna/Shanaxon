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
exports.UsageTracker = void 0;
const fs_1 = require("fs");
const path = __importStar(require("path"));
/**
 * Tracks usage frequencies and access timestamps to power auto-tuning strategies.
 * Uses atomic async disk persistence (.tmp -> rename) to prevent file corruption.
 */
class UsageTracker {
    usagePath;
    usage = {};
    saveTimeout = null;
    constructor(workspaceRoot) {
        this.usagePath = path.resolve(workspaceRoot, '.tokenist/usage.json');
        this.loadUsage();
    }
    loadUsage() {
        try {
            if ((0, fs_1.existsSync)(this.usagePath)) {
                const data = (0, fs_1.readFileSync)(this.usagePath, 'utf-8');
                this.usage = JSON.parse(data);
            }
        }
        catch {
            this.usage = {};
        }
    }
    scheduleSave() {
        if (this.saveTimeout)
            return;
        this.saveTimeout = setTimeout(async () => {
            this.saveTimeout = null;
            await this.flushToDisk();
        }, 2000);
    }
    /**
     * Serializes and writes usage metrics to disk using atomic temp file renaming.
     */
    async flushToDisk() {
        try {
            const dir = path.dirname(this.usagePath);
            await fs_1.promises.mkdir(dir, { recursive: true });
            const tempPath = `${this.usagePath}.${Date.now()}.${Math.random().toString(36).substring(2, 7)}.tmp`;
            await fs_1.promises.writeFile(tempPath, JSON.stringify(this.usage, null, 2), 'utf-8');
            await fs_1.promises.rename(tempPath, this.usagePath);
        }
        catch {
            // Fail silently
        }
    }
    recordAccess(filePath) {
        const absPath = path.resolve(filePath);
        const entry = this.usage[absPath] || { accessCount: 0, lastAccessed: '' };
        entry.accessCount++;
        entry.lastAccessed = new Date().toISOString();
        this.usage[absPath] = entry;
        this.scheduleSave();
    }
    getUsage(filePath) {
        const absPath = path.resolve(filePath);
        return this.usage[absPath] || null;
    }
    async clear() {
        this.usage = {};
        await this.flushToDisk();
    }
}
exports.UsageTracker = UsageTracker;
