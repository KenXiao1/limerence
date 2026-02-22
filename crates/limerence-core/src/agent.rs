use chrono::Utc;
use limerence_ai::{LlmClient, Message, Model, StreamEvent, ToolDef};
use tokio::sync::mpsc;

use crate::character::CharacterCard;
use crate::config::{Config, SearchConfig};
use crate::memory::{MemoryEntry, MemoryIndex};
use crate::session::Session;
use crate::tool;

/// Events sent from the agent to the TUI.
#[derive(Debug, Clone)]
pub enum AgentEvent {
    /// Streaming text delta from LLM
    TextDelta(String),
    /// A tool call is starting
    ToolCallStart { name: String },
    /// Tool call result
    ToolCallResult { name: String, result: String },
    /// LLM turn complete (no more tool calls)
    Done,
    /// Error occurred
    Error(String),
}

pub struct Agent {
    client: LlmClient,
    model: Model,
    character: CharacterCard,
    session: Session,
    memory: MemoryIndex,
    tools: Vec<ToolDef>,
    search_config: SearchConfig,
    base_system_prompt: String,
}

const MEMORY_INJECTION_MAX_CHARS: usize = 3000;

impl Agent {
    pub fn new(config: &Config, character: CharacterCard) -> Self {
        let model = config.to_model();
        let session = Session::new(&character.data.name, &model.id);
        let mut memory = MemoryIndex::new();
        memory.load_from_disk();

        let base_system_prompt = character.build_system_prompt();
        let tools = tool::all_tool_defs();

        Self {
            client: LlmClient::new(),
            model,
            character,
            session,
            memory,
            tools,
            search_config: config.search.clone(),
            base_system_prompt,
        }
    }

    pub fn character_name(&self) -> &str {
        &self.character.data.name
    }

    pub fn model_id(&self) -> &str {
        &self.model.id
    }

    pub fn session_id(&self) -> &str {
        &self.session.header.id
    }

    pub fn first_message(&self) -> Option<&str> {
        let msg = &self.character.data.first_mes;
        if msg.is_empty() { None } else { Some(msg) }
    }

    pub fn memory_count(&self) -> usize {
        self.memory.entry_count()
    }

    /// Process a user message through the agent loop.
    /// Returns a channel that receives AgentEvents for the TUI to render.
    pub async fn process_message(
        &mut self,
        user_input: String,
        event_tx: mpsc::UnboundedSender<AgentEvent>,
    ) {
        // Add user message
        let user_msg = Message::user(&user_input);
        self.session.append(user_msg.clone());

        // Index user message in memory
        self.memory.add(MemoryEntry {
            session_id: self.session.header.id.clone(),
            timestamp: Utc::now(),
            role: "user".to_string(),
            content: user_input,
        });

        // Agent loop: keep going until LLM responds without tool calls
        loop {
            // Build message list
            let runtime_system_prompt =
                compose_system_prompt(&self.base_system_prompt, self.memory.memory_root());
            let mut messages = vec![Message::system(runtime_system_prompt)];
            messages.extend(self.session.messages());

            // Stream LLM response
            let (stream_tx, mut stream_rx) = mpsc::unbounded_channel::<StreamEvent>();

            let client = self.client.clone();
            let model = self.model.clone();
            let tools = self.tools.clone();

            let llm_handle =
                tokio::spawn(
                    async move { client.stream(&model, &messages, &tools, stream_tx).await },
                );

            // Forward stream events to TUI
            let mut full_text = String::new();
            while let Some(event) = stream_rx.recv().await {
                match &event {
                    StreamEvent::TextDelta(text) => {
                        full_text.push_str(text);
                        let _ = event_tx.send(AgentEvent::TextDelta(text.clone()));
                    }
                    StreamEvent::Error(e) => {
                        let _ = event_tx.send(AgentEvent::Error(e.clone()));
                    }
                    _ => {}
                }
            }

            // Get the final assembled message
            let assistant_msg = match llm_handle.await {
                Ok(Ok(msg)) => msg,
                Ok(Err(e)) => {
                    let _ = event_tx.send(AgentEvent::Error(e.to_string()));
                    break;
                }
                Err(e) => {
                    let _ = event_tx.send(AgentEvent::Error(format!("Task join error: {e}")));
                    break;
                }
            };

            // Save assistant message
            self.session.append(assistant_msg.clone());

            // Index assistant message in memory
            if !full_text.is_empty() {
                self.memory.add(MemoryEntry {
                    session_id: self.session.header.id.clone(),
                    timestamp: Utc::now(),
                    role: "assistant".to_string(),
                    content: full_text,
                });
            }

            // Check for tool calls
            let tool_calls = match &assistant_msg {
                Message::Assistant { tool_calls, .. } => tool_calls.clone(),
                _ => vec![],
            };

            if tool_calls.is_empty() {
                let _ = event_tx.send(AgentEvent::Done);
                break;
            }

            // Execute tool calls sequentially
            for tc in &tool_calls {
                let name = &tc.function.name;
                let _ = event_tx.send(AgentEvent::ToolCallStart { name: name.clone() });

                let result = tool::execute_tool(
                    name,
                    &tc.function.arguments,
                    &self.memory,
                    &self.search_config,
                );

                let _ = event_tx.send(AgentEvent::ToolCallResult {
                    name: name.clone(),
                    result: result.clone(),
                });

                // Add tool result to session
                let tool_msg = Message::tool_result(&tc.id, &result);
                self.session.append(tool_msg);
            }

            // Continue loop — LLM will see tool results and generate next response
        }
    }

    /// Start a new session, keeping the same character and config.
    pub fn new_session(&mut self) {
        self.session = Session::new(&self.character.data.name, &self.model.id);
    }

    /// Switch to a different character.
    pub fn switch_character(&mut self, character: CharacterCard) {
        self.base_system_prompt = character.build_system_prompt();
        self.character = character;
        self.new_session();
    }
}

fn compose_system_prompt(base_system_prompt: &str, memory_root: &std::path::Path) -> String {
    if let Some(injection) = build_memory_injection(memory_root) {
        format!("{base_system_prompt}\n\n{injection}")
    } else {
        base_system_prompt.to_string()
    }
}

fn build_memory_injection(memory_root: &std::path::Path) -> Option<String> {
    let profile = std::fs::read_to_string(memory_root.join("PROFILE.md")).ok();
    let long_term = std::fs::read_to_string(memory_root.join("MEMORY.md")).ok();
    build_memory_injection_from_contents(profile.as_deref(), long_term.as_deref())
}

fn build_memory_injection_from_contents(
    profile: Option<&str>,
    long_term: Option<&str>,
) -> Option<String> {
    let mut parts = Vec::new();

    if let Some(content) = profile.filter(|v| !v.trim().is_empty()) {
        parts.push(format!(
            "[用户的记忆档案]\n{}",
            truncate_from_head(content.trim(), MEMORY_INJECTION_MAX_CHARS)
        ));
    }

    if let Some(content) = long_term.filter(|v| !v.trim().is_empty()) {
        parts.push(format!(
            "[长期记忆摘要]\n{}",
            truncate_from_head(content.trim(), MEMORY_INJECTION_MAX_CHARS)
        ));
    }

    if parts.is_empty() {
        None
    } else {
        Some(parts.join("\n\n"))
    }
}

fn truncate_from_head(text: &str, max_chars: usize) -> String {
    if text.chars().count() <= max_chars {
        return text.to_string();
    }
    let tail: String = text.chars().rev().take(max_chars).collect();
    format!("...\n{}", tail.chars().rev().collect::<String>())
}

#[cfg(test)]
mod tests {
    use super::*;

    struct TempMemoryRoot {
        root: std::path::PathBuf,
    }

    impl TempMemoryRoot {
        fn new() -> Self {
            let root =
                std::env::temp_dir().join(format!("limerence-agent-{}", uuid::Uuid::new_v4()));
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
    fn memory_injection_is_none_when_profile_and_memory_absent() {
        let temp = TempMemoryRoot::new();
        assert!(build_memory_injection(&temp.root).is_none());
    }

    #[test]
    fn memory_injection_includes_profile_and_memory_when_present() {
        let temp = TempMemoryRoot::new();
        std::fs::write(temp.root.join("PROFILE.md"), "姓名：小林\n偏好：咖啡")
            .expect("write profile");
        std::fs::write(temp.root.join("MEMORY.md"), "长期：正在学习 Rust").expect("write memory");

        let injected = build_memory_injection(&temp.root).expect("expected injection");
        assert!(injected.contains("[用户的记忆档案]"));
        assert!(injected.contains("偏好：咖啡"));
        assert!(injected.contains("[长期记忆摘要]"));
        assert!(injected.contains("正在学习 Rust"));
    }

    #[test]
    fn compose_system_prompt_appends_memory_injection() {
        let temp = TempMemoryRoot::new();
        std::fs::write(temp.root.join("PROFILE.md"), "喜欢夜跑").expect("write profile");

        let composed = compose_system_prompt("基础系统提示词", &temp.root);
        assert!(composed.starts_with("基础系统提示词"));
        assert!(composed.contains("用户的记忆档案"));
        assert!(composed.contains("喜欢夜跑"));
    }
}
