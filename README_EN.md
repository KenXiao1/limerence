# Limerence

[中文](./README.md)

Minimal AI companion agent with memory. Rust TUI + Web, ready out of the box.

## Architecture

```
                     Rust (TUI)                           Web (Browser)
                     ─────────                            ────────────
┌──────────────┐   ┌──────────────┐   ┌──────────────┐
│ limerence-ai │──→│limerence-core│──→│limerence-tui │
│ LLM abstract │   │ Agent runtime│   │ ratatui TUI  │
│ OpenAI proto  │   │ BM25·tools·  │   │ filesystem   │
│               │   │ session      │   │ persistence  │
└──────────────┘   └──────┬───────┘   └──────────────┘
                          │
                   Isomorphic TS port
                          │
                          ▼
                   ┌──────────────┐   ┌──────────────┐
                   │  Agent Loop  │──→│Edge Functions │
                   │  (React+TS)  │   │ chat-proxy.ts │
                   │  IndexedDB   │   │ web-search.ts │
                   └──────────────┘   └──────────────┘
```

Layer rule: lower layers don't know upper layers exist. `limerence-ai` knows nothing about agents, `limerence-core` knows nothing about terminals.

`web/src/lib/` is an isomorphic TypeScript port of `limerence-core`. The algorithms (BM25, tool dispatch, session management) are kept in sync with the Rust side.

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
cd web
npm install
npm run dev
```

Open `http://localhost:5173` in your browser and enter your API Key in settings to start chatting.

All data is stored in the browser's IndexedDB. Your API Key never touches the server.

## Deploy to Netlify

The web version can be deployed to Netlify in one click:

1. Fork this repository
2. Create a new site on Netlify and link the repo
3. Build config is preset in `web/netlify.toml`
4. (Optional) Set `LLM_API_KEY`, `LLM_BASE_URL`, `LLM_MODEL_ID` in Netlify environment variables to enable server-side proxy mode

Web architecture:

```
Browser (React)                    Netlify Edge Functions
┌─────────────────────┐           ┌──────────────────┐
│  Agent Loop (TS)    │           │  chat-proxy.ts   │
│  ├─ LLM streaming   │──stream──→│  (LLM API proxy) │
│  ├─ BM25 memory     │           │                  │
│  ├─ Notes system     │           │  web-search.ts   │
│  ├─ Session mgmt     │──fetch───→│  (search proxy)  │
│  └─ IndexedDB store  │           └──────────────────┘
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

The agent has 6 built-in tools, invoked automatically based on conversation context:

| Tool | Purpose |
|------|---------|
| `memory_search` | BM25 keyword search over conversation history, CJK-aware tokenization |
| `web_search` | DuckDuckGo / SearXNG web search |
| `note_write` | Write persistent notes to `~/.limerence/notes/` |
| `note_read` | Read notes or list all notes |
| `file_read` | Read files from sandboxed workspace |
| `file_write` | Create/write files in sandboxed workspace |

## Character Cards

Compatible with SillyTavern V2 format. Load a custom character with `-c`:

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

SillyTavern ignores `extensions.limerence`, Limerence ignores SillyTavern's extra fields.

## Data Directory

```
~/.limerence/
├── config.toml      # Configuration
├── sessions/        # JSONL conversation history
├── memory/          # Memory index (BM25)
├── notes/           # Agent's notes
├── workspace/       # Sandboxed filesystem
└── characters/      # Character cards
```
