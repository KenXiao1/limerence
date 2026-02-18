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
cd pi-web && npm run lint            # oxlint
cd pi-web && npm run typecheck       # tsc --noEmit
cd pi-web && npm run static          # typecheck + lint + LOC check
cd pi-web && npm test                # vitest run
cd pi-web && npm run test:watch      # vitest watch mode
```

### Legacy Web
```bash
cd legacy-web && npm install         # legacy React app deps
cd legacy-web && npm run dev         # legacy dev server
cd legacy-web && npm run build       # legacy build → legacy-web/dist/
```

### Netlify
Main deployment is configured in repository root `netlify.toml` (base = `pi-web`).
Edge Functions are in `pi-web/netlify/edge-functions/` (Deno runtime):
- `chat.ts` — Vercel AI SDK streaming endpoint (uses `streamText` + `frontendTools` from `@assistant-ui/react-ai-sdk`)
- `chat-proxy.ts` — legacy OpenAI-compatible proxy
- `web-search.ts` — DuckDuckGo scraper

## Architecture

```
limerence-ai   →  limerence-core  →  limerence-tui
(LLM client)      (agent runtime)    (ratatui binary)

pi-web (mainline web)
  React 19 + assistant-ui + Vercel AI SDK
  Tailwind CSS 4, IndexedDB + Supabase sync

legacy-web/src/lib/ (legacy TS port of limerence-core, runs in browser)
```

**Layer rule:** lower layers never import upper layers. `limerence-ai` knows nothing about agents. `limerence-core` knows nothing about UI.

**Migration note:** pi-web was previously built on `@mariozechner/pi-mono` packages (Lit + pi-agent-core + pi-ai + pi-web-ui). It has been fully rewritten to use `@assistant-ui/react` + Vercel AI SDK (`ai` package). The pi-mono packages are no longer dependencies. Some IndexedDB store names retain `pi-web-ui:` prefixes for backward compatibility.

### limerence-ai (crates/limerence-ai/)
OpenAI-compatible LLM client. Handles SSE streaming, tool call assembly, message format conversion. Key types: `Message` (tagged enum: System/User/Assistant/ToolResult), `StreamEvent`, `ToolDef`, `ToolCall`, `LlmClient`.

### limerence-core (crates/limerence-core/)
Agent runtime. The agent loop in `agent.rs` is the core: stream LLM → execute tool calls → loop until no tools remain. Sends `AgentEvent` variants to the UI layer via `mpsc` channel.

Modules: `agent` (orchestrator), `character` (SillyTavern V2 cards), `config` (TOML), `memory` (BM25 with CJK tokenizer), `session` (JSONL persistence), `tool` (6 tools + dispatch), `notes`, `file_os` (sandboxed).

### limerence-tui (crates/limerence-tui/)
Binary crate. `clap` CLI args → Config → CharacterCard → Agent → ratatui event loop. The binary name is `limerence`.

### pi-web/ (Mainline web, React + assistant-ui + Vercel AI SDK)
Current mainline web frontend. Fully React-based with assistant-ui for chat UI and Vercel AI SDK for LLM streaming.

**Core stack:** `@assistant-ui/react` (chat primitives), `@assistant-ui/react-ai-sdk` (bridge), `ai` (Vercel AI SDK), `@ai-sdk/openai-compatible`, `@sinclair/typebox` (tool schemas), `sql.js` (SQLite FTS5 in browser), `@supabase/supabase-js` (cloud sync).

**Source layout:**

| Directory | Purpose |
|-----------|---------|
| `src/chat/runtime/` | assistant-ui runtime wiring: `RuntimeProvider.tsx` (AssistantRuntimeProvider + system prompt), `thread-list-adapter.tsx` (IndexedDB thread persistence), `thread-history-adapter.ts` (message history) |
| `src/components/` | React UI: `Chat.tsx`, `Header.tsx`, `Settings.tsx`, `Workspace.tsx`, `SessionListDialog.tsx`, `CharacterSelector.tsx`, `ToolRenderers.tsx`, `AuthDialog.tsx` |
| `src/controllers/` | Pure logic (no React): `agent.ts` (model config, commands, routing), `session.ts`, `compaction.ts`, `context-budget.ts`, `character.ts`, `group-chat.ts`, `lorebook.ts`, `presets.ts`, `prompt-presets.ts`, `regex-rules.ts`, `slash-commands.ts`, `free-model-quota.ts` |
| `src/hooks/` | React context providers: `use-storage.tsx` (IndexedDB + MemoryIndex + MemoryDB + SyncEngine), `use-settings.tsx` (character, persona, keys, lorebook, presets), `use-session.tsx` |
| `src/lib/` | Domain logic: `tools.ts` (8 AgentTools), `memory.ts` (BM25), `memory-db.ts` (SQLite FTS5), `storage.ts` (LimerenceStorage), `character.ts` (system prompt), `indexed-db.ts`, `sync-engine.ts` (Supabase sync), `tokenizer.ts` (tiktoken), `auth.ts`, `i18n.ts`, `theme.ts` |
| `src/legacy-intro/` | React landing page (ParticleLenia, FourierHeart) |
| `src/shims/` | Vite aliases (`lmstudio-sdk.ts` stub) |

**Entry point:** `src/main.tsx` → `App.tsx` (StorageProvider → SettingsProvider → intro/chat routing). Chat view wraps in `ChatRuntimeProvider` which sets up `AssistantRuntimeProvider` with `useChatRuntime` + `AssistantChatTransport` pointing to `/api/chat`.

**Server-side:** The `/api/chat` endpoint is `netlify/edge-functions/chat.ts`, which uses Vercel AI SDK's `streamText()` with `@assistant-ui/react-ai-sdk`'s `frontendTools` for client-side tool execution.

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
`pi-mono/`, `SillyTavern/`, `fast-tavern/`, `ai/` (Vercel AI SDK), `assistant-ui/`, `openclaw/` are gitignored reference repos, not part of the build.

## Key Patterns

- **Tool execution (pi-web):** Tools run client-side. The edge function (`chat.ts`) uses `frontendTools` from `@assistant-ui/react-ai-sdk` — the LLM requests tool calls, the edge function streams them to the browser, assistant-ui executes them locally via `createLimerenceTools()`, then sends results back. The tool loop uses Vercel AI SDK's `stepCountIs(max)` as the stop condition.
- **Tool execution (Rust):** Agent streams LLM → executes tool calls sequentially → appends results → loops until no tools remain (`agent.rs` with mpsc).
- **Tools (pi-web):** 8 tools defined in `src/lib/tools.ts` via `createLimerenceTools()`: `memory_search` (SQLite FTS5 + BM25 fallback), `memory_write`, `memory_get`, `web_search`, `note_write`, `note_read`, `file_read`, `file_write`. Schemas use `@sinclair/typebox`.
- **Memory:** Dual-layer search in pi-web: `MemoryDB` (SQLite FTS5 via sql.js, persistent memory files chunked into segments) + `MemoryIndex` (BM25 in-memory, conversation history). Rust and legacy-web use BM25 only. BM25 algorithm with CJK single-character tokenization is identical across all three — changes should be mirrored.
- **Persistence:** TUI uses filesystem (`~/.limerence/`). Pi-web uses `IndexedDBStorageBackend` with stores: `limerence-memory`, `limerence-notes`, `limerence-files`, `limerence-characters`, `limerence-lorebook`, `limerence-memory-db` (SQLite blob), plus `pi-web-ui:*` stores (sessions, settings, provider-keys — names kept for backward compat). Legacy-web uses idb-keyval with key prefixes.
- **Supabase sync:** `SyncEngine` in `src/lib/sync-engine.ts` does bidirectional sync between IndexedDB and Supabase (sessions, memory, notes, files, characters, lorebook). Uses Supabase Realtime for push notifications. Auth via `src/lib/auth.ts`.
- **Context management:** `context-budget.ts` manages token budgets (system prompt + lorebook + history + output reserve). `compaction.ts` uses tiktoken for precise token counting and implements message compaction when history exceeds budget.
- **Character cards:** SillyTavern V2 JSON format. Default card is `config/default_character.json`, embedded in Rust via `include_str!` and served as `pi-web/public/default_character.json`.
- **Proxy mode:** Pi-web supports two modes. Direct: browser → LLM API with user's key. Proxy: browser → `/api/chat` edge function → upstream LLM using `LLM_API_KEY` env var.
- **Message format (Rust ↔ legacy-web):** `Message` is a tagged enum (`role` field). Conversion to OpenAI wire format in `types.rs` / `llm.ts`. Keep in sync.

## Conventions

- Rust edition 2024, workspace-level version/edition.
- Pi Web: React 19, Tailwind CSS 4 (Vite plugin), Vite 7, TypeScript 5.7. Linting via oxlint (not ESLint). Tests via vitest.
- Legacy Web: React 19, Tailwind CSS 4, React Router 7, Vite 6.
- Default language is Chinese. The default character, UI text, tool descriptions, and tool responses are all in Chinese.
- Edge Functions use Deno runtime with `npm:` specifiers (e.g. `npm:ai@6`, `npm:@ai-sdk/openai-compatible`) and `https://edge.netlify.com` imports.
- Pi-web controllers (`src/controllers/`) are pure functions with no React imports — testable without DOM. React state lives in `src/hooks/` context providers.
