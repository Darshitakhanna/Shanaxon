import { TelemetryRecord } from '../types';
import { getConfig } from '../core/configLoader';
import { ModelPricingRegistry } from '../intelligence/economicsEngine';

/**
 * Formats and renders a premium ASCII telemetry metrics report with dollar cost estimations.
 */
export function renderDashboard(records: TelemetryRecord[]): string {
  if (records.length === 0) {
    return `
===========================================================
SHANAXON OPTIMIZATION LEDGER - NO RECORDS FOUND
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
  const pricingModel = config.pricingModel || config.activeModel || 'claude-sonnet-4';
  const registry = ModelPricingRegistry.getInstance();
  const { pricing, isFallback } = registry.getPricingWithFallback(undefined, pricingModel, 'claude-sonnet-4');
  const ratePerToken = pricing.inputCostPerMillion / 1_000_000;
  const pricingDisplayName = registry.formatDisplayLabel(pricing, isFallback);

  const rawCost = rawCumulative * ratePerToken;
  const compressedCost = minimizedCumulative * ratePerToken;
  const usdSaved = savedCumulative * ratePerToken;
  
  // Project monthly savings based on an average active developer usage of 1000 calls per month
  const projectedMonthlySavings = (savedCumulative / totalCommands) * 1000 * ratePerToken;

  // Render a 20-character wide ASCII progress bar representing efficiency %
  const barWidth = 20;
  const filledChars = Math.round((overallSavingsPct / 100) * barWidth);
  const emptyChars = Math.max(0, barWidth - filledChars);
  const asciiBar = '█'.repeat(filledChars) + '░'.repeat(emptyChars);

  return `
===========================================================
SHANAXON OPTIMIZATION LEDGER
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
Active Pricing Model       : ${pricingDisplayName}
===========================================================
`;
}
