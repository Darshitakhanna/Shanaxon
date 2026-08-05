# Project Requirement Document (PRD)
## Project Name: Tokenist — Open-Source Local Token Optimizer Layer
## Version: 4.0.0 — Distribution, Intelligence & Enterprise Edition
## Date: July 14, 2026

---

## 1. Executive Summary & Problem Statement

### 1.1 Introduction
In modern software engineering, AI-assisted development tools and autonomous programming agents (Claude, Cursor, Windsurf, GitHub Copilot, Aider) have become the daily workflow of millions of developers. These systems face a critical, daily-exhausting bottleneck: **Token Bloat & Context Limit Exhaustion**.

Developers hit context limits mid-task. They restart conversations. They lose context. They re-paste the same files repeatedly. They pay for tokens they don't need. This is not an occasional problem — **it is a daily tax on developer productivity that costs real money and kills flow states.**

### 1.2 The Problem (The Developer's Daily Pain)
*   **Context Window Death:** A developer working on a 50-file codebase exhausts their 200K context window within 8-10 turns. They are forced to restart and re-paste context — losing their entire conversational thread.
*   **The Invisible Cost:** Every re-paste, every full file read, every bloated conversation is real money leaving the developer's wallet. Most developers have no idea how much they're spending per session.
*   **The "Lost in the Middle" Problem:** LLMs lose accuracy when critical structural information is buried inside thousands of lines of boilerplate, JSX markup, and implementation details.
*   **Token Budget Blindness:** Today's tools have zero awareness of remaining context budget. They blindly send entire files regardless of how little space remains.
*   **Cross-Platform Friction:** Most optimizer tools use UNIX shell utilities that break immediately on Windows — shutting out a massive segment of developers.
*   **No Dependency Awareness:** When an LLM edits a file, it lacks the types and interfaces of imported files, producing hallucinated parameter names and type errors in generated code.
*   **Invisible Value:** Even when a tool is working, developers can't see it saving them tokens or money — so they abandon it.
*   **Enterprise Deployment Barrier:** Tools that require config files and manual setup can't be deployed in Docker containers or CI/CD pipelines — blocking enterprise adoption entirely.

### 1.3 The Solution: Tokenist
A **100% Free, Open-Source, Locally-Executed Token Optimizer Layer** that transparently intercepts every AI code request and compresses it to its structural essence — saving 60-95% of tokens while keeping everything the LLM needs.

In v4.0, Tokenist becomes a **platform**: a tool that both indie developers and enterprise teams adopt without friction, see value from immediately (in dollars, not tokens), and that gets smarter the longer they use it.

---

## 2. Target Audience & Personas

### 2.1 The Indie Developer / Solo Builder
*   **Daily Pain:** Context limits kill their flow state. They're burning money on repetitive API calls they don't need.
*   **What They Need:** One command that installs everything. Works in 60 seconds. Shows dollar savings immediately. No configuration required.
*   **What Makes Them Stay:** The VS Code extension sidebar showing their savings growing. The dollar estimate that proves value. The tool that gets smarter as they use it.

### 2.2 The Cross-Platform Engineer (Windows-Primary)
*   **Daily Pain:** AI tools that work on macOS but silently break on Windows due to UNIX path utilities.
*   **What They Need:** Zero-config, out-of-the-box compatibility with PowerShell. No WSL, no Docker, no emulation required.

### 2.3 The Budget-Conscious Developer / API Cost Optimizer
*   **Daily Pain:** API bills that spike unexpectedly. No visibility into what's causing the cost.
*   **What They Need:** Dollar cost estimation per session, per file, and projected monthly. Something they can show their manager or co-founder to justify the setup.

### 2.4 The Multi-Language Polyglot Engineer
*   **Daily Pain:** Token optimizers that only handle TypeScript are useless for their Python ML scripts, Go microservices, or Rust system components.
*   **What They Need:** One unified tool that handles all major languages transparently with no per-language configuration.

### 2.5 The Enterprise Engineering Team (v4.0 Target)
*   **Daily Pain:** Teams spending hundreds of dollars per month on AI API calls with zero visibility into waste. Tools that can't be deployed in Docker or configured via ENV variables — blocking DevOps teams.
*   **What They Need:** Docker image, ENV variable configuration, shared cache server, audit log exports, team analytics dashboard, and Slack/Teams weekly savings reports. A tool a DevOps engineer can deploy in one hour with no developer friction.

### 2.6 The Engineering Manager / CTO
*   **Daily Pain:** No visibility into AI tooling ROI. Can't justify AI assistant costs to finance without hard data.
*   **What They Need:** The team analytics web dashboard showing aggregate monthly token savings, dollar cost saved, and per-developer breakdown. A URL they can share in a board meeting.

---

## 3. Product Scope & Functional Architecture (v4.0)

```
┌──────────────────────────────────────────────────────────┐
│             Developer's Local Source Directory           │
└───────────────────────────┬──────────────────────────────┘
                            │
                            ▼
┌──────────────────────────────────────────────────────────┐
│  Layer 0: Config Loader (.tokenist.json + ENV override)  │
│  Reads preferences: tier, budget, pricing, languages     │
└───────────────────────────┬──────────────────────────────┘
                            │
                            ▼
┌──────────────────────────────────────────────────────────┐
│  Layer 1: Project Auto-Detector                          │
│  Detects Next.js / Go / Rust / Python and sets defaults  │
└───────────────────────────┬──────────────────────────────┘
                            │
                            ▼
┌──────────────────────────────────────────────────────────┐
│  Layer 2: Workspace Indexer (.gitignore-aware, parallel) │
│  Concurrent crawl → import graph → disk cache            │
└───────────────────────────┬──────────────────────────────┘
                            │
                            ▼
┌──────────────────────────────────────────────────────────┐
│  Layer 3: Multi-Language AST Engine                      │
│  9 languages, 3 tiers, smart comment intelligence        │
└───────────────────────────┬──────────────────────────────┘
                            │
                            ▼
┌──────────────────────────────────────────────────────────┐
│  Layer 4: Token Budget Manager                           │
│  BPE counting → adaptive tier escalation per-file        │
│  Respects alwaysInclude pinned files                     │
└───────────────────────────┬──────────────────────────────┘
                            │
                            ▼
┌──────────────────────────────────────────────────────────┐
│  Layer 5: Git-Aware Tier Resolver                        │
│  Recent files → normal, stale files → aggressive         │
└───────────────────────────┬──────────────────────────────┘
                            │
                            ▼
┌──────────────────────────────────────────────────────────┐
│  Layer 6: Disk-Persistent Cache (local or shared NFS)    │
│  mtime-keyed → survives server restarts → <1ms hits      │
└───────────────────────────┬──────────────────────────────┘
                            │
                            ▼
┌──────────────────────────────────────────────────────────┐
│  Layer 7: MCP Protocol Server (stdio)                    │
│  6 tools exposed to AI agents and IDE integrations       │
└───────────────────────────┬──────────────────────────────┘
                            │
                            ▼
┌──────────────────────────────────────────────────────────┐
│  Layer 8: Semantic Ranker (lazy-loaded ONNX)             │
│  Optional, on-demand, non-blocking                       │
└───────────────────────────┬──────────────────────────────┘
                            │
                            ▼
┌──────────────────────────────────────────────────────────┐
│  Layer 9: Telemetry, Dollar Cost + Visibility Layer      │
│  Inline summary → rotating ledger → dollar estimate      │
│  → VS Code extension → web dashboard → Slack webhook     │
└──────────────────────────────────────────────────────────┘
```

---

## 4. Comprehensive Feature Specifications

### 4.1 Completed Features (v1.0–v3.0 / Phases 1–9)

| Feature | Status | Phase |
|---------|--------|-------|
| Multi-Language AST Extraction (9 languages) | ✅ Complete | 2, 6 |
| 3-Tier Compression (normal / medium / aggressive) | ✅ Complete | 2 |
| Smart Comment Intelligence (preserve JSDoc, strip license) | ✅ Complete | 6 |
| MCP Protocol Server (stdio, 4 tools) | ✅ Complete | 3 |
| Conversational History Pruning | ✅ Complete | 4 |
| Intent-Based Prompt Routing | ✅ Complete | 4 |
| BPE Token Budget Manager with Greedy Escalation | ✅ Complete | 7 |
| AST Import Dependency Graph (1-hop injection) | ✅ Complete | 7 |
| Disk-Persistent LRU Cache (mtime invalidation) | ✅ Complete | 9 |
| Lazy-Load ONNX Semantic Ranker | ✅ Complete | 8, 9 |
| Telemetry Ledger with Rotation | ✅ Complete | 8, 9 |
| Inline Per-Call Savings Summary | ✅ Complete | 9 |
| Configuration Loader (.tokenist.json) | ✅ Complete | 9 |
| Parallel Workspace Indexer | ✅ Complete | 9 |
| Unsupported File Type Handling | ✅ Complete | 9 |
| CLI Benchmark Tool | ✅ Complete | 9 |
| Security: Credentials Block (.env, .pem, .key) | ✅ Complete | 9 |
| Cross-Platform Windows/macOS/Linux Support | ✅ Complete | 1 |

---

### 4.2 Phase 10 Features — Distribution & Developer Intelligence

#### 4.2.1 `npx tokenist init` Setup Wizard [CRITICAL]
*   One-command install: `npx tokenist@latest init`
*   Interactive prompts auto-generate `.tokenist.json` and IDE-specific MCP config
*   Self-test on completion verifying server responds correctly
*   **Success Criteria:** Time from `npx tokenist init` to first successful file read < 60 seconds

#### 4.2.2 npm Package Publication
*   Published as `tokenist` on npm
*   Semantic versioning (SemVer)
*   Changelog maintained in `CHANGELOG.md`

#### 4.2.3 Dollar Cost Estimation
*   Embedded pricing table for Claude Sonnet 4, Claude Haiku 3.5, GPT-4o, Gemini 2.5 Pro
*   Per-call, per-session, and projected monthly savings in USD
*   Configurable via `pricingModel` field in `.tokenist.json`

#### 4.2.4 Git-Aware Compression Tiers
*   Files modified in last 24h → `normal` tier
*   Files untouched for 30+ days → `aggressive` tier
*   Graceful fallback when git unavailable
*   Toggle via `"gitAwareTiers": true/false`

#### 4.2.5 Context Pinning Enforcement
*   `alwaysInclude` glob patterns enforced in all tool calls
*   Pinned files always served at `normal` tier regardless of budget
*   Never omitted even at maximum budget escalation

#### 4.2.6 Environment Variable Configuration Override
*   All config fields overridable via `TOKENIST_*` ENV variables
*   Priority: ENV > `.tokenist.json` > built-in defaults
*   **Critical for enterprise Docker/CI deployment**

#### 4.2.7 VS Code Extension (`tokenist-vscode`)
*   Sidebar panel with live session savings and dollar estimate
*   Status bar indicator with real-time percentage
*   Command palette: Reindex, Dashboard, Savings Report
*   Published to VS Code Marketplace

---

### 4.3 Phase 11 Features — Enterprise & Team Collaboration

#### 4.3.1 Team Analytics Web Dashboard
*   Zero-dependency HTML dashboard at `http://localhost:3333`
*   Line chart, bar chart, top-files table, dollar savings summary
*   Launched via `npx tokenist dashboard`

#### 4.3.2 Docker Image
*   Official `tokenist/tokenist:latest` Docker Hub image
*   Base: `node:20-alpine`, runs as non-root user
*   Fully ENV-variable driven
*   Workspace mounted at `/workspace`

#### 4.3.3 Audit Log Export
*   `npx tokenist export --format csv --from 2026-07-01 --to 2026-07-31`
*   Importable into Datadog, Grafana, Excel

#### 4.3.4 Shared Cache Server Mode
*   `"cacheStrategy": "shared"` reads/writes from network path
*   Team-wide cache warm after single `reindex_workspace`

#### 4.3.5 Slack / Teams Webhook Integration
*   Scheduled weekly savings reports
*   Rich message with dollar savings, top files, efficiency trend

---

### 4.4 Phase 12 Features — Intelligence & Advanced Capabilities

#### 4.4.1 Usage Pattern Learning
*   Automatically promotes frequently-accessed files to `normal` tier
*   Demotes files not accessed in 14+ days to `aggressive`
*   Zero configuration required — self-tuning

#### 4.4.2 Project Type Auto-Detection
*   Detects project type from manifests (`package.json`, `go.mod`, `Cargo.toml`, etc.)
*   Auto-generates optimized `.tokenist.json` for the detected project type

#### 4.4.3 Compression Tier Auto-Tuning
*   Correlates read patterns with subsequent edit patterns
*   Promotes files that frequently require edit-mode reads to `normal` tier

#### 4.4.4 Context Diff Mode
*   New MCP tool: `get_file_diff_context`
*   Returns only changed sections + 10-line context window
*   90-95% token reduction for code review workflows

#### 4.4.5 Multi-Workspace Support
*   Single Tokenist server manages multiple workspace roots simultaneously
*   Config: `"workspaces": ["./service-a", "./service-b", "../shared-types"]`

---

## 5. Non-Functional Requirements

### 5.1 Zero-Cost Mandate ($0.00)
*   Every library, model, and dependency is 100% free and open-source
*   Zero external API calls during normal operation
*   All ML inference runs on local CPU via ONNX

### 5.2 Performance Targets (v4.0)
| Metric | Target |
|--------|--------|
| Server cold start | < 200ms |
| Cache hit (in-memory) | < 1ms |
| Cache hit (disk load) | < 5ms |
| Cache miss (parse + compress) | < 50ms per file |
| Workspace index (200 files) | < 8 seconds |
| Telemetry report generation | < 50ms always |
| Time to first value (`npx tokenist init`) | < 60 seconds |

### 5.3 Reliability
*   Graceful degradation on every external dependency (git, ONNX, webhooks, network cache)
*   All graceful fallbacks must leave core tool functional
*   No crash on malformed config, corrupted cache, or missing `.tokenist.json`

### 5.4 Cross-Platform
*   **Primary:** Windows 11 (PowerShell 7+, CMD)
*   **Secondary:** macOS (Apple Silicon + Intel), Linux (Ubuntu/Debian)
*   No native modules — pure JS/WASM only

### 5.5 Security
*   All file reads validated against workspace root(s) — no traversal possible
*   `.env`, `.pem`, `.key`, `.p12`, `.pfx`, `.crt` permanently blocked regardless of config
*   `.git/` directory hardcoded exclusion
*   No external network calls during normal operation
*   Webhook URL stored in ENV variable — never written to disk or telemetry logs
*   Docker container runs as non-root user with read-only workspace mount by default