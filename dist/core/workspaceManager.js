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
exports.WorkspaceManager = void 0;
const path = __importStar(require("path"));
const guardrails_1 = require("./guardrails");
/**
 * Manages multiple workspace roots in polyrepo or monorepo environments.
 * Validates path traversal guardrails across all registered workspaces.
 */
class WorkspaceManager {
    primaryRoot;
    workspaces = [];
    constructor(primaryRoot, configuredWorkspaces = []) {
        this.primaryRoot = path.resolve(primaryRoot);
        this.workspaces = [
            this.primaryRoot,
            ...configuredWorkspaces.map((w) => path.resolve(this.primaryRoot, w)),
        ];
    }
    /**
     * Finds the matching workspace root directory for a given file path.
     */
    findWorkspaceForFile(filePath) {
        const absPath = path.resolve(filePath);
        for (const root of this.workspaces) {
            const rel = path.relative(root, absPath);
            if (!rel.startsWith('..') && !path.isAbsolute(rel)) {
                return root;
            }
        }
        if (path.isAbsolute(absPath)) {
            return absPath;
        }
        return this.primaryRoot;
    }
    /**
     * Validates if a file resides within any of the configured workspaces or valid absolute paths.
     */
    async validateFileAccess(filePath) {
        const absPath = path.resolve(filePath);
        for (const root of this.workspaces) {
            const isValid = await (0, guardrails_1.validatePath)(absPath, root);
            if (isValid) {
                return root;
            }
        }
        const isValidTarget = await (0, guardrails_1.validatePath)(absPath, absPath);
        if (isValidTarget) {
            return absPath;
        }
        return null;
    }
    getWorkspaceRoots() {
        return this.workspaces;
    }
}
exports.WorkspaceManager = WorkspaceManager;
