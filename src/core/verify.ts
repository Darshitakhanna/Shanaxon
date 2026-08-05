import * as path from 'path';
import { normalizePath, validatePath } from './guardrails';

async function runTests() {
  console.log("=== Running Cross-Platform Path Guardrail Tests ===");

  const workspaceRoot = path.resolve(__dirname, '../../');
  console.log(`Workspace Root: ${workspaceRoot}`);

  // Test 1: normalizePath
  const tests = [
    { input: 'src/core/guardrails.ts', expected: path.join('src', 'core', 'guardrails.ts') },
    { input: 'src\\core\\guardrails.ts', expected: path.join('src', 'core', 'guardrails.ts') },
    { input: 'src/core\\guardrails.ts', expected: path.join('src', 'core', 'guardrails.ts') },
  ];

  for (const t of tests) {
    const output = normalizePath(t.input);
    if (output !== t.expected) {
      throw new Error(`normalizePath failed for: "${t.input}". Expected: "${t.expected}", Got: "${output}"`);
    }
    console.log(`✓ normalizePath successfully normalized "${t.input}" -> "${output}"`);
  }

  // Test 2: validatePath with a valid existing file in the workspace
  const validFile = path.join(workspaceRoot, 'package.json');
  const isValid = await validatePath(validFile, workspaceRoot);
  if (!isValid) {
    throw new Error(`validatePath failed: "${validFile}" was marked invalid but it is a valid file within base.`);
  }
  console.log(`✓ validatePath successfully validated valid file: "${validFile}"`);

  // Test 3: validatePath with directory traversal outside workspace
  const traversalFile = path.join(workspaceRoot, '../nonexistent_file_xyz.txt');
  const isTraversalValid = await validatePath(traversalFile, workspaceRoot);
  if (isTraversalValid) {
    throw new Error(`validatePath failed: Traversal path "${traversalFile}" was marked valid but it is outside base.`);
  }
  console.log(`✓ validatePath successfully blocked traversal path: "${traversalFile}"`);

  // Test 4: validatePath for nonexistent file inside workspace (should return false because of fs.stat check)
  const nonexistentInside = path.join(workspaceRoot, 'nonexistent_file_123.txt');
  const isNonexistentValid = await validatePath(nonexistentInside, workspaceRoot);
  if (isNonexistentValid) {
    throw new Error(`validatePath failed: Nonexistent file "${nonexistentInside}" was marked valid.`);
  }
  console.log(`✓ validatePath successfully blocked nonexistent file: "${nonexistentInside}"`);

  console.log("=== All Tests Passed Successfully! ===");
}

runTests().catch((err) => {
  console.error("❌ Test Suite Failed:");
  console.error(err);
  process.exit(1);
});
