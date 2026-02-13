use crossterm::event::{KeyCode, KeyEvent, KeyModifiers};

/// Handle key input for the text input field.
/// Returns Some(text) when the user submits (Enter), None otherwise.
pub fn handle_key_input(
    key: KeyEvent,
    input: &mut String,
    cursor_pos: &mut usize,
) -> Option<String> {
    match (key.modifiers, key.code) {
        // Enter: submit
        (KeyModifiers::NONE, KeyCode::Enter) | (KeyModifiers::NONE, KeyCode::Char('\n')) => {
            let text = input.trim().to_string();
            if text.is_empty() {
                return None;
            }
            input.clear();
            *cursor_pos = 0;
            Some(text)
        }
        // Shift+Enter: newline (for future multi-line support)
        (KeyModifiers::SHIFT, KeyCode::Enter) => {
            input.insert(*cursor_pos, '\n');
            *cursor_pos += 1;
            None
        }
        // Backspace
        (_, KeyCode::Backspace) => {
            if *cursor_pos > 0 {
                // Find the byte index for the character before cursor
                let byte_pos = input
                    .char_indices()
                    .nth(*cursor_pos - 1)
                    .map(|(i, _)| i)
                    .unwrap_or(0);
                let next_byte = input
                    .char_indices()
                    .nth(*cursor_pos)
                    .map(|(i, _)| i)
                    .unwrap_or(input.len());
                let _ = next_byte; // unused, we remove one char
                input.remove(byte_pos);
                *cursor_pos -= 1;
            }
            None
        }
        // Delete
        (_, KeyCode::Delete) => {
            let char_count = input.chars().count();
            if *cursor_pos < char_count {
                let byte_pos = input
                    .char_indices()
                    .nth(*cursor_pos)
                    .map(|(i, _)| i)
                    .unwrap_or(input.len());
                input.remove(byte_pos);
            }
            None
        }
        // Left arrow
        (_, KeyCode::Left) => {
            if *cursor_pos > 0 {
                *cursor_pos -= 1;
            }
            None
        }
        // Right arrow
        (_, KeyCode::Right) => {
            let char_count = input.chars().count();
            if *cursor_pos < char_count {
                *cursor_pos += 1;
            }
            None
        }
        // Home
        (_, KeyCode::Home) => {
            *cursor_pos = 0;
            None
        }
        // End
        (_, KeyCode::End) => {
            *cursor_pos = input.chars().count();
            None
        }
        // Regular character input
        (KeyModifiers::NONE | KeyModifiers::SHIFT, KeyCode::Char(c)) => {
            let byte_pos = input
                .char_indices()
                .nth(*cursor_pos)
                .map(|(i, _)| i)
                .unwrap_or(input.len());
            input.insert(byte_pos, c);
            *cursor_pos += 1;
            None
        }
        _ => None,
    }
}
