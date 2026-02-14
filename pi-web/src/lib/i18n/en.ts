/** English (en) translation dictionary. */
const en: Record<string, string> = {
  // ── Header ──────────────────────────────────────────────
  "header.intro": "Home",
  "header.sessions": "Session list",
  "header.new": "New session",
  "header.editTitle": "Click to edit title",
  "header.characters": "Select character",
  "header.export": "Export session",
  "header.import": "Import session",
  "header.proxy": "Toggle Netlify proxy mode",
  "header.workspaceOn": "Workspace ON",
  "header.workspace": "Workspace",
  "header.workspaceTooltip": "Open Markdown workspace",
  "header.limerenceSettings": "Limerence settings (Persona / Lorebook / Presets / Regex)",
  "header.theme": "Toggle theme",
  "header.focus": "Focus mode (Ctrl+Shift+F)",
  "header.settings": "Settings",

  // ── Message actions ─────────────────────────────────────
  "msg.swipePrev": "Previous reply",
  "msg.swipeNext": "Next reply",
  "msg.regenerate": "Regenerate reply (Ctrl+Shift+R)",
  "msg.regenerateShort": "Regenerate",
  "msg.editMsg": "Edit message",
  "msg.edit": "Edit",
  "msg.deleteLast": "Delete last exchange",
  "msg.delete": "Delete",
  "msg.userMsg": "User message",
  "msg.aiReply": "AI reply",
  "msg.editLabel": "Edit {0}",
  "msg.saveEdit": "Save edit",
  "msg.save": "Save",
  "msg.saveAndRegen": "Save & regenerate",
  "msg.cancelEdit": "Cancel edit",
  "msg.cancel": "Cancel",

  // ── Settings tabs ───────────────────────────────────────
  "settings.persona": "Persona",
  "settings.lorebook": "Lorebook",
  "settings.presets": "Presets",
  "settings.regex": "Regex",
  "settings.group": "Group",

  // ── Persona ─────────────────────────────────────────────
  "persona.hint": "Set your character name and description. The AI will use this info in conversations. Supports {{user}} template variable.",
  "persona.nameLabel": "Name",
  "persona.namePlaceholder": "Your name",
  "persona.descLabel": "Description",
  "persona.descPlaceholder": "About you (personality, appearance, etc.)",
  "persona.save": "Save",
  "persona.clear": "Clear",

  // ── Lorebook ────────────────────────────────────────────
  "lorebook.hint": "When keywords appear in conversation, the matching world info is automatically injected into the system prompt.",
  "lorebook.keywordsPlaceholder": "Keywords (comma-separated)",
  "lorebook.contentPlaceholder": "Content to inject when triggered",
  "lorebook.add": "Add entry",
  "lorebook.empty": "No lorebook entries yet",
  "lorebook.disable": "Disable",
  "lorebook.enable": "Enable",
  "lorebook.delete": "Delete",

  // ── Presets ─────────────────────────────────────────────
  "presets.hint": "Choose a generation preset to influence the AI reply style and length.",

  // ── Regex ───────────────────────────────────────────────
  "regex.hint": "Regex rules perform text replacement on AI output or user input.",
  "regex.namePlaceholder": "Rule name",
  "regex.patternPlaceholder": "Regular expression",
  "regex.replacementPlaceholder": "Replacement text",
  "regex.scopeOutput": "AI output only",
  "regex.scopeInput": "User input only",
  "regex.scopeBoth": "Both",
  "regex.add": "Add rule",
  "regex.empty": "No regex rules yet",
  "regex.scopeOutputShort": "Output",
  "regex.scopeInputShort": "Input",
  "regex.scopeBothShort": "Both",
  "regex.emptyReplacement": "(delete)",
  "regex.disable": "Disable",
  "regex.enable": "Enable",
  "regex.delete": "Delete",

  // ── Prompt presets ────────────────────────────────────────
  "settings.prompt": "Prompts",
  "prompt.hint": "Import SillyTavern prompt presets to customize system prompt assembly.",
  "prompt.import": "Import Preset",
  "prompt.export": "Export Preset",
  "prompt.clear": "Clear Preset",
  "prompt.active": "Active Preset",
  "prompt.none": "None (using default prompt)",
  "prompt.roleSystem": "System",
  "prompt.roleUser": "User",
  "prompt.roleAssistant": "Assistant",
  "prompt.marker": "Marker",
  "prompt.segments": "Prompt Segments",
  "prompt.importError": "Import failed",

  // ── Regex IO ─────────────────────────────────────────────
  "regex.export": "Export Rules",
  "regex.import": "Import Rules",
  "regex.importHint": "Supports Limerence and SillyTavern formats",

  // ── Group chat ──────────────────────────────────────────
  "group.hint": "When group chat is enabled, multiple characters take turns replying. Import characters first in character management.",
  "group.enabled": "Group chat ON",
  "group.enable": "Enable group chat",
  "group.strategyLabel": "Turn strategy",
  "group.roundRobin": "Round robin",
  "group.random": "Random",
  "group.natural": "Natural balance",
  "group.manual": "Manual",
  "group.responsesLabel": "Replies per turn",
  "group.addLabel": "Add character",
  "group.importFirst": "Import characters first in character management",
  "group.membersLabel": "Group members",
  "group.noMembers": "No members yet",
  "group.disable": "Disable",
  "group.enable2": "Enable",
  "group.remove": "Remove",
  "group.noDesc": "No description",

  // ── Character selector ──────────────────────────────────
  "char.title": "Select Character",
  "char.default": "Default character",
  "char.delete": "Delete character",
  "char.import": "Import character card (JSON)",
  "char.defaultName": "Default character",
  "char.importFailed": "Import failed: unable to parse JSON file",

  // ── Tool labels (UI only) ──────────────────────────────
  "tool.memorySearch": "Memory search",
  "tool.webSearch": "Web search",
  "tool.noteWrite": "Write note",
  "tool.noteRead": "Read note",
  "tool.fileRead": "Read file",
  "tool.fileWrite": "Write file",
  "tool.executing": "Tool executing",

  // ── Token usage ─────────────────────────────────────────
  "token.tooltip": "Estimated token usage / context window",

  // ── Slash commands ──────────────────────────────────────
  "slash.help": `Available commands:
/help — Show this help
/stop — Stop current generation
/new — New session
/retry — Regenerate last reply
/clear — Clear current session messages
/export — Export current session as JSON
/model — Show current model info`,

  // ── Workspace ───────────────────────────────────────────
  "ws.title": "Markdown Workspace",
  "ws.subtitle": "{0} .md files · {1} read/write events",
  "ws.refresh": "Refresh file list",
  "ws.close": "Close panel",
  "ws.pathLabel": "Path",
  "ws.saveToPath": "Save to this path",
  "ws.save": "Save",
  "ws.autoLog": "Agent file_read / file_write operations are logged below.",
  "ws.filesLabel": "Markdown Files",
  "ws.noFiles": "No .md files yet. Enter a path and click Save to create one.",
  "ws.noFileSelected": "No file selected",
  "ws.unsaved": "Unsaved",
  "ws.saved": "Saved",
  "ws.loading": "Loading file...",
  "ws.editorPlaceholder": "Edit Markdown content here...",
  "ws.diffTitle": "Change Preview",
  "ws.diffNoFile": "Select or create a Markdown file first.",
  "ws.diffNoChange": "Content matches the saved version.",
  "ws.diffTruncated": "Showing first {0} changed lines only.",
  "ws.eventsTitle": "Read/Write Log",
  "ws.noEvents": "No read/write events yet.",
  "ws.invalidPath": "Invalid file path.",
  "ws.confirmSwitch": "Current file has unsaved changes. Switch and discard?",
  "ws.fileNotFound": "File not found",
  "ws.enterValidPath": "Please enter a valid file path.",

  // ── App / render ────────────────────────────────────────
  "app.loading": "Loading...",
  "app.exitFocus": "Exit focus mode (Esc)",
  "app.importFailed": "Import failed: unable to parse JSON file",
  "app.importedSession": "Imported session",

  // ── Session IO ──────────────────────────────────────────
  "data.invalidJson": "Invalid JSON data",
  "data.missingMessages": "Session data missing messages array",
  "data.importedSession": "Imported session",
  "data.unknownFormat": "Unrecognized session format",

  // ── Landing — Hero ──────────────────────────────────────
  "landing.tagline": "Open Source AI Companion",
  "landing.heroTitle1": "An AI Companion",
  "landing.heroTitle2": "with Memory",
  "landing.heroDesc": "Limerence is an open-source AI conversation framework with long-term memory, tool calling, and custom characters. All data stays in your browser, guarded by a math-driven life form.",
  "landing.startChat": "Start chatting",
  "landing.startChatNav": "Start chat",

  // ── Landing — Features ──────────────────────────────────
  "landing.featuresTitle": "Core Features",
  "landing.featuresSubtitle": "A math-driven life form, guarding every memory of yours",
  "landing.feat1Title": "Conversation Memory",
  "landing.feat1Desc": "BM25 search engine — remembers everything you said across sessions",
  "landing.feat2Title": "Tool Calling",
  "landing.feat2Desc": "Search the web, read/write notes and files — more than just chat",
  "landing.feat3Title": "Character Cards",
  "landing.feat3Desc": "SillyTavern V2 compatible — customize your AI companion",
  "landing.feat4Title": "Privacy First",
  "landing.feat4Desc": "Data stored locally in your browser — API keys never touch the server",

  // ── Landing — Architecture ──────────────────────────────
  "landing.archTitle": "Architecture",
  "landing.archSubtitle": "Layered Rust architecture, isomorphic TS port, shared core logic",
  "landing.archRustCore": "Rust Core",
  "landing.archBrowser": "Browser",
  "landing.archTsPort": "TS Isomorphic Port",
  "landing.archCrate1Title": "LLM Abstraction",
  "landing.archCrate1Sub": "OpenAI protocol · SSE streaming",
  "landing.archCrate2Title": "Agent Runtime",
  "landing.archCrate2Sub": "BM25 · Tools · Sessions · Memory",
  "landing.archCrate3Title": "Terminal UI",
  "landing.archCrate3Sub": "ratatui · filesystem persistence",
  "landing.archMod1": "LLM Streaming Client",
  "landing.archMod2": "BM25 Memory Search",
  "landing.archMod3": "Notes & File System",
  "landing.archMod4": "Session Management",
  "landing.archMod4Sub": "JSONL persistence",
  "landing.archProxy": "Forwards LLM API, server-side key injection",
  "landing.archSearch": "Search proxy, bypasses browser CORS",
  "landing.archPrivacy": "Data never touches the server — API proxy only",

  // ── Landing — Nav ───────────────────────────────────────
  "landing.themeLight": "Switch to light mode",
  "landing.themeDark": "Switch to dark mode",

  // ── Language switcher ───────────────────────────────────
  "lang.switch": "中",
  "lang.tooltip": "切换到中文",
};

export default en;
