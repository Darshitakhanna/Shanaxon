"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.PlatformAdapter = void 0;
/**
 * Detects the runtime environment and provides platform-specific transports and presets.
 */
class PlatformAdapter {
    static detectPlatform() {
        const env = process.env;
        if (env.CLAUDE_CODE || env.CLAUDE_DESKTOP) {
            return {
                platform: 'claude-code',
                displayName: 'Claude Code / Claude Desktop',
                recommendedTransport: 'stdio',
                presetTier: 'aggressive'
            };
        }
        if (env.ANTIGRAVITY || env.GEMINI_IDE) {
            return {
                platform: 'antigravity',
                displayName: 'Antigravity AI Agent Platform',
                recommendedTransport: 'stdio',
                presetTier: 'aggressive'
            };
        }
        if (env.KIRO_SESSION) {
            return {
                platform: 'kiro',
                displayName: 'Kiro AI Coding Environment',
                recommendedTransport: 'http',
                defaultPort: 3334,
                presetTier: 'medium'
            };
        }
        if (env.OPENCODE_ENV) {
            return {
                platform: 'opencode',
                displayName: 'OpenCode Agent Environment',
                recommendedTransport: 'stdio',
                presetTier: 'medium'
            };
        }
        if (env.GEMINI_CLI) {
            return {
                platform: 'gemini-cli',
                displayName: 'Gemini CLI Coding Assistant',
                recommendedTransport: 'stdio',
                presetTier: 'aggressive'
            };
        }
        if (env.CONTINUE_DEV) {
            return {
                platform: 'continue',
                displayName: 'Continue.dev Context Provider',
                recommendedTransport: 'http',
                defaultPort: 3335,
                presetTier: 'normal'
            };
        }
        return {
            platform: 'generic-mcp',
            displayName: 'Generic Model Context Protocol Client',
            recommendedTransport: 'stdio',
            presetTier: 'aggressive'
        };
    }
}
exports.PlatformAdapter = PlatformAdapter;
