# Incremental Implementation Phase Roadmap (phase.md)
## Project Name: Tokenist — Open-Source Local Token Optimizer Layer
## Version: 4.0.0 — Distribution, Intelligence & Enterprise Edition
## Date: July 14, 2026

---

## 1. Roadmap Overview & Philosophy

Tokenist is built on a **严格零成本 (Strictly Zero-Cost) Mandate** — every library, model, and dependency is 100% free and open-source. No cloud APIs. No hidden costs.

This roadmap evolves through **12 sequential phases**, each independently testable and shippable. Phases 1–9 are **complete and production-verified**. Phases 10–12 represent the roadmap to enterprise-grade adoption and the finest developer tool in its category.

---

## 2. Phase-by-Phase Execution Breakdown

### ✅ Phase 1: Environment Initialization & Windows Path Guardrails [COMPLETED]
*   **Task 1.1:** Initialized package context, installed TypeScript strict dev dependencies.
*   **Task 1.2:** Implemented `src/core/guardrails.ts` with cross-platform path normalization.
*   **Task 1.3:** Built `src/core/verify.ts` — validated correct path resolution across PowerShell and bash.
*   **Outcome:** All cross-platform file access guardrails verified and locked.

---

### ✅ Phase 2: Core AST Extraction Engine [COMPLETED]
*   **Task 2.1:** Installed `web-tree-sitter@0.20.8` + `tree-sitter-wasms` — bypasses Windows C++/Python build failures entirely.
*   **Task 2.2:** Built `src/core/parser.ts` — `CodeCompressionEngine` with 3 compression profiles.
*   **Task 2.3:** Verified via `src/core/verify_parser.ts` — **84.72% line reduction** in aggressive tier.
*   **Outcome:** Production-grade AST parser delivering 60–90% token reduction.

---

### ✅ Phase 3: Model Context Protocol (MCP) Integration Layer [COMPLETED]
*   **Task 3.1:** Installed `@modelcontextprotocol/sdk`. Initialized `src/server.ts` and `src/index.ts`.
*   **Task 3.2:** Registered `fetch_optimized_repository_map` and `read_optimized_file` tools.
*   **Task 3.3:** Configured stdio transport. Verified MCP handshake, tool listing, and path traversal blocking.
*   **Outcome:** Full MCP server running on stdio — tested end-to-end.

---

### ✅ Phase 4: Prompt Interception & History Middleware [COMPLETED]
*   **Task 4.1:** Built `src/middleware/historyPruner.ts` — sliding window, stack trace collapse, terminal dump replacement.
*   **Task 4.2:** Built `src/middleware/promptRouter.ts` — keyword-based write-intent detection + raw code swapping.
*   **Task 4.3:** Verified via `src/core/verify_middleware.ts` — all pruning and routing tests passed.
*   **Outcome:** Multi-turn conversation context kept tight across long development sessions.

---

### ✅ Phase 5: E2E Integration & Production Compile [COMPLETED]
*   **Task 5.1:** Fixed strict TypeScript type annotations. Added `"jsx": "react"`. Built via `npm run build`.
*   **Task 5.2:** Ran all compiled verification scripts — **100% pass rate**.
*   **Task 5.3:** Cleaned debug artifacts. Verified production `dist/` layout.
*   **Outcome:** Clean production build with zero TypeScript errors.

---

### ✅ Phase 6: Multi-Language Support & Smart Compression Intelligence [COMPLETED]
*   **Task 6.1:** Built `src/core/languageRegistry.ts` — extension-to-WASM-grammar mapping (9 languages).
*   **Task 6.2:** Updated `src/core/parser.ts` to dynamically resolve language from registry.
*   **Task 6.3:** Implemented Smart Comment Intelligence — preserves JSDoc/docstrings, strips license headers.
*   **Task 6.4:** Built `src/core/workspaceIndexer.ts` — `.gitignore`-aware recursive crawler.
*   **Task 6.5:** Added `reindex_workspace` MCP tool.
*   **Task 6.6:** Verified via `src/core/verify_multilang.ts` — Python, Go, Rust all pass.
*   **Outcome:** 9-language support with intelligent comment filtering.

---

### ✅ Phase 7: Token Budget Manager & Incremental Caching [COMPLETED]
*   **Task 7.1:** Built `src/core/budgetManager.ts` — BPE heuristic + greedy tier escalation.
*   **Task 7.2:** Built `src/core/importGraph.ts` — AST-based import dependency tracker.
*   **Task 7.3:** Updated `promptRouter.ts` to inject 1-hop dependency signatures on edit intents.
*   **Task 7.4:** Built `src/core/cache.ts` — in-memory LRU cache with mtime invalidation.
*   **Task 7.5:** Added `maxTokenBudget?` parameter to both MCP tools.
*   **Task 7.6:** Verified via `src/core/verify_budget.ts` — all budget, dependency, and cache tests pass.
*   **Outcome:** Adaptive budget enforcement + instant cache hits.

---

### ✅ Phase 8: Embedding Semantic Ranker & Telemetry Dashboard [COMPLETED]
*   **Task 8.1:** Installed `@xenova/transformers` (ONNX runtime, Apache 2.0).
*   **Task 8.2:** Built `src/core/embeddingRanker.ts` — `all-MiniLM-L6-v2` local CPU inference.
*   **Task 8.3:** Integrated ranker into server tool handlers with `semanticQuery` parameter.
*   **Task 8.4:** Built `src/telemetry/metricsCollector.ts` — JSON ledger logging.
*   **Task 8.5:** Built `src/telemetry/terminalConsole.ts` — ASCII progress bar dashboard.
*   **Task 8.6:** Added `get_token_savings_report` MCP tool.
*   **Task 8.7:** Verified via `src/core/verify_embedding.ts` — semantic ranking + telemetry pass.
*   **Task 8.8:** Built `src/types/index.ts` — consolidated TypeScript type declarations.
*   **Outcome:** Semantic file ranking + local telemetry tracking.

---

### ✅ Phase 9: Production Hardening & Developer Experience [COMPLETED]
*   **Task 9.1:** Built `src/core/configLoader.ts` — loads and validates `.tokenist.json` config.
*   **Task 9.2:** Enhanced `src/core/cache.ts` — disk-persistent LRU with debounced JSON flush.
*   **Task 9.3:** Enhanced `src/core/workspaceIndexer.ts` — parallel `Promise.all` crawling.
*   **Task 9.4:** Added inline per-call savings summary to every `read_optimized_file` response.
*   **Task 9.5:** Lazy-loaded ONNX embedding ranker — cold startup now < 200ms.
*   **Task 9.6:** Added telemetry ledger rotation with automatic archiving at configurable limit.
*   **Task 9.7:** Added graceful handling for unsupported file types (.json, .md) and security block for credentials.
*   **Task 9.8:** Created [README.md](file:///j:/T-V1/README.md) with quick install, MCP config snippets, and benchmark data.
*   **Task 9.9:** Built standalone `npm run benchmark` CLI tool.
*   **Task 9.10:** Verified all Phase 9 features via `src/core/verify_production.ts`. All tests pass.
*   **Outcome:** Production-grade release. 85.3% token reduction. < 200ms cold start. Disk-persistent cache. Benchmark tool. Full documentation.

---

### 🔴 Phase 10: Distribution, Adoption & Developer Intelligence [NEXT]
*Objective: Make Tokenist the tool that developers discover organically, install in 60 seconds, and never remove. Remove every friction point between discovery and first value.*

#### Task 10.1: npm Package Publication & `npx tokenist init` Wizard [CRITICAL]
*   Publish `tokenist` to npm registry under the `tokenist` package name.
*   Implement an interactive `npx tokenist init` setup wizard:
    - *"Which IDE are you using? (Claude Desktop / Cursor / Windsurf / VS Code)"*
    - *"What's your primary language? (TypeScript / Python / Go / Mixed)"*
    - *"What's your typical context budget? (8K / 32K / 200K)"*
    - Generates a perfect `.tokenist.json` + prints the exact MCP JSON block to paste into the IDE
    - Runs a self-test and confirms the server is responding correctly
*   **Why Critical:** Installation should be a single command. Every step beyond that loses developers.

#### Task 10.2: Dollar Cost Estimation in Savings Report [CRITICAL]
*   Extend `src/telemetry/metricsCollector.ts` and `src/telemetry/terminalConsole.ts` with dollar cost estimates.
*   Maintain a pricing table for common models (updated quarterly):
    ```
    Claude Sonnet 4: $3.00 / 1M input tokens
    Claude Haiku 3.5: $0.80 / 1M input tokens
    GPT-4o: $2.50 / 1M input tokens
    Gemini 2.5 Pro: $1.25 / 1M input tokens
    ```
*   Add to savings report:
    ```
    Tokens Saved This Session  : 94,200
    Est. Cost Saved (Sonnet)   : ~$0.28
    Est. Monthly Savings       : ~$8.40 (at current session rate)
    ```
*   Configurable via `.tokenist.json` → `"pricingModel": "claude-sonnet-4"`.
*   **Why Critical:** Developers don't feel tokens. They feel dollars. This single addition makes the tool's value visible and shareable.

#### Task 10.3: Git-Aware Compression Tiers (`src/core/gitAwareTier.ts`) [HIGH]
*   Query `git diff --name-only HEAD~1` to identify files changed in the last 24 hours.
*   Files modified recently → `normal` tier (developer is actively working on them — needs full detail).
*   Files untouched for 30+ days → `aggressive` tier (stable code — just signatures needed).
*   Fallback gracefully if git is not installed or workspace is not a git repo.
*   Expose via config: `"gitAwareTiers": true/false`.
*   **Why Important:** Smart context management without any user configuration — the tool just gets smarter over time.

#### Task 10.4: Context Pinning Enforcement (`src/core/configLoader.ts` + `src/server.ts`) [HIGH]
*   Implement the `alwaysInclude` config field already defined in the schema.
*   In `fetch_optimized_repository_map`: always fetch `alwaysInclude` files at `normal` tier regardless of budget.
*   In `read_optimized_file`: skip budget escalation for pinned files.
*   Support glob patterns: `"alwaysInclude": ["src/types/**", "src/api/contracts.ts"]`.
*   **Why Important:** Developers have mental models of which files are "always relevant." Pinning lets them encode that knowledge once and forget about it.

#### Task 10.5: VS Code Extension (`tokenist-vscode/`) [HIGH — Viral Feature]
*   Build a lightweight VS Code extension (separate package within the monorepo).
*   Sidebar panel showing real-time session stats:
    ```
    ┌───────────────────────────────┐
    │  ⚡ Tokenist Active            │
    │  Session tokens saved: 94K    │
    │  This file: 847 tokens (81%)  │
    │  Est. cost saved: $0.28       │
    │  [View Full Report]           │
    └───────────────────────────────┘
    ```
*   Status bar item showing live savings percentage as you work.
*   One-click `reindex_workspace` command from the command palette.
*   **Why Important:** Makes the tool visible. An invisible tool gets uninstalled. A VS Code extension with a live savings counter is the single most viral feature possible — developers screenshot it and share it.

#### Task 10.6: Environment Variable Config Override [HIGH — Enterprise Blocker]
*   All `.tokenist.json` fields must be overridable via `TOKENIST_*` environment variables:
    ```bash
    TOKENIST_DEFAULT_TIER=aggressive
    TOKENIST_MAX_BUDGET=8000
    TOKENIST_CACHE_PATH=/shared/cache/tokenist.json
    TOKENIST_SHOW_INLINE_SUMMARY=true
    TOKENIST_PRICING_MODEL=gpt-4o
    ```
*   ENV vars take priority over `.tokenist.json` which takes priority over defaults.
*   Load ENV overrides in `src/core/configLoader.ts` after reading the file.
*   **Why Critical for Enterprise:** Docker containers, CI/CD pipelines, and remote dev environments cannot use `.tokenist.json` files. This is a hard blocker for enterprise deployment.

#### Task 10.7: End-to-End Verification Suite (`src/core/verify_phase10.ts`) [HIGH]
*   Tests all new Phase 10 features:
    - Dollar cost estimation produces correct values for known token counts
    - Git-aware tier correctly falls back when git is unavailable
    - Context pinning files are always included at normal tier regardless of budget ceiling
    - ENV variable overrides correctly take priority over config file values
*   All tests must pass via `npm run build && node dist/core/verify_phase10.js`

---

### 🟡 Phase 11: Enterprise Features & Team Collaboration [PLANNED]
*Objective: Give enterprise teams the visibility, deployment flexibility, and audit tooling they need to adopt Tokenist at scale.*

#### Task 11.1: Team Analytics Web Dashboard (`src/dashboard/`)
*   A zero-dependency, single-file HTML + embedded JS dashboard served at `http://localhost:3333`.
*   Launched via `npx tokenist dashboard`.
*   Shows:
    - Team-wide token savings per day (line chart, pure SVG)
    - Per-file breakdown table sorted by most savings
    - Dollar cost savings with configurable pricing model
    - Efficiency trend chart (7-day rolling average)
*   Reads directly from `telemetry_ledger.json` — zero database, zero server.
*   **Why Important:** This is what a CTO shows in a budget meeting to justify the tool.

#### Task 11.2: Docker Image (`Dockerfile`)
*   Official `Dockerfile` for containerized MCP server deployment.
*   Base image: `node:20-alpine` (minimal surface area).
*   ENV-only configuration (no config file needed inside container).
*   Supports mounting workspace volume: `-v /path/to/project:/workspace`.
*   Publish to Docker Hub as `tokenist/tokenist:latest`.
*   **Why Critical:** Enterprise teams deploy shared MCP servers in containers. Without Docker support, enterprise adoption is blocked.

#### Task 11.3: Audit Log Export (`src/cli/export.ts`)
*   `npx tokenist export --format csv --from 2026-07-01 --to 2026-07-31` command.
*   Generates a structured CSV or JSON report with:
    - Per-file token savings data
    - Compression tier used
    - Latency statistics
    - Timestamps
*   Importable into Datadog, Grafana, Excel, or any BI tool.
*   **Why Important:** Enterprise procurement teams require audit trails and exportable usage data for compliance and budgeting.

#### Task 11.4: Shared Cache Server Mode (`src/cache/sharedCacheServer.ts`)
*   When `"cacheMode": "shared"` in config, Tokenist reads/writes from a network path or shared NFS mount.
*   Team members point to the same `TOKENIST_CACHE_PATH=/mnt/shared/tokenist_cache.json`.
*   One team member runs `reindex_workspace` → results instantly available to all team members.
*   **Why Important:** 10 developers on the same codebase shouldn't each re-parse every file independently. Shared cache reduces team-wide compute by 90%.

#### Task 11.5: Slack / Teams Webhook Integration (`src/telemetry/webhookReporter.ts`)
*   Configure a Slack/Teams webhook URL in `.tokenist.json`:
    ```json
    { "webhook": { "url": "https://hooks.slack.com/...", "schedule": "weekly" } }
    ```
*   Automatically sends a weekly message:
    ```
    📊 Tokenist Weekly Report — Your team saved 1.2M tokens this week!
    Cost saved: ~$3.60 | Top file: src/api/handler.ts (91.3% reduction)
    ```
*   **Why Important:** Makes the tool visible to team leads and managers. This is how Tokenist spreads virally through organizations.

---

### 🟡 Phase 12: Intelligence, Self-Tuning & Advanced Features [PLANNED]
*Objective: Make Tokenist the smartest context optimizer in existence — one that learns from usage and requires zero manual tuning.*

#### Task 12.1: Usage Pattern Learning (`src/core/usageTracker.ts`)
*   Track which files are read most frequently across sessions.
*   Automatically promote most-accessed files to `normal` tier (always keep in full detail).
*   Automatically demote files not accessed in 14+ days to `aggressive` tier.
*   No configuration required — the tool tunes itself based on your real workflow.
*   **Why Important:** The best tool is the one that gets smarter the more you use it. This creates compounding value and makes Tokenist sticky.

#### Task 12.2: Project Type Auto-Detection (`src/core/projectDetector.ts`)
*   Detect project type from `package.json`, `go.mod`, `Cargo.toml`, `pyproject.toml`, `pom.xml`, etc.
*   Auto-suggest optimized `.tokenist.json` configuration:
    - Next.js project → exclude `*.stories.tsx`, `*.test.tsx`, `public/**`
    - Go microservice → exclude `vendor/**`, `*_test.go`
    - Python ML project → exclude `__pycache__`, `*.ipynb`, `.venv/**`
*   `npx tokenist init` uses this detector to pre-fill the setup wizard.
*   **Why Important:** Zero-config experience for common project types. Most developers shouldn't need to write any configuration.

#### Task 12.3: Compression Tier Auto-Tuning (`src/core/tierTuner.ts`)
*   Track which tier produces the best LLM outcomes per file type.
*   If a developer frequently edits a file after reading its aggressive-tier version, auto-promote it to normal.
*   Works by correlating `reindex_workspace` reads → `read_optimized_file` writes → subsequent edits.
*   **Why Important:** The current tier system is static. Auto-tuning means Tokenist gets better at predicting which files need more detail — without any user intervention.

#### Task 12.4: Context Diff Mode (`src/core/diffContext.ts`)
*   New MCP tool: `get_file_diff_context` — instead of sending the full file, sends only the changed sections + surrounding 10-line context window.
*   Ideal for code review sessions where the LLM only needs to understand recent changes.
*   Token reduction for diff-based queries: 90-95%.
*   **Why Important:** Most AI code review sessions are reviewing diffs, not entire files. This single tool makes Tokenist indispensable for PR review workflows.

#### Task 12.5: Multi-Workspace Support (`src/core/workspaceManager.ts`)
*   Single Tokenist server instance can manage multiple workspace roots simultaneously.
*   Developers working on microservices monorepos can query files across multiple services.
*   Config: `"workspaces": ["./service-a", "./service-b", "../shared-types"]`.
*   **Why Important:** Enterprise developers often work across multiple related repositories. Single-workspace limitation is a frustration for monorepo and polyrepo teams.

---

## 3. Development Strategy (v4.0)

```
[ Design Task ] ──► [ Code ] ──► [ Test on Real 200+ File Codebase ] ──► [ Verify ] ──► [ Lock & Ship ]
```

**v4.0 Priority Rules:**
1. **Zero friction, zero config by default:** Every new feature must work with zero configuration and only become configurable for power users.
2. **Enterprise-first reliability:** Every feature must have graceful fallback, ENV variable override, and explicit documentation.
3. **Measure everything:** Dollar cost savings must be visible at every surface — CLI, web dashboard, Slack, VS Code extension.
4. **No bloat:** Every dependency added must be justified. The strictly zero external API-call mandate is permanent.

---

## 4. Complete Phase Completion Summary

| Phase | Name | Status |
|-------|------|--------|
| 1 | Environment Initialization & Windows Path Guardrails | ✅ COMPLETED |
| 2 | Core AST Extraction Engine | ✅ COMPLETED |
| 3 | MCP Integration Layer | ✅ COMPLETED |
| 4 | Prompt Interception & History Middleware | ✅ COMPLETED |
| 5 | E2E Integration & Production Compile | ✅ COMPLETED |
| 6 | Multi-Language Support & Smart Compression | ✅ COMPLETED |
| 7 | Token Budget Manager & Incremental Caching | ✅ COMPLETED |
| 8 | Embedding Semantic Ranker & Telemetry Dashboard | ✅ COMPLETED |
| 9 | Production Hardening & Developer Experience | ✅ COMPLETED |
| 10 | Distribution, Adoption & Developer Intelligence | 🔴 NEXT |
| 11 | Enterprise Features & Team Collaboration | 🟡 PLANNED |
| 12 | Intelligence, Self-Tuning & Advanced Features | 🟡 PLANNED |

---

## 5. Target Metrics After Phase 10-12 Completion

| Metric | Phase 9 (Current) | Phase 10 Target | Phase 12 Target |
|--------|-------------------|-----------------|-----------------|
| Time to first value | ~5 minutes | < 60 seconds | < 30 seconds |
| Token savings | 60-90% | 60-90% | 70-95% (auto-tuned) |
| Enterprise deployable | ❌ No | ✅ ENV vars + Docker | ✅ Shared cache + audit logs |
| Value visibility | Inline summary | Dollar cost savings | VS Code extension + Slack |
| Configuration required | Some | Zero (auto-detect) | Zero (self-tuning) |
| Multi-workspace | ❌ No | ❌ No | ✅ Yes |