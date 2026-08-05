# System Architecture & Technical Design Document
## Project Name: Tokenist — Open-Source Local Token Optimizer Layer
## Version: 4.0.0 — Distribution, Intelligence & Enterprise Edition
## Date: July 14, 2026

---

## 1. Zero-Cost Technology Stack Selection

### 1.1 Core Development Environment
*   **Language Runtime:** Node.js (v20+ LTS) + TypeScript (`tsc` with `strict: true`, zero implicit `any`)
*   **Cost:** $0.00 (MIT)

### 1.2 AST Parsing Framework
*   **Engine:** `web-tree-sitter` v0.20.8 — pure WASM, zero native compilation (bypasses Windows `node-gyp`)
*   **Grammars:** `tree-sitter-wasms` — 36 pre-built WASM grammars including TypeScript, Python, Go, Rust, Java, C#
*   **Language Registry:** `src/core/languageRegistry.ts` — extension-to-grammar mapping
*   **Cost:** $0.00 (MIT)

### 1.3 MCP Protocol Layer
*   **SDK:** `@modelcontextprotocol/sdk` — official Anthropic MCP SDK
*   **Transport:** stdio JSON-RPC — no TCP sockets, no firewall alerts, native to Claude Desktop, Cursor, Windsurf, VS Code
*   **Cost:** $0.00 (MIT)

### 1.4 Semantic Embedding Engine (Lazy-Loaded)
*   **Library:** `@xenova/transformers` — ONNX Runtime in Node.js
*   **Model:** `all-MiniLM-L6-v2` (22MB, 384-dimensional vectors, Apache 2.0)
*   **Strategy:** Lazy-loaded only when `semanticQuery` is provided. Not initialized at server startup.
*   **Cost:** $0.00 (local CPU inference only)

### 1.5 Disk-Persistent Cache
*   **Strategy:** JSON file stored at `.tokenist/cache.json` (configurable via ENV or config file)
*   **Format:** `Record<filePath, { mtime: number, normal: string, medium: string, aggressive: string }>`
*   **Write Policy:** Debounced async flush — max one disk write per 5 seconds
*   **Eviction:** LRU by last-access time. Configurable max size (default: 10MB)
*   **Shared Mode:** Supports network path or NFS mount for team-shared caching (Phase 11)
*   **Cost:** $0.00 (native `fs` module)

### 1.6 Configuration System (Multi-Layer)
*   **Layer 1 (Lowest Priority):** Built-in defaults in `src/core/configLoader.ts`
*   **Layer 2:** `.tokenist.json` in workspace root — loaded at server startup
*   **Layer 3 (Highest Priority):** `TOKENIST_*` environment variables — override any config field
*   **Validator:** Strict JSON schema validation with typed TypeScript `WorkspaceConfig` interface
*   **Cost:** $0.00

### 1.7 Telemetry & Analytics
*   **Active Ledger:** Flat JSON array in `telemetry_ledger.json` (rotation at configurable limit)
*   **Archives:** Timestamped `telemetry_ledger_archive_<ts>.json` files
*   **Dollar Pricing Table:** Embedded per-model cost map, updated quarterly
*   **Web Dashboard:** Zero-dependency SVG chart HTML (Phase 11)
*   **Webhook Reporter:** Slack/Teams integration with scheduled summaries (Phase 11)
*   **Cost:** $0.00

### 1.8 Workspace Crawler
*   **Library:** `ignore` npm package (MIT) for `.gitignore` glob parsing
*   **Strategy:** Fully concurrent directory walk via `Promise.all`
*   **Custom Ignore:** `.tokenistignore` file support
*   **Cost:** $0.00

### 1.9 VS Code Extension (Phase 10)
*   **Framework:** VS Code Extension API (no Webpack, no external bundler required)
*   **Distribution:** Published to VS Code Marketplace as `tokenist.tokenist-vscode`
*   **Features:** Sidebar savings panel, status bar indicator, command palette integration
*   **Cost:** $0.00

### 1.10 Docker Support (Phase 11)
*   **Base Image:** `node:20-alpine`
*   **Configuration:** Fully ENV-variable driven (no `.tokenist.json` required inside container)
*   **Volume:** Mounts project workspace at `/workspace`
*   **Cost:** $0.00

---

## 2. Complete End-to-End Application Flow (v4.0)

```
[ IDE / AI Agent / VS Code Extension / Docker Container ]
        │
        ▼ JSON-RPC over stdio
┌─────────────────────────────────────────────────────────┐
│  Tokenist MCP Server (src/server.ts)                    │
│  Version: 4.0.0 | Tools: 6 | Transport: stdio          │
└───────────────┬─────────────────────────────────────────┘
                │
                ▼ On startup (< 200ms target)
┌─────────────────────────────────────────────────────────┐
│  Config Loader (src/core/configLoader.ts)               │
│  ├── Read .tokenist.json (or use defaults)              │
│  ├── Apply TOKENIST_* environment variable overrides    │
│  ├── Validate schema                                     │
│  └── Export typed WorkspaceConfig singleton             │
└───────────────┬─────────────────────────────────────────┘
                │
                ▼
┌─────────────────────────────────────────────────────────┐
│  Project Detector (src/core/projectDetector.ts) [NEW]   │
│  ├── Detect: Next.js / Go module / Rust / Python ML     │
│  └── Auto-populate smart exclude patterns               │
└───────────────┬─────────────────────────────────────────┘
                │
                ▼
┌─────────────────────────────────────────────────────────┐
│  Disk Cache Loader (src/core/cache.ts)                  │
│  ├── Read .tokenist/cache.json (or shared network path) │
│  ├── Validate mtime signatures                           │
│  └── Warm in-memory cache from disk                     │
└───────────────┬─────────────────────────────────────────┘
                │
                ▼ Per-request
┌─────────────────────────────────────────────────────────┐
│  Path Guardrails (src/core/guardrails.ts)               │
│  ├── Normalize Windows/UNIX slashes                     │
│  ├── Validate within workspace root(s)                  │
│  └── Block .env, .git, credentials, parent traversal   │
└───────────────┬─────────────────────────────────────────┘
                │
                ▼
┌─────────────────────────────────────────────────────────┐
│  Context Pinning (src/server.ts)                        │
│  ├── Resolve alwaysInclude glob patterns                │
│  └── Force normal tier for pinned files regardless      │
└───────────────┬─────────────────────────────────────────┘
                │
                ▼
┌─────────────────────────────────────────────────────────┐
│  Cache Lookup (src/core/cache.ts)                       │
│  ├── Hit: return in <1ms                                │
│  └── Miss: route to AST parser                          │
└───────────────┬─────────────────────────────────────────┘
                │
                ▼ On cache miss
┌─────────────────────────────────────────────────────────┐
│  Multi-Language AST Parser (src/core/parser.ts)         │
│  ├── Language resolved via languageRegistry             │
│  ├── Git-Aware Tier Override (if gitAwareTiers: true)   │
│  ├── Compress: normal / medium / aggressive             │
│  ├── Smart Comment Intelligence                          │
│  └── Write result back to disk+memory cache             │
└───────────────┬─────────────────────────────────────────┘
                │
                ▼
┌─────────────────────────────────────────────────────────┐
│  Token Budget Manager (src/core/budgetManager.ts)       │
│  ├── Estimate BPE tokens per file                       │
│  ├── Escalate tiers to fit maxTokenBudget               │
│  └── Skip escalation for pinned files                   │
└───────────────┬─────────────────────────────────────────┘
                │
                ▼ If semanticQuery provided
┌─────────────────────────────────────────────────────────┐
│  Semantic Ranker (src/core/embeddingRanker.ts)          │
│  ├── Lazy-init ONNX pipeline (only first semantic call) │
│  ├── Embed query + cosine similarity rank               │
│  └── Graceful fallback if model unavailable             │
└───────────────┬─────────────────────────────────────────┘
                │
                ▼
┌─────────────────────────────────────────────────────────┐
│  Telemetry + Dollar Cost Reporter                       │
│  ├── Log record to telemetry_ledger.json                │
│  ├── Apply rotation if > limit                          │
│  ├── Calculate dollar cost saved (pricing table)        │
│  ├── Append inline summary to response (if enabled)     │
│  └── Push webhook event if configured (Phase 11)       │
└───────────────┬─────────────────────────────────────────┘
                │
                ▼
[ AI Agent Context Window — 60-95% Tokens Saved ]
```

---

## 3. Complete File & Directory Architecture (v4.0)

```
tokenist/
├── .tokenist.json                        # User configuration file
├── .tokenist/
│   └── cache.json                        # Disk-persisted AST cache
├── .tokenistignore                        # Custom ignore patterns (optional)
├── Dockerfile                             # Official container image [Phase 11]
├── src/
│   ├── index.ts                           # Bootstrap: stdio transport
│   ├── server.ts                          # MCP server: all tool handlers
│   ├── cli/
│   │   ├── init.ts                        # `npx tokenist init` setup wizard [Phase 10]
│   │   ├── benchmark.ts                   # `tokenist benchmark ./src` CLI tool
│   │   └── export.ts                      # `tokenist export --format csv` [Phase 11]
│   ├── core/
│   │   ├── parser.ts                      # Multi-language AST compression engine
│   │   ├── guardrails.ts                  # Cross-platform path safety
│   │   ├── languageRegistry.ts            # Extension → WASM grammar map
│   │   ├── configLoader.ts                # .tokenist.json + ENV reader & validator
│   │   ├── projectDetector.ts             # Auto-detect project type [Phase 10]
│   │   ├── gitAwareTier.ts                # Git-based dynamic tier assignment [Phase 10]
│   │   ├── usageTracker.ts                # Usage pattern learning [Phase 12]
│   │   ├── tierTuner.ts                   # Compression auto-tuning [Phase 12]
│   │   ├── diffContext.ts                 # Diff-based context mode [Phase 12]
│   │   ├── budgetManager.ts               # BPE estimation + adaptive escalation
│   │   ├── importGraph.ts                 # AST-based dependency resolver
│   │   ├── cache.ts                       # Disk+memory LRU cache
│   │   ├── embeddingRanker.ts             # Lazy-loaded ONNX semantic ranker
│   │   ├── workspaceIndexer.ts            # .gitignore-aware parallel crawler
│   │   ├── workspaceManager.ts            # Multi-workspace support [Phase 12]
│   │   ├── verify.ts                      # Phase 1 verification
│   │   ├── verify_parser.ts               # Phase 2 verification
│   │   ├── verify_server.ts               # Phase 3 verification
│   │   ├── verify_middleware.ts           # Phase 4 verification
│   │   ├── verify_multilang.ts            # Phase 6 verification
│   │   ├── verify_budget.ts               # Phase 7 verification
│   │   ├── verify_embedding.ts            # Phase 8 verification
│   │   ├── verify_production.ts           # Phase 9 verification
│   │   └── verify_phase10.ts              # Phase 10 verification [Phase 10]
│   ├── middleware/
│   │   ├── historyPruner.ts               # Sliding window history compression
│   │   └── promptRouter.ts                # Intent-based + 1-hop dependency routing
│   ├── telemetry/
│   │   ├── metricsCollector.ts            # Ledger write + rotation + dollar cost
│   │   ├── terminalConsole.ts             # ASCII dashboard renderer
│   │   └── webhookReporter.ts             # Slack/Teams scheduled reports [Phase 11]
│   ├── dashboard/
│   │   └── index.html                     # Zero-dep SVG web dashboard [Phase 11]
│   └── types/
│       └── index.ts                       # Shared TypeScript type declarations
├── tokenist-vscode/                       # VS Code Extension package [Phase 10]
│   ├── package.json
│   ├── src/
│   │   ├── extension.ts                   # Extension entry point
│   │   ├── sidebarProvider.ts             # Savings sidebar panel
│   │   └── statusBar.ts                   # Live savings status bar
│   └── README.md
├── telemetry_ledger.json                  # Active telemetry records
├── package.json
├── tsconfig.json                          # Strict TypeScript config
└── README.md                             # Developer onboarding guide
```

---

## 4. Module Responsibilities (v4.0 — New Modules)

### 4.1 `src/core/configLoader.ts` [ENHANCED — ENV Overrides]
*   **Priority Chain:** Built-in defaults → `.tokenist.json` → `TOKENIST_*` ENV variables
*   **ENV Mapping:**
    - `TOKENIST_DEFAULT_TIER` → `defaultTier`
    - `TOKENIST_MAX_BUDGET` → `maxTokenBudget`
    - `TOKENIST_CACHE_PATH` → `cachePath`
    - `TOKENIST_SHOW_INLINE_SUMMARY` → `showInlineSummary`
    - `TOKENIST_PRICING_MODEL` → `pricingModel`
    - `TOKENIST_SEMANTIC_RANKING` → `enableSemanticRanking`

### 4.2 `src/core/projectDetector.ts` [NEW — Phase 10]
*   **Detects:** Next.js, Vite, Go module, Rust crate, Python (Poetry/pip), Java (Maven/Gradle), .NET
*   **Output:** Pre-configured `excludePatterns` and `alwaysInclude` recommendations
*   **Used by:** `npx tokenist init` wizard to generate smart defaults automatically

### 4.3 `src/core/gitAwareTier.ts` [NEW — Phase 10]
*   **API:** `getGitAwareTier(filePath: string): Promise<'normal' | 'medium' | 'aggressive'>`
*   **Logic:** Files in `git diff --name-only HEAD~1` → `normal`; files not committed in 30+ days → `aggressive`; all others → config default tier
*   **Fallback:** If git is unavailable, returns config default tier silently — never crashes

### 4.4 `src/telemetry/metricsCollector.ts` [ENHANCED — Dollar Cost]
*   **Pricing Table:** Embedded `PRICING_TABLE` map with per-model cost per 1M tokens
*   **New Methods:**
    - `getDollarCostSaved(tokensSaved: number, model: string): number`
    - `getProjectedMonthlySavings(records: TelemetryRecord[], model: string): number`
*   **Dashboard Integration:** Both the ASCII terminal renderer and the web dashboard consume these estimates

### 4.5 `src/cli/init.ts` [NEW — Phase 10]
*   **Interactive Wizard:**
    1. Detect project type via `projectDetector.ts`
    2. Ask IDE preference → generate IDE-specific MCP config block
    3. Ask primary language → filter language registry
    4. Ask context budget → set `maxTokenBudget`
    5. Write `.tokenist.json` with all settings
    6. Run self-test to confirm server responds correctly
    7. Print success message with copy-paste MCP config

### 4.6 `tokenist-vscode/` [NEW — Phase 10]
*   **Sidebar Panel:** Reads `telemetry_ledger.json` on a 5-second poll interval
*   **Status Bar:** Shows session savings percentage and estimated dollar savings
*   **Commands:** `Tokenist: Reindex Workspace`, `Tokenist: Open Dashboard`, `Tokenist: Show Savings Report`
*   **Zero MCP dependency:** Reads telemetry data directly from disk, no MCP call needed for display

### 4.7 `src/dashboard/index.html` [NEW — Phase 11]
*   **Self-contained:** Single HTML file with embedded vanilla JS and SVG charts
*   **Data Source:** Reads `telemetry_ledger.json` via a local Express endpoint served by `npx tokenist dashboard`
*   **Charts:** Line chart (daily savings), bar chart (per-file), table (top 10 files by savings)
*   **Responsive:** Works on any screen size, no external CSS framework

### 4.8 `src/telemetry/webhookReporter.ts` [NEW — Phase 11]
*   **Trigger:** Cron-based scheduler running inside the MCP server process
*   **Supported Platforms:** Slack (Incoming Webhooks), Microsoft Teams (Adaptive Cards)
*   **Message Template:** Rich message with weekly savings summary, top files, dollar estimate
*   **Retry Logic:** 3 retries with exponential backoff on webhook delivery failure

---

## 5. API Reference: MCP Tools (v4.0)

### Tool 1: `fetch_optimized_repository_map`
```typescript
{
  directoryPath: string;        // Target directory (relative or absolute)
  level?: 'normal'|'medium'|'aggressive'; // Default from config
  maxTokenBudget?: number;      // Hard token ceiling
  semanticQuery?: string;       // Optional: enables semantic file ranking
}
```

### Tool 2: `read_optimized_file`
```typescript
{
  filePath: string;             // Target file path
  compressionTier?: 'normal'|'medium'|'aggressive'; // Default from config
  maxTokenBudget?: number;      // Hard token ceiling for this file
}
```

### Tool 3: `reindex_workspace`
```typescript
{}  // No parameters — uses workspace root and config
// Returns: { filesIndexed, dependenciesMapped, cacheWarmed, durationMs }
```

### Tool 4: `get_token_savings_report`
```typescript
{}  // No parameters
// Returns: Formatted ASCII dashboard with dollar cost savings
```

### Tool 5: `get_file_diff_context` [Phase 12]
```typescript
{
  filePath: string;             // Target file path
  contextLines?: number;        // Lines of context around each change (default: 10)
}
// Returns: Changed sections + context, ~90-95% token reduction vs full file
```

### Tool 6: `get_workspace_stats` [Phase 11]
```typescript
{}  // No parameters
// Returns: { totalFiles, indexedFiles, cacheHitRate, avgCompressionRatio, topFiles }
```

---

## 6. Security Architecture

| Threat | Mitigation |
|--------|-----------|
| Path traversal attack | All paths validated against workspace root(s) before any read |
| Secret file exposure | `.env`, `.pem`, `.key`, `.p12`, `.pfx`, `.crt` permanently blocked |
| `.git/` directory read | Hardcoded exclusion regardless of user config |
| Arbitrary code execution | AST parsing is read-only; no `eval`, no `exec` |
| Network data exfiltration | Zero external network calls during normal operation |
| Config injection | `.tokenist.json` is strictly validated against typed schema |
| Container escape | Docker image runs as non-root user; workspace mounted read-only by default |
| Webhook credential exposure | Webhook URL stored in ENV variable, never written to disk or telemetry |

---

## 7. Configuration Reference (v4.0 Full Schema)

```json
{
  "defaultTier": "aggressive",
  "maxTokenBudget": 12000,
  "showInlineSummary": true,
  "enableSemanticRanking": false,
  "gitAwareTiers": false,
  "pricingModel": "claude-sonnet-4",
  "preserveCommentPatterns": ["TODO", "FIXME", "@api", "@public"],
  "alwaysInclude": ["src/types/**", "src/api/contracts.ts"],
  "excludePatterns": ["**/*.test.ts", "**/*.spec.ts", "**/*.stories.tsx"],
  "languages": ["typescript", "javascript", "python", "go", "rust", "java", "c_sharp"],
  "cacheStrategy": "disk",
  "cachePath": ".tokenist/cache.json",
  "maxCacheSizeMb": 10,
  "telemetryRotationLimit": 500,
  "enableUsageLearning": false,
  "webhook": {
    "url": "",
    "platform": "slack",
    "schedule": "weekly"
  }
}
```

### Environment Variable Override Reference

| ENV Variable | Config Field | Example |
|---|---|---|
| `TOKENIST_DEFAULT_TIER` | `defaultTier` | `aggressive` |
| `TOKENIST_MAX_BUDGET` | `maxTokenBudget` | `8000` |
| `TOKENIST_CACHE_PATH` | `cachePath` | `/mnt/shared/cache.json` |
| `TOKENIST_SHOW_INLINE_SUMMARY` | `showInlineSummary` | `true` |
| `TOKENIST_PRICING_MODEL` | `pricingModel` | `gpt-4o` |
| `TOKENIST_SEMANTIC_RANKING` | `enableSemanticRanking` | `false` |
| `TOKENIST_GIT_AWARE_TIERS` | `gitAwareTiers` | `true` |
| `TOKENIST_WEBHOOK_URL` | `webhook.url` | `https://hooks.slack.com/...` |