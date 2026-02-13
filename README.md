# Limerence

[English](./README_EN.md)

极简 AI 记忆陪伴 agent。Rust TUI + Web 双端，开箱即用。

## 架构

```
crates/
  limerence-ai     LLM 抽象层，只懂 OpenAI 协议
  limerence-core   Agent 运行时，不懂终端
  limerence-tui    ratatui 终端界面

web/               React 前端（可部署到 Netlify）
  src/lib/         从 Rust 移植的 TS 核心（agent loop / BM25 / tools）
  netlify/         Edge Functions（LLM 代理 + 搜索代理）
```

层级规则：下层不知道上层存在。`limerence-ai` 不知道 agent，`limerence-core` 不知道终端。

## 快速开始

### TUI（终端）

```bash
# 设置 API key（默认 DeepSeek，可换任何 OpenAI 兼容 API）
export DEEPSEEK_API_KEY="sk-..."

# 运行
cargo run --release
```

首次启动会在 `~/.limerence/` 生成默认配置，默认角色「苏晚」（心理咨询师御姐）会打招呼。

### Web

```bash
cd web
npm install
npm run dev
```

打开浏览器访问 `http://localhost:5173`，在设置中填入 API Key 即可开始对话。

数据存储在浏览器 IndexedDB 中，API Key 不经过服务器。

## 部署到 Netlify

Web 版可以一键部署到 Netlify：

1. Fork 本仓库
2. 在 Netlify 创建新站点，关联仓库
3. 构建配置已在 `web/netlify.toml` 中预设好
4. （可选）在 Netlify 环境变量中设置 `LLM_API_KEY`、`LLM_BASE_URL`、`LLM_MODEL_ID` 以启用服务端代理模式

Web 版架构：

```
浏览器（React）                    Netlify Edge Functions
┌─────────────────────┐           ┌──────────────────┐
│  Agent Loop (TS)    │           │  chat-proxy.ts   │
│  ├─ LLM 流式客户端  │──stream──→│  (转发 LLM API)  │
│  ├─ BM25 记忆搜索   │           │                  │
│  ├─ 笔记系统        │           │  web-search.ts   │
│  ├─ 会话管理        │──fetch───→│  (搜索代理)      │
│  └─ IndexedDB 持久化│           └──────────────────┘
└─────────────────────┘
```

两种 API Key 模式：
- **用户自带 Key**（默认）：浏览器直连 LLM API，Key 不经过服务器
- **服务端代理**：通过 Edge Function 转发，Key 存 Netlify 环境变量

## 配置（TUI）

`~/.limerence/config.toml`：

```toml
[model]
id = "deepseek-chat"
base_url = "https://api.deepseek.com/v1"
api_key_env = "DEEPSEEK_API_KEY"

[search]
engine = "duckduckgo"  # 或 "searxng"
# searxng_url = "http://localhost:8080"
```

切换到其他 provider 只需改 `base_url`：

```toml
# OpenAI
id = "gpt-4o"
base_url = "https://api.openai.com/v1"
api_key_env = "OPENAI_API_KEY"

# Ollama 本地
id = "qwen2.5"
base_url = "http://localhost:11434/v1"
api_key_env = "OLLAMA_API_KEY"  # 随便填，Ollama 不校验
```

## 快捷键

| 按键 | 功能 |
|------|------|
| `Enter` | 发送消息 |
| `Esc` | 中断当前生成 |
| `Ctrl+N` | 新会话 |
| `Ctrl+C` | 退出 |

## 工具

Agent 有 6 个内置工具，会根据对话上下文自动调用：

| 工具 | 用途 |
|------|------|
| `memory_search` | BM25 关键词搜索历史对话，支持 CJK 分词 |
| `web_search` | DuckDuckGo / SearXNG 网络搜索 |
| `note_write` | 写持久笔记到 `~/.limerence/notes/` |
| `note_read` | 读笔记或列出所有笔记 |
| `file_read` | 读取沙箱工作区文件 |
| `file_write` | 在沙箱工作区创建/写入文件 |

## 角色卡

兼容 SillyTavern V2 格式。用 `-c` 参数加载自定义角色：

```bash
cargo run --release -- -c path/to/character.json
```

也可以把角色卡放到 `~/.limerence/characters/` 目录。

角色卡结构：

```json
{
  "spec": "chara_card_v2",
  "spec_version": "2.0",
  "data": {
    "name": "角色名",
    "description": "角色描述",
    "personality": "性格特征",
    "scenario": "场景设定",
    "first_mes": "第一条消息",
    "system_prompt": "系统提示词",
    "mes_example": "对话示例",
    "extensions": {
      "limerence": {
        "tools": ["memory_search", "web_search", "note_write", "note_read", "file_read", "file_write"]
      }
    }
  }
}
```

SillyTavern 会忽略 `extensions.limerence`，Limerence 会忽略 SillyTavern 的多余字段。

## 数据目录

```
~/.limerence/
├── config.toml      # 配置
├── sessions/        # JSONL 会话历史
├── memory/          # 记忆索引（BM25）
├── notes/           # Agent 的笔记
├── workspace/       # 沙箱文件系统
└── characters/      # 角色卡
```

## License

MIT
