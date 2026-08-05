#!/usr/bin/env node
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { McpCompressionServer } from './server';

async function main() {
  const mcpServer = new McpCompressionServer();
  const transport = new StdioServerTransport();

  await mcpServer.server.connect(transport);
  console.error('Tokenist MCP server running on stdio');
}

main().catch((error) => {
  console.error('Server crashed with error:', error);
  process.exit(1);
});
