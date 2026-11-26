# SHANAXON OPTIMIZER OVERHEAD CALIBRATION REPORT

## Executive Summary

| Metric | Measured Value |
|---|---|
| Total Optimization Runs | 336 |
| Average Wall-Clock Latency | 1 ms |
| Average CPU Execution Time | 0 ms |
| Average Memory Delta | 0 MB |
| Average Tokens Processed / Task | 1662.1 tokens |
| Processing Throughput | 1,662,116 tokens/sec |
| Configured Cost Rate | $0.001 / sec |
| Total Optimizer Overhead Spend | $0.000336 |
| Cost Accounting Mode | `estimated` |

---

## Technical Cost Methodology

1. **Configured Rate**: Optimizer overhead uses configured rate of `$0.001/sec` (`SHANAXON_OPTIMIZER_COST_PER_SECOND`).
2. **Cost Mode**: Tagged explicitly as `optimizerCostMode = "estimated"`.
3. **Hardware Independence**: CPU time is tracked separately from wall-clock time to prevent infrastructure variations from distorting financial estimates.

---

## Sample Performance Measurements

| Task ID | Tier | Tokens | Wall-Clock (ms) | CPU (ms) | Memory (MB) | Overhead Cost ($) |
|---|---|---|---|---|---|---|
| TASK_TOKENIST_001 | normal | 712 | 1 | 0 | 0 | $0.000001 |
| TASK_TOKENIST_001 | medium | 712 | 1 | 0 | 0 | $0.000001 |
| TASK_TOKENIST_001 | aggressive | 712 | 1 | 0 | 0 | $0.000001 |
| TASK_TOKENIST_002 | normal | 11066 | 1 | 0 | 0 | $0.000001 |
| TASK_TOKENIST_002 | medium | 11066 | 1 | 0 | 0 | $0.000001 |
| TASK_TOKENIST_002 | aggressive | 11066 | 1 | 0 | 0 | $0.000001 |
| TASK_TOKENIST_003 | normal | 659 | 1 | 0 | 0 | $0.000001 |
| TASK_TOKENIST_003 | medium | 659 | 1 | 0 | 0 | $0.000001 |
| TASK_TOKENIST_003 | aggressive | 659 | 1 | 0 | 0 | $0.000001 |
| TASK_TOKENIST_004 | normal | 2210 | 1 | 0 | 0 | $0.000001 |
| TASK_TOKENIST_004 | medium | 2210 | 1 | 0 | 0 | $0.000001 |
| TASK_TOKENIST_004 | aggressive | 2210 | 1 | 0 | 0 | $0.000001 |
| TASK_TOKENIST_005 | normal | 909 | 1 | 0 | 0 | $0.000001 |
| TASK_TOKENIST_005 | medium | 909 | 1 | 0 | 0 | $0.000001 |
| TASK_TOKENIST_005 | aggressive | 909 | 1 | 0 | 0 | $0.000001 |

---

*Report generated automatically by Tokenist v6.1 OptimizerCalibrator.*
