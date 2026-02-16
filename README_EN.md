# Limerence

[中文](./README.md)

Minimal AI companion agent with memory. Rust TUI + Web, ready out of the box.

## Architecture

```
  ┌──────────────────── Rust (TUI) ────────────────────────┐
  │                                                         │
  │  limerence-ai ───▶ limerence-core ───▶ limerence-tui   │
  │  LLM abstract       Agent runtime       ratatui TUI     │
  │  OpenAI protocol     BM25 · tools ·      filesystem      │
  │                      session             persistence     │
  └────────────────────────┬────────────────────────────────┘
                           │
                    Isomorphic TS port
                           │
                           ▼
  ┌─────────────────── Web (Lit + TS) ─────────────────────┐
  │                                                         │
  │  pi-mono framework ──▶ Agent Loop ──▶ Netlify Edge      │
  │  pi-agent-core         8 tools ·       chat-proxy.ts    │
  │  pi-ai · pi-web-ui     characters      web-search.ts   │
  │                         IndexedDB                       │
  │                            │                            │
  │                     ┌──────┴───────┐                    │
  │                     │ SQLite WASM  │                    │
  │                     │ FTS5 search  │                    │
  │                     │ vector cache │                    │
  │                     └──────────────┘                    │
  └─────────────────────────────────────────────────────────┘
```

Layer rule: lower layers don't know upper layers exist. `limerence-ai` knows nothing about agents, `limerence-core` knows nothing about terminals.

`pi-web/` is the current web mainline, built with Lit + Tailwind CSS 4. `legacy-web/src/lib/` is the earlier isomorphic TypeScript port of `limerence-core` (BM25, tool dispatch, session management).

## Quick Start

### TUI (Terminal)

```bash
# Set API key (defaults to DeepSeek, works with any OpenAI-compatible API)
export DEEPSEEK_API_KEY="sk-..."

# Run
cargo run --release
```

On first launch, a default config is generated at `~/.limerence/`. The default character "Su Wan" (a psychologist) will greet you.

### Web

```bash
cd pi-web
npm install
npm run dev
```

Open `http://localhost:5173` in your browser and enter your API Key in settings to start chatting.

All data is stored in the browser's IndexedDB. Your API Key never touches the server.

## Deploy to Netlify

The current web mainline (`pi-web`) can be deployed to Netlify:

1. Fork this repository
2. Create a new site on Netlify and link the repo
3. Use the repository root `netlify.toml` (already pointing to `pi-web`)
4. (Optional) Set `LLM_API_KEY`, `LLM_BASE_URL`, `LLM_MODEL_ID`, and `FREE_MODEL_ID` in Netlify environment variables to enable server-side proxy mode

Recommended (OpenRouter DeepSeek R1 free model):

```env
LLM_BASE_URL=https://openrouter.ai/api/v1
LLM_MODEL_ID=deepseek/deepseek-r1-0528:free
FREE_MODEL_ID=deepseek/deepseek-r1-0528:free
```

Web architecture:

```
Browser (Lit + TS)                  Netlify Edge Functions
┌─────────────────────┐           ┌──────────────────┐
│  Agent Loop          │           │  chat-proxy.ts   │
│  ├─ LLM streaming    │──stream──→│  (LLM API proxy) │
│  ├─ SQLite WASM mem   │           │                  │
│  │  └─ FTS5 + vectors │           │  web-search.ts   │
│  ├─ Notes & files     │──fetch───→│  (search proxy)  │
│  ├─ Session mgmt      │           └──────────────────┘
│  └─ IndexedDB store   │
└─────────────────────┘
```

Two API Key modes:
- **Bring Your Own Key** (default): browser connects directly to LLM API, key never leaves the browser
- **Server Proxy**: requests forwarded through Edge Function, key stored in Netlify env vars

## Configuration (TUI)

`~/.limerence/config.toml`:

```toml
[model]
id = "deepseek-chat"
base_url = "https://api.deepseek.com/v1"
api_key_env = "DEEPSEEK_API_KEY"

[search]
engine = "duckduckgo"  # or "searxng"
# searxng_url = "http://localhost:8080"
```

Switch providers by changing `base_url`:

```toml
# OpenAI
id = "gpt-4o"
base_url = "https://api.openai.com/v1"
api_key_env = "OPENAI_API_KEY"

# Ollama (local)
id = "qwen2.5"
base_url = "http://localhost:11434/v1"
api_key_env = "OLLAMA_API_KEY"  # any value works, Ollama doesn't validate
```

## Keyboard Shortcuts

| Key | Action |
|-----|--------|
| `Enter` | Send message |
| `Esc` | Abort current generation |
| `Ctrl+N` | New session |
| `Ctrl+C` | Quit |

## Tools

The agent has 8 built-in tools, invoked automatically based on conversation context:

| Tool | Purpose |
|------|---------|
| `memory_search` | SQLite FTS5 + BM25 hybrid search over memory files and conversation history, CJK-aware |
| `memory_write` | Write persistent memory files (PROFILE.md / MEMORY.md / daily logs) |
| `memory_get` | Read memory file content by line range |
| `web_search` | DuckDuckGo / SearXNG web search |
| `note_write` | Write persistent notes to `~/.limerence/notes/` |
| `note_read` | Read notes or list all notes |
| `file_read` | Read files from sandboxed workspace |
| `file_write` | Create/write files in sandboxed workspace |

## Character Cards

Compatible with SillyTavern V2/V3 format. Load a custom character with `-c`:

```bash
cargo run --release -- -c path/to/character.json
```

You can also place character cards in `~/.limerence/characters/`.

Card structure:

```json
{
  "spec": "chara_card_v2",
  "spec_version": "2.0",
  "data": {
    "name": "Character Name",
    "description": "Character description",
    "personality": "Personality traits",
    "scenario": "Scenario setting",
    "first_mes": "First message",
    "system_prompt": "System prompt",
    "mes_example": "Example dialogue",
    "extensions": {
      "limerence": {
        "tools": ["memory_search", "web_search", "note_write", "note_read", "file_read", "file_write"]
      }
    }
  }
}
```

SillyTavern ignores `extensions.limerence`, Limerence ignores SillyTavern's extra fields. V3 cards are automatically normalized to V2 format internally.

## Data Directory

```
~/.limerence/
├── config.toml      # Configuration
├── sessions/        # JSONL conversation history
├── memory/          # Memory files (PROFILE.md / MEMORY.md / daily logs)
├── notes/           # Agent's notes
├── workspace/       # Sandboxed filesystem
└── characters/      # Character cards
```

On the web, memory is stored in the browser's IndexedDB via SQLite WASM (FTS5 full-text search + vector embedding cache) for hybrid search.
