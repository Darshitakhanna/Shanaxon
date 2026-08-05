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
exports.detectProject = detectProject;
const path = __importStar(require("path"));
const fs_1 = require("fs");
/**
 * Automatically detects the workspace project type (NodeJS, Go, Rust, Python, Generic)
 * and returns recommended exclude and alwaysInclude paths.
 */
async function detectProject(workspaceRoot) {
    const info = {
        projectType: 'generic',
        excludePatterns: ['**/node_modules/**', '**/.git/**'],
        alwaysInclude: []
    };
    const hasFile = async (fileName) => {
        return fs_1.promises.stat(path.join(workspaceRoot, fileName)).then(s => s.isFile()).catch(() => false);
    };
    if (await hasFile('package.json')) {
        info.projectType = 'nodejs';
        info.excludePatterns = [
            '**/node_modules/**',
            '**/dist/**',
            '**/build/**',
            '**/.next/**',
            '**/.nuxt/**',
            '**/*.test.ts',
            '**/*.spec.ts',
            '**/*.stories.tsx'
        ];
    }
    else if (await hasFile('go.mod')) {
        info.projectType = 'go';
        info.excludePatterns = [
            '**/vendor/**',
            '**/*_test.go'
        ];
    }
    else if (await hasFile('Cargo.toml')) {
        info.projectType = 'rust';
        info.excludePatterns = [
            '**/target/**',
            '**/*.rs.bk'
        ];
    }
    else if (await hasFile('pyproject.toml') ||
        await hasFile('requirements.txt') ||
        await hasFile('setup.py')) {
        info.projectType = 'python';
        info.excludePatterns = [
            '**/__pycache__/**',
            '**/.venv/**',
            '**/venv/**',
            '**/*.pyc',
            '**/.ipynb_checkpoints/**'
        ];
    }
    return info;
}
