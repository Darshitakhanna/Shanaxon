"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.SmartCrusher = void 0;
const tokenizer_1 = require("./tokenizer");
/**
 * Content-Type-Aware Compression Engine.
 * Intelligently compresses non-code context (JSON API responses, terminal logs, stack traces).
 * Reduces non-code token volume by 60–90% while keeping errors and critical schema fields.
 */
class SmartCrusher {
    /**
     * Main entry point: auto-detects content type and applies the optimal crusher.
     */
    crush(input) {
        const contentType = this.detectContentType(input);
        let crushed = input;
        switch (contentType) {
            case 'json':
                crushed = this.crushJson(input);
                break;
            case 'stacktrace':
                crushed = this.crushStackTrace(input);
                break;
            case 'terminal':
                crushed = this.crushTerminal(input);
                break;
            case 'log':
                crushed = this.crushLog(input);
                break;
            default:
                crushed = this.crushGeneric(input);
                break;
        }
        const originalTokens = tokenizer_1.Tokenizer.countTokens(input);
        const crushedTokens = tokenizer_1.Tokenizer.countTokens(crushed);
        const savingsPct = originalTokens > 0
            ? parseFloat((((originalTokens - crushedTokens) / originalTokens) * 100).toFixed(2))
            : 0;
        return {
            crushed,
            contentType,
            originalTokens,
            crushedTokens,
            savingsPct,
        };
    }
    /**
     * Auto-detects whether input is JSON, Stack Trace, Terminal Dump, or Log file.
     */
    detectContentType(input) {
        const trimmed = input.trim();
        // Check JSON
        if ((trimmed.startsWith('{') && trimmed.endsWith('}')) || (trimmed.startsWith('[') && trimmed.endsWith(']'))) {
            try {
                JSON.parse(trimmed);
                return 'json';
            }
            catch { }
        }
        // Check Stack Trace
        if (/(?:Error|Exception|Traceback):[^\n]+\n\s+at /i.test(input) || /File "[^"]+", line \d+/i.test(input)) {
            return 'stacktrace';
        }
        // Check Terminal Dump
        if (input.includes('npm ERR!') ||
            input.includes('yarn run') ||
            input.includes('webpack') ||
            input.includes('vite v') ||
            /\[\d{1,2}:\d{2}:\d{2}\]/.test(input) ||
            /\x1b\[[0-9;]*m/.test(input)) {
            return 'terminal';
        }
        // Check Log
        if (/(?:INFO|DEBUG|WARN|ERROR|FATAL|TRACE)[\s:]/i.test(input)) {
            return 'log';
        }
        return 'unknown';
    }
    /**
     * JSON Crusher:
     * - Truncates strings >150 chars
     * - Collapses arrays >3 items to first 2 items + count summary
     * - Prunes null / empty object properties
     * - Preserves critical keys: 'id', 'error', 'status', 'code', 'type', 'message', 'key', 'name'
     */
    crushJson(input) {
        try {
            const parsed = JSON.parse(input);
            const pruned = this.pruneJsonObject(parsed);
            return JSON.stringify(pruned, null, 2);
        }
        catch {
            return input;
        }
    }
    pruneJsonObject(obj, depth = 0) {
        if (obj === null || obj === undefined)
            return undefined;
        if (typeof obj === 'string') {
            if (obj.length > 150) {
                return `${obj.substring(0, 100)}... [${obj.length - 100} chars truncated]`;
            }
            return obj;
        }
        if (typeof obj !== 'object')
            return obj;
        if (Array.isArray(obj)) {
            if (obj.length > 3 && depth > 0) {
                const firstTwo = obj.slice(0, 2).map((item) => this.pruneJsonObject(item, depth + 1));
                firstTwo.push(`... [${obj.length - 2} additional items collapsed]`);
                return firstTwo;
            }
            return obj.map((item) => this.pruneJsonObject(item, depth + 1));
        }
        const result = {};
        const criticalKeys = new Set(['id', '_id', 'error', 'errors', 'status', 'statusCode', 'code', 'type', 'message', 'name', 'key', 'success']);
        for (const [key, val] of Object.entries(obj)) {
            if (val === null || val === undefined || val === '')
                continue;
            const isCritical = criticalKeys.has(key.toLowerCase());
            if (depth > 2 && !isCritical && typeof val === 'object') {
                result[key] = '[Object]';
                continue;
            }
            const prunedVal = this.pruneJsonObject(val, depth + 1);
            if (prunedVal !== undefined) {
                result[key] = prunedVal;
            }
        }
        return result;
    }
    /**
     * Log Crusher:
     * - Deduplicates consecutive duplicate log lines
     * - Strips ANSI codes
     * - Preserves ERROR / WARN / FATAL lines fully
     * - Summarizes repetitive INFO / DEBUG lines
     */
    crushLog(input) {
        const cleanInput = this.stripAnsi(input);
        const lines = cleanInput.split('\n');
        const result = [];
        let prevLine = '';
        let dupCount = 0;
        for (const line of lines) {
            const trimmed = line.trim();
            if (!trimmed)
                continue;
            const isImportant = /(?:ERROR|WARN|FATAL|EXCEPTION|CRITICAL)/i.test(trimmed);
            if (trimmed === prevLine && !isImportant) {
                dupCount++;
                continue;
            }
            if (dupCount > 0) {
                result.push(`  └─ [Repeated ${dupCount} times]`);
                dupCount = 0;
            }
            result.push(line);
            prevLine = trimmed;
        }
        if (dupCount > 0) {
            result.push(`  └─ [Repeated ${dupCount} times]`);
        }
        return result.join('\n');
    }
    /**
     * Terminal Crusher:
     * - Strips ANSI color codes and progress spinners
     * - Collapses verbose build tool dumps (npm, webpack, vite)
     */
    crushTerminal(input) {
        let text = this.stripAnsi(input);
        // Remove spinner lines / carriage return progress overwrites
        text = text.replace(/\r[^\n]*/g, '');
        const lines = text.split('\n').filter((l) => l.trim().length > 0);
        const output = [];
        let inVerboseDump = false;
        let verboseCount = 0;
        for (const line of lines) {
            const isError = /(?:ERR!|Error:|FAILED|Exception)/i.test(line);
            const isSummary = /(?:built in|timing|completed|success|packages|vulnerability)/i.test(line);
            if (isError || isSummary) {
                if (inVerboseDump && verboseCount > 0) {
                    output.push(`[... ${verboseCount} lines of verbose terminal output collapsed ...]`);
                    inVerboseDump = false;
                    verboseCount = 0;
                }
                output.push(line);
            }
            else if (line.includes('http://') || line.includes('https://') || line.includes('Local:')) {
                output.push(line);
            }
            else {
                inVerboseDump = true;
                verboseCount++;
            }
        }
        if (inVerboseDump && verboseCount > 0) {
            output.push(`[... ${verboseCount} lines of verbose terminal output collapsed ...]`);
        }
        return output.join('\n');
    }
    /**
     * Stack Trace Crusher:
     * Keeps error message + first 3 stack frames + last stack frame.
     */
    crushStackTrace(input) {
        const lines = input.split('\n');
        if (lines.length <= 6)
            return input;
        const errorLine = lines[0];
        const frameLines = lines.slice(1).filter((l) => l.trim().startsWith('at ') || l.trim().startsWith('File '));
        if (frameLines.length <= 4)
            return input;
        const firstThree = frameLines.slice(0, 3);
        const lastOne = frameLines[frameLines.length - 1];
        const collapsedCount = frameLines.length - 4;
        return [
            errorLine,
            ...firstThree,
            `    ... [${collapsedCount} internal stack frames collapsed]`,
            lastOne,
        ].join('\n');
    }
    crushGeneric(input) {
        return this.crushLog(input);
    }
    stripAnsi(str) {
        return str.replace(/\x1b\[[0-9;]*[a-zA-Z]/g, '');
    }
}
exports.SmartCrusher = SmartCrusher;
