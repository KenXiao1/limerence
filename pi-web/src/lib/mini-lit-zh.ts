/**
 * Chinese translations for @mariozechner/mini-lit i18n system.
 * Covers all i18n() keys used by pi-web-ui components.
 */

import { defaultEnglish } from "@mariozechner/mini-lit";

/** mini-lit built-in keys — Chinese */
const miniLitCore: Record<string, string> = {
  "*": "*",
  Copy: "复制",
  "Copy code": "复制代码",
  "Copied!": "已复制！",
  Download: "下载",
  Close: "关闭",
  Preview: "预览",
  Code: "代码",
  "Loading...": "加载中…",
  "Select an option": "选择一项",
  "Mode 1": "模式 1",
  "Mode 2": "模式 2",
  Required: "必填",
  Optional: "可选",
  "Input Required": "需要输入",
  Cancel: "取消",
  Confirm: "确认",
};

/** pi-web-ui keys — Chinese */
const piWebUi: Record<string, string> = {
  // ── Settings dialog ──
  Settings: "设置",
  "API Keys": "API 密钥",
  "Configure API keys for LLM providers. Keys are stored locally in your browser.":
    "配置 LLM 提供商的 API 密钥。密钥保存在浏览器本地。",
  Proxy: "代理",
  "Allows browser-based apps to bypass CORS restrictions when calling LLM providers. Required for Z-AI and Anthropic with OAuth token.":
    "允许浏览器应用绕过 CORS 限制调用 LLM 提供商。Z-AI 和 Anthropic OAuth 令牌模式需要此功能。",
  "Use CORS Proxy": "使用 CORS 代理",
  "Proxy URL": "代理地址",
  "Format: The proxy must accept requests as <proxy-url>/?url=<target-url>":
    "格式：代理须接受 <proxy-url>/?url=<target-url> 形式的请求",

  // ── Providers & Models ──
  "Add Provider": "添加提供商",
  "Edit Provider": "编辑提供商",
  "Provider Name": "提供商名称",
  "e.g., My Ollama Server": "例如：我的 Ollama 服务器",
  "Provider Type": "提供商类型",
  "Base URL": "基础 URL",
  "e.g., http://localhost:11434": "例如：http://localhost:11434",
  "API Key (Optional)": "API 密钥（可选）",
  "Leave empty if not required": "不需要则留空",
  "Testing...": "测试中…",
  "Test Connection": "测试连接",
  Discovered: "发现了",
  models: "个模型",
  and: "和",
  more: "更多",
  "For manual provider types, add models after saving the provider.":
    "手动类型的提供商请在保存后添加模型。",
  "Please fill in all required fields": "请填写所有必填字段",
  "Failed to save provider": "保存提供商失败",
  "OpenAI Completions Compatible": "OpenAI Completions 兼容",
  "OpenAI Responses Compatible": "OpenAI Responses 兼容",
  "Anthropic Messages Compatible": "Anthropic Messages 兼容",
  Save: "保存",
  Models: "模型",
  "Checking...": "检查中…",
  Disconnected: "已断开",
  Refresh: "刷新",
  Edit: "编辑",
  Delete: "删除",
  "Enter API key": "输入 API 密钥",
  "✗ Invalid": "✗ 无效",

  // ── Model selector ──
  "Select Model": "选择模型",
  "Search models...": "搜索模型…",
  Thinking: "思考",
  Vision: "视觉",

  // ── Sessions ──
  Sessions: "会话列表",
  "Load a previous conversation": "加载历史对话",
  "No sessions yet": "暂无会话",
  messages: "条消息",
  "Delete this session?": "删除此会话？",
  Today: "今天",
  Yesterday: "昨天",
  "{days} days ago": "{days} 天前",

  // ── Auth token ──
  "Enter Auth Token": "输入认证令牌",
  "Please enter your auth token.": "请输入您的认证令牌。",

  // ── API key prompt ──
  "API Key Required": "需要 API 密钥",

  // ── Persistent storage ──
  "Storage Permission Required": "需要存储权限",
  "This app needs persistent storage to save your conversations":
    "此应用需要持久存储来保存您的对话",
  "Why is this needed?": "为什么需要此权限？",
  "Without persistent storage, your browser may delete saved conversations when it needs disk space. Granting this permission ensures your chat history is preserved.":
    "如果没有持久存储权限，浏览器可能会在磁盘空间不足时删除已保存的对话。授予此权限可确保聊天记录不会丢失。",
  "What this means:": "这意味着：",
  "Your conversations will be saved locally in your browser":
    "您的对话将保存在浏览器本地",
  "Data will not be deleted automatically to free up space":
    "数据不会被自动删除以释放空间",
  "You can still manually clear data at any time":
    "您仍可随时手动清除数据",
  "No data is sent to external servers": "不会向外部服务器发送任何数据",
  "Continue Anyway": "仍然继续",
  "Requesting...": "请求中…",
  "Grant Permission": "授予权限",

  // ── Attachments ──
  PDF: "PDF",
  Document: "文档",
  Presentation: "演示文稿",
  Spreadsheet: "电子表格",
  Text: "文本",
  "Error loading file": "加载文件出错",
  "No text content available": "无可用文本内容",
  "No content available": "无可用内容",
  "Failed to load PDF": "加载 PDF 失败",
  "Failed to load document": "加载文档失败",
  "Failed to load spreadsheet": "加载电子表格失败",
  "Failed to display text content": "显示文本内容失败",
  "Error loading document": "加载文档出错",
  "Error loading spreadsheet": "加载电子表格出错",
  "Error loading PDF": "加载 PDF 出错",
  "Failed to fetch file": "获取文件失败",
  "Invalid source type": "无效的来源类型",
  Remove: "移除",

  // ── Artifacts ──
  "Show artifacts": "显示工件",
  Artifacts: "工件",
  "Close artifacts": "关闭工件",
  "Creating artifact": "正在创建工件",
  "Created artifact": "已创建工件",
  "Updating artifact": "正在更新工件",
  "Updated artifact": "已更新工件",
  "Rewriting artifact": "正在重写工件",
  "Rewrote artifact": "已重写工件",
  "Getting artifact": "正在获取工件",
  "Got artifact": "已获取工件",
  "Deleting artifact": "正在删除工件",
  "Deleted artifact": "已删除工件",
  "Getting logs": "正在获取日志",
  "Got logs": "已获取日志",
  "Processing artifact": "正在处理工件",
  "Processed artifact": "已处理工件",
  "An error occurred": "发生错误",
  "(no output)": "（无输出）",
  "Preparing artifact...": "准备工件中…",
  "Preview not available for this file type.": "此文件类型不支持预览。",
  "Click the download button above to view it on your computer.":
    "请点击上方下载按钮在电脑上查看。",
  "Copy HTML": "复制 HTML",
  "Reload HTML": "重新加载 HTML",
  "Download HTML": "下载 HTML",
  "No logs for {filename}": "{filename} 无日志",
  "Copy SVG": "复制 SVG",
  "Download SVG": "下载 SVG",
  "Copy Markdown": "复制 Markdown",
  "Download Markdown": "下载 Markdown",

  // ── Console ──
  console: "控制台",
  "Autoscroll enabled": "自动滚动已开启",
  "Autoscroll disabled": "自动滚动已关闭",
  "Copy logs": "复制日志",
  "Copy output": "复制输出",

  // ── Tool renderers ──
  "Running command...": "正在执行命令…",
  "Waiting for command...": "等待命令…",
  "Executing JavaScript": "正在执行 JavaScript",
  "Preparing JavaScript...": "准备 JavaScript 中…",
  Calculating: "正在计算",
  "Writing expression...": "正在编写表达式…",
  "Waiting for expression...": "等待表达式…",
  "Getting current time in": "正在获取当前时间，时区：",
  "Getting current date and time": "正在获取当前日期和时间",
  "Getting time...": "获取时间中…",

  // ── Messages ──
  "Error:": "错误：",
  "Request aborted": "请求已中止",
  Call: "调用",
  Result: "结果",
  "(no result)": "（无结果）",
  "No session available": "无可用会话",
  "No session set": "未设置会话",

  // ── Message editor ──
  "Drop files here": "拖放文件到此处",
  "Type a message...": "输入消息…",
  Off: "关闭",
  Minimal: "最低",
  Low: "低",
  Medium: "中",
  High: "高",

  // ── Format ──
  Free: "免费",
};

/** Merged Chinese translations for setTranslations() */
export const miniLitChinese: Record<string, string | ((...args: unknown[]) => string)> = {
  ...miniLitCore,
  ...piWebUi,
};

/** Re-export English defaults with pi-web-ui keys (passthrough) */
export const miniLitEnglish: Record<string, string | ((...args: unknown[]) => string)> = {
  ...defaultEnglish,
};
