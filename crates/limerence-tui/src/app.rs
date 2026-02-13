use crossterm::event::{self, Event, KeyCode, KeyModifiers};
use limerence_core::{Agent, AgentEvent, CharacterCard, Config};
use ratatui::DefaultTerminal;
use std::time::Duration;
use tokio::sync::mpsc;

use crate::input;
use crate::ui;

#[derive(Debug, Clone)]
pub enum DisplayMessage {
    User(String),
    Assistant(String),
    ToolCall { name: String },
    ToolResult { name: String, result: String },
    System(String),
    Error(String),
}

pub struct App {
    pub agent: Option<Agent>,
    pub config: Config,
    pub messages: Vec<DisplayMessage>,
    pub input: String,
    pub cursor_pos: usize,
    pub streaming_text: String,
    pub is_streaming: bool,
    pub should_quit: bool,
}

impl App {
    pub fn new(config: Config, character: CharacterCard) -> Self {
        let agent = Agent::new(&config, character);
        Self {
            agent: Some(agent),
            config,
            messages: Vec::new(),
            input: String::new(),
            cursor_pos: 0,
            streaming_text: String::new(),
            is_streaming: false,
            should_quit: false,
        }
    }

    fn agent(&self) -> &Agent {
        self.agent.as_ref().expect("agent should be present")
    }

    fn agent_mut(&mut self) -> &mut Agent {
        self.agent.as_mut().expect("agent should be present")
    }

    pub async fn run(&mut self) -> Result<(), Box<dyn std::error::Error>> {
        let mut terminal = ratatui::init();
        terminal.clear()?;

        if let Some(first_mes) = self.agent().first_message() {
            self.messages
                .push(DisplayMessage::Assistant(first_mes.to_string()));
        }

        let result = self.event_loop(&mut terminal).await;

        ratatui::restore();
        result
    }

    async fn event_loop(
        &mut self,
        terminal: &mut DefaultTerminal,
    ) -> Result<(), Box<dyn std::error::Error>> {
        loop {
            terminal.draw(|frame| ui::draw(frame, self))?;

            if self.should_quit {
                break;
            }

            if event::poll(Duration::from_millis(50))? {
                if let Event::Key(key) = event::read()? {
                    match (key.modifiers, key.code) {
                        (KeyModifiers::CONTROL, KeyCode::Char('c')) => {
                            self.should_quit = true;
                        }
                        (KeyModifiers::CONTROL, KeyCode::Char('n')) => {
                            self.agent_mut().new_session();
                            self.messages.clear();
                            self.messages
                                .push(DisplayMessage::System("新会话已开始。".to_string()));
                            if let Some(first_mes) = self.agent().first_message() {
                                self.messages
                                    .push(DisplayMessage::Assistant(first_mes.to_string()));
                            }
                        }
                        _ => {
                            if let Some(user_input) =
                                input::handle_key_input(key, &mut self.input, &mut self.cursor_pos)
                            {
                                self.send_message(user_input, terminal).await;
                            }
                        }
                    }
                }
            }
        }

        Ok(())
    }

    async fn send_message(&mut self, user_input: String, terminal: &mut DefaultTerminal) {
        self.messages.push(DisplayMessage::User(user_input.clone()));
        self.streaming_text.clear();
        self.is_streaming = true;

        let (event_tx, mut event_rx) = mpsc::unbounded_channel::<AgentEvent>();

        // Take the agent out of self so we can move it into a local task
        // while still mutating self for UI updates.
        let mut agent = self.agent.take().expect("agent should be present");

        let local = tokio::task::LocalSet::new();

        let agent_handle = local.spawn_local(async move {
            agent.process_message(user_input, event_tx).await;
            agent
        });

        // Run the LocalSet alongside our UI event loop
        local
            .run_until(async {
                loop {
                    // Draw
                    let _ = terminal.draw(|frame| ui::draw(frame, self));

                    // Check keyboard
                    if event::poll(Duration::from_millis(16)).unwrap_or(false) {
                        if let Ok(Event::Key(key)) = event::read() {
                            if key.code == KeyCode::Esc {
                                self.flush_streaming();
                                agent_handle.abort();
                                break;
                            }
                            if key.modifiers == KeyModifiers::CONTROL
                                && key.code == KeyCode::Char('c')
                            {
                                self.flush_streaming();
                                self.should_quit = true;
                                agent_handle.abort();
                                break;
                            }
                        }
                    }

                    // Drain agent events
                    loop {
                        match event_rx.try_recv() {
                            Ok(ev) => {
                                if self.handle_agent_event(ev) {
                                    self.is_streaming = false;
                                    let _ = terminal.draw(|frame| ui::draw(frame, self));

                                    // Wait for agent to finish and recover it
                                    if let Ok(a) = agent_handle.await {
                                        self.agent = Some(a);
                                    }
                                    return;
                                }
                            }
                            Err(mpsc::error::TryRecvError::Empty) => break,
                            Err(mpsc::error::TryRecvError::Disconnected) => {
                                self.flush_streaming();
                                self.is_streaming = false;
                                let _ = terminal.draw(|frame| ui::draw(frame, self));

                                if let Ok(a) = agent_handle.await {
                                    self.agent = Some(a);
                                }
                                return;
                            }
                        }
                    }

                    // Yield to let the local task (agent) make progress
                    tokio::task::yield_now().await;
                }
            })
            .await;

        // If agent was aborted (Esc/Ctrl+C), recover by creating a fresh one
        if self.agent.is_none() {
            // Agent was lost due to abort — recreate from config
            let character = CharacterCard::default_character();
            self.agent = Some(Agent::new(&self.config, character));
            self.messages
                .push(DisplayMessage::System("生成已中断。".to_string()));
        }

        self.is_streaming = false;
    }

    fn handle_agent_event(&mut self, event: AgentEvent) -> bool {
        match event {
            AgentEvent::TextDelta(text) => {
                self.streaming_text.push_str(&text);
                false
            }
            AgentEvent::ToolCallStart { name } => {
                self.flush_streaming();
                self.messages.push(DisplayMessage::ToolCall { name });
                false
            }
            AgentEvent::ToolCallResult { name, result } => {
                self.messages
                    .push(DisplayMessage::ToolResult { name, result });
                false
            }
            AgentEvent::Done => {
                self.flush_streaming();
                true
            }
            AgentEvent::Error(e) => {
                self.flush_streaming();
                self.messages.push(DisplayMessage::Error(e));
                true
            }
        }
    }

    fn flush_streaming(&mut self) {
        if !self.streaming_text.is_empty() {
            self.messages.push(DisplayMessage::Assistant(
                std::mem::take(&mut self.streaming_text),
            ));
        }
    }
}
