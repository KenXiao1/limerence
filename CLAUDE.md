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
Legacy Edge Functions are in `legacy-web/netlify/edge-functions/` (Deno runtime).

## Architecture

```
limerence-ai   →  limerence-core  →  limerence-tui
(LLM client)      (agent runtime)    (ratatui binary)
                        ↑
                   legacy-web/src/lib/ (legacy TS port of core, runs in browser)
```

**Layer rule:** lower layers never import upper layers. `limerence-ai` knows nothing about agents. `limerence-core` knows nothing about UI.

### limerence-ai (crates/limerence-ai/)
OpenAI-compatible LLM client. Handles SSE streaming, tool call assembly, message format conversion. Key types: `Message` (tagged enum: System/User/Assistant/ToolResult), `StreamEvent`, `ToolDef`, `ToolCall`, `LlmClient`.

### limerence-core (crates/limerence-core/)
Agent runtime. The agent loop in `agent.rs` is the core: stream LLM → execute tool calls → loop until no tools remain. Sends `AgentEvent` variants to the UI layer via `mpsc` channel.

Modules: `agent` (orchestrator), `character` (SillyTavern V2 cards), `config` (TOML), `memory` (BM25 with CJK tokenizer), `session` (JSONL persistence), `tool` (6 tools + dispatch), `notes`, `file_os` (sandboxed).

### limerence-tui (crates/limerence-tui/)
Binary crate. `clap` CLI args → Config → CharacterCard → Agent → ratatui event loop. The binary name is `limerence`.

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

Two API key modes: direct (browser → LLM API) or proxy (browser → Edge Function → LLM API with server-side key).

## Key Patterns

- **Message format:** `Message` is a tagged enum (`role` field). Conversion to OpenAI wire format happens in `types.rs` (`message_to_openai`) / `llm.ts` (`messageToOpenai`). Keep these in sync.
- **Tool execution loop:** Agent streams LLM response, collects tool calls, executes them sequentially, appends `ToolResult` messages, then loops. The loop exits when the LLM responds without tool calls.
- **SSE parsing:** Both Rust (`stream.rs`) and TS (`llm.ts`) parse `data: ` lines from chunked SSE. The TS version uses `ReadableStream` + `TextDecoder`; Rust uses `bytes_stream()`.
- **Memory:** BM25 scoring with CJK-aware single-character tokenization. The algorithm is identical in Rust and TS — changes to one should be mirrored.
- **Persistence:** TUI uses filesystem (`~/.limerence/`). Web uses IndexedDB with key prefixes (`session:`, `note:`, `file:`, `memory:entries`).
- **Character cards:** SillyTavern V2 JSON format. Default card is `config/default_character.json`, embedded in the Rust binary via `include_str!` and served as `pi-web/public/default_character.json` (mainline) and `legacy-web/public/default_character.json` (legacy).
- **Error types:** Rust uses `thiserror` (`LlmError`). Web surfaces errors as `AgentEvent { type: "error" }`.

## Conventions

- Rust edition 2024, workspace-level version/edition.
- Web: React 19, Tailwind CSS 4 (Vite plugin), React Router 7.
- Default language is Chinese. The default character, UI text, and tool responses are in Chinese.
- Edge Functions use Deno imports (`https://edge.netlify.com`).
