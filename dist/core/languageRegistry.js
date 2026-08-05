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
exports.LANGUAGE_REGISTRY = void 0;
exports.getLanguageInfoForFile = getLanguageInfoForFile;
const path = __importStar(require("path"));
exports.LANGUAGE_REGISTRY = {
    '.ts': { grammarName: 'typescript', wasmFile: 'tree-sitter-typescript.wasm' },
    '.tsx': { grammarName: 'tsx', wasmFile: 'tree-sitter-tsx.wasm' },
    '.js': { grammarName: 'javascript', wasmFile: 'tree-sitter-javascript.wasm' },
    '.jsx': { grammarName: 'javascript', wasmFile: 'tree-sitter-javascript.wasm' },
    '.py': { grammarName: 'python', wasmFile: 'tree-sitter-python.wasm' },
    '.go': { grammarName: 'go', wasmFile: 'tree-sitter-go.wasm' },
    '.rs': { grammarName: 'rust', wasmFile: 'tree-sitter-rust.wasm' },
    '.java': { grammarName: 'java', wasmFile: 'tree-sitter-java.wasm' },
    '.cs': { grammarName: 'c_sharp', wasmFile: 'tree-sitter-c_sharp.wasm' }
};
/**
 * Returns the language registry info based on file path extension.
 */
function getLanguageInfoForFile(filePath) {
    const ext = path.extname(filePath).toLowerCase();
    return exports.LANGUAGE_REGISTRY[ext] || null;
}
