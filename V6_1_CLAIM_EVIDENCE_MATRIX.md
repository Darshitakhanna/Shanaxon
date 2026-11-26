# TOKENIST v6.1 — CLAIM-EVIDENCE MATRIX

| Claim | Empirical Evidence | Measurement Type | Confidence Level | Explicit Limitation |
|---|---|---|---|---|
| **"45/45 Benchmark Scenarios Passing"** | Verified 100% pass rate in `benchmarkRunner.ts` (35 unit + 10 v6.1 validation scenarios). | Automated deterministic test suite | High | Unit benchmark scope. |
| **"Token Count Accounting Accuracy"** | `Tokenizer.countTokens()` BPE counter applied across all tasks instead of `chars/3.8`. | Language-aware BPE token estimation | High | BPE estimate calibrated to standard cl100k/o200k tokens. |
| **"Token Reduction on Large Code Tasks"** | Achieved up to **5.63% token reduction** on large TypeScript code files (`parser.ts`, `server.ts`). Overall 200-task corpus mean: **0.04%** (Median: **0%**, Max: **5.63%**). | BPE token count comparison | High | Corpus includes 136 small requests (<150 tokens) and 56 abstentions where reduction is 0%. |
| **"100% Critical Information Retention"** | 0 critical comment or symbol loss on all accepted candidates across 200 tasks. | Deterministic AST structural evaluation | High | Structural AST retention does not guarantee human-subjective prose elegance. |
| **"0 False Optimization Rate"** | Zero candidate accepted where quality score fell below configured floor (0.85). | Quality Gate + Pareto Selector enforcement | High | Corpus boundary scope. |
| **"$0.016933 Net Financial Savings"** | Baseline spend ($1.255068) minus Tokenist spend ($1.238135 = model $1.238127 + overhead $0.000008) = **$0.016933 (1.35% net savings)**. | Offline Model Pricing Registry computation | High (Mathematically reproducible) | Benchmark scale sample ($1.25 baseline total spend). |
| **"DO NOT OPTIMIZE / Abstention Enforcement"** | 136 preflight skips (`SKIP_TOO_SMALL`) + 56 fallbacks (`FALLBACK_BASELINE`) correctly abstained when savings <= $0. | Economic Gate + Preflight rules | High | Tested against simulated model pricing rules. |
| **"LLM Judge Cost Isolation"** | Gated via `TOKENIST_ENABLE_LLM_JUDGE=true`; judge cost ($0.0003/task) accrued into `evaluationCostUsd` separately. | Isolated telemetry ledger | High | Optional evaluation layer only; opt-in. |
| **"Optimizer Overhead Tracking"** | Instrument wall-clock latency, CPU execution time, and memory usage. Overhead calculated at `$0.001/sec` estimated. | Process CPU/Memory + Latency instrumentation | Medium | Uses configured estimate (`optimizerCostMode = "estimated"`), not cloud infra billing. |
| **"Simulated Execution Environment"** | Offline benchmark uses BPE tokenizer and ModelPricingRegistry pricing. | Offline Simulation | High | Classified explicitly as `SIMULATED_LLM_EXECUTION`. Does not make live LLM API calls. |
