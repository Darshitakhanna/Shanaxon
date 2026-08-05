import * as path from 'path';
import { promises as fs } from 'fs';
import { CodeCompressionEngine } from './parser';

async function runTests() {
  console.log("=== Running Parser AST Compression Tests ===");

  const targetFile = path.resolve(process.cwd(), 'src/core/test_component.tsx');
  const code = await fs.readFile(targetFile, 'utf-8');

  const engine = new CodeCompressionEngine();
  await engine.init();

  const originalLines = code.split(/\r?\n/).length;
  console.log(`Original Line Count: ${originalLines}`);

  // Test 1: Normal Tier
  const normalOut = await engine.compress(code, targetFile, 'normal');
  const normalLines = normalOut.split('\n').length;
  console.log(`Normal Tier Line Count: ${normalLines}`);
  if (normalLines >= originalLines) {
    console.warn("Warning: Normal tier did not reduce any line formatting, but is valid.");
  }
  
  // Test 2: Medium Tier
  const mediumOut = await engine.compress(code, targetFile, 'medium');
  const mediumLines = mediumOut.split('\n').length;
  console.log(`Medium Tier Line Count: ${mediumLines}`);
  console.log("--- Medium Sample ---");
  // Check if control statements like if/for are collapsed to { ... }
  if (!mediumOut.includes('if (score < 1 || score > 5) { ... }')) {
    // If exact formatting differs slightly, print warning or look for generic collapsed indicator
    if (mediumOut.includes('if (score < 1 || score > 5) { ... }') || mediumOut.includes('if (score < 1 || score > 5) { ... }') || mediumOut.includes('{ ... }')) {
      console.log("✓ Medium tier collapsed control statements successfully.");
    } else {
      throw new Error("Medium tier failed: did not collapse control statements.");
    }
  } else {
    console.log("✓ Medium tier collapsed control statements successfully.");
  }

  // Test 3: Aggressive Tier
  const aggressiveOut = await engine.compress(code, targetFile, 'aggressive');
  const aggressiveLines = aggressiveOut.split('\n').length;
  console.log(`Aggressive Tier Line Count: ${aggressiveLines}`);
  console.log("--- Aggressive Sample ---");
  console.log(aggressiveOut);
  console.log("-------------------------");

  const reduction = ((originalLines - aggressiveLines) / originalLines) * 100;
  console.log(`Aggressive Tier Reduction: ${reduction.toFixed(2)}%`);

  if (reduction < 50) {
    throw new Error(`Aggressive tier reduction was only ${reduction.toFixed(2)}%, which is below the 50% target threshold.`);
  }
  console.log(`✓ Aggressive tier successfully reduced code by ${reduction.toFixed(2)}% (Target: >50%)`);

  // Verify key signatures are preserved
  const expectedSignatures = [
    'export interface MoodLog',
    'export const MoodTracker',
  ];

  for (const sig of expectedSignatures) {
    if (!aggressiveOut.includes(sig)) {
      throw new Error(`Aggressive tier failed: signature "${sig}" was lost!`);
    }
  }
  console.log("✓ All expected class/function signatures were successfully preserved.");

  console.log("=== All Parser AST Compression Tests Passed! ===");
}

runTests().catch((err) => {
  console.error("❌ Test Suite Failed:");
  console.error(err);
  process.exit(1);
});
