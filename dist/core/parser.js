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
exports.CodeCompressionEngine = void 0;
const path = __importStar(require("path"));
const fs = __importStar(require("fs"));
const web_tree_sitter_1 = __importDefault(require("web-tree-sitter"));
const languageRegistry_1 = require("./languageRegistry");
const configLoader_1 = require("./configLoader");
class CodeCompressionEngine {
    parser = null;
    loadedLanguages = new Map();
    isInitialized = false;
    wasmFallbackMode = false;
    getParser() {
        return this.parser;
    }
    getLoadedLanguages() {
        return this.loadedLanguages;
    }
    async init() {
        if (this.isInitialized)
            return;
        try {
            // Multi-tier path resolution for web-tree-sitter.wasm
            const candidateWasmDirs = [
                path.resolve(__dirname, '../../node_modules/web-tree-sitter'),
                path.resolve(__dirname, '../node_modules/web-tree-sitter'),
                path.resolve(__dirname, './wasm'),
                process.cwd()
            ];
            let resolvedWasmDir = candidateWasmDirs[0];
            for (const dir of candidateWasmDirs) {
                if (fs.existsSync(path.join(dir, 'tree-sitter.wasm'))) {
                    resolvedWasmDir = dir;
                    break;
                }
            }
            await web_tree_sitter_1.default.init({
                locateFile(scriptName) {
                    return path.join(resolvedWasmDir, scriptName);
                }
            });
            this.parser = new web_tree_sitter_1.default();
            // Multi-tier resolution for tree-sitter-wasms
            const candidateWasmsDirs = [
                path.resolve(__dirname, '../../node_modules/tree-sitter-wasms/out'),
                path.resolve(__dirname, '../node_modules/tree-sitter-wasms/out'),
                path.resolve(__dirname, './wasm')
            ];
            let resolvedWasmsDir = candidateWasmsDirs[0];
            for (const dir of candidateWasmsDirs) {
                if (fs.existsSync(dir)) {
                    resolvedWasmsDir = dir;
                    break;
                }
            }
            for (const key of Object.keys(languageRegistry_1.LANGUAGE_REGISTRY)) {
                const info = languageRegistry_1.LANGUAGE_REGISTRY[key];
                if (!this.loadedLanguages.has(info.grammarName)) {
                    const langPath = path.join(resolvedWasmsDir, info.wasmFile);
                    if (fs.existsSync(langPath)) {
                        try {
                            const lang = await web_tree_sitter_1.default.Language.load(langPath);
                            this.loadedLanguages.set(info.grammarName, lang);
                        }
                        catch {
                            // Ignore single language load failures
                        }
                    }
                }
            }
        }
        catch {
            // WASM load failure fallback mode: switch gracefully to regex fallback
            this.wasmFallbackMode = true;
        }
        finally {
            this.isInitialized = true;
        }
    }
    async compress(code, filePath, tier) {
        if (!this.isInitialized) {
            await this.init();
        }
        if (this.wasmFallbackMode || !this.parser) {
            return this.fallbackCompress(code, tier);
        }
        // Resolve grammar using languageRegistry
        const langInfo = (0, languageRegistry_1.getLanguageInfoForFile)(filePath);
        let language;
        if (langInfo) {
            language = this.loadedLanguages.get(langInfo.grammarName);
        }
        if (!language) {
            return this.fallbackCompress(code, tier);
        }
        this.parser.setLanguage(language);
        try {
            const tree = this.parser.parse(code);
            if (!tree) {
                return this.fallbackCompress(code, tier);
            }
            const root = tree.rootNode;
            if (tier === 'normal') {
                // Strip license headers even in normal tier, but keep all code lines
                const replacements = [];
                const cleanComments = (node) => {
                    if (node.type.includes('comment') && this.isLicenseHeader(node)) {
                        replacements.push({ start: node.startIndex, end: node.endIndex, text: '' });
                    }
                    for (let i = 0; i < node.childCount; i++) {
                        cleanComments(node.child(i));
                    }
                };
                cleanComments(root);
                replacements.sort((a, b) => b.start - a.start);
                let cleanedCode = code;
                for (const r of replacements) {
                    cleanedCode = cleanedCode.slice(0, r.start) + r.text + cleanedCode.slice(r.end);
                }
                return this.fallbackCompress(cleanedCode, 'normal');
            }
            const replacements = [];
            // Helper to check if a node is a license header
            const isLicense = (node) => this.isLicenseHeader(node);
            // Helper to collect replacements
            const traverse = (node, isTopLevel = false) => {
                const type = node.type;
                // Smart Comment Handling
                if (type.includes('comment')) {
                    if (isLicense(node)) {
                        replacements.push({
                            start: node.startIndex,
                            end: node.endIndex,
                            text: ''
                        });
                        return;
                    }
                    if (tier === 'medium' || tier === 'aggressive') {
                        // Keep JSDoc (/** ... */) or Rust/C# triple-slash (/// ...)
                        const isDocComment = node.text.startsWith('/**') || node.text.startsWith('///');
                        if (!isDocComment) {
                            const config = (0, configLoader_1.getConfig)();
                            const preservePatterns = config.preserveCommentPatterns || [];
                            const isPreserved = preservePatterns.some((pattern) => node.text.includes(pattern));
                            if (!isPreserved) {
                                replacements.push({
                                    start: node.startIndex,
                                    end: node.endIndex,
                                    text: ''
                                });
                            }
                        }
                    }
                    return;
                }
                if (tier === 'aggressive') {
                    // Collapse function/method bodies
                    const isFunctionBlock = (type === 'statement_block' &&
                        (node.parent?.type === 'function_declaration' ||
                            node.parent?.type === 'method_definition' ||
                            node.parent?.type === 'function_expression' ||
                            node.parent?.type === 'arrow_function')) ||
                        (type === 'block' &&
                            (node.parent?.type === 'function_definition' ||
                                node.parent?.type === 'function_declaration' ||
                                node.parent?.type === 'method_declaration' ||
                                node.parent?.type === 'function_item' ||
                                node.parent?.type === 'method_declaration' ||
                                node.parent?.type === 'constructor_declaration')) ||
                        (type === 'constructor_body');
                    if (isFunctionBlock) {
                        let docstringNode = null;
                        if (node.type === 'block' && node.childCount > 0) {
                            const firstChild = node.child(0);
                            if (firstChild.type === 'expression_statement' && firstChild.childCount > 0 && firstChild.child(0).type === 'string') {
                                docstringNode = firstChild;
                            }
                        }
                        if (node.childCount >= 2 && node.child(0).text === '{' && node.child(node.childCount - 1).text === '}') {
                            const firstChild = node.child(0);
                            const lastChild = node.child(node.childCount - 1);
                            replacements.push({
                                start: firstChild.endIndex,
                                end: lastChild.startIndex,
                                text: ' ... '
                            });
                        }
                        else if (docstringNode) {
                            replacements.push({
                                start: docstringNode.endIndex,
                                end: node.endIndex,
                                text: '\n    ...'
                            });
                        }
                        else {
                            replacements.push({
                                start: node.startIndex,
                                end: node.endIndex,
                                text: ' ...'
                            });
                        }
                        return;
                    }
                    if (type === 'arrow_function' && node.lastChild && node.lastChild.type !== 'statement_block') {
                        const bodyNode = node.lastChild;
                        replacements.push({
                            start: bodyNode.startIndex,
                            end: bodyNode.endIndex,
                            text: '...'
                        });
                        return;
                    }
                    if (isTopLevel && type === 'lexical_declaration') {
                        let collapsedAny = false;
                        for (let i = 0; i < node.childCount; i++) {
                            const child = node.child(i);
                            if (child.type === 'variable_declarator') {
                                const valueNode = child.child(child.childCount - 1);
                                if (valueNode && (valueNode.type === 'object' || valueNode.type === 'array' || valueNode.type.startsWith('jsx_'))) {
                                    replacements.push({
                                        start: valueNode.startIndex,
                                        end: valueNode.endIndex,
                                        text: valueNode.type === 'array' ? '[...]' : '{...}'
                                    });
                                    collapsedAny = true;
                                }
                            }
                        }
                        if (collapsedAny) {
                            return;
                        }
                    }
                    if (type === 'jsx_element') {
                        const openTag = node.child(0);
                        const closeTag = node.child(node.childCount - 1);
                        if (openTag && closeTag && openTag !== closeTag) {
                            replacements.push({
                                start: openTag.endIndex,
                                end: closeTag.startIndex,
                                text: '...'
                            });
                        }
                        return;
                    }
                    if (type === 'jsx_self_closing_element') {
                        return;
                    }
                }
                if (tier === 'medium') {
                    const isControlStatement = [
                        'if_statement', 'for_statement', 'for_in_statement', 'for_of_statement',
                        'while_statement', 'do_statement', 'switch_statement', 'try_statement',
                        'if_expression', 'for_expression', 'while_expression', 'loop_expression',
                        'match_expression', 'expression_switch_statement', 'type_switch_statement',
                        'select_statement'
                    ].includes(type);
                    if (isControlStatement) {
                        for (let i = 0; i < node.childCount; i++) {
                            const child = node.child(i);
                            if (child.type === 'statement_block' || child.type === 'block' || child.type === 'switch_body' || child.type === 'switch_block') {
                                if (child.childCount >= 2 && child.child(0).text === '{' && child.child(child.childCount - 1).text === '}') {
                                    const first = child.child(0);
                                    const last = child.child(child.childCount - 1);
                                    replacements.push({
                                        start: first.endIndex,
                                        end: last.startIndex,
                                        text: ' ... '
                                    });
                                }
                                else {
                                    replacements.push({
                                        start: child.startIndex,
                                        end: child.endIndex,
                                        text: ' ...'
                                    });
                                }
                            }
                            else if (child.type === 'catch_clause') {
                                const catchBlock = child.child(child.childCount - 1);
                                if (catchBlock && (catchBlock.type === 'statement_block' || catchBlock.type === 'block')) {
                                    if (catchBlock.childCount >= 2 && catchBlock.child(0).text === '{' && catchBlock.child(catchBlock.childCount - 1).text === '}') {
                                        const first = catchBlock.child(0);
                                        const last = catchBlock.child(catchBlock.childCount - 1);
                                        replacements.push({
                                            start: first.endIndex,
                                            end: last.startIndex,
                                            text: ' ... '
                                        });
                                    }
                                    else {
                                        replacements.push({
                                            start: catchBlock.startIndex,
                                            end: catchBlock.endIndex,
                                            text: ' ...'
                                        });
                                    }
                                }
                            }
                        }
                    }
                }
                const count = node.childCount;
                const isChildTopLevel = type === 'program' || type === 'export_statement';
                for (let i = 0; i < count; i++) {
                    traverse(node.child(i), isChildTopLevel);
                }
            };
            traverse(root, true);
            replacements.sort((a, b) => b.start - a.start);
            let compressedCode = code;
            for (const r of replacements) {
                if (r.start >= 0 && r.end <= compressedCode.length && r.start <= r.end) {
                    compressedCode =
                        compressedCode.slice(0, r.start) + r.text + compressedCode.slice(r.end);
                }
            }
            return this.fallbackCompress(compressedCode, 'normal');
        }
        catch {
            return this.fallbackCompress(code, tier);
        }
    }
    isLicenseHeader(node) {
        if (!node.type.includes('comment'))
            return false;
        if (node.startIndex > 1500)
            return false;
        const text = node.text.toLowerCase();
        return (text.includes('copyright') ||
            text.includes('license') ||
            text.includes('all rights reserved') ||
            text.includes('authored by'));
    }
    fallbackCompress(code, tier) {
        const lines = code.split(/\r?\n/);
        const cleanedLines = lines
            .map((line) => line.trimEnd())
            .filter((line) => line.length > 0);
        if (tier === 'normal') {
            return cleanedLines.join('\n');
        }
        const config = (0, configLoader_1.getConfig)();
        const preservePatterns = config.preserveCommentPatterns || [];
        const isPreservedComment = (lineText) => {
            const trimmed = lineText.trim();
            if (trimmed.startsWith('///') || trimmed.startsWith('/**'))
                return true;
            return preservePatterns.some((pattern) => trimmed.includes(pattern));
        };
        if (tier === 'medium') {
            const filtered = cleanedLines.filter((line) => {
                const trimmed = line.trim();
                if (trimmed.startsWith('//') || trimmed.startsWith('#')) {
                    return isPreservedComment(trimmed);
                }
                return true;
            });
            return filtered.join('\n');
        }
        // Aggressive tier: filter comments + strip debug logging statements
        const debugRegex = /^\s*(console\.(log|debug|trace)|print\(|fmt\.Print)/;
        const filtered = cleanedLines.filter((line) => {
            const trimmed = line.trim();
            if (trimmed.startsWith('//') || trimmed.startsWith('#')) {
                return isPreservedComment(trimmed);
            }
            if (debugRegex.test(trimmed)) {
                return false;
            }
            return true;
        });
        return filtered.join('\n');
    }
}
exports.CodeCompressionEngine = CodeCompressionEngine;
