use crate::config::notes_dir;
use std::path::PathBuf;

/// Write a note to ~/.limerence/notes/{title}.md
/// If append is true, appends to existing note; otherwise overwrites.
pub fn write_note(title: &str, content: &str, append: bool) -> Result<String, String> {
    let path = note_path(title);
    let _ = std::fs::create_dir_all(notes_dir());

    if append && path.exists() {
        use std::io::Write;
        let mut file = std::fs::OpenOptions::new()
            .append(true)
            .open(&path)
            .map_err(|e| e.to_string())?;
        writeln!(file, "\n{content}").map_err(|e| e.to_string())?;
        Ok(format!("已追加内容到笔记「{title}」"))
    } else {
        std::fs::write(&path, content).map_err(|e| e.to_string())?;
        Ok(format!("已写入笔记「{title}」"))
    }
}

/// Read a note by title, or list all notes if title is empty.
pub fn read_note(title: &str) -> Result<String, String> {
    if title.is_empty() {
        return list_notes();
    }

    let path = note_path(title);
    if !path.exists() {
        return Err(format!("笔记「{title}」不存在"));
    }

    std::fs::read_to_string(&path).map_err(|e| e.to_string())
}

fn list_notes() -> Result<String, String> {
    let dir = notes_dir();
    let mut notes = Vec::new();

    if let Ok(entries) = std::fs::read_dir(&dir) {
        for entry in entries.flatten() {
            let path = entry.path();
            if path.extension().is_some_and(|e| e == "md") {
                if let Some(stem) = path.file_stem().and_then(|s| s.to_str()) {
                    notes.push(stem.to_string());
                }
            }
        }
    }

    if notes.is_empty() {
        Ok("暂无笔记。".to_string())
    } else {
        notes.sort();
        Ok(format!("笔记列表：\n{}", notes.join("\n")))
    }
}

fn note_path(title: &str) -> PathBuf {
    // Sanitize title: replace path separators
    let safe_title = title.replace(['/', '\\', ':', '*', '?', '"', '<', '>', '|'], "_");
    notes_dir().join(format!("{safe_title}.md"))
}
