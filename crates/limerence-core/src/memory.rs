use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize};
use std::collections::HashMap;

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
}

impl MemoryIndex {
    pub fn new() -> Self {
        Self {
            entries: Vec::new(),
            inverted_index: HashMap::new(),
            avg_dl: 0.0,
        }
    }

    /// Load all memory files from disk and build index.
    pub fn load_from_disk(&mut self) {
        let dir = memory_dir();
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
        let path = memory_dir().join(format!("{}.jsonl", entry.session_id));
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
                    let tf_norm = (tf * (k1 + 1.0)) / (tf + k1 * (1.0 - b + b * dl / self.avg_dl.max(1.0)));
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
