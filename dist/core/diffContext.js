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
exports.getFileDiffContext = getFileDiffContext;
const child_process_1 = require("child_process");
const path = __importStar(require("path"));
const fs = __importStar(require("fs"));
/**
 * Returns only the changed git hunks of a file (with configurable context lines)
 * rather than sending the full file. Safe against missing git CLI binaries & non-git directories.
 */
function getFileDiffContext(filePath, workspaceRoot, contextLines = 10) {
    return new Promise((resolve) => {
        const absPath = path.resolve(filePath);
        const relPath = path.relative(workspaceRoot, absPath).replace(/\\/g, '/');
        const gitDir = path.join(workspaceRoot, '.git');
        if (!fs.existsSync(gitDir)) {
            resolve(`[Tokenist Diff Mode] Git repository uninitialized in workspace.`);
            return;
        }
        const safeContextLines = Math.max(0, Math.floor(Number(contextLines) || 10));
        const args = ['diff', `-U${safeContextLines}`, '--', relPath];
        (0, child_process_1.execFile)('git', args, { cwd: workspaceRoot }, (err, stdout) => {
            if (err) {
                if (err.code === 'ENOENT') {
                    resolve(`[Tokenist Diff Mode] Git executable not found on system PATH.`);
                }
                else {
                    resolve(`[Tokenist Diff Mode] No uncommitted changes detected for: ${relPath}`);
                }
            }
            else if (!stdout || !stdout.trim()) {
                resolve(`[Tokenist Diff Mode] No uncommitted changes detected for: ${relPath}`);
            }
            else {
                resolve(stdout.trim());
            }
        });
    });
}
