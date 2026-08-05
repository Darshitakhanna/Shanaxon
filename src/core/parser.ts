import * as path from 'path';
import * as fs from 'fs';
import Parser from 'web-tree-sitter';
import { getLanguageInfoForFile, LANGUAGE_REGISTRY } from './languageRegistry';
import { getConfig } from './configLoader';

export class CodeCompressionEngine {
  private parser: Parser | null = null;
  private loadedLanguages = new Map<string, Parser.Language>();
  private isInitialized = false;
  private wasmFallbackMode = false;

  public getParser(): Parser | null {
    return this.parser;
  }

  public getLoadedLanguages(): Map<string, Parser.Language> {
    return this.loadedLanguages;
  }

  async init(): Promise<void> {
    if (this.isInitialized) return;

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

      await Parser.init({
        locateFile(scriptName: string) {
          return path.join(resolvedWasmDir, scriptName);
        }
      });

      this.parser = new Parser();

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

      for (const key of Object.keys(LANGUAGE_REGISTRY)) {
        const info = LANGUAGE_REGISTRY[key];
        if (!this.loadedLanguages.has(info.grammarName)) {
          const langPath = path.join(resolvedWasmsDir, info.wasmFile);
          if (fs.existsSync(langPath)) {
            try {
              const lang = await Parser.Language.load(langPath);
              this.loadedLanguages.set(info.grammarName, lang);
            } catch {
              // Ignore single language load failures
            }
          }
        }
      }
    } catch {
      // WASM load failure fallback mode: switch gracefully to regex fallback
      this.wasmFallbackMode = true;
    } finally {
      this.isInitialized = true;
    }
  }

  async compress(code: string, filePath: string, tier: 'normal' | 'medium' | 'aggressive'): Promise<string> {
    if (!this.isInitialized) {
      await this.init();
    }

    if (this.wasmFallbackMode || !this.parser) {
      return this.fallbackCompress(code, tier);
    }

    // Resolve grammar using languageRegistry
    const langInfo = getLanguageInfoForFile(filePath);
    let language: Parser.Language | undefined;
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
        const replacements: { start: number; end: number; text: string }[] = [];
        const cleanComments = (node: Parser.SyntaxNode) => {
          if (node.type.includes('comment') && this.isLicenseHeader(node)) {
            replacements.push({ start: node.startIndex, end: node.endIndex, text: '' });
          }
          for (let i = 0; i < node.childCount; i++) {
            cleanComments(node.child(i)!);
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

      const replacements: { start: number; end: number; text: string }[] = [];

      // Helper to check if a node is a license header
      const isLicense = (node: Parser.SyntaxNode) => this.isLicenseHeader(node);

      // Helper to collect replacements
      const traverse = (node: Parser.SyntaxNode, isTopLevel = false) => {
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
              const config = getConfig();
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
          const isFunctionBlock =
            (type === 'statement_block' &&
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
            let docstringNode: Parser.SyntaxNode | null = null;
            if (node.type === 'block' && node.childCount > 0) {
              const firstChild = node.child(0)!;
              if (firstChild.type === 'expression_statement' && firstChild.childCount > 0 && firstChild.child(0)!.type === 'string') {
                docstringNode = firstChild;
              }
            }

            if (node.childCount >= 2 && node.child(0)!.text === '{' && node.child(node.childCount - 1)!.text === '}') {
              const firstChild = node.child(0)!;
              const lastChild = node.child(node.childCount - 1)!;
              replacements.push({
                start: firstChild.endIndex,
                end: lastChild.startIndex,
                text: ' ... '
              });
            } else if (docstringNode) {
              replacements.push({
                start: docstringNode.endIndex,
                end: node.endIndex,
                text: '\n    ...'
              });
            } else {
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
              const child = node.child(i)!;
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
          const isControlStatement =
            [
              'if_statement', 'for_statement', 'for_in_statement', 'for_of_statement',
              'while_statement', 'do_statement', 'switch_statement', 'try_statement',
              'if_expression', 'for_expression', 'while_expression', 'loop_expression',
              'match_expression', 'expression_switch_statement', 'type_switch_statement',
              'select_statement'
            ].includes(type);

          if (isControlStatement) {
            for (let i = 0; i < node.childCount; i++) {
              const child = node.child(i)!;
              if (child.type === 'statement_block' || child.type === 'block' || child.type === 'switch_body' || child.type === 'switch_block') {
                if (child.childCount >= 2 && child.child(0)!.text === '{' && child.child(child.childCount - 1)!.text === '}') {
                  const first = child.child(0)!;
                  const last = child.child(child.childCount - 1)!;
                  replacements.push({
                    start: first.endIndex,
                    end: last.startIndex,
                    text: ' ... '
                  });
                } else {
                  replacements.push({
                    start: child.startIndex,
                    end: child.endIndex,
                    text: ' ...'
                  });
                }
              } else if (child.type === 'catch_clause') {
                const catchBlock = child.child(child.childCount - 1);
                if (catchBlock && (catchBlock.type === 'statement_block' || catchBlock.type === 'block')) {
                  if (catchBlock.childCount >= 2 && catchBlock.child(0)!.text === '{' && catchBlock.child(catchBlock.childCount - 1)!.text === '}') {
                    const first = catchBlock.child(0)!;
                    const last = catchBlock.child(catchBlock.childCount - 1)!;
                    replacements.push({
                      start: first.endIndex,
                      end: last.startIndex,
                      text: ' ... '
                    });
                  } else {
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
          traverse(node.child(i)!, isChildTopLevel);
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
    } catch {
      return this.fallbackCompress(code, tier);
    }
  }

  private isLicenseHeader(node: Parser.SyntaxNode): boolean {
    if (!node.type.includes('comment')) return false;
    if (node.startIndex > 1500) return false;
    const text = node.text.toLowerCase();
    return (
      text.includes('copyright') ||
      text.includes('license') ||
      text.includes('all rights reserved') ||
      text.includes('authored by')
    );
  }

  private fallbackCompress(code: string, tier: 'normal' | 'medium' | 'aggressive'): string {
    const lines = code.split(/\r?\n/);
    const cleanedLines = lines
      .map((line) => line.trimEnd())
      .filter((line) => line.length > 0);

    if (tier === 'normal') {
      return cleanedLines.join('\n');
    }

    const config = getConfig();
    const preservePatterns = config.preserveCommentPatterns || [];

    const isPreservedComment = (lineText: string): boolean => {
      const trimmed = lineText.trim();
      if (trimmed.startsWith('///') || trimmed.startsWith('/**')) return true;
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
