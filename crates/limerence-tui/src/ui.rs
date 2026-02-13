use ratatui::{
    layout::{Constraint, Direction, Layout, Rect},
    style::{Color, Modifier, Style},
    text::{Line, Span, Text},
    widgets::{Block, Borders, Paragraph, Wrap},
    Frame,
};

use crate::app::{App, DisplayMessage};

fn agent_name(app: &App) -> &str {
    app.agent
        .as_ref()
        .map(|a| a.character_name())
        .unwrap_or("...")
}

pub fn draw(frame: &mut Frame, app: &App) {
    let chunks = Layout::default()
        .direction(Direction::Vertical)
        .constraints([
            Constraint::Length(1),
            Constraint::Min(5),
            Constraint::Length(3),
            Constraint::Length(1),
        ])
        .split(frame.area());

    draw_title_bar(frame, app, chunks[0]);
    draw_messages(frame, app, chunks[1]);
    draw_input(frame, app, chunks[2]);
    draw_status_bar(frame, app, chunks[3]);
}

fn draw_title_bar(frame: &mut Frame, app: &App, area: Rect) {
    let (name, model, memory) = match &app.agent {
        Some(a) => (a.character_name(), a.model_id(), a.memory_count()),
        None => ("...", "...", 0),
    };

    let title = Line::from(vec![
        Span::styled(
            format!(" {name} "),
            Style::default()
                .fg(Color::Magenta)
                .add_modifier(Modifier::BOLD),
        ),
        Span::styled(" │ ", Style::default().fg(Color::DarkGray)),
        Span::styled(model, Style::default().fg(Color::Cyan)),
        Span::styled(" │ ", Style::default().fg(Color::DarkGray)),
        Span::styled(
            format!("记忆 {memory}"),
            Style::default().fg(Color::Yellow),
        ),
        if app.is_streaming {
            Span::styled(" │ 生成中...", Style::default().fg(Color::Green))
        } else {
            Span::raw("")
        },
    ]);

    let bar = Paragraph::new(title).style(
        Style::default()
            .bg(Color::Rgb(30, 30, 40))
            .fg(Color::White),
    );
    frame.render_widget(bar, area);
}

fn draw_messages(frame: &mut Frame, app: &App, area: Rect) {
    let char_name = agent_name(app);
    let mut lines: Vec<Line> = Vec::new();

    for msg in &app.messages {
        match msg {
            DisplayMessage::User(text) => {
                lines.push(Line::from(""));
                lines.push(Line::from(Span::styled(
                    "你：",
                    Style::default()
                        .fg(Color::Blue)
                        .add_modifier(Modifier::BOLD),
                )));
                for l in text.lines() {
                    lines.push(Line::from(Span::styled(
                        format!("  {l}"),
                        Style::default().fg(Color::White),
                    )));
                }
            }
            DisplayMessage::Assistant(text) => {
                lines.push(Line::from(""));
                lines.push(Line::from(Span::styled(
                    format!("{char_name}："),
                    Style::default()
                        .fg(Color::Magenta)
                        .add_modifier(Modifier::BOLD),
                )));
                for l in text.lines() {
                    lines.push(Line::from(Span::styled(
                        format!("  {l}"),
                        Style::default().fg(Color::White),
                    )));
                }
            }
            DisplayMessage::ToolCall { name } => {
                lines.push(Line::from(Span::styled(
                    format!("  ⚙ 调用工具：{name}"),
                    Style::default().fg(Color::Yellow),
                )));
            }
            DisplayMessage::ToolResult { name, result } => {
                let preview = if result.len() > 100 {
                    let end = result
                        .char_indices()
                        .nth(100)
                        .map(|(i, _)| i)
                        .unwrap_or(result.len());
                    format!("{}...", &result[..end])
                } else {
                    result.clone()
                };
                lines.push(Line::from(Span::styled(
                    format!("  ✓ {name}：{}", preview.replace('\n', " ")),
                    Style::default().fg(Color::DarkGray),
                )));
            }
            DisplayMessage::System(text) => {
                lines.push(Line::from(""));
                lines.push(Line::from(Span::styled(
                    format!("  {text}"),
                    Style::default()
                        .fg(Color::Cyan)
                        .add_modifier(Modifier::ITALIC),
                )));
            }
            DisplayMessage::Error(text) => {
                lines.push(Line::from(""));
                lines.push(Line::from(Span::styled(
                    format!("  错误：{text}"),
                    Style::default().fg(Color::Red),
                )));
            }
        }
    }

    // Streaming text (currently being generated)
    if !app.streaming_text.is_empty() {
        lines.push(Line::from(""));
        lines.push(Line::from(Span::styled(
            format!("{char_name}："),
            Style::default()
                .fg(Color::Magenta)
                .add_modifier(Modifier::BOLD),
        )));
        for l in app.streaming_text.lines() {
            lines.push(Line::from(Span::styled(
                format!("  {l}"),
                Style::default().fg(Color::White),
            )));
        }
        lines.push(Line::from(Span::styled(
            "  ▌",
            Style::default().fg(Color::Magenta),
        )));
    }

    let text = Text::from(lines);
    let total_lines = text.lines.len() as u16;
    let visible_height = area.height.saturating_sub(2);

    let scroll = if total_lines > visible_height {
        total_lines - visible_height
    } else {
        0
    };

    let messages_widget = Paragraph::new(text)
        .block(Block::default().borders(Borders::NONE))
        .wrap(Wrap { trim: false })
        .scroll((scroll, 0));

    frame.render_widget(messages_widget, area);
}

fn draw_input(frame: &mut Frame, app: &App, area: Rect) {
    let input_text = if app.is_streaming {
        "（生成中... 按 Esc 中断）"
    } else {
        &app.input
    };

    let input_widget = Paragraph::new(input_text)
        .block(
            Block::default()
                .borders(Borders::ALL)
                .border_style(Style::default().fg(if app.is_streaming {
                    Color::DarkGray
                } else {
                    Color::Cyan
                }))
                .title(" 输入 "),
        )
        .style(Style::default().fg(if app.is_streaming {
            Color::DarkGray
        } else {
            Color::White
        }));

    frame.render_widget(input_widget, area);

    if !app.is_streaming {
        frame.set_cursor_position((
            area.x + app.cursor_pos as u16 + 1,
            area.y + 1,
        ));
    }
}

fn draw_status_bar(frame: &mut Frame, app: &App, area: Rect) {
    let session_id = app
        .agent
        .as_ref()
        .map(|a| a.session_id())
        .unwrap_or("--------");
    let session_short = &session_id[..8.min(session_id.len())];

    let status = Line::from(vec![
        Span::styled(
            format!(" 会话 {session_short}"),
            Style::default().fg(Color::DarkGray),
        ),
        Span::styled(" │ ", Style::default().fg(Color::DarkGray)),
        Span::styled(
            "Ctrl+N 新会话  Ctrl+C 退出  Esc 中断",
            Style::default().fg(Color::DarkGray),
        ),
    ]);

    let bar = Paragraph::new(status).style(
        Style::default()
            .bg(Color::Rgb(20, 20, 30))
            .fg(Color::DarkGray),
    );
    frame.render_widget(bar, area);
}
