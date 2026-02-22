use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize};
use std::collections::{HashMap, HashSet};
use std::path::{Component, Path, PathBuf};

use crate::config::memory_dir;

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct MemoryEntry {
    pub session_id: String,
    pub timestamp: DateTime<Utc>,
    pub role: String,
    pub content: String,
}

/// BM25-based memory search engine. Zero external dependencies.
pub struct MemoryIndex {
    entries: Vec<MemoryEntry>,
    /// term -> list of (entry_index, term_frequency)
    inverted_index: HashMap<String, Vec<(usize, f64)>>,
    /// Average document length
    avg_dl: f64,
    memory_root: PathBuf,
}

impl MemoryIndex {
    pub fn new() -> Self {
        Self::with_memory_root(memory_dir())
    }

    pub fn with_memory_root(memory_root: PathBuf) -> Self {
        Self {
            entries: Vec::new(),
            inverted_index: HashMap::new(),
            avg_dl: 0.0,
            memory_root,
        }
    }

    pub fn memory_root(&self) -> &Path {
        &self.memory_root
    }

    /// Load all memory files from disk and build index.
    pub fn load_from_disk(&mut self) {
        let dir = self.memory_root.clone();
        if let Ok(read_dir) = std::fs::read_dir(&dir) {
            for entry in read_dir.flatten() {
                let path = entry.path();
                if path.extension().is_some_and(|e| e == "jsonl") {
                    if let Ok(content) = std::fs::read_to_string(&path) {
                        for line in content.lines() {
                            if let Ok(mem) = serde_json::from_str::<MemoryEntry>(line) {
                                self.entries.push(mem);
                            }
                        }
                    }
                }
            }
        }
        self.rebuild_index();
    }

    /// Add a new entry and index it.
    pub fn add(&mut self, entry: MemoryEntry) {
        // Persist to disk
        let path = self.memory_root.join(format!("{}.jsonl", entry.session_id));
        if let Ok(line) = serde_json::to_string(&entry) {
            use std::io::Write;
            if let Ok(mut file) = std::fs::OpenOptions::new()
                .create(true)
                .append(true)
                .open(&path)
            {
                let _ = writeln!(file, "{line}");
            }
        }

        let idx = self.entries.len();
        let tokens = tokenize(&entry.content);
        let dl = tokens.len() as f64;

        // Update avg_dl
        let n = self.entries.len() as f64;
        self.avg_dl = (self.avg_dl * n + dl) / (n + 1.0);

        // Count term frequencies
        let mut tf_map: HashMap<&str, usize> = HashMap::new();
        for t in &tokens {
            *tf_map.entry(t.as_str()).or_default() += 1;
        }

        for (term, count) in tf_map {
            let tf = count as f64 / dl.max(1.0);
            self.inverted_index
                .entry(term.to_string())
                .or_default()
                .push((idx, tf));
        }

        self.entries.push(entry);
    }

    /// Search memories using BM25 scoring.
    pub fn search(&self, query: &str, limit: usize) -> Vec<SearchResult> {
        if self.entries.is_empty() {
            return vec![];
        }

        let query_tokens = tokenize(query);
        let n = self.entries.len() as f64;
        let k1 = 1.2;
        let b = 0.75;

        let mut scores: HashMap<usize, f64> = HashMap::new();

        for token in &query_tokens {
            if let Some(postings) = self.inverted_index.get(token.as_str()) {
                let df = postings.len() as f64;
                let idf = ((n - df + 0.5) / (df + 0.5) + 1.0).ln();

                for &(doc_idx, tf) in postings {
                    let dl = tokenize(&self.entries[doc_idx].content).len() as f64;
                    let tf_norm =
                        (tf * (k1 + 1.0)) / (tf + k1 * (1.0 - b + b * dl / self.avg_dl.max(1.0)));
                    *scores.entry(doc_idx).or_default() += idf * tf_norm;
                }
            }
        }

        let mut results: Vec<(usize, f64)> = scores.into_iter().collect();
        results.sort_by(|a, b| b.1.partial_cmp(&a.1).unwrap_or(std::cmp::Ordering::Equal));
        results.truncate(limit);

        results
            .into_iter()
            .map(|(idx, score)| {
                let entry = &self.entries[idx];
                SearchResult {
                    timestamp: entry.timestamp,
                    role: entry.role.clone(),
                    content: entry.content.clone(),
                    score,
                }
            })
            .collect()
    }

    fn rebuild_index(&mut self) {
        self.inverted_index.clear();

        if self.entries.is_empty() {
            self.avg_dl = 0.0;
            return;
        }

        let mut total_dl = 0.0;

        for (idx, entry) in self.entries.iter().enumerate() {
            let tokens = tokenize(&entry.content);
            let dl = tokens.len() as f64;
            total_dl += dl;

            let mut tf_map: HashMap<&str, usize> = HashMap::new();
            for t in &tokens {
                *tf_map.entry(t.as_str()).or_default() += 1;
            }

            for (term, count) in tf_map {
                let tf = count as f64 / dl.max(1.0);
                self.inverted_index
                    .entry(term.to_string())
                    .or_default()
                    .push((idx, tf));
            }
        }

        self.avg_dl = total_dl / self.entries.len() as f64;
    }

    pub fn entry_count(&self) -> usize {
        self.entries.len()
    }

    pub fn search_memory_files(&self, query: &str, limit: usize) -> Vec<MemoryFileSearchResult> {
        search_memory_files_in_dir(&self.memory_root, query, limit)
    }

    pub fn list_memory_markdown_files(&self) -> Result<Vec<String>, String> {
        list_memory_markdown_files_in_dir(&self.memory_root)
    }

    pub fn write_memory_file(
        &self,
        path: &str,
        content: &str,
        append: bool,
    ) -> Result<String, String> {
        memory_file_write_in_dir(&self.memory_root, path, content, append)
    }

    pub fn get_memory_file(&self, path: &str, from: usize, lines: usize) -> Result<String, String> {
        memory_file_get_in_dir(&self.memory_root, path, from, lines)
    }
}

impl Default for MemoryIndex {
    fn default() -> Self {
        Self::new()
    }
}

#[derive(Debug, Clone)]
pub struct SearchResult {
    pub timestamp: DateTime<Utc>,
    pub role: String,
    pub content: String,
    pub score: f64,
}

#[derive(Debug, Clone)]
pub struct MemoryFileSearchResult {
    pub path: String,
    pub start_line: usize,
    pub end_line: usize,
    pub text: String,
    pub score: f64,
}

#[derive(Debug, Clone)]
struct MemoryChunk {
    path: String,
    start_line: usize,
    end_line: usize,
    text: String,
    tokens: Vec<String>,
}

/// Tokenize text with CJK support: split CJK chars individually, split others by whitespace.
fn tokenize(text: &str) -> Vec<String> {
    let mut tokens = Vec::new();
    let text = text.to_lowercase();
    let mut current_word = String::new();

    for ch in text.chars() {
        if is_cjk(ch) {
            // Flush current word
            if !current_word.is_empty() {
                tokens.push(std::mem::take(&mut current_word));
            }
            // CJK char as individual token
            tokens.push(ch.to_string());
        } else if ch.is_alphanumeric() {
            current_word.push(ch);
        } else {
            // Whitespace or punctuation: flush
            if !current_word.is_empty() {
                tokens.push(std::mem::take(&mut current_word));
            }
        }
    }

    if !current_word.is_empty() {
        tokens.push(current_word);
    }

    tokens
}

fn is_cjk(ch: char) -> bool {
    matches!(ch,
        '\u{4E00}'..='\u{9FFF}' |   // CJK Unified Ideographs
        '\u{3400}'..='\u{4DBF}' |   // CJK Extension A
        '\u{F900}'..='\u{FAFF}' |   // CJK Compatibility Ideographs
        '\u{3000}'..='\u{303F}' |   // CJK Symbols and Punctuation
        '\u{3040}'..='\u{309F}' |   // Hiragana
        '\u{30A0}'..='\u{30FF}' |   // Katakana
        '\u{AC00}'..='\u{D7AF}'     // Hangul Syllables
    )
}

const MEMORY_CHUNK_LINES: usize = 12;
const MEMORY_SNIPPET_MAX_CHARS: usize = 300;

fn search_memory_files_in_dir(
    memory_root: &Path,
    query: &str,
    limit: usize,
) -> Vec<MemoryFileSearchResult> {
    let query = query.trim();
    if query.is_empty() || limit == 0 {
        return vec![];
    }

    let files = match list_memory_markdown_files_in_dir(memory_root) {
        Ok(v) => v,
        Err(_) => return vec![],
    };

    let mut chunks: Vec<MemoryChunk> = Vec::new();
    for virtual_path in files {
        let Ok(full_path) = resolve_memory_virtual_path_in_dir(memory_root, &virtual_path) else {
            continue;
        };
        let Ok(content) = std::fs::read_to_string(&full_path) else {
            continue;
        };
        chunks.extend(build_chunks_for_file(&virtual_path, &content));
    }

    if chunks.is_empty() {
        return vec![];
    }

    let mut tf_maps: Vec<HashMap<String, usize>> = Vec::with_capacity(chunks.len());
    let mut doc_freq: HashMap<String, usize> = HashMap::new();
    let mut total_doc_len = 0usize;

    for chunk in &chunks {
        let mut tf: HashMap<String, usize> = HashMap::new();
        for token in &chunk.tokens {
            *tf.entry(token.clone()).or_default() += 1;
        }

        total_doc_len += chunk.tokens.len();
        let seen: HashSet<String> = tf.keys().cloned().collect();
        for term in seen {
            *doc_freq.entry(term).or_default() += 1;
        }
        tf_maps.push(tf);
    }

    let query_tokens = tokenize(query);
    if query_tokens.is_empty() {
        return vec![];
    }

    let n = chunks.len() as f64;
    let avg_dl = (total_doc_len as f64 / n).max(1.0);
    let k1 = 1.2;
    let b = 0.75;
    let mut scores = vec![0.0_f64; chunks.len()];

    for token in query_tokens {
        let Some(df) = doc_freq.get(&token) else {
            continue;
        };
        let df = *df as f64;
        let idf = ((n - df + 0.5) / (df + 0.5) + 1.0).ln();

        for (idx, tf_map) in tf_maps.iter().enumerate() {
            let Some(raw_tf) = tf_map.get(&token) else {
                continue;
            };

            let tf = *raw_tf as f64;
            let dl = chunks[idx].tokens.len() as f64;
            let tf_norm = (tf * (k1 + 1.0)) / (tf + k1 * (1.0 - b + b * dl / avg_dl));
            scores[idx] += idf * tf_norm;
        }
    }

    let mut ranked: Vec<(usize, f64)> = scores
        .into_iter()
        .enumerate()
        .filter(|(_, score)| *score > 0.0)
        .collect();
    ranked.sort_by(|a, b| b.1.partial_cmp(&a.1).unwrap_or(std::cmp::Ordering::Equal));
    ranked.truncate(limit);

    ranked
        .into_iter()
        .map(|(idx, score)| {
            let chunk = &chunks[idx];
            MemoryFileSearchResult {
                path: chunk.path.clone(),
                start_line: chunk.start_line,
                end_line: chunk.end_line,
                text: truncate_chars(&chunk.text, MEMORY_SNIPPET_MAX_CHARS),
                score,
            }
        })
        .collect()
}

fn build_chunks_for_file(path: &str, content: &str) -> Vec<MemoryChunk> {
    let lines: Vec<&str> = content.lines().collect();
    if lines.is_empty() {
        return vec![];
    }

    let mut out = Vec::new();
    let mut start = 0usize;
    while start < lines.len() {
        let end = (start + MEMORY_CHUNK_LINES).min(lines.len());
        let text = lines[start..end].join("\n").trim().to_string();
        if !text.is_empty() {
            let tokens = tokenize(&text);
            if !tokens.is_empty() {
                out.push(MemoryChunk {
                    path: path.to_string(),
                    start_line: start + 1,
                    end_line: end,
                    text,
                    tokens,
                });
            }
        }
        start = end;
    }
    out
}

fn list_memory_markdown_files_in_dir(memory_root: &Path) -> Result<Vec<String>, String> {
    std::fs::create_dir_all(memory_root).map_err(|e| format!("创建记忆目录失败：{e}"))?;
    let mut files = Vec::new();
    collect_markdown_files(memory_root, memory_root, &mut files)?;
    files.sort();
    Ok(files)
}

fn collect_markdown_files(root: &Path, dir: &Path, out: &mut Vec<String>) -> Result<(), String> {
    let entries = std::fs::read_dir(dir).map_err(|e| format!("读取记忆目录失败：{e}"))?;
    for entry in entries {
        let entry = entry.map_err(|e| format!("读取目录项失败：{e}"))?;
        let path = entry.path();
        let meta = entry
            .file_type()
            .map_err(|e| format!("读取目录项类型失败：{e}"))?;

        if meta.is_dir() {
            collect_markdown_files(root, &path, out)?;
            continue;
        }

        if !meta.is_file() || !path.extension().is_some_and(|ext| ext == "md") {
            continue;
        }

        let rel = path
            .strip_prefix(root)
            .map_err(|e| format!("路径解析失败：{e}"))?;
        let rel = rel.to_string_lossy().replace('\\', "/");
        out.push(format!("memory/{rel}"));
    }
    Ok(())
}

fn memory_file_write_in_dir(
    memory_root: &Path,
    path: &str,
    content: &str,
    append: bool,
) -> Result<String, String> {
    std::fs::create_dir_all(memory_root).map_err(|e| format!("创建记忆目录失败：{e}"))?;
    let full_path = resolve_memory_virtual_path_in_dir(memory_root, path)?;
    if let Some(parent) = full_path.parent() {
        std::fs::create_dir_all(parent).map_err(|e| format!("创建目录失败：{e}"))?;
    }

    if append {
        use std::io::Write;
        let file_exists = full_path.exists();
        let file_len = std::fs::metadata(&full_path).map(|m| m.len()).unwrap_or(0);
        let mut file = std::fs::OpenOptions::new()
            .create(true)
            .append(true)
            .open(&full_path)
            .map_err(|e| format!("写入记忆文件失败：{e}"))?;

        if file_exists && file_len > 0 {
            write!(file, "\n").map_err(|e| format!("写入记忆文件失败：{e}"))?;
        }
        write!(file, "{content}").map_err(|e| format!("写入记忆文件失败：{e}"))?;
        return Ok(format!(
            "已追加内容到记忆文件：{}",
            normalize_memory_virtual_path(path)
        ));
    }

    std::fs::write(&full_path, content).map_err(|e| format!("写入记忆文件失败：{e}"))?;
    Ok(format!(
        "已写入记忆文件：{}",
        normalize_memory_virtual_path(path)
    ))
}

fn memory_file_get_in_dir(
    memory_root: &Path,
    path: &str,
    from: usize,
    lines: usize,
) -> Result<String, String> {
    std::fs::create_dir_all(memory_root).map_err(|e| format!("创建记忆目录失败：{e}"))?;
    let full_path = resolve_memory_virtual_path_in_dir(memory_root, path)?;
    if !full_path.exists() {
        return Err(format!(
            "记忆文件不存在：{}",
            normalize_memory_virtual_path(path)
        ));
    }

    let content =
        std::fs::read_to_string(&full_path).map_err(|e| format!("读取记忆文件失败：{e}"))?;
    let all_lines: Vec<&str> = content.lines().collect();
    let total = all_lines.len();
    if total == 0 {
        return Ok(format!(
            "[{}] 共 0 行，文件为空。",
            normalize_memory_virtual_path(path)
        ));
    }

    let from = from.max(1);
    let line_count = lines.max(1);
    let start_idx = from.saturating_sub(1).min(total - 1);
    let end_idx = (start_idx + line_count).min(total);
    let shown = all_lines[start_idx..end_idx].join("\n");

    Ok(format!(
        "[{}] 共 {} 行，显示 L{}-L{}：\n{}",
        normalize_memory_virtual_path(path),
        total,
        start_idx + 1,
        end_idx,
        shown
    ))
}

fn resolve_memory_virtual_path_in_dir(memory_root: &Path, path: &str) -> Result<PathBuf, String> {
    let virtual_path = normalize_memory_virtual_path(path);
    if !virtual_path.starts_with("memory/") {
        return Err("记忆文件路径必须以 memory/ 开头。".to_string());
    }

    let rel = virtual_path.trim_start_matches("memory/");
    if rel.is_empty() {
        return Err("请提供记忆文件路径。".to_string());
    }

    let root = normalize_path(memory_root);
    let resolved = normalize_path(&root.join(rel));
    if !resolved.starts_with(&root) {
        return Err("路径越权：不允许访问 memory/ 目录外的文件".to_string());
    }

    Ok(resolved)
}

fn normalize_memory_virtual_path(path: &str) -> String {
    path.trim().replace('\\', "/")
}

fn normalize_path(path: &Path) -> PathBuf {
    let mut out = PathBuf::new();
    for component in path.components() {
        match component {
            Component::ParentDir => {
                out.pop();
            }
            Component::CurDir => {}
            Component::Prefix(prefix) => out.push(prefix.as_os_str()),
            Component::RootDir => out.push(component.as_os_str()),
            Component::Normal(seg) => out.push(seg),
        }
    }
    out
}

fn truncate_chars(text: &str, max_chars: usize) -> String {
    if text.chars().count() <= max_chars {
        return text.to_string();
    }
    text.chars().take(max_chars).collect::<String>() + "..."
}

#[cfg(test)]
mod tests {
    use super::*;

    struct TempMemoryRoot {
        root: PathBuf,
    }

    impl TempMemoryRoot {
        fn new() -> Self {
            let root =
                std::env::temp_dir().join(format!("limerence-memory-{}", uuid::Uuid::new_v4()));
            std::fs::create_dir_all(&root).expect("create temp memory root");
            Self { root }
        }
    }

    impl Drop for TempMemoryRoot {
        fn drop(&mut self) {
            let _ = std::fs::remove_dir_all(&self.root);
        }
    }

    #[test]
    fn memory_write_and_get_support_append_and_ranges() {
        let temp = TempMemoryRoot::new();
        let path = "memory/PROFILE.md";

        memory_file_write_in_dir(&temp.root, path, "line1", true).expect("first write");
        memory_file_write_in_dir(&temp.root, path, "line2", true).expect("append write");

        let output = memory_file_get_in_dir(&temp.root, path, 2, 1).expect("memory_get");
        assert!(output.contains("显示 L2-L2"));
        assert!(output.contains("line2"));
        assert!(!output.contains("line1"));
    }

    #[test]
    fn list_memory_files_only_returns_markdown() {
        let temp = TempMemoryRoot::new();
        memory_file_write_in_dir(&temp.root, "memory/PROFILE.md", "p", false).expect("profile");
        memory_file_write_in_dir(&temp.root, "memory/daily/2026-02-22.md", "d", false)
            .expect("daily");
        std::fs::write(temp.root.join("MEMORY.txt"), "x").expect("txt");

        let files = list_memory_markdown_files_in_dir(&temp.root).expect("list");
        assert!(files.contains(&"memory/PROFILE.md".to_string()));
        assert!(files.contains(&"memory/daily/2026-02-22.md".to_string()));
        assert!(!files.iter().any(|f| f.ends_with(".txt")));
    }

    #[test]
    fn memory_file_rejects_path_traversal() {
        let temp = TempMemoryRoot::new();
        let err = memory_file_write_in_dir(&temp.root, "memory/../escape.md", "x", false)
            .expect_err("traversal should fail");
        assert!(err.contains("路径越权"));
    }

    #[test]
    fn search_memory_files_returns_path_line_range_and_snippet() {
        let temp = TempMemoryRoot::new();
        memory_file_write_in_dir(
            &temp.root,
            "memory/MEMORY.md",
            "第1行\n我喜欢手冲咖啡\n第3行",
            false,
        )
        .expect("write memory");

        let results = search_memory_files_in_dir(&temp.root, "咖啡", 5);
        assert!(!results.is_empty());

        let first = &results[0];
        assert!(first.path.starts_with("memory/"));
        assert!(first.start_line >= 1);
        assert!(first.end_line >= first.start_line);
        assert!(first.text.contains("咖啡"));
        assert!(first.score > 0.0);
    }
}
