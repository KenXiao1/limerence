/**
 * Message actions bar — renders action buttons for the last response.
 * Supports: regenerate, swipe (prev/next), edit, delete.
 */

import { html, type TemplateResult } from "lit";
import { t, tf } from "../lib/i18n";
import type { SwipeState } from "../controllers/message-actions";

export interface MessageActionsState {
  /** Whether there are messages to act on */
  hasMessages: boolean;
  /** Whether the agent is currently streaming */
  isStreaming: boolean;
  /** Swipe state for the last response (null if no swipe data) */
  swipeState: SwipeState | null;
  /** Whether we're in edit mode */
  editMode: boolean;
  /** Index of the message being edited (-1 if none) */
  editingIndex: number;
  /** Text content being edited */
  editText: string;
  /** Role of the message being edited */
  editRole: string;
}

export interface MessageActionsCallbacks {
  onRegenerate: () => void;
  onSwipePrev: () => void;
  onSwipeNext: () => void;
  onEditLast: () => void;
  onDeleteLast: () => void;
  onEditSave: () => void;
  onEditCancel: () => void;
  onEditTextChange: (text: string) => void;
  onRegenerateFromEdit: () => void;
}

export function renderMessageActions(
  s: MessageActionsState,
  actions: MessageActionsCallbacks,
): TemplateResult | null {
  if (!s.hasMessages) return null;

  // Edit mode: show editor
  if (s.editMode) {
    return renderEditMode(s, actions);
  }

  // Normal mode: show action buttons
  return html`
    <div class="limerence-msg-actions">
      <div class="limerence-msg-actions-row">
        ${renderSwipeControls(s, actions)}
        ${renderActionButtons(s, actions)}
      </div>
    </div>
  `;
}

function renderSwipeControls(
  s: MessageActionsState,
  actions: MessageActionsCallbacks,
): TemplateResult | null {
  if (!s.swipeState || s.swipeState.alternatives.length <= 1) return null;

  const { currentIndex, alternatives } = s.swipeState;
  const total = alternatives.length;

  return html`
    <div class="limerence-msg-swipe">
      <button
        class="limerence-msg-swipe-btn"
        @click=${actions.onSwipePrev}
        title="${t("msg.swipePrev")}"
        ?disabled=${s.isStreaming}
      >‹</button>
      <span class="limerence-msg-swipe-counter">${currentIndex + 1}/${total}</span>
      <button
        class="limerence-msg-swipe-btn"
        @click=${actions.onSwipeNext}
        title="${t("msg.swipeNext")}"
        ?disabled=${s.isStreaming}
      >›</button>
    </div>
  `;
}

function renderActionButtons(
  s: MessageActionsState,
  actions: MessageActionsCallbacks,
): TemplateResult {
  return html`
    <div class="limerence-msg-btns">
      <button
        class="limerence-msg-btn"
        @click=${actions.onRegenerate}
        title="${t("msg.regenerate")}"
        ?disabled=${s.isStreaming}
      >
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="13" height="13">
          <path stroke-linecap="round" stroke-linejoin="round" d="M16.023 9.348h4.992v-.001M2.985 19.644v-4.992m0 0h4.992m-4.993 0 3.181 3.183a8.25 8.25 0 0 0 13.803-3.7M4.031 9.865a8.25 8.25 0 0 1 13.803-3.7l3.181 3.182" />
        </svg>
        <span>${t("msg.regenerateShort")}</span>
      </button>
      <button
        class="limerence-msg-btn"
        @click=${actions.onEditLast}
        title="${t("msg.editMsg")}"
        ?disabled=${s.isStreaming}
      >
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="13" height="13">
          <path stroke-linecap="round" stroke-linejoin="round" d="m16.862 4.487 1.687-1.688a1.875 1.875 0 1 1 2.652 2.652L10.582 16.07a4.5 4.5 0 0 1-1.897 1.13L6 18l.8-2.685a4.5 4.5 0 0 1 1.13-1.897l8.932-8.931Z" />
        </svg>
        <span>${t("msg.edit")}</span>
      </button>
      <button
        class="limerence-msg-btn limerence-msg-btn-danger"
        @click=${actions.onDeleteLast}
        title="${t("msg.deleteLast")}"
        ?disabled=${s.isStreaming}
      >
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="13" height="13">
          <path stroke-linecap="round" stroke-linejoin="round" d="m14.74 9-.346 9m-4.788 0L9.26 9m9.968-3.21c.342.052.682.107 1.022.166m-1.022-.165L18.16 19.673a2.25 2.25 0 0 1-2.244 2.077H8.084a2.25 2.25 0 0 1-2.244-2.077L4.772 5.79m14.456 0a48.108 48.108 0 0 0-3.478-.397m-12 .562c.34-.059.68-.114 1.022-.165m0 0a48.11 48.11 0 0 1 3.478-.397m7.5 0v-.916c0-1.18-.91-2.164-2.09-2.201a51.964 51.964 0 0 0-3.32 0c-1.18.037-2.09 1.022-2.09 2.201v.916m7.5 0a48.667 48.667 0 0 0-7.5 0" />
        </svg>
        <span>${t("msg.delete")}</span>
      </button>
    </div>
  `;
}

function renderEditMode(
  s: MessageActionsState,
  actions: MessageActionsCallbacks,
): TemplateResult {
  const roleLabel = s.editRole === "user" || s.editRole === "user-with-attachments" ? t("msg.userMsg") : t("msg.aiReply");

  return html`
    <div class="limerence-msg-edit">
      <div class="limerence-msg-edit-header">
        <span class="limerence-msg-edit-label">${tf("msg.editLabel", roleLabel)}</span>
        <div class="limerence-msg-edit-actions">
          <button class="limerence-msg-btn" @click=${actions.onEditSave} title="${t("msg.saveEdit")}">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="13" height="13">
              <path stroke-linecap="round" stroke-linejoin="round" d="m4.5 12.75 6 6 9-13.5" />
            </svg>
            <span>${t("msg.save")}</span>
          </button>
          ${s.editRole === "user" || s.editRole === "user-with-attachments" ? html`
            <button class="limerence-msg-btn" @click=${actions.onRegenerateFromEdit} title="${t("msg.saveAndRegen")}">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="13" height="13">
                <path stroke-linecap="round" stroke-linejoin="round" d="M16.023 9.348h4.992v-.001M2.985 19.644v-4.992m0 0h4.992m-4.993 0 3.181 3.183a8.25 8.25 0 0 0 13.803-3.7M4.031 9.865a8.25 8.25 0 0 1 13.803-3.7l3.181 3.182" />
              </svg>
              <span>${t("msg.saveAndRegen")}</span>
            </button>
          ` : null}
          <button class="limerence-msg-btn" @click=${actions.onEditCancel} title="${t("msg.cancelEdit")}">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="13" height="13">
              <path stroke-linecap="round" stroke-linejoin="round" d="M6 18 18 6M6 6l12 12" />
            </svg>
            <span>${t("msg.cancel")}</span>
          </button>
        </div>
      </div>
      <textarea
        class="limerence-msg-edit-textarea"
        .value=${s.editText}
        @input=${(e: Event) => actions.onEditTextChange((e.target as HTMLTextAreaElement).value)}
        rows="6"
      ></textarea>
    </div>
  `;
}
