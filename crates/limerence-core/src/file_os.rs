use crate::config::workspace_dir;
use std::path::{Path, PathBuf};

/// Read a file from the sandbox workspace.
pub fn file_read(path: &str) -> Result<String, String> {
    let full_path = resolve_path(path)?;

    if !full_path.exists() {
        return Err(format!("文件不存在：{path}"));
    }

    if !full_path.is_file() {
        // List directory contents
        if full_path.is_dir() {
            return list_dir(&full_path);
        }
        return Err(format!("不是文件：{path}"));
    }

    std::fs::read_to_string(&full_path).map_err(|e| format!("读取失败：{e}"))
}

/// Write a file to the sandbox workspace.
pub fn file_write(path: &str, content: &str) -> Result<String, String> {
    let full_path = resolve_path(path)?;

    // Create parent directories
    if let Some(parent) = full_path.parent() {
        std::fs::create_dir_all(parent).map_err(|e| format!("创建目录失败：{e}"))?;
    }

    std::fs::write(&full_path, content).map_err(|e| format!("写入失败：{e}"))?;
    Ok(format!("已写入文件：{path}"))
}

/// Resolve a relative path within the sandbox, preventing path traversal.
fn resolve_path(path: &str) -> Result<PathBuf, String> {
    let workspace = workspace_dir();
    let _ = std::fs::create_dir_all(&workspace);

    let requested = Path::new(path);

    // Join with workspace and canonicalize to prevent traversal
    let full_path = workspace.join(requested);

    // Normalize the path (resolve .. and .)
    // We can't use canonicalize because the file might not exist yet
    let normalized = normalize_path(&full_path);

    // Ensure the normalized path is within workspace
    let workspace_canonical = if workspace.exists() {
        workspace.canonicalize().unwrap_or(workspace.clone())
    } else {
        workspace.clone()
    };

    let check_path = if normalized.exists() {
        normalized.canonicalize().unwrap_or(normalized.clone())
    } else {
        normalized.clone()
    };

    if !check_path.starts_with(&workspace_canonical) && !normalized.starts_with(&workspace) {
        return Err("路径越权：不允许访问工作区外的文件".to_string());
    }

    Ok(normalized)
}

fn normalize_path(path: &Path) -> PathBuf {
    let mut components = Vec::new();
    for component in path.components() {
        match component {
            std::path::Component::ParentDir => {
                components.pop();
            }
            std::path::Component::CurDir => {}
            other => components.push(other),
        }
    }
    components.iter().collect()
}

fn list_dir(path: &Path) -> Result<String, String> {
    let mut entries = Vec::new();
    if let Ok(read_dir) = std::fs::read_dir(path) {
        for entry in read_dir.flatten() {
            let name = entry.file_name().to_string_lossy().to_string();
            let is_dir = entry.file_type().map(|t| t.is_dir()).unwrap_or(false);
            if is_dir {
                entries.push(format!("{name}/"));
            } else {
                entries.push(name);
            }
        }
    }
    entries.sort();
    if entries.is_empty() {
        Ok("目录为空。".to_string())
    } else {
        Ok(entries.join("\n"))
    }
}
