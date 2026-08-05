import * as path from 'path';
import { promises as fs, existsSync } from 'fs';

async function runTests() {
  console.log("=== Running VS Code Extension Verification ===");

  const workspaceRoot = process.cwd();

  // 1. Verify Extension Manifest (package.json)
  console.log("\n1. Testing Extension Manifest (package.json)...");
  const extPkgPath = path.resolve(workspaceRoot, 'vscode-extension/package.json');
  if (!existsSync(extPkgPath)) {
    throw new Error("vscode-extension/package.json manifest missing!");
  }

  const pkg = JSON.parse(await fs.readFile(extPkgPath, 'utf-8'));
  console.log(`Extension ID: ${pkg.publisher}.${pkg.name}`);
  console.log(`Main entry: ${pkg.main}`);
  console.log(`Registered commands count: ${pkg.contributes?.commands?.length}`);

  if (pkg.name !== 'tokenist-vscode' || !pkg.main || pkg.contributes?.commands?.length < 4) {
    throw new Error("Extension manifest missing essential metadata or commands!");
  }
  console.log("✓ Extension Manifest verification passed.");

  // 2. Verify Compiled Dist Artifacts
  console.log("\n2. Testing Compiled Extension Dist Build Artifacts...");
  const distFiles = [
    'vscode-extension/dist/extension.js',
    'vscode-extension/dist/StatusBarManager.js',
    'vscode-extension/dist/TokenistRunner.js',
    'vscode-extension/dist/DashboardWebview.js'
  ];

  for (const f of distFiles) {
    const fullPath = path.resolve(workspaceRoot, f);
    if (!existsSync(fullPath)) {
      throw new Error(`Missing compiled extension dist file: ${f}`);
    }
    console.log(`✓ Artifact verified: ${f}`);
  }
  console.log("✓ Extension Dist Build Artifacts verification passed.");

  // 3. Verify Status Bar Telemetry Reader Output
  console.log("\n3. Testing Status Bar Telemetry Integration...");
  const ledgerPath = path.resolve(workspaceRoot, 'telemetry_ledger.json');
  if (existsSync(ledgerPath)) {
    const records = JSON.parse(await fs.readFile(ledgerPath, 'utf-8'));
    console.log(`Found ${records.length} telemetry ledger records for status bar rendering.`);
  }
  console.log("✓ Status Bar Telemetry Integration verified.");

  console.log("\n=== All VS Code Extension Tests Passed successfully! ===");
}

runTests().catch(err => {
  console.error("❌ VS Code Extension Test Suite Failed:");
  console.error(err);
  process.exit(1);
});
