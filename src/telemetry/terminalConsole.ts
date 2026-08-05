import { TelemetryRecord } from '../types';
import { getConfig } from '../core/configLoader';

const PRICING_MAP: Record<string, { name: string; rate: number }> = {
  'claude-sonnet-4': { name: 'Claude Sonnet 4 ($3.00/1M)', rate: 3.00 / 1000000 },
  'claude-haiku-3.5': { name: 'Claude Haiku 3.5 ($0.80/1M)', rate: 0.80 / 1000000 },
  'gpt-4o': { name: 'GPT-4o ($2.50/1M)', rate: 2.50 / 1000000 },
  'gemini-2.5-pro': { name: 'Gemini 2.5 Pro ($1.25/1M)', rate: 1.25 / 1000000 },
};

/**
 * Formats and renders a premium ASCII telemetry metrics report with dollar cost estimations.
 */
export function renderDashboard(records: TelemetryRecord[]): string {
  if (records.length === 0) {
    return `
===========================================================
TOKENIST OPTIMIZATION LEDGER - NO RECORDS FOUND
===========================================================
No optimization records found yet. Run scans or queries first.
===========================================================
`;
  }

  const totalCommands = records.length;
  const rawCumulative = records.reduce((sum, r) => sum + r.rawTokens, 0);
  const minimizedCumulative = records.reduce((sum, r) => sum + r.compressedTokens, 0);
  const savedCumulative = rawCumulative - minimizedCumulative;
  const avgLatency = records.reduce((sum, r) => sum + r.latencyMs, 0) / totalCommands;
  
  const overallSavingsPct = rawCumulative > 0 ? (savedCumulative / rawCumulative) * 100 : 0;

  const config = getConfig();
  const pricingModel = config.pricingModel || 'claude-sonnet-4';
  const pricing = PRICING_MAP[pricingModel] || PRICING_MAP['claude-sonnet-4'];
  
  const rawCost = rawCumulative * pricing.rate;
  const compressedCost = minimizedCumulative * pricing.rate;
  const usdSaved = savedCumulative * pricing.rate;
  
  // Project monthly savings based on an average active developer usage of 1000 calls per month
  const projectedMonthlySavings = (savedCumulative / totalCommands) * 1000 * pricing.rate;

  // Render a 20-character wide ASCII progress bar representing efficiency %
  const barWidth = 20;
  const filledChars = Math.round((overallSavingsPct / 100) * barWidth);
  const emptyChars = Math.max(0, barWidth - filledChars);
  const asciiBar = '█'.repeat(filledChars) + '░'.repeat(emptyChars);

  return `
===========================================================
TOKENIST OPTIMIZATION LEDGER
===========================================================
Total Intercepted Commands : ${totalCommands}
Raw Cumulative Input Tokens: ${rawCumulative.toLocaleString()} (${(rawCumulative / 1000).toFixed(1)}K)
Minimized Output Tokens    : ${minimizedCumulative.toLocaleString()} (${(minimizedCumulative / 1000).toFixed(1)}K)
Context Reclaimed Volume   : ${savedCumulative.toLocaleString()} Tokens Saved
System Efficiency Rating   : [${asciiBar}] ${overallSavingsPct.toFixed(1)}%
Average Execution Latency  : ${Math.round(avgLatency)}ms
-----------------------------------------------------------
Raw Context Cost (Est.)    : $${rawCost.toFixed(4)}
Minimized Context Cost     : $${compressedCost.toFixed(4)}
Estimated Cash Saved       : $${usdSaved.toFixed(4)}
Projected Monthly Savings  : $${projectedMonthlySavings.toFixed(2)} (at 1,000 calls/mo)
Active Pricing Model       : ${pricing.name}
===========================================================
`;
}
