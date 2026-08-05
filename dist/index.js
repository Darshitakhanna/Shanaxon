#!/usr/bin/env node
"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const stdio_js_1 = require("@modelcontextprotocol/sdk/server/stdio.js");
const server_1 = require("./server");
async function main() {
    const mcpServer = new server_1.McpCompressionServer();
    const transport = new stdio_js_1.StdioServerTransport();
    await mcpServer.server.connect(transport);
    console.error('Tokenist MCP server running on stdio');
}
main().catch((error) => {
    console.error('Server crashed with error:', error);
    process.exit(1);
});
