#!/usr/bin/env node
import * as fs from 'fs';
import * as path from 'path';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { McpCompressionServer } from './server';

function readPackageVersion(): string {
  try {
    const pkgPath = path.resolve(__dirname, '../package.json');
    const parsed = JSON.parse(fs.readFileSync(pkgPath, 'utf-8'));
    return typeof parsed.version === 'string' ? parsed.version : '6.1.0';
  } catch {
    return '6.1.0';
  }
}

function printHelp(version: string): void {
  console.log(`Shanaxon v${version} — Open-Source Local Context Optimization & FinOps MCP Server

Usage:
  shanaxon                         Start the MCP server over stdio (default for IDE/agent clients)
  shanaxon init [--yes | -y]       Generate .shanaxon.json and register workspace MCP configs
  shanaxon benchmark               Run AST compression benchmark against ./src in current workspace
  shanaxon export [options]        Export telemetry_ledger.json (--format json|csv --out <file>)
  shanaxon dashboard [--port N]    Start the local web analytics dashboard (default port: 3333)
  shanaxon --version | -v          Print version and exit
  shanaxon --help | -h             Show this help message and exit
`);
}

function parsePortArg(args: string[], defaultPort = 3333): number {
  for (let i = 0; i < args.length; i++) {
    if (args[i] === '--port' && args[i + 1]) {
      const parsed = Number(args[i + 1]);
      if (Number.isInteger(parsed) && parsed > 0 && parsed <= 65535) return parsed;
    } else if (args[i].startsWith('--port=')) {
      const parsed = Number(args[i].split('=')[1]);
      if (Number.isInteger(parsed) && parsed > 0 && parsed <= 65535) return parsed;
    }
  }
  return defaultPort;
}

async function main(): Promise<void> {
  const args = process.argv.slice(2);
  const cmd = args[0];

  if (cmd === '--version' || cmd === '-v') {
    console.log(readPackageVersion());
    process.exit(0);
  }

  if (cmd === '--help' || cmd === '-h' || cmd === 'help') {
    printHelp(readPackageVersion());
    process.exit(0);
  }

  if (cmd === 'init') {
    const { runInit } = await import('./cli/init');
    await runInit(args.slice(1));
    return;
  }

  if (cmd === 'benchmark') {
    const { runBenchmarkCli } = await import('./core/benchmarkReal');
    await runBenchmarkCli(process.cwd());
    return;
  }

  if (cmd === 'export') {
    const { runExport } = await import('./cli/export');
    await runExport(args.slice(1));
    return;
  }

  if (cmd === 'dashboard') {
    const port = parsePortArg(args.slice(1), 3333);
    const { startDashboardServer } = await import('./dashboard/server');
    const server = startDashboardServer(process.cwd(), port);
    server.on('listening', () => {
      const addr = server.address();
      const activePort = typeof addr === 'object' && addr ? addr.port : port;
      console.log(`Shanaxon Analytics Dashboard listening at http://localhost:${activePort}`);
    });
    return;
  }

  if (cmd && cmd.startsWith('-')) {
    console.error(`Unknown option: ${cmd}`);
    console.error('Run "shanaxon --help" for usage.');
    process.exit(1);
  }

  if (cmd) {
    console.error(`Unknown command: ${cmd}`);
    console.error('Run "shanaxon --help" for usage.');
    process.exit(1);
  }

  const mcpServer = new McpCompressionServer();
  const transport = new StdioServerTransport();

  await mcpServer.server.connect(transport);
  console.error('Shanaxon MCP server running on stdio');
}

main().catch((error) => {
  console.error('Server crashed with error:', error);
  process.exit(1);
});
