use serde::{Deserialize, Serialize};

/// SillyTavern V2 compatible character card.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CharacterCard {
    #[serde(default = "default_spec")]
    pub spec: String,
    #[serde(default = "default_spec_version")]
    pub spec_version: String,
    pub data: CharacterData,
}

fn default_spec() -> String {
    "chara_card_v2".to_string()
}
fn default_spec_version() -> String {
    "2.0".to_string()
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CharacterData {
    pub name: String,
    #[serde(default)]
    pub description: String,
    #[serde(default)]
    pub personality: String,
    #[serde(default)]
    pub scenario: String,
    #[serde(default)]
    pub first_mes: String,
    #[serde(default)]
    pub system_prompt: String,
    #[serde(default)]
    pub mes_example: String,
    #[serde(default)]
    pub extensions: serde_json::Value,
}

impl CharacterCard {
    pub fn load(path: &std::path::Path) -> Result<Self, Box<dyn std::error::Error>> {
        let content = std::fs::read_to_string(path)?;
        let card: Self = serde_json::from_str(&content)?;
        Ok(card)
    }

    /// Load the default character from config/default_character.json (embedded).
    pub fn default_character() -> Self {
        let json = include_str!("../../limerence-tui/../../config/default_character.json");
        serde_json::from_str(json).expect("default character card should be valid JSON")
    }

    /// Build the system prompt from character card fields.
    pub fn build_system_prompt(&self) -> String {
        let d = &self.data;
        let mut parts = Vec::new();

        if !d.system_prompt.is_empty() {
            parts.push(d.system_prompt.clone());
        }

        parts.push(format!("你的名字是{}。", d.name));

        if !d.description.is_empty() {
            parts.push(format!("角色描述：{}", d.description));
        }
        if !d.personality.is_empty() {
            parts.push(format!("性格特征：{}", d.personality));
        }
        if !d.scenario.is_empty() {
            parts.push(format!("场景设定：{}", d.scenario));
        }
        if !d.mes_example.is_empty() {
            parts.push(format!("对话示例：\n{}", d.mes_example));
        }

        // Append tool usage instructions
        parts.push(
            "你可以使用以下工具来增强对话体验：\n\
             - memory_search：搜索历史对话和持久记忆文件\n\
             - memory_write：写入持久记忆文件（memory/PROFILE.md、memory/MEMORY.md、memory/YYYY-MM-DD.md）\n\
             - memory_get：读取记忆文件的指定行范围\n\
             - web_search：搜索互联网获取实时信息\n\
             - note_write：写入持久化笔记，记录用户的重要信息\n\
             - note_read：读取之前写的笔记\n\
             - file_read：读取工作区文件\n\
             - file_write：在工作区创建或写入文件（memory/ 目录请使用 memory_write）\n\
             \n\
             回忆之前的事情时：先用 memory_search 搜索，再用 memory_get 获取完整内容。\n\
             发现用户的重要新信息时，优先用 memory_write 写入持久记忆。\n\
             用 note_write 记录短期笔记（偏好、经历、情绪状态等）。"
                .to_string(),
        );

        parts.join("\n\n")
    }
}
