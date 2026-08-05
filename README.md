# Tokenist ⚡
> **Open-Source Local Token Optimizer Layer for AI Coding Agents**

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![Node.js Version](https://img.shields.io/badge/node-%3E%3D18.0.0-brightgreen.svg)](https://nodejs.org/)
[![MCP Spec](https://img.shields.io/badge/MCP-1.0.0-blue.svg)](https://modelcontextprotocol.io/)
[![Token Savings](https://img.shields.io/badge/Token_Savings-Up_to_84%25-success.svg)](#benchmark--performance)

**Tokenist** is an ultra-fast, local Model Context Protocol (MCP) server that sits between AI agent platforms (Claude Code, Antigravity, Kiro, OpenCode, Continue.dev) and your codebase. 

By analyzing Abstract Syntax Trees (ASTs) via `web-tree-sitter`, PageRank dependency centrality graphs, and hybrid semantic search, Tokenist **reduces token consumption by up to 84%** while preserving complete syntactic integrity and core API signatures.

---

## 🚀 Key Features

* **🌳 Multi-Tier AST Code Compression**: 3 intelligent compression levels (`normal`, `medium`, `aggressive`) using Tree-Sitter WASM parsers for TypeScript, JavaScript, Python, Go, Rust, Java, and C#.
* **🕸️ PageRank Dependency Centrality Scoring**: Power iteration graph analysis ranks high-impact architectural interfaces so foundational modules are kept at full detail while leaf utilities are aggressively compressed.
* **⚡ SHA-256 Content-Hash AST Cache**: Instant `<15ms` cache hits with SHA-256 invalidation that eliminates NFS/Docker `mtime` staleness issues.
* **🔍 BM25 + Semantic Hybrid Search**: Local ONNX `all-MiniLM-L6-v2` vector embeddings combined with BM25 keyword matching for context retrieval.
* **📌 Query-Adaptive Symbol Pinning**: Automatically extracts function, class, and variable identifiers from developer prompts to pin relevant target files.
* **📊 Analytics Dashboard & Telemetry**: Built-in HTTP dashboard and terminal cost estimator tracking reclaimed tokens and dollar savings across GPT-4o, Claude 3.5/3.7, and Gemini models.
* **🔌 Universal Platform Integration**: Out-of-the-box MCP transport adapters for Claude Code, Antigravity, Kiro, OpenCode, Continue.dev, and Gemini CLI.

---

## 📦 Quickstart

### 1. Initialize in your repository
Run the initialization wizard in your project root:
```bash
npx tokenist init
```
This generates a `.tokenist.json` configuration file tailored to your project structure.

### 2. Connect to your AI Agent

#### 🤖 Claude Code / Claude Desktop
Add Tokenist to your `claude_desktop_config.json` or `.mcp/config.json`:
```json
{
  "mcpServers": {
    "tokenist": {
      "command": "npx",
      "args": ["-y", "@darshitakhanna15/tokenist"]
    }
  }
}
```

#### 🌌 Antigravity / Gemini IDE Platform
Add to your workspace `.gemini/mcp.json`:
```json
{
  "mcpServers": {
    "tokenist": {
      "command": "npx",
      "args": ["-y", "@darshitakhanna15/tokenist"]
    }
  }
}
```

#### 🎯 Kiro / Continue.dev (HTTP Transport)
Start Tokenist in HTTP transport mode:
```bash
npx tokenist --transport http --port 3334
```

---

## 🛠️ MCP Tools Reference

Tokenist exposes 5 high-performance MCP tools:

| MCP Tool Name | Description | Key Parameters |
|---|---|---|
| `fetch_optimized_repository_map` | Crawls and compresses an entire workspace folder into a token-budgeted context map. | `dirPath`, `tier` (`normal`\|`medium`\|`aggressive`), `maxTokenBudget`, `semanticQuery`, `activePrompt` |
| `read_optimized_file` | Reads and compresses a single source file at a specified compression tier. | `filePath`, `tier` (`normal`\|`medium`\|`aggressive`) |
| `get_file_diff_context` | Extracts uncommitted git diff hunks with configurable context lines. | `filePath`, `contextLines` |
| `reindex_workspace` | Force-flushes AST caches and re-indexes PageRank dependency graphs. | *None* |
| `get_token_savings_report` | Displays accumulated token volume savings and estimated cash savings. | *None* |

---

## 📊 Benchmark & Performance

Tested on a real-world TypeScript project (49 files, ~63,000 BPE tokens):

| Compression Tier | Raw Volume | Compressed Volume | Token Reduction | Average Latency |
|---|---|---|---|---|
| **Normal** (Clean & Licenses) | 63,066 tokens | 62,804 tokens | **0.42%** | 0.8ms / file |
| **Medium** (Control Blocks Collapsed) | 63,066 tokens | 34,120 tokens | **45.89%** | 1.2ms / file |
| **Aggressive** (Function Signature Map) | 63,066 tokens | 9,982 tokens | **84.16%** | 1.8ms / file |

*Cost Savings:* At $3.00/1M tokens (Claude Sonnet), aggressive tier reduces context cost from **$0.189 to $0.029 per request** (Saving **~$160/month** for active developers).

---

## ⚙️ Configuration (`.tokenist.json`)

Customize compression behaviors by creating a `.tokenist.json` in your workspace root:

```json
{
  "defaultTier": "aggressive",
  "maxTokenBudget": 8000,
  "enableSemanticRanking": true,
  "gitAwareTiers": true,
  "pricingModel": "claude-sonnet-4",
  "alwaysInclude": [
    "src/types/**/*.ts",
    "src/server.ts"
  ],
  "preserveCommentPatterns": ["TODO", "FIXME", "@api", "@public"],
  "cacheStrategy": "disk",
  "maxCacheSizeMb": 20
}
```

---

## 🔠 Supported Languages

Tokenist provides native Tree-Sitter AST grammars for:
- **TypeScript** (`.ts`, `.tsx`)
- **JavaScript** (`.js`, `.jsx`, `.mjs`)
- **Python** (`.py`)
- **Go** (`.go`)
- **Rust** (`.rs`)
- **Java** (`.java`)
- **C#** (`.cs`)

---

## 📄 License

Distributed under the MIT License. See `LICENSE` for more information.
