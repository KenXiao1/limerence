use limerence_ai::ToolDef;
use serde_json::json;

use crate::config::SearchConfig;
use crate::memory::MemoryIndex;

/// Execute a tool call and return the result string.
pub fn execute_tool(
    name: &str,
    args: &str,
    memory: &MemoryIndex,
    search_config: &SearchConfig,
) -> String {
    let args: serde_json::Value = serde_json::from_str(args).unwrap_or(json!({}));

    match name {
        "memory_search" => tool_memory_search(&args, memory),
        "web_search" => tool_web_search(&args, search_config),
        "note_write" => tool_note_write(&args),
        "note_read" => tool_note_read(&args),
        "file_read" => tool_file_read(&args),
        "file_write" => tool_file_write(&args),
        _ => format!("未知工具：{name}"),
    }
}

/// Return all tool definitions.
pub fn all_tool_defs() -> Vec<ToolDef> {
    vec![
        ToolDef {
            name: "memory_search".to_string(),
            description: "搜索与用户的历史对话记忆。用于回忆用户之前提到的事情。".to_string(),
            parameters: json!({
                "type": "object",
                "properties": {
                    "query": {
                        "type": "string",
                        "description": "搜索关键词"
                    },
                    "limit": {
                        "type": "integer",
                        "description": "返回结果数量上限，默认5",
                        "default": 5
                    }
                },
                "required": ["query"]
            }),
        },
        ToolDef {
            name: "web_search".to_string(),
            description: "搜索互联网获取实时信息。用于回答时事、事实性问题等。".to_string(),
            parameters: json!({
                "type": "object",
                "properties": {
                    "query": {
                        "type": "string",
                        "description": "搜索查询"
                    }
                },
                "required": ["query"]
            }),
        },
        ToolDef {
            name: "note_write".to_string(),
            description: "写入持久化笔记。用于记录用户的重要信息、偏好、经历等。".to_string(),
            parameters: json!({
                "type": "object",
                "properties": {
                    "title": {
                        "type": "string",
                        "description": "笔记标题"
                    },
                    "content": {
                        "type": "string",
                        "description": "笔记内容"
                    },
                    "append": {
                        "type": "boolean",
                        "description": "是否追加到已有笔记，默认false",
                        "default": false
                    }
                },
                "required": ["title", "content"]
            }),
        },
        ToolDef {
            name: "note_read".to_string(),
            description: "读取笔记。传入标题读取指定笔记，留空列出所有笔记。".to_string(),
            parameters: json!({
                "type": "object",
                "properties": {
                    "title": {
                        "type": "string",
                        "description": "笔记标题，留空则列出所有笔记",
                        "default": ""
                    }
                }
            }),
        },
        ToolDef {
            name: "file_read".to_string(),
            description: "读取工作区文件内容。可以读取文件或列出目录。路径相对于工作区根目录。".to_string(),
            parameters: json!({
                "type": "object",
                "properties": {
                    "path": {
                        "type": "string",
                        "description": "文件路径（相对于工作区）"
                    }
                },
                "required": ["path"]
            }),
        },
        ToolDef {
            name: "file_write".to_string(),
            description: "在工作区创建或写入文件。路径相对于工作区根目录，自动创建子目录。".to_string(),
            parameters: json!({
                "type": "object",
                "properties": {
                    "path": {
                        "type": "string",
                        "description": "文件路径（相对于工作区）"
                    },
                    "content": {
                        "type": "string",
                        "description": "文件内容"
                    }
                },
                "required": ["path", "content"]
            }),
        },
    ]
}

fn tool_memory_search(args: &serde_json::Value, memory: &MemoryIndex) -> String {
    let query = args["query"].as_str().unwrap_or("");
    let limit = args["limit"].as_u64().unwrap_or(5) as usize;

    if query.is_empty() {
        return "请提供搜索关键词。".to_string();
    }

    let results = memory.search(query, limit);
    if results.is_empty() {
        return "没有找到相关记忆。".to_string();
    }

    let mut output = String::new();
    for (i, r) in results.iter().enumerate() {
        let time = r.timestamp.format("%Y-%m-%d %H:%M");
        let role = match r.role.as_str() {
            "user" => "用户",
            "assistant" => "助手",
            _ => &r.role,
        };
        // Truncate long content
        let content = if r.content.len() > 200 {
            format!("{}...", &r.content[..r.content.char_indices().nth(200).map(|(i, _)| i).unwrap_or(r.content.len())])
        } else {
            r.content.clone()
        };
        output.push_str(&format!("[{}] [{time}] {role}：{content}\n", i + 1));
    }
    output
}

fn tool_web_search(args: &serde_json::Value, config: &SearchConfig) -> String {
    let query = args["query"].as_str().unwrap_or("");
    if query.is_empty() {
        return "请提供搜索查询。".to_string();
    }

    // Synchronous HTTP request for web search (runs in blocking context)
    match &config.engine {
        e if e == "duckduckgo" => duckduckgo_search(query),
        e if e == "searxng" => {
            if let Some(url) = &config.searxng_url {
                searxng_search(query, url)
            } else {
                "SearXNG URL 未配置。".to_string()
            }
        }
        _ => "不支持的搜索引擎。".to_string(),
    }
}

fn duckduckgo_search(query: &str) -> String {
    // Use DuckDuckGo HTML lite for simplicity
    let url = format!(
        "https://html.duckduckgo.com/html/?q={}",
        urlencoded(query)
    );

    let client = reqwest::blocking::Client::builder()
        .user_agent("Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36")
        .build();

    let client = match client {
        Ok(c) => c,
        Err(e) => return format!("HTTP 客户端创建失败：{e}"),
    };

    match client.get(&url).send() {
        Ok(resp) => {
            let body = resp.text().unwrap_or_default();
            parse_ddg_html(&body)
        }
        Err(e) => format!("搜索请求失败：{e}"),
    }
}

fn searxng_search(query: &str, base_url: &str) -> String {
    let url = format!(
        "{}/search?q={}&format=json",
        base_url.trim_end_matches('/'),
        urlencoded(query)
    );

    let client = reqwest::blocking::Client::new();
    match client.get(&url).send() {
        Ok(resp) => {
            let json: serde_json::Value = resp.json().unwrap_or_default();
            if let Some(results) = json["results"].as_array() {
                let mut output = String::new();
                for (i, r) in results.iter().take(5).enumerate() {
                    let title = r["title"].as_str().unwrap_or("无标题");
                    let url = r["url"].as_str().unwrap_or("");
                    let content = r["content"].as_str().unwrap_or("");
                    output.push_str(&format!("[{}] {title}\n{url}\n{content}\n\n", i + 1));
                }
                if output.is_empty() {
                    "没有搜索结果。".to_string()
                } else {
                    output
                }
            } else {
                "搜索结果解析失败。".to_string()
            }
        }
        Err(e) => format!("搜索请求失败：{e}"),
    }
}

fn parse_ddg_html(html: &str) -> String {
    // Simple HTML parsing for DuckDuckGo lite results
    let mut results = Vec::new();
    let mut pos = 0;

    while let Some(start) = html[pos..].find("class=\"result__a\"") {
        let abs_start = pos + start;

        // Find href
        let href_start = html[..abs_start].rfind("href=\"").map(|i| i + 6);
        let href = if let Some(hs) = href_start {
            if let Some(he) = html[hs..].find('"') {
                let raw = &html[hs..hs + he];
                // DDG wraps URLs, extract the actual URL
                if let Some(uddg) = raw.find("uddg=") {
                    let encoded = &raw[uddg + 5..];
                    let end = encoded.find('&').unwrap_or(encoded.len());
                    urlencoded_decode(&encoded[..end])
                } else {
                    raw.to_string()
                }
            } else {
                String::new()
            }
        } else {
            String::new()
        };

        // Find title text (between > and </a>)
        let title = if let Some(tag_end) = html[abs_start..].find('>') {
            let text_start = abs_start + tag_end + 1;
            if let Some(text_end) = html[text_start..].find("</a>") {
                strip_html_tags(&html[text_start..text_start + text_end])
            } else {
                String::new()
            }
        } else {
            String::new()
        };

        // Find snippet
        let snippet_marker = "class=\"result__snippet\"";
        let snippet = if let Some(ss) = html[abs_start..].find(snippet_marker) {
            let snippet_abs = abs_start + ss;
            if let Some(tag_end) = html[snippet_abs..].find('>') {
                let text_start = snippet_abs + tag_end + 1;
                if let Some(text_end) = html[text_start..].find("</") {
                    strip_html_tags(&html[text_start..text_start + text_end])
                } else {
                    String::new()
                }
            } else {
                String::new()
            }
        } else {
            String::new()
        };

        if !title.is_empty() {
            results.push(format!(
                "[{}] {}\n{}\n{}",
                results.len() + 1,
                title.trim(),
                href,
                snippet.trim()
            ));
        }

        pos = abs_start + 1;

        if results.len() >= 5 {
            break;
        }
    }

    if results.is_empty() {
        "没有搜索结果。".to_string()
    } else {
        results.join("\n\n")
    }
}

fn tool_note_write(args: &serde_json::Value) -> String {
    let title = args["title"].as_str().unwrap_or("untitled");
    let content = args["content"].as_str().unwrap_or("");
    let append = args["append"].as_bool().unwrap_or(false);

    match crate::notes::write_note(title, content, append) {
        Ok(msg) => msg,
        Err(e) => format!("写入笔记失败：{e}"),
    }
}

fn tool_note_read(args: &serde_json::Value) -> String {
    let title = args["title"].as_str().unwrap_or("");
    match crate::notes::read_note(title) {
        Ok(content) => content,
        Err(e) => format!("读取笔记失败：{e}"),
    }
}

fn tool_file_read(args: &serde_json::Value) -> String {
    let path = args["path"].as_str().unwrap_or("");
    if path.is_empty() {
        return crate::file_os::file_read(".").unwrap_or_else(|e| e);
    }
    match crate::file_os::file_read(path) {
        Ok(content) => content,
        Err(e) => e,
    }
}

fn tool_file_write(args: &serde_json::Value) -> String {
    let path = args["path"].as_str().unwrap_or("");
    let content = args["content"].as_str().unwrap_or("");
    if path.is_empty() {
        return "请提供文件路径。".to_string();
    }
    match crate::file_os::file_write(path, content) {
        Ok(msg) => msg,
        Err(e) => e,
    }
}

fn urlencoded(s: &str) -> String {
    let mut result = String::new();
    for byte in s.bytes() {
        match byte {
            b'A'..=b'Z' | b'a'..=b'z' | b'0'..=b'9' | b'-' | b'_' | b'.' | b'~' => {
                result.push(byte as char);
            }
            b' ' => result.push('+'),
            _ => {
                result.push_str(&format!("%{byte:02X}"));
            }
        }
    }
    result
}

fn urlencoded_decode(s: &str) -> String {
    let mut result = Vec::new();
    let bytes = s.as_bytes();
    let mut i = 0;
    while i < bytes.len() {
        if bytes[i] == b'%' && i + 2 < bytes.len() {
            if let Ok(byte) = u8::from_str_radix(
                &String::from_utf8_lossy(&bytes[i + 1..i + 3]),
                16,
            ) {
                result.push(byte);
                i += 3;
                continue;
            }
        }
        if bytes[i] == b'+' {
            result.push(b' ');
        } else {
            result.push(bytes[i]);
        }
        i += 1;
    }
    String::from_utf8_lossy(&result).to_string()
}

fn strip_html_tags(s: &str) -> String {
    let mut result = String::new();
    let mut in_tag = false;
    for ch in s.chars() {
        if ch == '<' {
            in_tag = true;
        } else if ch == '>' {
            in_tag = false;
        } else if !in_tag {
            result.push(ch);
        }
    }
    // Decode common HTML entities
    result
        .replace("&amp;", "&")
        .replace("&lt;", "<")
        .replace("&gt;", ">")
        .replace("&quot;", "\"")
        .replace("&#x27;", "'")
        .replace("&nbsp;", " ")
}
