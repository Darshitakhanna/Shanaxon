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
exports.ImportGraph = void 0;
const path = __importStar(require("path"));
const fs_1 = require("fs");
const languageRegistry_1 = require("./languageRegistry");
class ImportGraph {
    // Map of absolute filePath -> Set of absolute imported filePaths
    graph = new Map();
    parser;
    constructor(parser) {
        this.parser = parser;
    }
    /**
     * Clears the dependency graph.
     */
    clear() {
        this.graph.clear();
    }
    /**
     * Parses a file, extracts its imports/require statements, and updates the dependency graph.
     */
    async parseFileImports(filePath, code, loadedLanguages) {
        const absPath = path.resolve(filePath);
        const langInfo = (0, languageRegistry_1.getLanguageInfoForFile)(filePath);
        if (!langInfo)
            return;
        const language = loadedLanguages.get(langInfo.grammarName);
        if (!language)
            return;
        this.parser.setLanguage(language);
        const tree = this.parser.parse(code);
        if (!tree)
            return;
        const imports = new Set();
        const fileDir = path.dirname(absPath);
        const traverse = (node) => {
            const type = node.type;
            if (type === 'import_statement') {
                for (let i = 0; i < node.childCount; i++) {
                    const child = node.child(i);
                    if (child.type === 'string') {
                        const rawPath = child.text.replace(/['"]/g, '');
                        imports.add(rawPath);
                    }
                }
            }
            else if (type === 'call_expression') {
                const funcNode = node.child(0);
                const argsNode = node.child(1);
                if (funcNode && funcNode.text === 'require' && argsNode && argsNode.type === 'arguments') {
                    for (let i = 0; i < argsNode.childCount; i++) {
                        const arg = argsNode.child(i);
                        if (arg.type === 'string') {
                            const rawPath = arg.text.replace(/['"]/g, '');
                            imports.add(rawPath);
                        }
                    }
                }
            }
            for (let i = 0; i < node.childCount; i++) {
                traverse(node.child(i));
            }
        };
        traverse(tree.rootNode);
        const resolvedImports = new Set();
        for (const rawPath of imports) {
            if (rawPath.startsWith('.')) {
                const resolvedBase = path.resolve(fileDir, rawPath);
                const possibleExtensions = ['.ts', '.tsx', '.js', '.jsx', '.py', '.go', '.rs'];
                const currentExt = path.extname(rawPath).toLowerCase();
                if (possibleExtensions.includes(currentExt)) {
                    resolvedImports.add(resolvedBase);
                }
                else {
                    for (const ext of possibleExtensions) {
                        resolvedImports.add(resolvedBase + ext);
                    }
                }
            }
        }
        if (resolvedImports.size > 0) {
            this.graph.set(absPath, resolvedImports);
        }
    }
    /**
     * Retrieves the 1-hop dependencies of a file that exist in the workspace.
     */
    async getDirectDependencies(filePath) {
        const absPath = path.resolve(filePath);
        const deps = this.graph.get(absPath);
        if (!deps)
            return [];
        const activeDeps = [];
        for (const dep of deps) {
            try {
                const stat = await fs_1.promises.stat(dep);
                if (stat.isFile()) {
                    activeDeps.push(dep);
                }
            }
            catch { }
        }
        return activeDeps;
    }
    /**
     * Builds reverse dependency map: targetFilePath -> Set of source filePaths that import target.
     */
    buildReverseGraph() {
        const reverseGraph = new Map();
        for (const [source, targets] of this.graph.entries()) {
            for (const target of targets) {
                let sources = reverseGraph.get(target);
                if (!sources) {
                    sources = new Set();
                    reverseGraph.set(target, sources);
                }
                sources.add(source);
            }
        }
        return reverseGraph;
    }
    /**
     * Returns all files within N hops of forward dependencies (what this file imports).
     */
    getNHopDependencies(filePath, maxHops = 3) {
        const absPath = path.resolve(filePath);
        const result = new Map();
        const visited = new Set([absPath]);
        let currentLevel = [absPath];
        for (let hop = 1; hop <= maxHops; hop++) {
            const nextLevel = [];
            for (const node of currentLevel) {
                const targets = this.graph.get(node);
                if (targets) {
                    for (const target of targets) {
                        if (!visited.has(target)) {
                            visited.add(target);
                            nextLevel.push(target);
                        }
                    }
                }
            }
            if (nextLevel.length === 0)
                break;
            result.set(hop, nextLevel);
            currentLevel = nextLevel;
        }
        return result;
    }
    /**
     * Returns all files within N hops of reverse dependencies (what files import this file).
     */
    getReverseDependencies(filePath, maxHops = 3) {
        const absPath = path.resolve(filePath);
        const reverseGraph = this.buildReverseGraph();
        const result = new Map();
        const visited = new Set([absPath]);
        let currentLevel = [absPath];
        for (let hop = 1; hop <= maxHops; hop++) {
            const nextLevel = [];
            for (const node of currentLevel) {
                const sources = reverseGraph.get(node);
                if (sources) {
                    for (const source of sources) {
                        if (!visited.has(source)) {
                            visited.add(source);
                            nextLevel.push(source);
                        }
                    }
                }
            }
            if (nextLevel.length === 0)
                break;
            result.set(hop, nextLevel);
            currentLevel = nextLevel;
        }
        return result;
    }
    /**
     * Computes the full Blast Radius for a file modification.
     */
    getBlastRadius(filePath, maxHops = 3) {
        const absPath = path.resolve(filePath);
        const forwardDeps = this.getNHopDependencies(absPath, maxHops);
        const reverseDeps = this.getReverseDependencies(absPath, maxHops);
        const affectedSet = new Set();
        for (const files of forwardDeps.values()) {
            for (const f of files)
                affectedSet.add(f);
        }
        for (const files of reverseDeps.values()) {
            for (const f of files)
                affectedSet.add(f);
        }
        const totalAffectedFiles = affectedSet.size;
        let riskLevel = 'low';
        if (totalAffectedFiles > 15)
            riskLevel = 'critical';
        else if (totalAffectedFiles > 7)
            riskLevel = 'high';
        else if (totalAffectedFiles > 2)
            riskLevel = 'medium';
        return {
            targetFile: absPath,
            forwardDeps,
            reverseDeps,
            totalAffectedFiles,
            riskLevel,
        };
    }
    /**
     * Returns all known file node paths in the dependency graph.
     */
    getAllNodes() {
        const nodes = new Set();
        for (const [source, targets] of this.graph.entries()) {
            nodes.add(source);
            for (const target of targets) {
                nodes.add(target);
            }
        }
        return nodes;
    }
    /**
     * Computes the in-degree count (how many files import each file).
     */
    getInDegreeMap() {
        const inDegrees = new Map();
        for (const node of this.getAllNodes()) {
            inDegrees.set(node, 0);
        }
        for (const [, targets] of this.graph.entries()) {
            for (const target of targets) {
                inDegrees.set(target, (inDegrees.get(target) || 0) + 1);
            }
        }
        return inDegrees;
    }
    /**
     * Returns a map of source file -> Set of imported target files (out-edges).
     */
    getOutEdgesMap() {
        return this.graph;
    }
}
exports.ImportGraph = ImportGraph;
