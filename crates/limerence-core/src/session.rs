use chrono::{DateTime, Utc};
use limerence_ai::Message;
use serde::{Deserialize, Serialize};
use std::path::PathBuf;
use uuid::Uuid;

use crate::config::sessions_dir;

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SessionHeader {
    pub id: String,
    pub timestamp: DateTime<Utc>,
    pub character: String,
    pub model: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SessionEntry {
    pub id: String,
    pub parent_id: Option<String>,
    pub timestamp: DateTime<Utc>,
    pub message: Message,
}

pub struct Session {
    pub header: SessionHeader,
    pub entries: Vec<SessionEntry>,
    path: PathBuf,
    last_entry_id: Option<String>,
}

impl Session {
    pub fn new(character: &str, model: &str) -> Self {
        let id = Uuid::new_v4().to_string();
        let header = SessionHeader {
            id: id.clone(),
            timestamp: Utc::now(),
            character: character.to_string(),
            model: model.to_string(),
        };
        let path = sessions_dir().join(format!("{id}.jsonl"));
        let mut session = Self {
            header,
            entries: Vec::new(),
            path,
            last_entry_id: None,
        };
        session.write_header();
        session
    }

    pub fn load(path: &PathBuf) -> Option<Self> {
        let content = std::fs::read_to_string(path).ok()?;
        let mut lines = content.lines();

        let header: SessionHeader = serde_json::from_str(lines.next()?).ok()?;
        let mut entries = Vec::new();
        let mut last_entry_id = None;

        for line in lines {
            if line.trim().is_empty() {
                continue;
            }
            if let Ok(entry) = serde_json::from_str::<SessionEntry>(line) {
                last_entry_id = Some(entry.id.clone());
                entries.push(entry);
            }
        }

        Some(Self {
            header,
            entries,
            path: path.clone(),
            last_entry_id,
        })
    }

    pub fn list_sessions() -> Vec<(String, SessionHeader)> {
        let dir = sessions_dir();
        let mut sessions = Vec::new();

        if let Ok(entries) = std::fs::read_dir(&dir) {
            for entry in entries.flatten() {
                let path = entry.path();
                if path.extension().is_some_and(|e| e == "jsonl") {
                    if let Ok(content) = std::fs::read_to_string(&path) {
                        if let Some(first_line) = content.lines().next() {
                            if let Ok(header) = serde_json::from_str::<SessionHeader>(first_line) {
                                sessions.push((header.id.clone(), header));
                            }
                        }
                    }
                }
            }
        }

        sessions.sort_by(|a, b| b.1.timestamp.cmp(&a.1.timestamp));
        sessions
    }

    pub fn append(&mut self, message: Message) {
        let entry = SessionEntry {
            id: Uuid::new_v4().to_string(),
            parent_id: self.last_entry_id.clone(),
            timestamp: Utc::now(),
            message,
        };
        self.last_entry_id = Some(entry.id.clone());

        // Append to file
        if let Ok(line) = serde_json::to_string(&entry) {
            use std::io::Write;
            if let Ok(mut file) = std::fs::OpenOptions::new()
                .create(true)
                .append(true)
                .open(&self.path)
            {
                let _ = writeln!(file, "{line}");
            }
        }

        self.entries.push(entry);
    }

    pub fn messages(&self) -> Vec<Message> {
        self.entries.iter().map(|e| e.message.clone()).collect()
    }

    fn write_header(&mut self) {
        if let Ok(line) = serde_json::to_string(&self.header) {
            let _ = std::fs::write(&self.path, format!("{line}\n"));
        }
    }
}
