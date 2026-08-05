# AI Agent Operational Rules & Boundary Configuration (rules.md)
## Project Name: Open-Source Local Token Optimizer Layer (Project Dharohar-Context)
## Version: 1.0.0
## Date: July 14, 2026

---

## 1. Executive Directive & Context Guardrails

To eliminate hallucinations, prevent attention drift, and guarantee high-quality code generation under tight execution constraints, any AI agent acting within this repository must adhere strictly to these operational boundaries.

### 1.1 The Context Integrity Principle
*   **Acknowledge Signature Maps:** The agent must recognize that the codebase is dynamically filtered via AST parsing down to method signatures.
*   **Banned Inferences:** The agent is strictly prohibited from guessing, inventing, or assuming the internal implementation details of a function or dependency if it only sees a minimized structural signature placeholder (`const functionName = ...`).
*   **The Explicit Read Mandate:** If an agent needs to evaluate, debug, or modify the internal calculations of a function, it **must** explicitly issue an uncompressed tool call to read the target file's raw text before writing any code modifications.

---

## 2. Technical Engineering Constraints & Code Standards

### 2.1 Native Windows Cross-Compatibility
*   **No Spawn Primitives:** Never emit code that spawns native UNIX subsystem commands (`cat`, `ls`, `grep`, `rm`, `sed`).
*   **Path Abstraction Rule:** All path management operations must use pure language runtime abstractions (`path.join()`, `path.normalize()`). Standardize file system interaction entirely via asynchronous Node.js `fs.promises` interfaces.

### 2.2 Strict Language Boundaries
*   **Typing Policy:** Write strict, fully annotated TypeScript. The use of implicit `any` parameter mappings is strictly forbidden. Every interface, configuration envelope, and data matrix must feature formal type syntax definitions.
*   **Zero-Cost Execution:** Do not introduce third-party node packages that require online software service registration, licensing fees, cloud databases, or enterprise activation thresholds.

---

## 3. Strict Execution & Quality Timelines

To ensure features are delivered rapidly without compromising architectural stability, the agent must implement a structured verification pipeline:

```
[ Step 1: Structural Verification ] ──► Validate local file existence and map AST signatures
                 │
                 ▼
[ Step 2: Pure Local Compilation  ] ──► Compile locally to verify zero type mismatches
                 │
                 ▼
[ Step 3: Zero-Overhead Telemetry ] ──► Append structural token logging metrics atomically
```

*   **Boundary 3.1: Structural Blueprint Checks:** Before altering an entry point, the agent must run a path confirmation check. Writing code blindly based on historical memory without validating current local file existence is a direct violation.
*   **Boundary 3.2: Immediate Local Validation:** Every modification must compile locally without type errors or broken dependency exports. The agent must verify that structural updates do not introduce performance regressions or drop tool call response latencies below the **50-millisecond parsing ceiling**.