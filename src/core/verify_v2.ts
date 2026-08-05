import { RetrieveCache } from './retrieveCache';
import { SmartCrusher } from './smartCrusher';
import { CacheAligner } from './cacheAligner';
import { getTersePrompt } from './terseMode';
import { SchemaCompressor } from './schemaCompressor';
import { ContextReceiptGenerator } from './contextReceipt';
import { ImportGraph } from './importGraph';
import Parser from 'web-tree-sitter';
import { CodeCompressionEngine } from './parser';

async function runV2Verification() {
  console.log('===========================================================');
  console.log('TOKENIST v2 REVOLUTIONARY FEATURES VERIFICATION SUITE');
  console.log('===========================================================');

  let passedTests = 0;
  let totalTests = 0;

  function assert(condition: boolean, testName: string) {
    totalTests++;
    if (condition) {
      console.log(`  [PASS] ${testName}`);
      passedTests++;
    } else {
      console.error(`  [FAIL] ${testName}`);
    }
  }

  // TEST 1: Feature 1 — CCR (Compress-Cache-Retrieve)
  console.log('\n--- 1. Testing Feature 1: CCR Architecture ---');
  const retrieveCache = new RetrieveCache();
  const rawCode = `function calculateTotal(items: number[]): number {\n  return items.reduce((a, b) => a + b, 0);\n}`;
  const compressedCode = `function calculateTotal(items: number[]): number;`;
  const filePath = 'src/utils/math.ts';

  const markerOutput = retrieveCache.injectMarker(compressedCode, rawCode, filePath, 'aggressive');
  assert(markerOutput.includes('[tokenist:retrieve hash='), 'Retrieve marker injected into compressed output');
  
  const hashMatch = markerOutput.match(/hash=([0-9a-f]{8})/);
  assert(hashMatch !== null, 'Hash key successfully extracted from marker');

  if (hashMatch) {
    const retrieved = retrieveCache.retrieve(hashMatch[1]);
    assert(retrieved !== null && retrieved.original === rawCode, 'Original content retrieved round-trip from hash');
  }

  // TEST 2: Feature 2 — SmartCrusher (JSON / Log / Terminal / Stack trace)
  console.log('\n--- 2. Testing Feature 2: SmartCrusher ---');
  const crusher = new SmartCrusher();
  const sampleJson = JSON.stringify({
    status: 'success',
    id: 'req_12345',
    data: {
      items: [1, 2, 3, 4, 5, 6, 7, 8, 9, 10],
      longString: 'A'.repeat(300),
    },
    nullField: null,
  });

  const jsonResult = crusher.crush(sampleJson);
  assert(jsonResult.contentType === 'json', 'Auto-detected content type: JSON');
  assert(jsonResult.savingsPct > 20, `JSON compressed: ${jsonResult.savingsPct}% tokens saved`);
  assert(jsonResult.crushed.includes('req_12345'), 'Preserved critical ID key in crushed JSON');

  const stackTraceSample = `Error: Cannot find module './missing'\n    at Function.Module._resolveFilename (node:internal/modules/cjs/loader:933:15)\n    at Function.Module._load (node:internal/modules/cjs/loader:774:27)\n    at Function.executeUserEntryPoint [as runMain] (node:internal/modules/run_main:77:12)\n    at node:internal/main/run_main_module:17:47`;
  const stackResult = crusher.crush(stackTraceSample);
  assert(stackResult.contentType === 'stacktrace', 'Auto-detected content type: STACKTRACE');

  // TEST 3: Feature 3 — CacheAligner (KV-Cache Prompt Stabilization)
  console.log('\n--- 3. Testing Feature 3: CacheAligner ---');
  const aligner = new CacheAligner();
  const rawPrompt = `System initialized at 2026-08-01T05:22:40Z for session 465c4a12-27fc-4bab-821d-4b8bbd3f2f79. Perform refactoring.`;
  const alignResult = aligner.align(rawPrompt);
  assert(alignResult.dynamicCount === 2, 'Identified 2 dynamic variables (Timestamp + UUID)');
  assert(alignResult.stablePrefix.includes('{{DYN_TIMESTAMP_1}}'), 'Timestamp replaced with stable prefix placeholder');
  assert(alignResult.dynamicSuffix.includes('465c4a12-27fc-4bab-821d-4b8bbd3f2f79'), 'UUID relocated to dynamic suffix block');

  // TEST 4: Feature 4 — TerseMode (Caveman Output Compression)
  console.log('\n--- 4. Testing Feature 4: TerseMode ---');
  const minimalTerse = getTersePrompt('minimal');
  assert(minimalTerse.level === 'minimal', 'Terse mode minimal level set');
  assert(minimalTerse.systemInstruction.includes('TERSE MODE MINIMAL'), 'Minimal system prompt generated');

  const compactTerse = getTersePrompt('compact');
  assert(compactTerse.systemInstruction.includes('TERSE MODE COMPACT'), 'Compact system prompt generated');

  // TEST 5: Feature 5 — Blast Radius Analysis
  console.log('\n--- 5. Testing Feature 5: Multi-Hop Blast Radius ---');
  const engine = new CodeCompressionEngine();
  await engine.init();

  const parser = engine.getParser();
  if (parser) {
    const importGraph = new ImportGraph(parser);
    const codeA = `import { b } from './b';\nexport const a = 1;`;
    const codeB = `import { c } from './c';\nexport const b = 2;`;
    const codeC = `export const c = 3;`;

    await importGraph.parseFileImports('src/a.ts', codeA, engine.getLoadedLanguages());
    await importGraph.parseFileImports('src/b.ts', codeB, engine.getLoadedLanguages());
    await importGraph.parseFileImports('src/c.ts', codeC, engine.getLoadedLanguages());

    const report = importGraph.getBlastRadius('src/c.ts', 3);
    assert(report.totalAffectedFiles >= 2, 'Blast radius detected affected files across multi-hop chain');
    assert(report.reverseDeps.size > 0, 'Reverse dependencies (who imports src/c.ts) correctly computed');
  } else {
    console.log('  [SKIP] Blast radius parser skip in fallback WASM mode');
  }

  // TEST 6: Feature 6 — Context Receipts & FinOps Auditor
  console.log('\n--- 6. Testing Feature 6: Context Receipts ---');
  const receiptGen = new ContextReceiptGenerator();
  const receipt = receiptGen.generate(
    'fetch_optimized_repository_map',
    [
      {
        filePath: 'src/server.ts',
        tier: 'aggressive',
        rawTokens: 3500,
        compressedTokens: 600,
        savingsPct: 82.86,
        hasRetrieveMarker: true,
      },
    ],
    [],
    10000
  );

  assert(receipt.requestId.length === 7, 'Generated unique receipt ID');
  assert(receipt.totalSavingsPct === 82.86, 'Calculated request token savings percentage');

  const footer = receiptGen.formatAsFooter(receipt);
  assert(footer.includes('Tokenist Context Receipt'), 'Formatted context receipt footer');

  const sessionSummary = receiptGen.formatSessionSummary();
  assert(sessionSummary.includes('TOKENIST SESSION FINOPS AUDIT'), 'Formatted session FinOps summary');

  // TEST 7: Feature 7 — SchemaCompressor
  console.log('\n--- 7. Testing Feature 7: SchemaCompressor ---');
  const schemaComp = new SchemaCompressor();
  const sampleSchemas = [
    {
      name: 'large_tool',
      description: 'This is a very long verbose tool description that goes on and on explaining unnecessary details about how the tool executes internally.',
      inputSchema: {
        type: 'object',
        properties: {
          param1: { type: 'string', description: 'Verbose description of param 1', example: 'foo', default: 'bar' },
        },
      },
    },
  ];

  const schemaResult = schemaComp.compress(sampleSchemas);
  assert(schemaResult.toolCount === 1, 'Compressed 1 tool schema');
  assert(schemaResult.savingsPct > 30, `Schema compressed: ${schemaResult.savingsPct}% tokens saved`);
  assert(!schemaResult.compressed.includes('unnecessary details'), 'Shortened verbose description string');

  console.log('\n===========================================================');
  console.log(`VERIFICATION COMPLETE: ${passedTests}/${totalTests} tests passed`);
  console.log('===========================================================');

  if (passedTests !== totalTests) {
    process.exit(1);
  }
}

runV2Verification().catch((err) => {
  console.error('Verification failed with exception:', err);
  process.exit(1);
});
