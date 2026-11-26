# Shanaxon ⚡
> **Open-Source Local Context Optimization, Intelligence & FinOps Layer for AI Coding Agents**

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![Node.js Version](https://img.shields.io/badge/node-%3E%3D18.0.0-brightgreen.svg)](https://nodejs.org/)
[![MCP Spec](https://img.shields.io/badge/MCP-1.0.0-blue.svg)](https://modelcontextprotocol.io/)
[![Release](https://img.shields.io/badge/version-6.1.0-blue.svg)](#)

**Shanaxon** is a local Model Context Protocol (MCP) server (`stdio`) and CLI toolkit that sits between AI coding agents (Claude Code, Claude Desktop, Antigravity, Gemini CLI, OpenCode, Kiro, Continue.dev) and your codebase.

By combining pure-WASM `web-tree-sitter` AST compression, PageRank dependency centrality graphs, BM25 + local ONNX hybrid search, deterministic quality gates, and an economic cost-benefit gate, Shanaxon reduces redundant context tokens while protecting critical code structure and preventing negative-savings optimizations.

---

## 🚀 Key Capabilities

* **🌳 Multi-Tier AST Code Compression**: `normal`, `medium`, and `aggressive` AST transformations using Tree-Sitter WASM grammars for TypeScript (`.ts`, `.tsx`), JavaScript (`.js`, `.jsx`), Python (`.py`), Go (`.go`), Rust (`.rs`), Java (`.java`), and C# (`.cs`), with regex fallback.
* **🕸️ PageRank Dependency Centrality & Blast Radius**: AST import graph analysis scores architectural interfaces (`normal` tier) vs leaf utilities (`aggressive` tier) and computes multi-hop forward/reverse impact.
* **🔁 Reversible Compress-Cache-Retrieve (CCR)**: Compressed outputs embed `[Shanaxon:retrieve hash=...]` markers so agents can fetch exact uncompressed source on demand via `retrieve_original`.
* **🧠 v6.0 Context Intelligence Engine**: Deterministic task classification (`analyze_task`), model-policy tier caps (`modelPolicy`), persistent architectural memory (`store_critical_memory` / `recall_critical_memory`), prompt capability equalization (`equalize_context`), multi-signal retention `QualityGate`, and agent failure-loop detection (`detect_agent_failure`).
* **💰 v6.1 Economic Gate & Unified FinOps**: Preflight abstention (`shouldAttemptOptimization`), Pareto tier selection (`evaluateParetoTradeoff`), and net-savings gating (`evaluateEconomicGate`) backed by a unified `ModelPricingRegistry` and language-aware `Tokenizer`.
* **⚡ SHA-256 Content-Hash AST Cache & Hybrid Search**: Persistent `.Shanaxon/cache.json` with SHA-256 invalidation plus local ONNX `Xenova/all-MiniLM-L6-v2` + BM25 hybrid ranking.
* **🛡️ Workspace Containment & Secret Guardrails**: Enforces lexical + symlink `realpath` containment inside workspace roots and blocks `.env*`, `*.pem`, `*.key`, `*.p12`, `*.pfx`, `id_rsa`, `id_ed25519`, `*secret*`, and `*credential*` paths.

---

## 📦 Quickstart

### 1. Initialize in your repository
Run the setup wizard in your project root (or pass `--yes` for non-interactive defaults):
```bash
npx shanaxon-mcp init
# or non-interactive:
npx shanaxon-mcp init --yes
```
This creates `.Shanaxon.json` with v6.1 intelligence and economics defaults and registers Shanaxon in `.mcp/config.json`, `.gemini/mcp.json`, and your OS Claude Desktop config.

### 2. Connect to your AI Agent (`stdio` MCP Transport)

#### 🤖 Claude Code / Claude Desktop (`.mcp/config.json` or `claude_desktop_config.json`)
```json
{
  "mcpServers": {
    "Shanaxon": {
      "command": "npx",
      "args": ["-y", "shanaxon-mcp"]
    }
  }
}
```

#### 🌌 Antigravity / Gemini IDE (`.gemini/mcp.json`)
```json
{
  "mcpServers": {
    "Shanaxon": {
      "command": "npx",
      "args": ["-y", "shanaxon-mcp"]
    }
  }
}
```

> **Note:** Shanaxon operates as a `stdio` JSON-RPC MCP server. Standalone HTTP analytics are served separately via `Shanaxon dashboard` (default port `3333`); `--transport http` is not implemented in the MCP entrypoint.

---

## 💻 CLI Reference

| Command | Description |
|---|---|
| `Shanaxon` | Starts the MCP server over `stdio` (default for IDE/agent clients). |
| `Shanaxon init [--yes \| -y]` | Generates `.Shanaxon.json` and registers workspace/IDE MCP configs. |
| `Shanaxon benchmark` | Benchmarks multi-tier AST compression against `./src` in the current workspace. |
| `Shanaxon export [--format json\|csv] [--out <file>]` | Exports `telemetry_ledger.json` to JSON or CSV. |
| `Shanaxon dashboard [--port 3333]` | Starts the local web analytics dashboard (`http://localhost:3333`). |
| `Shanaxon --version \| -v` | Prints the installed version and exits. |
| `Shanaxon --help \| -h` | Displays CLI usage help and exits. |

---

## 🛠️ MCP Tools Reference (22 Tools)

### Context Optimization & Repository Analysis
| MCP Tool | Description | Key Parameters |
|---|---|---|
| `fetch_optimized_repository_map` | Crawls a workspace directory, scores PageRank & context importance, enforces token budgets, and applies the v6.1 economic gate. | `directoryPath`, `level`, `maxTokenBudget`, `semanticQuery`, `activePrompt` |
| `read_optimized_file` | Reads and optimizes a single source file with AST compression, quality gate, economic gate, and CCR marker injection. | `filePath`, `compressionTier`, `maxTokenBudget` |
| `get_file_diff_context` | Extracts uncommitted git diff hunks with configurable context lines. | `filePath`, `contextLines` |
| `get_blast_radius` | Computes N-hop forward and reverse dependency impact for changing a file. | `filePath`, `maxHops` |
| `reindex_workspace` | Crawls workspace files, rebuilds the AST import graph, and warms `.Shanaxon/cache.json`. | *None* |
| `retrieve_original` | Restores original uncompressed source from a `[Shanaxon:retrieve hash=...]` marker. | `hash` |

### Prompt, Schema & Output Compression
| MCP Tool | Description | Key Parameters |
|---|---|---|
| `compress_output` | Content-type-aware compression for JSON payloads, build logs, terminal dumps, and stack traces. | `content` |
| `prune_chat_history` | Collapses old stack traces and long terminal dumps outside recent turns. | `messages`, `maxTurns` |
| `stabilize_prompt` | Relocates volatile timestamps, UUIDs, hashes, and PIDs to the prompt suffix for KV-cache prefix reuse. | `prompt` |
| `get_terse_system_prompt` | Returns `minimal`, `compact`, or `standard` conciseness directives. | `level` |
| `compress_mcp_schemas` | Shortens MCP tool descriptions and flattens nested JSON Schema definitions. | `schemas` |

### v6.0 Context Intelligence, Memory & Receipts
| MCP Tool | Description | Key Parameters |
|---|---|---|
| `analyze_task` | Classifies a prompt into a `TaskProfile` and resolves `ModelPolicy` tier limits. | `prompt`, `modelName` |
| `store_critical_memory` | Persists architectural decisions, constraints, dependencies, or gotchas in `.Shanaxon/memory.json`. | `category`, `title`, `content`, `priority`, `tags` |
| `recall_critical_memory` | Recalls relevant critical memories with staleness and contradiction detection. | `query`, `category`, `limit` |
| `list_critical_memory` | Lists stored critical memories, optionally filtered by category. | `category` |
| `delete_critical_memory` | Deletes a critical memory entry by ID. | `id` |
| `equalize_context` | Enriches brief prompts with recalled memories, verified file signatures, and context-gap warnings. | `prompt` |
| `detect_agent_failure` | Detects retry loops, context exhaustion, missing-dependency errors, and conflicting constraints. | `history` |
| `get_token_savings_report` | Renders an ASCII telemetry ledger summary with `ModelPricingRegistry` cost estimates. | *None* |
| `get_context_receipt` | Returns the session audit summary of all file/map context receipts. | *None* |
| `get_optimization_receipt` | Returns the latest v6.1 `OptimizationReceipt` (tokens, quality score, and net economics). | *None* |
| `run_benchmark` | Executes the 45-scenario deterministic intelligence & economics benchmark suite. | *None* |

---

## ⚙️ Configuration (`.Shanaxon.json` & `Shanaxon_*` Env Vars)

```json
{
  "defaultTier": "aggressive",
  "showInlineSummary": true,
  "enableSemanticRanking": false,
  "activeModel": "claude-3-7-sonnet",
  "pricingModel": "claude-sonnet-4",
  "enableIntelligencePipeline": true,
  "enableCapabilityEqualization": true,
  "enableCriticalMemory": true,
  "enableQualityGate": true,
  "qualityGateMinRetention": 0.85,
  "economics": {
    "enabled": true,
    "optimizerCostMode": "estimated",
    "optimizerCostPerSecond": 0.001,
    "minimumSavingsUsd": 0.00001,
    "minimumSavingsPercent": 2.0,
    "qualityFloor": 0.85,
    "trackRetries": true,
    "enablePreflight": true
  },
  "alwaysInclude": ["src/types/**/*.ts"],
  "preserveCommentPatterns": ["TODO", "FIXME", "@api", "@public"],
  "cacheStrategy": "disk",
  "cachePath": ".Shanaxon/cache.json",
  "telemetryRotationLimit": 500
}
```

### Environment Variable Overrides
- **Compression & Caching**: `Shanaxon_DEFAULT_TIER`, `Shanaxon_MAX_BUDGET`, `Shanaxon_SHOW_INLINE_SUMMARY`, `Shanaxon_SEMANTIC_RANKING`, `Shanaxon_GIT_AWARE_TIERS`, `Shanaxon_USAGE_LEARNING`, `Shanaxon_CACHE_STRATEGY`, `Shanaxon_CACHE_PATH`
- **Intelligence & Tenancy**: `Shanaxon_ACTIVE_MODEL`, `Shanaxon_PRICING_MODEL`, `Shanaxon_INTELLIGENCE_PIPELINE`, `Shanaxon_CAPABILITY_EQUALIZATION`, `Shanaxon_CRITICAL_MEMORY`, `Shanaxon_QUALITY_GATE`, `Shanaxon_MEMORY_PATH`, `Shanaxon_TENANT_ID`, `Shanaxon_ORG_ID`
- **Economics Gate**: `Shanaxon_ECONOMICS_ENABLED`, `Shanaxon_MIN_SAVINGS_USD`, `Shanaxon_MIN_SAVINGS_PCT`, `Shanaxon_QUALITY_FLOOR`, `Shanaxon_OPTIMIZER_COST_PER_SECOND`

---

## 🛠️ Development & Verification

```bash
npm install
npm run build
npm --prefix vscode-extension run build

# Run core verification suites
npx ts-node src/core/verify_phase14.ts
npx ts-node src/core/verify_budget.ts
npx ts-node src/core/verify_phase10.ts
node dist/core/verify_server.js

# Run offline 200-task economic validation
npm run validate
```

---

## 📄 License

Distributed under the MIT License. See [LICENSE](LICENSE) for more information.
