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
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.WorkspaceIndexer = void 0;
const path = __importStar(require("path"));
const fs_1 = require("fs");
const ignore_1 = __importDefault(require("ignore"));
const guardrails_1 = require("./guardrails");
const languageRegistry_1 = require("./languageRegistry");
class WorkspaceIndexer {
    workspaceRoot;
    maxDepth;
    maxFiles;
    constructor(workspaceRoot, maxDepth = 8, maxFiles = 5000) {
        this.workspaceRoot = path.resolve(workspaceRoot);
        this.maxDepth = maxDepth;
        this.maxFiles = maxFiles;
    }
    /**
     * Crawls the workspace concurrently, respects gitignore and tokenistignore patterns,
     * enforces depth and max file caps to prevent heap OOM crashes in giant monorepos.
     */
    async indexWorkspace(targetDir) {
        const absoluteTarget = path.isAbsolute(targetDir)
            ? path.resolve(targetDir)
            : path.resolve(this.workspaceRoot, targetDir);
        const isValid = await (0, guardrails_1.validatePath)(absoluteTarget, absoluteTarget);
        if (!isValid) {
            throw new Error(`Access Denied: target directory "${targetDir}" is outside the workspace.`);
        }
        const effectiveRoot = absoluteTarget;
        // Initialize gitignore parser
        const ig = (0, ignore_1.default)();
        ig.add([
            'node_modules',
            '.git',
            'dist',
            'build',
            '.gemini',
            'telemetry_ledger.json'
        ]);
        const gitignorePath = path.join(effectiveRoot, '.gitignore');
        try {
            const gitignoreContent = await fs_1.promises.readFile(gitignorePath, 'utf-8');
            ig.add(gitignoreContent);
        }
        catch { }
        for (const ignoreFileName of ['.tokenistignore', '.dharoharignore']) {
            const ignoreFilePath = path.join(effectiveRoot, ignoreFileName);
            try {
                const ignoreContent = await fs_1.promises.readFile(ignoreFilePath, 'utf-8');
                ig.add(ignoreContent);
            }
            catch { }
        }
        const matchedFiles = [];
        const walk = async (currentDir, currentDepth) => {
            if (currentDepth > this.maxDepth || matchedFiles.length >= this.maxFiles) {
                return;
            }
            let entries;
            try {
                entries = await fs_1.promises.readdir(currentDir, { withFileTypes: true });
            }
            catch {
                return;
            }
            const tasks = entries.map(async (entry) => {
                if (matchedFiles.length >= this.maxFiles)
                    return;
                const fullPath = path.join(currentDir, entry.name);
                const relativeToRoot = path.relative(effectiveRoot, fullPath);
                const normalizedRelPath = relativeToRoot.replace(/\\/g, '/');
                const checkPath = entry.isDirectory() ? `${normalizedRelPath}/` : normalizedRelPath;
                if (ig.ignores(checkPath)) {
                    return;
                }
                if (entry.isDirectory()) {
                    await walk(fullPath, currentDepth + 1);
                }
                else if (entry.isFile()) {
                    const langInfo = (0, languageRegistry_1.getLanguageInfoForFile)(fullPath);
                    if (langInfo && matchedFiles.length < this.maxFiles) {
                        matchedFiles.push(fullPath);
                    }
                }
            });
            await Promise.all(tasks);
        };
        await walk(absoluteTarget, 0);
        matchedFiles.sort((a, b) => a.localeCompare(b));
        return matchedFiles;
    }
}
exports.WorkspaceIndexer = WorkspaceIndexer;
