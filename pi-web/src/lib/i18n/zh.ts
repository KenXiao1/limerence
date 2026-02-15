/** Chinese (zh) translation dictionary. */
const zh: Record<string, string> = {
  // ── Header ──────────────────────────────────────────────
  "header.intro": "返回首页",
  "header.sessions": "会话列表",
  "header.new": "新会话",
  "header.editTitle": "点击编辑标题",
  "header.characters": "选择角色",
  "header.export": "导出会话",
  "header.import": "导入会话",
  "header.proxy": "切换 Netlify 代理模式",
  "header.workspaceOn": "工作区 ON",
  "header.workspace": "工作区",
  "header.workspaceTooltip": "打开 Markdown 工作区",
  "header.limerenceSettings": "Limerence 设置（人设/世界书/预设/正则）",
  "header.theme": "切换主题",
  "header.focus": "专注模式 (Ctrl+Shift+F)",
  "header.settings": "设置",

  // ── Message actions ─────────────────────────────────────
  "msg.swipePrev": "上一个回复",
  "msg.swipeNext": "下一个回复",
  "msg.regenerate": "重新生成回复 (Ctrl+Shift+R)",
  "msg.regenerateShort": "重新生成",
  "msg.editMsg": "编辑消息",
  "msg.edit": "编辑",
  "msg.deleteLast": "删除最后一轮对话",
  "msg.delete": "删除",
  "msg.userMsg": "用户消息",
  "msg.aiReply": "AI 回复",
  "msg.editLabel": "编辑{0}",
  "msg.saveEdit": "保存编辑",
  "msg.save": "保存",
  "msg.saveAndRegen": "保存并重新生成",
  "msg.cancelEdit": "取消编辑",
  "msg.cancel": "取消",

  // ── Settings tabs ───────────────────────────────────────
  "settings.persona": "人设",
  "settings.lorebook": "世界书",
  "settings.presets": "预设",
  "settings.regex": "正则",
  "settings.group": "群聊",

  // ── Persona ─────────────────────────────────────────────
  "persona.hint": "设置你的角色名和描述，AI 会在对话中使用这些信息。支持 {{user}} 模板变量。",
  "persona.nameLabel": "名字",
  "persona.namePlaceholder": "你的名字",
  "persona.descLabel": "描述",
  "persona.descPlaceholder": "关于你的描述（性格、外貌等）",
  "persona.save": "保存",
  "persona.clear": "清除",

  // ── Lorebook ────────────────────────────────────────────
  "lorebook.hint": "当对话中出现关键词时，自动注入对应的世界设定到系统提示中。",
  "lorebook.keywordsPlaceholder": "关键词（逗号分隔）",
  "lorebook.contentPlaceholder": "触发时注入的内容",
  "lorebook.add": "添加条目",
  "lorebook.empty": "暂无世界书条目",
  "lorebook.disable": "禁用",
  "lorebook.enable": "启用",
  "lorebook.delete": "删除",

  // ── Presets ─────────────────────────────────────────────
  "presets.hint": "选择生成参数预设，影响 AI 回复的风格和长度。",

  // ── Regex ───────────────────────────────────────────────
  "regex.hint": "正则规则可对 AI 输出或用户输入进行文本替换处理。",
  "regex.namePlaceholder": "规则名称",
  "regex.patternPlaceholder": "正则表达式",
  "regex.replacementPlaceholder": "替换文本",
  "regex.scopeOutput": "仅 AI 输出",
  "regex.scopeInput": "仅用户输入",
  "regex.scopeBoth": "双向",
  "regex.add": "添加规则",
  "regex.empty": "暂无正则规则",
  "regex.scopeOutputShort": "输出",
  "regex.scopeInputShort": "输入",
  "regex.scopeBothShort": "双向",
  "regex.emptyReplacement": "(删除)",
  "regex.disable": "禁用",
  "regex.enable": "启用",
  "regex.delete": "删除",

  // ── Prompt presets ────────────────────────────────────────
  "settings.prompt": "提示词",
  "prompt.hint": "导入 SillyTavern 提示词预设，自定义系统提示词的组装方式。",
  "prompt.import": "导入预设",
  "prompt.export": "导出预设",
  "prompt.clear": "清除预设",
  "prompt.active": "当前预设",
  "prompt.none": "无（使用默认提示词）",
  "prompt.roleSystem": "系统",
  "prompt.roleUser": "用户",
  "prompt.roleAssistant": "助手",
  "prompt.marker": "标记",
  "prompt.segments": "提示词片段",
  "prompt.importError": "导入失败",

  // ── Regex IO ─────────────────────────────────────────────
  "regex.export": "导出规则",
  "regex.import": "导入规则",
  "regex.importHint": "支持 Limerence 和 SillyTavern 格式",

  // ── Group chat ──────────────────────────────────────────
  "group.hint": "启用群聊后，多个角色会轮流回复你的消息。需要先在角色管理中导入角色。",
  "group.enabled": "群聊已开启",
  "group.enable": "开启群聊",
  "group.strategyLabel": "发言策略",
  "group.roundRobin": "轮流发言",
  "group.random": "随机发言",
  "group.natural": "自然平衡",
  "group.manual": "手动选择",
  "group.responsesLabel": "每轮回复数",
  "group.addLabel": "添加角色",
  "group.importFirst": "请先在角色管理中导入角色",
  "group.membersLabel": "群聊成员",
  "group.noMembers": "暂无成员",
  "group.disable": "禁用",
  "group.enable2": "启用",
  "group.remove": "移除",
  "group.noDesc": "无描述",

  // ── Character selector ──────────────────────────────────
  "char.title": "选择角色",
  "char.default": "默认角色",
  "char.delete": "删除角色",
  "char.import": "导入角色卡 (JSON/PNG)",
  "char.exportJson": "导出 JSON",
  "char.exportPng": "导出 PNG",
  "char.pngNoData": "PNG 文件中未找到角色卡数据",
  "char.defaultName": "默认角色",
  "char.importFailed": "导入失败：无法解析文件",

  // ── Tool labels (UI only, descriptions stay zh for LLM) ─
  "tool.memorySearch": "记忆搜索",
  "tool.memoryWrite": "写记忆",
  "tool.memoryGet": "读记忆",
  "tool.webSearch": "网络搜索",
  "tool.noteWrite": "写笔记",
  "tool.noteRead": "读笔记",
  "tool.fileRead": "读文件",
  "tool.fileWrite": "写文件",
  "tool.executing": "工具执行中",

  // ── Token usage ─────────────────────────────────────────
  "token.tooltip": "估算 token 用量 / 上下文窗口",

  // ── Slash commands ──────────────────────────────────────
  "slash.help": `可用命令：
/help — 显示此帮助
/stop — 停止当前生成
/new — 新建会话
/retry — 重新生成最后一条回复
/clear — 清空当前会话消息
/export — 导出当前会话为 JSON
/model — 显示当前模型信息`,

  // ── Workspace ───────────────────────────────────────────
  "ws.title": "Markdown 工作区",
  "ws.subtitle": "{0} 个 .md 文件 · {1} 条读写记录",
  "ws.refresh": "刷新文件列表",
  "ws.close": "关闭面板",
  "ws.pathLabel": "路径",
  "ws.saveToPath": "保存到该路径",
  "ws.save": "保存",
  "ws.autoLog": "Agent 的 file_read / file_write 会在下方自动记录。",
  "ws.filesLabel": "Markdown 文件",
  "ws.noFiles": "当前没有 .md 文件，输入路径后点击保存即可创建。",
  "ws.noFileSelected": "未选择文件",
  "ws.unsaved": "未保存",
  "ws.saved": "已保存",
  "ws.loading": "正在加载文件...",
  "ws.editorPlaceholder": "在这里编辑 Markdown 内容...",
  "ws.diffTitle": "变更预览",
  "ws.diffNoFile": "先选择或创建一个 Markdown 文件。",
  "ws.diffNoChange": "当前内容与已保存版本一致。",
  "ws.diffTruncated": "仅展示前 {0} 行变更。",
  "ws.eventsTitle": "读写流程",
  "ws.noEvents": "暂无读写记录。",
  "ws.invalidPath": "文件路径无效。",
  "ws.confirmSwitch": "当前文件有未保存改动，确认切换并丢弃改动吗？",
  "ws.fileNotFound": "文件不存在",
  "ws.enterValidPath": "请输入有效文件路径。",

  // ── App / render ────────────────────────────────────────
  "app.loading": "Loading...",
  "app.exitFocus": "退出专注模式 (Esc)",
  "app.importFailed": "导入失败：无法解析 JSON 文件",
  "app.importedSession": "导入的会话",

  // ── Session IO ──────────────────────────────────────────
  "data.invalidJson": "无效的 JSON 数据",
  "data.missingMessages": "会话数据缺少 messages 数组",
  "data.importedSession": "导入的会话",
  "data.unknownFormat": "无法识别的会话格式",

  // ── Landing — Hero ──────────────────────────────────────
  "landing.tagline": "Open Source AI Companion",
  "landing.heroTitle1": "有记忆的",
  "landing.heroTitle2": "AI 伙伴",
  "landing.heroDesc": "Limerence 是一个开源的 AI 对话框架，支持长期记忆、工具调用和自定义角色。所有数据存储在你的浏览器中，由数学驱动的生命体守护。",
  "landing.startChat": "开始对话",
  "landing.startChatNav": "开始聊天",

  // ── Landing — Features ──────────────────────────────────
  "landing.featuresTitle": "核心能力",
  "landing.featuresSubtitle": "数学驱动的生命体，守护你的每一段记忆",
  "landing.feat1Title": "对话记忆",
  "landing.feat1Desc": "BM25 搜索引擎，跨会话记住你说过的每一句话",
  "landing.feat2Title": "工具调用",
  "landing.feat2Desc": "搜索互联网、读写笔记和文件，不只是聊天",
  "landing.feat3Title": "角色卡",
  "landing.feat3Desc": "SillyTavern V2 兼容，自定义你的 AI 伙伴",
  "landing.feat4Title": "隐私优先",
  "landing.feat4Desc": "数据存储在浏览器本地，API Key 不经过服务器。项目完全开源，你可以 fork 后部署自己的 Supabase 实例",

  // ── Landing — Architecture ──────────────────────────────
  "landing.archTitle": "架构",
  "landing.archSubtitle": "Rust 分层架构，Web 同构移植，双端共享核心逻辑",
  "landing.archRustCore": "Rust 核心",
  "landing.archBrowser": "浏览器",
  "landing.archTsPort": "TS 同构移植",
  "landing.archCrate1Title": "LLM 抽象层",
  "landing.archCrate1Sub": "OpenAI 协议 · SSE 流式",
  "landing.archCrate2Title": "Agent 运行时",
  "landing.archCrate2Sub": "BM25 · 工具 · 会话 · 记忆",
  "landing.archCrate3Title": "终端界面",
  "landing.archCrate3Sub": "ratatui · 文件系统持久化",
  "landing.archMod1": "LLM 流式客户端",
  "landing.archMod2": "BM25 记忆搜索",
  "landing.archMod3": "笔记 & 文件系统",
  "landing.archMod4": "会话管理",
  "landing.archMod4Sub": "JSONL 持久化",
  "landing.archProxy": "转发 LLM API，服务端注入密钥",
  "landing.archSearch": "搜索代理，绕过浏览器 CORS",
  "landing.archPrivacy": "数据不经过服务器 - 仅代理 API 请求",

  // ── Landing — Nav ───────────────────────────────────────
  "landing.themeLight": "切换到亮色模式",
  "landing.themeDark": "切换到暗色模式",

  // ── Language switcher ───────────────────────────────────
  "lang.switch": "EN",
  "lang.tooltip": "Switch to English",

  // ── Auth ───────────────────────────────────────────────────
  "auth.login": "登录",
  "auth.signup": "注册",
  "auth.loginTitle": "登录",
  "auth.signupTitle": "注册",
  "auth.email": "邮箱",
  "auth.password": "密码",
  "auth.loading": "处理中...",
  "auth.checkEmail": "注册成功！请查收验证邮件，点击链接后即可登录。",
  "auth.signupHint": "注册后需要验证邮箱。15 天不活跃账号将被自动删除，但可用同一邮箱重新注册。",
  "auth.loggedInAs": "已登录：{0}",
  "auth.logout": "登出",
  "auth.customSupabase": "使用自己的 Supabase 实例 →",
  "auth.forgotPassword": "忘记密码？",
  "auth.resetPassword": "重置密码",
  "auth.resetPasswordHint": "输入注册邮箱，我们将发送密码重置链接。",
  "auth.sendResetLink": "发送重置链接",
  "auth.resetEmailSent": "重置链接已发送！请查收邮件，点击链接后设置新密码。",
  "auth.backToLogin": "← 返回登录",
  "auth.newPassword": "新密码",
  "auth.confirmPassword": "确认密码",
  "auth.setNewPassword": "设置新密码",
  "auth.passwordMismatch": "两次输入的密码不一致",
  "auth.passwordUpdateSuccess": "密码已更新！请使用新密码登录。",

  // ── Sync ──────────────────────────────────────────────────
  "sync.idle": "未同步",
  "sync.syncing": "同步中...",
  "sync.synced": "已同步",
  "sync.error": "同步出错",
  "sync.login": "登录同步",

  // ── Supabase config ───────────────────────────────────────
  "supabase.configTitle": "配置 Supabase",
  "supabase.configHint": "输入你的 Supabase 项目 URL 和 Publishable Key（或 legacy anon key）。这些是公开密钥，存储在本地浏览器中。首次使用前请先在 Supabase SQL Editor 中执行 schema 文件。",
  "supabase.urlLabel": "项目 URL",
  "supabase.anonKeyLabel": "Publishable Key",
  "supabase.downloadSchema": "下载 SQL Schema 文件",

  // ── Memory 渲染器 ─────────────────────────────────────────
  "memory.searchHeader": "搜索记忆：{0}",
  "memory.writeHeader": "写入记忆：{0}",
  "memory.getHeader": "读取记忆：{0}",
  "memory.persistentSection": "持久记忆",
  "memory.conversationSection": "对话历史",
  "memory.noResults": "没有找到相关记忆",
  "memory.resultCount": "{0} 条结果",
  "memory.appended": "已追加",
  "memory.written": "已写入",
  "memory.lines": "共 {0} 行",
  "memory.openInEditor": "在编辑器中打开",
  "memory.error": "执行出错",

  // ── Workspace Memory 标签页 ───────────────────────────────
  "ws.tabFiles": "文件",
  "ws.tabMemory": "记忆",
  "ws.memoryFiles": "记忆文件",
  "ws.memoryPreview": "预览",
  "ws.memoryOps": "操作日志",
  "ws.noMemoryFiles": "暂无记忆文件",
  "ws.noMemoryOps": "暂无记忆操作",

  // ── Landing — Memory Showcase ─────────────────────────────
  "landing.memoryTitle": "记忆系统",
  "landing.memorySubtitle": "你的 AI 伙伴会记住你",
  "landing.memoryFlow1": "对话消息",
  "landing.memoryFlow2": "BM25 + FTS5 索引",
  "landing.memoryFlow3": "SQLite WASM 持久化",
  "landing.memoryFlow4": "记忆文件",
  "landing.memoryStat1": "SQLite WASM",
  "landing.memoryStat1Desc": "浏览器内嵌数据库",
  "landing.memoryStat2": "FTS5 全文搜索",
  "landing.memoryStat2Desc": "中日韩分词支持",
  "landing.memoryStat3": "BM25 排序",
  "landing.memoryStat3Desc": "相关性评分",
  "landing.termLine1": "## 用户档案",
  "landing.termLine2": "- 名字：小明",
  "landing.termLine3": "- 喜欢：编程、音乐、咖啡",
  "landing.termLine4": "- 生日：1月15日",
  "landing.termLine5": "## 长期记忆",
  "landing.termLine6": "最近在学 Rust，对 WASM 很感兴趣",
  "landing.termLine7": "喜欢在深夜写代码",
  "landing.termLine8": "养了一只叫「比特」的猫",
  "landing.archMod5": "SQLite WASM 记忆",
  "landing.archMod5Sub": "FTS5 · 持久化",
};

export default zh;
