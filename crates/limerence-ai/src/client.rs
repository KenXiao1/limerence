use crate::types::*;
use futures::StreamExt;
use thiserror::Error;
use tokio::sync::mpsc;

#[derive(Debug, Error)]
pub enum LlmError {
    #[error("HTTP error: {0}")]
    Http(#[from] reqwest::Error),
    #[error("API error: {0}")]
    Api(String),
    #[error("Missing API key for env var: {0}")]
    MissingApiKey(String),
    #[error("JSON error: {0}")]
    Json(#[from] serde_json::Error),
}

#[derive(Clone)]
pub struct LlmClient {
    http: reqwest::Client,
}

impl LlmClient {
    pub fn new() -> Self {
        Self {
            http: reqwest::Client::new(),
        }
    }

    /// Stream a chat completion, sending events through the channel.
    pub async fn stream(
        &self,
        model: &Model,
        messages: &[Message],
        tools: &[ToolDef],
        tx: mpsc::UnboundedSender<StreamEvent>,
    ) -> Result<Message, LlmError> {
        let api_key = model
            .api_key()
            .ok_or_else(|| LlmError::MissingApiKey(model.api_key_env.clone()))?;

        let url = format!("{}/chat/completions", model.base_url.trim_end_matches('/'));

        let openai_messages: Vec<serde_json::Value> =
            messages.iter().map(message_to_openai).collect();

        let openai_tools: Option<Vec<serde_json::Value>> = if tools.is_empty() {
            None
        } else {
            Some(tools.iter().map(tool_to_openai).collect())
        };

        let body = ChatRequest {
            model: model.id.clone(),
            messages: openai_messages,
            tools: openai_tools,
            stream: true,
        };

        let resp = self
            .http
            .post(&url)
            .header("Authorization", format!("Bearer {api_key}"))
            .header("Content-Type", "application/json")
            .json(&body)
            .send()
            .await?;

        if !resp.status().is_success() {
            let status = resp.status();
            let body = resp.text().await.unwrap_or_default();
            return Err(LlmError::Api(format!("{status}: {body}")));
        }

        // Read SSE stream
        let mut text_content = String::new();
        let mut tool_calls: Vec<ToolCall> = Vec::new();
        // Buffer for accumulating tool call arguments by index
        let mut tc_args: Vec<String> = Vec::new();

        let mut byte_stream = resp.bytes_stream();
        let mut line_buf = String::new();

        while let Some(chunk) = byte_stream.next().await {
            let chunk = chunk?;
            let chunk_str = String::from_utf8_lossy(&chunk);
            line_buf.push_str(&chunk_str);

            // Process complete lines
            while let Some(newline_pos) = line_buf.find('\n') {
                let line = line_buf[..newline_pos].trim().to_string();
                line_buf = line_buf[newline_pos + 1..].to_string();

                if line.is_empty() || !line.starts_with("data: ") {
                    continue;
                }

                if let Some(event) = crate::stream::parse_sse_line(&line) {
                    match &event {
                        StreamEvent::TextDelta(text) => {
                            text_content.push_str(text);
                        }
                        StreamEvent::ToolCallStart { index, id, name } => {
                            while tool_calls.len() <= *index {
                                tool_calls.push(ToolCall {
                                    id: String::new(),
                                    function: FunctionCall {
                                        name: String::new(),
                                        arguments: String::new(),
                                    },
                                });
                                tc_args.push(String::new());
                            }
                            tool_calls[*index].id = id.clone();
                            tool_calls[*index].function.name = name.clone();
                        }
                        StreamEvent::ToolCallDelta { index, arguments } => {
                            while tc_args.len() <= *index {
                                tc_args.push(String::new());
                            }
                            tc_args[*index].push_str(arguments);
                        }
                        StreamEvent::Done => {}
                        StreamEvent::Error(e) => {
                            let _ = tx.send(StreamEvent::Error(e.clone()));
                        }
                    }
                    let _ = tx.send(event);
                }
            }
        }

        // Finalize tool call arguments
        for (i, args) in tc_args.into_iter().enumerate() {
            if i < tool_calls.len() {
                tool_calls[i].function.arguments = args;
            }
        }

        let _ = tx.send(StreamEvent::Done);

        if tool_calls.is_empty() {
            Ok(Message::assistant(text_content))
        } else {
            Ok(Message::assistant_with_tools(text_content, tool_calls))
        }
    }

    /// Non-streaming completion (for simple use cases).
    pub async fn complete(
        &self,
        model: &Model,
        messages: &[Message],
        tools: &[ToolDef],
    ) -> Result<Message, LlmError> {
        let api_key = model
            .api_key()
            .ok_or_else(|| LlmError::MissingApiKey(model.api_key_env.clone()))?;

        let url = format!("{}/chat/completions", model.base_url.trim_end_matches('/'));

        let openai_messages: Vec<serde_json::Value> =
            messages.iter().map(message_to_openai).collect();

        let openai_tools: Option<Vec<serde_json::Value>> = if tools.is_empty() {
            None
        } else {
            Some(tools.iter().map(tool_to_openai).collect())
        };

        let body = serde_json::json!({
            "model": model.id,
            "messages": openai_messages,
            "tools": openai_tools,
            "stream": false,
        });

        let resp = self
            .http
            .post(&url)
            .header("Authorization", format!("Bearer {api_key}"))
            .json(&body)
            .send()
            .await?;

        if !resp.status().is_success() {
            let status = resp.status();
            let body = resp.text().await.unwrap_or_default();
            return Err(LlmError::Api(format!("{status}: {body}")));
        }

        let json: serde_json::Value = resp.json().await?;
        let choice = &json["choices"][0]["message"];

        let content = choice["content"]
            .as_str()
            .unwrap_or_default()
            .to_string();

        let tool_calls = if let Some(tcs) = choice.get("tool_calls").and_then(|t| t.as_array()) {
            tcs.iter()
                .filter_map(|tc| {
                    Some(ToolCall {
                        id: tc.get("id")?.as_str()?.to_string(),
                        function: FunctionCall {
                            name: tc.get("function")?.get("name")?.as_str()?.to_string(),
                            arguments: tc
                                .get("function")?
                                .get("arguments")?
                                .as_str()?
                                .to_string(),
                        },
                    })
                })
                .collect()
        } else {
            vec![]
        };

        if tool_calls.is_empty() {
            Ok(Message::assistant(content))
        } else {
            Ok(Message::assistant_with_tools(content, tool_calls))
        }
    }
}

impl Default for LlmClient {
    fn default() -> Self {
        Self::new()
    }
}
