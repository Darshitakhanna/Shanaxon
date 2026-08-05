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
exports.normalizePath = normalizePath;
exports.validatePath = validatePath;
const path = __importStar(require("path"));
const fs_1 = require("fs");
/**
 * Normalizes a raw path string, resolving redundant segments and
 * standardizing on system-native separators (slashes or backslashes).
 */
function normalizePath(rawPath) {
    if (!rawPath)
        return '';
    return path.normalize(rawPath);
}
/**
 * Validates a target path. Ensures:
 * 1. The target path resides within the base directory (preventing directory traversal outside the workspace).
 * 2. The path exists and has valid permissions (readable) using language-level fs abstractions.
 * 3. Does not spawn external processes.
 *
 * @param targetPath Path to validate.
 * @param baseDir Base directory boundary (defaults to process.cwd() or current workspace root).
 */
async function validatePath(targetPath, baseDir) {
    try {
        const resolvedTarget = path.resolve(targetPath);
        const resolvedBase = path.resolve(baseDir || process.cwd());
        // 1. Directory Traversal Guardrail: Ensure target is nested inside base directory
        const relative = path.relative(resolvedBase, resolvedTarget);
        const isInside = relative && !relative.startsWith('..') && !path.isAbsolute(relative);
        // Also check if they are identical (e.g. if target is the base directory itself)
        const isSame = resolvedTarget === resolvedBase;
        if (!isInside && !isSame) {
            return false;
        }
        // 2. Local Permission / Existence Check using fs.promises.stat
        const stats = await fs_1.promises.stat(resolvedTarget);
        // 3. Readability check using fs.promises.access
        await fs_1.promises.access(resolvedTarget, fs_1.promises.constants.R_OK);
        return true;
    }
    catch (error) {
        return false;
    }
}
