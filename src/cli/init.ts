#!/usr/bin/env node
import * as path from 'path';
import { promises as fs, existsSync } from 'fs';
import * as readline from 'readline';
import { detectProject } from '../core/projectDetector';
import { PlatformAdapter } from '../adapters/platformAdapter';

export interface McpConfigResult {
  configPath: string;
  updated: boolean;
  platform: string;
}

/**
 * Automatically detects target platform config locations and injects the Tokenist MCP server definition.
 */
export async function autoConfigureMcp(workspaceRoot: string): Promise<McpConfigResult[]> {
  const results: McpConfigResult[] = [];
  const homeDir = process.env.USERPROFILE || process.env.HOME || process.cwd();

  // Potential platform config paths
  const configTargets = [
    {
      platform: 'Claude Desktop',
      path: path.join(homeDir, 'AppData', 'Roaming', 'Claude', 'claude_desktop_config.json')
    },
    {
      platform: 'Claude / Generic MCP Workspace',
      path: path.join(workspaceRoot, '.mcp', 'config.json')
    },
    {
      platform: 'Antigravity / Gemini IDE',
      path: path.join(workspaceRoot, '.gemini', 'mcp.json')
    }
  ];

  const serverDef = {
    command: 'npx',
    args: ['-y', 'tokenist']
  };

  for (const target of configTargets) {
    try {
      let configData: any = { mcpServers: {} };
      if (existsSync(target.path)) {
        try {
          const raw = await fs.readFile(target.path, 'utf-8');
          configData = JSON.parse(raw);
        } catch {
          configData = { mcpServers: {} };
        }
      } else {
        const dir = path.dirname(target.path);
        await fs.mkdir(dir, { recursive: true });
      }

      if (!configData.mcpServers) {
        configData.mcpServers = {};
      }

      configData.mcpServers.tokenist = serverDef;
      await fs.writeFile(target.path, JSON.stringify(configData, null, 2), 'utf-8');

      results.push({
        configPath: target.path,
        updated: true,
        platform: target.platform
      });
    } catch {
      // Ignore targets that fail due to permissions or missing parent dirs
    }
  }

  return results;
}

async function runInit() {
  const args = process.argv.slice(2);
  const isNonInteractive = args.includes('--yes') || args.includes('-y');

  console.log("=== Tokenist Setup Wizard ===");
  const workspaceRoot = process.cwd();

  console.log("Detecting project type...");
  const projectInfo = await detectProject(workspaceRoot);
  const detectedPlatform = PlatformAdapter.detectPlatform();
  console.log(`Detected project type: ${projectInfo.projectType}`);
  console.log(`Detected platform: ${detectedPlatform.displayName}`);

  let defaultTier = 'aggressive';
  let maxTokenBudget: number | undefined = undefined;
  let showInlineSummary = true;
  let enableSemanticRanking = false;

  if (!isNonInteractive) {
    const rl = readline.createInterface({
      input: process.stdin,
      output: process.stdout
    });

    const question = (query: string): Promise<string> => {
      return new Promise((resolve) => rl.question(query, resolve));
    };

    const defaultTierInput = await question("Select default compression tier (normal/medium/aggressive) [aggressive]: ");
    if (['normal', 'medium', 'aggressive'].includes(defaultTierInput.trim())) {
      defaultTier = defaultTierInput.trim();
    }

    const budgetInput = await question("Enter maximum token budget per call (number or press Enter for none) [none]: ");
    if (budgetInput.trim()) {
      maxTokenBudget = Number(budgetInput.trim());
    }

    const showSummaryInput = await question("Show inline token savings summary on file reads? (yes/no) [yes]: ");
    if (showSummaryInput.trim().toLowerCase() === 'no') {
      showInlineSummary = false;
    }

    const enableRankingInput = await question("Enable ONNX semantic embedding ranking? (yes/no) [no]: ");
    if (enableRankingInput.trim().toLowerCase() === 'yes') {
      enableSemanticRanking = true;
    }

    rl.close();
  }

  const configPath = path.resolve(workspaceRoot, '.tokenist.json');
  const config = {
    defaultTier,
    maxTokenBudget,
    showInlineSummary,
    enableSemanticRanking,
    preserveCommentPatterns: ["TODO", "FIXME", "@api", "@public"],
    alwaysInclude: [],
    excludePatterns: projectInfo.excludePatterns,
    cacheStrategy: "disk",
    cachePath: ".tokenist/cache.json",
    telemetryRotationLimit: 500
  };

  await fs.writeFile(configPath, JSON.stringify(config, null, 2), 'utf-8');
  console.log(`\n✓ Config file successfully created at: ${configPath}`);

  // Automatically write MCP configuration to detected platform JSON files
  console.log("\nConfiguring IDE / AI Platform MCP settings...");
  const mcpConfigResults = await autoConfigureMcp(workspaceRoot);
  for (const res of mcpConfigResults) {
    console.log(`✓ Tokenist MCP server registered for ${res.platform}: ${res.configPath}`);
  }

  console.log("\n==================================================");
  console.log("MCP SERVER CONFIGURATION SNIPPET");
  console.log("==================================================");
  console.log("Manual fallback JSON snippet:");
  console.log(JSON.stringify({
    mcpServers: {
      "tokenist": {
        "command": "npx",
        "args": ["-y", "tokenist"]
      }
    }
  }, null, 2));
  console.log("==================================================");
}

if (require.main === module) {
  runInit().catch((err) => {
    console.error("Setup wizard failed:", err);
    process.exit(1);
  });
}
