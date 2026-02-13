# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Build & Run Commands

### Rust (TUI)
```bash
cargo build                          # build all crates
cargo run --release                  # run TUI binary (limerence)
cargo run --release -- -c char.json  # run with custom character card
cargo run --release -- --resume ID   # resume a session
cargo test                           # run tests
```

### Pi Web (Mainline)
```bash
cd pi-web && npm install             # install deps
cd pi-web && npm run dev             # vite dev server
cd pi-web && npm run build           # tsc + vite build → pi-web/dist/
```

### Legacy Web
```bash
cd legacy-web && npm install         # legacy React app deps
cd legacy-web && npm run dev         # legacy dev server
cd legacy-web && npm run build       # legacy build → legacy-web/dist/
```

### Netlify
Main deployment is configured in repository root `netlify.toml` (base = `pi-web`).
Edge Functions are in `pi-web/netlify/edge-functions/` (Deno runtime): `chat-proxy.ts` (LLM proxy) and `web-search.ts` (DuckDuckGo scraper).

## Architecture

```
limerence-ai   →  limerence-core  →  limerence-tui
(LLM client)      (agent runtime)    (ratatui binary)

pi-mono packages (npm @mariozechner/*)  →  pi-web (mainline web)
  pi-ai, pi-agent-core, pi-web-ui,         Lit + Tailwind CSS 4
  mini-lit                                  IndexedDB persistence

legacy-web/src/lib/ (legacy TS port of limerence-core, runs in browser)
```

**Layer rule:** lower layers never import upper layers. `limerence-ai` knows nothing about agents. `limerence-core` knows nothing about UI.

### limerence-ai (crates/limerence-ai/)
OpenAI-compatible LLM client. Handles SSE streaming, tool call assembly, message format conversion. Key types: `Message` (tagged enum: System/User/Assistant/ToolResult), `StreamEvent`, `ToolDef`, `ToolCall`, `LlmClient`.

### limerence-core (crates/limerence-core/)
Agent runtime. The agent loop in `agent.rs` is the core: stream LLM → execute tool calls → loop until no tools remain. Sends `AgentEvent` variants to the UI layer via `mpsc` channel.

Modules: `agent` (orchestrator), `character` (SillyTavern V2 cards), `config` (TOML), `memory` (BM25 with CJK tokenizer), `session` (JSONL persistence), `tool` (6 tools + dispatch), `notes`, `file_os` (sandboxed).

### limerence-tui (crates/limerence-tui/)
Binary crate. `clap` CLI args → Config → CharacterCard → Agent → ratatui event loop. The binary name is `limerence`.

### pi-web/ (Mainline web, Lit + pi-mono)
Current mainline web frontend. Uses `@mariozechner/pi-mono` framework packages instead of a custom agent loop:

- `@mariozechner/pi-agent-core` — `Agent` class, `AgentTool` interface, agent state management
- `@mariozechner/pi-ai` — model registry, streaming providers (openai-completions, openai-responses)
- `@mariozechner/pi-web-ui` — `ChatPanel`, `SettingsDialog`, `SessionsStore`, `IndexedDBStorageBackend`, etc.
- `@mariozechner/mini-lit` — `Button`, `Input`, `ThemeToggle` UI primitives

Rendering uses Lit's `html` template literals + `render()`, not React components (React is a dependency but only used indirectly by pi-web-ui internals).

`pi-web/src/lib/` contains Limerence-specific logic that plugs into pi-mono:

| File | Purpose |
|------|---------|
| `character.ts` | System prompt builder + default character loader |
| `memory.ts` | BM25 index with CJK tokenizer (same algorithm as Rust) |
| `storage.ts` | `LimerenceStorage` class — notes, files, memory entries via `IndexedDBStorageBackend` |
| `tools.ts` | `createLimerenceTools()` — 6 `AgentTool` implementations for pi-agent-core |

`pi-web/src/shims/` contains Vite aliases that make `@mariozechner/pi-ai` work in the browser:
- `pi-ai-browser.ts` — re-exports only browser-safe providers (openai-completions, openai-responses), adds `limerence-proxy` provider for Netlify proxy mode
- `env-api-keys.ts` — stubs out server-side env key lookup

`pi-web/src/main.ts` is the app entry point: intro page ↔ chat view routing, session management, workspace panel (markdown editor with diff preview).

`pi-web/src/legacy-intro/` — React-based intro/landing page mounted into the Lit app shell.

### legacy-web/ (React frontend, legacy)
TypeScript port of `limerence-core` logic, running entirely in the browser. `legacy-web/src/lib/` mirrors the Rust modules:

| TS file | Rust source | Notes |
|---------|-------------|-------|
| `agent.ts` | `agent.rs` | Agent loop via async/await instead of mpsc |
| `llm.ts` | `client.rs` + `stream.rs` | SSE parsing, AsyncGenerator yield |
| `memory.ts` | `memory.rs` | BM25 + CJK tokenizer, identical algorithm |
| `tools.ts` | `tool.rs` | Same 6 tools, async (IndexedDB + fetch) |
| `storage.ts` | `session.rs` + `notes.rs` + `file_os.rs` | IndexedDB via idb-keyval |
| `character.ts` | `character.rs` | System prompt builder |

### Reference directories (gitignored)
`pi-mono/`, `SillyTavern/`, `fast-tavern/` are gitignored reference repos, not part of the build.

## Key Patterns

- **Tool execution loop:** Agent streams LLM response, collects tool calls, executes them sequentially, appends results, then loops. The loop exits when the LLM responds without tool calls. In pi-web this is handled by `@mariozechner/pi-agent-core`'s `Agent` class; in legacy-web it's a custom async loop; in Rust it's `agent.rs` with mpsc.
- **Memory:** BM25 scoring with CJK-aware single-character tokenization. The algorithm is identical in Rust, pi-web, and legacy-web — changes to one should be mirrored.
- **Persistence:** TUI uses filesystem (`~/.limerence/`). Pi-web uses `IndexedDBStorageBackend` with three custom stores (`limerence-memory`, `limerence-notes`, `limerence-files`). Legacy-web uses idb-keyval with key prefixes.
- **Character cards:** SillyTavern V2 JSON format. Default card is `config/default_character.json`, embedded in the Rust binary via `include_str!` and served as `pi-web/public/default_character.json` (mainline) and `legacy-web/public/default_character.json` (legacy).
- **Proxy mode:** Pi-web supports two API key modes. Direct mode: browser calls LLM API with user's key. Proxy mode: browser calls `/api/llm/v1/chat/completions` Edge Function which forwards to upstream LLM using `LLM_API_KEY` env var. The shim in `pi-ai-browser.ts` registers a `limerence-proxy` provider for this.
- **SSE parsing:** Rust (`stream.rs`) uses `bytes_stream()`. Legacy-web (`llm.ts`) uses `ReadableStream` + `TextDecoder`. Pi-web delegates to pi-ai's streaming providers.
- **Message format (Rust ↔ legacy-web):** `Message` is a tagged enum (`role` field). Conversion to OpenAI wire format happens in `types.rs` (`message_to_openai`) / `llm.ts` (`messageToOpenai`). Keep these in sync.
- **Error types:** Rust uses `thiserror` (`LlmError`). Legacy-web surfaces errors as `AgentEvent { type: "error" }`. Pi-web uses pi-agent-core's event system.

## Conventions

- Rust edition 2024, workspace-level version/edition.
- Pi Web: Lit 3 + Tailwind CSS 4 (Vite plugin), Vite 7, TypeScript 5.7. UI rendering via Lit `html` templates, not JSX.
- Legacy Web: React 19, Tailwind CSS 4, React Router 7, Vite 6.
- Default language is Chinese. The default character, UI text, and tool responses are in Chinese.
- Edge Functions use Deno imports (`https://edge.netlify.com`).
