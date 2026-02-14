/**
 * Character selector dialog — allows users to browse, import, and select characters.
 * Renders as a modal overlay.
 */

import { html, type TemplateResult } from "lit";
import { t } from "../lib/i18n";
import type { CharacterEntry } from "../controllers/character";
import { characterPreview } from "../controllers/character";

export interface CharacterSelectorState {
  characters: CharacterEntry[];
  defaultCharacterName: string;
  isOpen: boolean;
  importError: string;
}

export interface CharacterSelectorActions {
  onSelect: (entry: CharacterEntry | null) => void; // null = default
  onImport: (file: File) => void;
  onDelete: (id: string) => void;
  onClose: () => void;
}

export function renderCharacterSelector(
  s: CharacterSelectorState,
  actions: CharacterSelectorActions,
): TemplateResult | null {
  if (!s.isOpen) return null;

  return html`
    <div class="limerence-dialog-overlay" @click=${(e: Event) => {
      if ((e.target as HTMLElement).classList.contains("limerence-dialog-overlay")) {
        actions.onClose();
      }
    }}>
      <div class="limerence-dialog">
        <div class="limerence-dialog-header">
          <span class="limerence-dialog-title">${t("char.title")}</span>
          <button class="limerence-dialog-close" @click=${actions.onClose}>✕</button>
        </div>

        <div class="limerence-dialog-body">
          <!-- Default character -->
          <button
            class="limerence-char-item"
            @click=${() => actions.onSelect(null)}
          >
            <div class="limerence-char-name">${s.defaultCharacterName}</div>
            <div class="limerence-char-desc">${t("char.default")}</div>
          </button>

          <!-- Custom characters -->
          ${s.characters.map((entry) => html`
            <div class="limerence-char-item-row">
              <button
                class="limerence-char-item"
                @click=${() => actions.onSelect(entry)}
              >
                <div class="limerence-char-name">${entry.name}</div>
                <div class="limerence-char-desc">${characterPreview(entry.card)}</div>
              </button>
              <button
                class="limerence-char-delete"
                @click=${() => actions.onDelete(entry.id)}
                title="${t("char.delete")}"
              >✕</button>
            </div>
          `)}

          ${s.importError ? html`
            <div class="limerence-char-error">${s.importError}</div>
          ` : null}
        </div>

        <div class="limerence-dialog-footer">
          <label class="limerence-char-import-btn">
            <input
              type="file"
              accept=".json"
              style="display:none"
              @change=${(e: Event) => {
                const file = (e.target as HTMLInputElement).files?.[0];
                if (file) actions.onImport(file);
                (e.target as HTMLInputElement).value = "";
              }}
            />
            <span>${t("char.import")}</span>
          </label>
        </div>
      </div>
    </div>
  `;
}
