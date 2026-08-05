import * as path from 'path';
import { promises as fs, existsSync } from 'fs';
import { autoConfigureMcp } from '../cli/init';

async function runTests() {
  console.log("=== Running P2: Product & DX Improvements Verification ===");

  const workspaceRoot = process.cwd();

  // 1. Verify README.md Existence & Structure
  console.log("\n1. Testing README.md Documentation...");
  const readmePath = path.resolve(workspaceRoot, 'README.md');
  if (!existsSync(readmePath)) {
    throw new Error("README.md file missing from repository root!");
  }

  const readmeContent = await fs.readFile(readmePath, 'utf-8');
  console.log(`README size: ${readmeContent.length} chars`);
  
  if (!readmeContent.includes("# Tokenist") || 
      !readmeContent.includes("fetch_optimized_repository_map") || 
      !readmeContent.includes("npx tokenist init") ||
      !readmeContent.includes("Benchmark & Performance")) {
    throw new Error("README.md is missing essential sections or documentation!");
  }
  console.log("✓ README.md documentation structure verified.");

  // 2. Verify Automatic MCP Config Generator
  console.log("\n2. Testing Automatic MCP Config Installer...");
  const tempDir = path.resolve(workspaceRoot, '.tokenist/test_mcp_install');
  await fs.mkdir(tempDir, { recursive: true });

  try {
    const configResults = await autoConfigureMcp(tempDir);
    console.log(`Configured ${configResults.length} platform MCP config files.`);

    const geminiMcpPath = path.resolve(tempDir, '.gemini/mcp.json');
    if (!existsSync(geminiMcpPath)) {
      throw new Error("autoConfigureMcp failed to generate .gemini/mcp.json!");
    }

    const mcpData = JSON.parse(await fs.readFile(geminiMcpPath, 'utf-8'));
    console.log(`Generated MCP Server Command: ${mcpData.mcpServers?.tokenist?.command}`);
    if (!mcpData.mcpServers?.tokenist || mcpData.mcpServers.tokenist.command !== 'npx') {
      throw new Error("Generated MCP JSON definition is invalid!");
    }
  } finally {
    await fs.rm(tempDir, { recursive: true, force: true }).catch(() => {});
  }
  console.log("✓ Automatic MCP Config Installer verification passed.");

  // 3. Verify Package Publication Configuration
  console.log("\n3. Testing Package Publication Settings...");
  const pkgPath = path.resolve(workspaceRoot, 'package.json');
  const pkgData = JSON.parse(await fs.readFile(pkgPath, 'utf-8'));

  console.log(`Bin entry tokenist: ${pkgData.bin?.tokenist}`);
  console.log(`Bin entry tokenist-init: ${pkgData.bin?.['tokenist-init']}`);
  
  if (!pkgData.bin?.tokenist || !pkgData.bin?.['tokenist-init'] || !pkgData.scripts?.prepublishOnly) {
    throw new Error("package.json is missing binary definitions or prepublish scripts!");
  }

  const indexPath = path.resolve(workspaceRoot, 'src/index.ts');
  const indexContent = await fs.readFile(indexPath, 'utf-8');
  if (!indexContent.startsWith('#!/usr/bin/env node')) {
    throw new Error("src/index.ts is missing executable shebang header!");
  }
  console.log("✓ Package Publication Settings verification passed.");

  console.log("\n=== All P2 Product & DX Tests Passed successfully! ===");
}

runTests().catch(err => {
  console.error("❌ P2 Test Suite Failed:");
  console.error(err);
  process.exit(1);
});
