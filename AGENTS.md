# Repository Guidelines

## Project Structure & Module Organization
- `crates/limerence-ai`: OpenAI-compatible client, wire types, and streaming parser.
- `crates/limerence-core`: agent runtime, BM25 memory, tool dispatch, config/session persistence.
- `crates/limerence-tui`: terminal binary (`limerence`) built with `ratatui` + `crossterm`.
- `pi-web/`: current web mainline (Vite + TypeScript + Lit/pi-mono); Netlify edge functions live in `pi-web/netlify/edge-functions/`.
- `legacy-web/`: older React implementation kept for reference and comparison.
- `config/default_character.json`: default character card shared by TUI/Web flows.
- `SillyTavern/`, `fast-tavern/`, and `pi-mono/` are local references and are gitignored.

## Build, Test, and Development Commands
```bash
cargo build
cargo run --release
cargo run --release -- -c config/default_character.json
cargo test

cd pi-web && npm install && npm run dev
cd pi-web && npm run build
cd legacy-web && npm install && npm run dev
```
- `cargo run --release` starts the TUI app.
- `pi-web` is the primary browser client; `legacy-web` is secondary.
- Root `netlify.toml` builds from `pi-web` via `npm ci && npm run build`.

## Coding Style & Naming Conventions
- Respect layer boundaries: `limerence-ai -> limerence-core -> limerence-tui` (no upward imports).
- Rust (edition 2024): `snake_case` for modules/functions, `PascalCase` for types/enums.
- TypeScript: keep `strict`-mode compatible code, semicolons, and 2-space indentation.
- Preserve naming parity across Rust and TS ports for shared concepts (`memory`, `tools`, `session`).

## Testing Guidelines
- Minimum verification for changes:
  - Rust paths: `cargo test`
  - Web paths: `npm run build` in the touched app (`pi-web` and/or `legacy-web`)
- No first-party web test runner is configured yet; type-check + production build is the required baseline.
- If adding tests, use `*_test.rs` (Rust) and `*.test.ts` / `*.test.tsx` (web), near the code under test.

## Commit & Pull Request Guidelines
- Recent commits use short, imperative subjects; optional prefixes are acceptable (`feat:`, `init:`).
- Keep commits scoped to one layer or concern (`core`, `tui`, `pi-web`, docs).
- PRs should include:
  - What changed and why
  - Affected directories
  - Commands run for verification
  - Screenshots/GIFs for UI updates
- Link related issues and call out config/env changes (`DEEPSEEK_API_KEY`, `LLM_*`).
