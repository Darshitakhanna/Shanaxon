import * as fs from 'fs';
import * as path from 'path';

/**
 * CLI command to export optimization logs to CSV or JSON formats.
 * Usage: shanaxon export --format csv --out audit_logs.csv
 */
export async function runExport(args: string[] = process.argv.slice(2)): Promise<void> {
  const formatIndex = args.indexOf('--format');
  const format = formatIndex !== -1 && args[formatIndex + 1] ? args[formatIndex + 1].toLowerCase() : 'json';
  
  const outIndex = args.indexOf('--out');
  const outPath = outIndex !== -1 ? args[outIndex + 1] : undefined;

  const workspaceRoot = process.cwd();
  const ledgerPath = path.resolve(workspaceRoot, 'telemetry_ledger.json');

  if (!fs.existsSync(ledgerPath)) {
    console.warn("No telemetry ledger found to export.");
    return;
  }

  const rawData = fs.readFileSync(ledgerPath, 'utf-8');
  const records = JSON.parse(rawData);

  let outputContent = '';
  if (format === 'csv') {
    const headers = ['Timestamp', 'FilePath', 'RawTokens', 'CompressedTokens', 'Tier', 'SavingsPct', 'LatencyMs'];
    const rows = records.map((r: any) => [
      r.timestamp,
      String(r.filePath || '').replace(/"/g, '""'),
      r.rawTokens,
      r.compressedTokens,
      r.tier,
      r.savingsPct,
      r.latencyMs
    ]);
    outputContent = [headers.join(','), ...rows.map((row: any[]) => row.map(val => `"${val}"`).join(','))].join('\n');
  } else {
    outputContent = JSON.stringify(records, null, 2);
  }

  if (outPath) {
    const targetPath = path.resolve(workspaceRoot, outPath);
    // Automatically create parent folders
    fs.mkdirSync(path.dirname(targetPath), { recursive: true });
    fs.writeFileSync(targetPath, outputContent, 'utf-8');
    console.log(`✓ Audit logs exported successfully to: ${targetPath}`);
  } else {
    console.log(outputContent);
  }
}

if (require.main === module) {
  runExport().catch(err => {
    console.error("Export command failed:", err);
    process.exit(1);
  });
}
