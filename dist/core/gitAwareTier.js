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
exports.getGitAwareTier = getGitAwareTier;
const child_process_1 = require("child_process");
const path = __importStar(require("path"));
function runGitCommand(cmd, cwd) {
    return new Promise((resolve) => {
        (0, child_process_1.exec)(cmd, { cwd }, (err, stdout) => {
            if (err) {
                resolve('');
            }
            else {
                resolve(stdout.trim());
            }
        });
    });
}
/**
 * Dynamically resolves file tier based on modification history.
 * - Recently modified/uncommitted files get full detail (normal).
 * - Untouched files (> 30 days) get optimized detail (aggressive).
 */
async function getGitAwareTier(filePath, workspaceRoot, defaultTier) {
    try {
        const absPath = path.resolve(filePath);
        const relPath = path.relative(workspaceRoot, absPath).replace(/\\/g, '/');
        // 1. Check if uncommitted, modified, or staged
        const statusOutput = await runGitCommand(`git status --porcelain "${relPath}"`, workspaceRoot);
        if (statusOutput.length > 0) {
            return 'normal';
        }
        // 2. Check if modified in last 24 hours
        const last24hLog = await runGitCommand(`git log --since="24 hours ago" --name-only --format=format: -- "${relPath}"`, workspaceRoot);
        if (last24hLog.length > 0) {
            return 'normal';
        }
        // 3. Check if modified in last 30 days
        const last30dLog = await runGitCommand(`git log --since="30 days ago" --name-only --format=format: -- "${relPath}"`, workspaceRoot);
        if (last30dLog.length === 0) {
            // Confirm file is tracked to avoid categorizing new files as aggressive
            const isTracked = await runGitCommand(`git ls-files "${relPath}"`, workspaceRoot);
            if (isTracked.length > 0) {
                return 'aggressive';
            }
        }
    }
    catch {
        // Fail silently using fallback
    }
    return defaultTier;
}
