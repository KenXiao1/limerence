use crate::types::StreamEvent;
use futures::Stream;
use std::pin::Pin;
use std::task::{Context, Poll};

/// Parses SSE lines from an OpenAI-compatible streaming response into StreamEvents.
pub struct SseStream {
    lines: Vec<String>,
    pos: usize,
}

impl SseStream {
    pub fn new(lines: Vec<String>) -> Self {
        Self { lines, pos: 0 }
    }
}

impl Stream for SseStream {
    type Item = StreamEvent;

    fn poll_next(mut self: Pin<&mut Self>, _cx: &mut Context<'_>) -> Poll<Option<Self::Item>> {
        while self.pos < self.lines.len() {
            let pos = self.pos;
            self.pos += 1;
            let line = &self.lines[pos];

            if let Some(event) = parse_sse_line(line) {
                return Poll::Ready(Some(event));
            }
        }
        Poll::Ready(None)
    }
}

/// Parse a single SSE data line into a StreamEvent.
pub fn parse_sse_line(line: &str) -> Option<StreamEvent> {
    let data = line.strip_prefix("data: ")?;

    if data == "[DONE]" {
        return Some(StreamEvent::Done);
    }

    let json: serde_json::Value = serde_json::from_str(data).ok()?;

    // Check for error
    if let Some(err) = json.get("error") {
        return Some(StreamEvent::Error(err.to_string()));
    }

    let choice = json.get("choices")?.get(0)?;
    let delta = choice.get("delta")?;

    // Text content delta
    if let Some(content) = delta.get("content").and_then(|c| c.as_str()) {
        if !content.is_empty() {
            return Some(StreamEvent::TextDelta(content.to_string()));
        }
    }

    // Tool call deltas
    if let Some(tool_calls) = delta.get("tool_calls").and_then(|t| t.as_array()) {
        for tc in tool_calls {
            let index = tc.get("index").and_then(|i| i.as_u64()).unwrap_or(0) as usize;

            // Tool call start: has id and function.name
            if let (Some(id), Some(func)) = (
                tc.get("id").and_then(|i| i.as_str()),
                tc.get("function"),
            ) {
                if let Some(name) = func.get("name").and_then(|n| n.as_str()) {
                    return Some(StreamEvent::ToolCallStart {
                        index,
                        id: id.to_string(),
                        name: name.to_string(),
                    });
                }
            }

            // Tool call delta: has function.arguments chunk
            if let Some(args) = tc
                .get("function")
                .and_then(|f| f.get("arguments"))
                .and_then(|a| a.as_str())
            {
                if !args.is_empty() {
                    return Some(StreamEvent::ToolCallDelta {
                        index,
                        arguments: args.to_string(),
                    });
                }
            }
        }
    }

    // finish_reason = "stop" or "tool_calls"
    if let Some(reason) = choice.get("finish_reason").and_then(|r| r.as_str()) {
        if reason == "stop" || reason == "tool_calls" {
            return Some(StreamEvent::Done);
        }
    }

    None
}
