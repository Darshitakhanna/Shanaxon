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
exports.QueryAdapter = void 0;
const path = __importStar(require("path"));
/**
 * Extracts key symbols and file paths mentioned in an active user prompt query
 * and resolves corresponding workspace files to temporarily pin at full fidelity ('normal' tier).
 */
class QueryAdapter {
    /**
     * Tokenizes user prompt, identifies symbols/filenames, and resolves matching workspace files.
     */
    resolveQueryAdaptivePins(activePrompt, workspaceFiles) {
        if (!activePrompt || !activePrompt.trim()) {
            return { extractedSymbols: [], pinnedFiles: [] };
        }
        // 1. Extract potential code symbols (words, camelCase, snake_case, identifiers, file basenames)
        const rawTokens = activePrompt.match(/[a-zA-Z_0-9./\\]+/g) || [];
        const extractedSymbols = new Set();
        for (const token of rawTokens) {
            if (token.length >= 3) {
                extractedSymbols.add(token.toLowerCase());
                // Handle camelCase splitting (e.g. authService -> auth, service)
                const camelParts = token.replace(/([a-z])([A-Z])/g, '$1 $2').split(' ');
                if (camelParts.length > 1) {
                    camelParts.forEach(p => p.length >= 3 && extractedSymbols.add(p.toLowerCase()));
                }
            }
        }
        // 2. Match symbols against workspace files
        const pinnedFilesSet = new Set();
        for (const file of workspaceFiles) {
            const absPath = path.resolve(file);
            const baseName = path.basename(absPath).toLowerCase();
            const baseNameNoExt = path.basename(absPath, path.extname(absPath)).toLowerCase();
            const relPath = file.toLowerCase().replace(/\\/g, '/');
            // Check if any extracted symbol matches file basename or path segment
            for (const symbol of extractedSymbols) {
                if (baseName === symbol ||
                    baseNameNoExt === symbol ||
                    relPath.includes(symbol)) {
                    pinnedFilesSet.add(absPath);
                    break;
                }
            }
        }
        return {
            extractedSymbols: Array.from(extractedSymbols),
            pinnedFiles: Array.from(pinnedFilesSet)
        };
    }
}
exports.QueryAdapter = QueryAdapter;
