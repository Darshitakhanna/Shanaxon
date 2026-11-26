# SHANAXON v6.1.0 — REAL PROVIDER VALIDATION REPORT

> [!IMPORTANT]
> **MOCK MODE NOTICE**: This experiment ran using simulated LLM provider responses (no API key was supplied). Actual LLM token counts and costs use Shanaxon BPE token counting and published provider pricing rates.

## Executive Comparison Summary

| Metric Dimension | Baseline LLM Call | Shanaxon Optimized Call | Variance / Savings |
|---|---|---|---|
| **Total Test Tasks** | 50 tasks | 50 tasks | — |
| **Provider / Model** | `mock` / `gpt-4o-mini` | `mock` / `gpt-4o-mini` | — |
| **Input Tokens** | 89,985 tokens | 89,362 tokens | **-623 tokens** (0.69%) |
| **Model API Bill** | $0.017408 | $0.017314 | -$0.000094 |
| **Optimizer Overhead** | $0.000000 | $0.000003 | +$0.000003 |
| **Total User Spend** | $0.017408 | **$0.017317** | **Net Savings: $0.000091** (0.52%) |
| **Quality Retention** | 100.0% baseline | **100%** | Safe quality floor |
| **Task Success Rate** | Baseline ground truth | **2%** | Net savings + quality preserved |

---

## Decision Diagnostic & Optimization Rate Audit

- **Total Tasks Analyzed**: 50
- **Optimized (OPTIMIZE)**: **1 tasks** (2%)
- **Fell Back to Baseline (FALLBACK_BASELINE)**: **49 tasks**
- **Skipped at Preflight (SKIP_TOO_SMALL)**: **0 tasks**

### Decision Reason Breakdown
- `QUALITY_RISK_TOO_HIGH`: **42 tasks**
- `SAVINGS_ACCEPTED`: **1 tasks**
- `BASELINE_ALREADY_OPTIMAL`: **7 tasks**

### Context Size Distribution
- **Under 150 Tokens**: 0 tasks (Preflight floor skipped)
- **150 to 500 Tokens**: 0 tasks
- **500 to 2,000 Tokens**: 35 tasks
- **Over 2,000 Tokens**: 15 tasks (Optimal compression yield)

### Fallback Reasons Breakdown
- **Quality Risk Floor Failed**: 42 tasks
- **No Meaningful Net Savings**: 0 tasks
- **Optimizer Overhead Exceeded Savings**: 0 tasks
- **Baseline Already Optimal**: 7 tasks

---

## Systematic Diagnostic Recommendations

- Optimization rate is 2%. Tokenist strictly enforces financial safety (net savings > $0), protecting users from paying more for optimizer overhead than they save on LLM tokens.

---

## Detailed Task Results (First 15 Tasks)

| Task ID | Workload | Baseline Tokens | Shanaxon Tokens | Decision | Reason | Net Savings ($) |
|---|---|---|---|---|---|---|
| `ELIGIBLE_TASK_001` | code_medium | 743 | 743 | `FALLBACK_BASELINE` | `QUALITY_RISK_TOO_HIGH` | $0.000000 |
| `ELIGIBLE_TASK_002` | code_large | 11097 | 10474 | `OPTIMIZE` | `SAVINGS_ACCEPTED` | $0.000091 |
| `ELIGIBLE_TASK_003` | code_medium | 687 | 687 | `FALLBACK_BASELINE` | `BASELINE_ALREADY_OPTIMAL` | $0.000000 |
| `ELIGIBLE_TASK_004` | code_large | 2238 | 2238 | `FALLBACK_BASELINE` | `QUALITY_RISK_TOO_HIGH` | $0.000000 |
| `ELIGIBLE_TASK_005` | code_medium | 938 | 938 | `FALLBACK_BASELINE` | `QUALITY_RISK_TOO_HIGH` | $0.000000 |
| `ELIGIBLE_TASK_006` | code_medium | 1379 | 1379 | `FALLBACK_BASELINE` | `QUALITY_RISK_TOO_HIGH` | $0.000000 |
| `ELIGIBLE_TASK_007` | code_large | 2464 | 2464 | `FALLBACK_BASELINE` | `QUALITY_RISK_TOO_HIGH` | $0.000000 |
| `ELIGIBLE_TASK_008` | code_medium | 1484 | 1484 | `FALLBACK_BASELINE` | `BASELINE_ALREADY_OPTIMAL` | $0.000000 |
| `ELIGIBLE_TASK_009` | code_medium | 940 | 940 | `FALLBACK_BASELINE` | `QUALITY_RISK_TOO_HIGH` | $0.000000 |
| `ELIGIBLE_TASK_010` | code_large | 3914 | 3914 | `FALLBACK_BASELINE` | `QUALITY_RISK_TOO_HIGH` | $0.000000 |
| `ELIGIBLE_TASK_011` | code_medium | 1794 | 1794 | `FALLBACK_BASELINE` | `QUALITY_RISK_TOO_HIGH` | $0.000000 |
| `ELIGIBLE_TASK_012` | code_medium | 1986 | 1986 | `FALLBACK_BASELINE` | `QUALITY_RISK_TOO_HIGH` | $0.000000 |
| `ELIGIBLE_TASK_013` | code_medium | 622 | 622 | `FALLBACK_BASELINE` | `BASELINE_ALREADY_OPTIMAL` | $0.000000 |
| `ELIGIBLE_TASK_014` | code_medium | 963 | 963 | `FALLBACK_BASELINE` | `QUALITY_RISK_TOO_HIGH` | $0.000000 |
| `ELIGIBLE_TASK_015` | code_medium | 931 | 931 | `FALLBACK_BASELINE` | `QUALITY_RISK_TOO_HIGH` | $0.000000 |

---

*Report generated automatically by Shanaxon ProviderValidationReporter v6.1.1 on 2026-11-26T14:58:55.056Z.*
