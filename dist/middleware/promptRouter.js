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
exports.routePrompt = routePrompt;
const path = __importStar(require("path"));
/**
 * Dynamic Data Swapping Matrix
 * Intercepts query and decides which files should expose full raw code versus compressed signatures.
 * Automatically resolves and tags 1-hop dependency signatures when a target is selected for edits.
 *
 * @param query The user's query/prompt instructions.
 * @param files Collection of files in context with their signatures and raw content.
 * @param getDependencies Optional helper to fetch dependency paths of a given file path.
 */
function routePrompt(query, files, getDependencies) {
    const lowercaseQuery = query.toLowerCase();
    // Action keywords suggesting write/update intents
    const actionKeywords = ['edit', 'write', 'update', 'modify', 'change', 'patch', 'replace', 'fix', 'implement'];
    const hasUpdateIntent = actionKeywords.some((keyword) => lowercaseQuery.includes(keyword));
    // Determine targeted files by checking if the query references the file name/path
    const targetFiles = new Set();
    const dependencyFiles = new Set();
    if (hasUpdateIntent) {
        for (const file of files) {
            const baseName = path.basename(file.filePath).toLowerCase();
            const relativePath = file.filePath.toLowerCase();
            // Check if user query mentions either the relative path or the base name of the file
            if (lowercaseQuery.includes(relativePath) || lowercaseQuery.includes(baseName)) {
                targetFiles.add(file.filePath);
                // Fetch dependencies if helper is provided
                if (getDependencies) {
                    const deps = getDependencies(file.filePath);
                    for (const dep of deps) {
                        if (path.resolve(dep) !== path.resolve(file.filePath)) {
                            dependencyFiles.add(path.resolve(dep));
                        }
                    }
                }
            }
        }
    }
    // Map each file to its output content
    return files.map((file) => {
        const isTarget = targetFiles.has(file.filePath);
        // Check if the current file resolves to any path in the dependencyFiles set
        const isDependency = !isTarget && Array.from(dependencyFiles).some(dep => path.resolve(dep) === path.resolve(file.filePath));
        return {
            filePath: file.filePath,
            content: isTarget ? file.rawCode : file.signatures,
            swapped: isTarget,
            isDependency: isDependency
        };
    });
}
