use serde::{Deserialize, Serialize};
use std::path::PathBuf;

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Config {
    pub model: ModelConfig,
    #[serde(default)]
    pub search: SearchConfig,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ModelConfig {
    pub id: String,
    pub base_url: String,
    pub api_key_env: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SearchConfig {
    #[serde(default = "default_engine")]
    pub engine: String,
    pub searxng_url: Option<String>,
}

fn default_engine() -> String {
    "duckduckgo".to_string()
}

impl Default for SearchConfig {
    fn default() -> Self {
        Self {
            engine: default_engine(),
            searxng_url: None,
        }
    }
}

impl Default for Config {
    fn default() -> Self {
        Self {
            model: ModelConfig {
                id: "deepseek-chat".to_string(),
                base_url: "https://api.deepseek.com/v1".to_string(),
                api_key_env: "DEEPSEEK_API_KEY".to_string(),
            },
            search: SearchConfig::default(),
        }
    }
}

impl Config {
    pub fn load() -> Self {
        let path = data_dir().join("config.toml");
        if path.exists() {
            let content = std::fs::read_to_string(&path).unwrap_or_default();
            toml::from_str(&content).unwrap_or_default()
        } else {
            let config = Config::default();
            // Write default config
            let _ = std::fs::create_dir_all(data_dir());
            let _ = std::fs::write(&path, toml::to_string_pretty(&config).unwrap_or_default());
            config
        }
    }

    pub fn to_model(&self) -> limerence_ai::Model {
        limerence_ai::Model {
            id: self.model.id.clone(),
            base_url: self.model.base_url.clone(),
            api_key_env: self.model.api_key_env.clone(),
        }
    }
}

/// Returns data dir (`$LIMERENCE_HOME` if set, otherwise `~/.limerence/`).
pub fn data_dir() -> PathBuf {
    if let Ok(override_home) = std::env::var("LIMERENCE_HOME") {
        let trimmed = override_home.trim();
        if !trimmed.is_empty() {
            return PathBuf::from(trimmed);
        }
    }

    dirs::home_dir()
        .unwrap_or_else(|| PathBuf::from("."))
        .join(".limerence")
}

pub fn sessions_dir() -> PathBuf {
    let d = data_dir().join("sessions");
    let _ = std::fs::create_dir_all(&d);
    d
}

pub fn memory_dir() -> PathBuf {
    let d = data_dir().join("memory");
    let _ = std::fs::create_dir_all(&d);
    d
}

pub fn notes_dir() -> PathBuf {
    let d = data_dir().join("notes");
    let _ = std::fs::create_dir_all(&d);
    d
}

pub fn workspace_dir() -> PathBuf {
    let d = data_dir().join("workspace");
    let _ = std::fs::create_dir_all(&d);
    d
}

pub fn characters_dir() -> PathBuf {
    let d = data_dir().join("characters");
    let _ = std::fs::create_dir_all(&d);
    d
}

#[cfg(test)]
mod tests {
    use super::data_dir;
    use std::sync::{Mutex, OnceLock};

    static ENV_LOCK: OnceLock<Mutex<()>> = OnceLock::new();

    fn env_lock() -> &'static Mutex<()> {
        ENV_LOCK.get_or_init(|| Mutex::new(()))
    }

    #[test]
    fn data_dir_uses_limerence_home_when_set() {
        let _guard = env_lock().lock().expect("env lock poisoned");
        let temp = std::env::temp_dir().join(format!("limerence-home-{}", uuid::Uuid::new_v4()));

        // SAFETY: guarded by a process-wide mutex in this test module.
        unsafe {
            std::env::set_var("LIMERENCE_HOME", &temp);
        }

        let actual = data_dir();

        // SAFETY: guarded by a process-wide mutex in this test module.
        unsafe {
            std::env::remove_var("LIMERENCE_HOME");
        }

        assert_eq!(actual, temp);
    }

    #[test]
    fn data_dir_falls_back_to_default_when_env_missing() {
        let _guard = env_lock().lock().expect("env lock poisoned");

        // SAFETY: guarded by a process-wide mutex in this test module.
        unsafe {
            std::env::remove_var("LIMERENCE_HOME");
        }

        let actual = data_dir();
        assert!(actual.ends_with(".limerence"));
    }
}
