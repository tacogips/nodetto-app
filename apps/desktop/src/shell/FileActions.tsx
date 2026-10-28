// The header's leading controls: the File menu (new, template, open,
// reload, export, save, save as, recent) and the Settings button. File
// commands are disabled while a cloud room owns the editor.

import { Icon } from "@nodetto/ui-solid";
import { For, type JSX, Show } from "solid-js";
import type { SessionState } from "../file/session.ts";

export interface FileActionsProps {
  /** False outside Tauri: the File menu is not shown at all. */
  readonly filesAvailable: boolean;
  readonly isCloud: boolean;
  readonly file: SessionState;
  readonly onNew: () => void;
  readonly onNewFromTemplate: () => void;
  readonly onOpen: () => void;
  readonly onReload: () => void;
  readonly onExport: () => void;
  readonly onSave: () => void;
  readonly onSaveAs: () => void;
  readonly onOpenRecent: (path: string) => void;
  readonly onOpenSettings: () => void;
  /** Receives the File menu, which the shell closes on Escape or click-away. */
  readonly menuRef: (menu: HTMLDetailsElement) => void;
  /** Receives the Settings button, which takes focus back from dialogs. */
  readonly settingsButtonRef: (button: HTMLButtonElement) => void;
}

export function FileActions(props: FileActionsProps): JSX.Element {
  return (
    <div class="app-file-actions">
      <Show when={props.filesAvailable}>
        <details class="app-file-menu" ref={props.menuRef}>
          <summary
            class="app-file-button app-header-icon"
            aria-label="File"
            title="File"
          >
            <Icon name="file" />
          </summary>
          <div class="app-file-controls">
            <button
              type="button"
              class="app-file-button"
              disabled={!props.filesAvailable || props.isCloud}
              onClick={() => props.onNew()}
              aria-label="New"
              title="New"
            >
              <Icon name="newFile" />
            </button>
            <button
              type="button"
              class="app-file-button"
              disabled={props.isCloud}
              onClick={() => props.onNewFromTemplate()}
              aria-label="New from template"
              title="New from template"
            >
              <Icon name="frame" />
            </button>
            <button
              type="button"
              class="app-file-button"
              disabled={!props.filesAvailable || props.isCloud}
              onClick={() => props.onOpen()}
              aria-label="Open"
              title="Open"
            >
              <Icon name="openFile" />
            </button>
            <button
              type="button"
              class="app-file-button"
              aria-label="Reload from disk"
              title="Reload from disk"
              disabled={!props.file.filePath || props.isCloud}
              onClick={() => props.onReload()}
            >
              <Icon name="reload" />
            </button>
            <button
              type="button"
              class="app-file-button"
              onClick={() => props.onExport()}
              aria-label="Export…"
              title="Export…"
            >
              <Icon name="export" />
            </button>
            <button
              type="button"
              class="app-file-button"
              disabled={!props.filesAvailable || props.isCloud}
              onClick={() => props.onSave()}
              aria-label="Save"
              title="Save"
            >
              <Icon name="save" />
            </button>
            <button
              type="button"
              class="app-file-button"
              disabled={!props.filesAvailable || props.isCloud}
              onClick={() => props.onSaveAs()}
              aria-label="Save As"
              title="Save As"
            >
              <Icon name="saveAs" />
            </button>
            <select
              class="app-recent-select"
              disabled={
                !props.filesAvailable ||
                props.isCloud ||
                props.file.recent.length === 0
              }
              value=""
              onChange={(event) => {
                const path = event.currentTarget.value;
                event.currentTarget.value = "";
                props.onOpenRecent(path);
              }}
            >
              <option value="">Recent</option>
              <For each={props.file.recent}>
                {(entry) => <option value={entry.path}>{entry.path}</option>}
              </For>
            </select>
          </div>
        </details>
      </Show>
      <button
        type="button"
        class="app-file-button app-header-icon"
        ref={props.settingsButtonRef}
        aria-label="Settings"
        title="Settings"
        aria-haspopup="dialog"
        onClick={() => props.onOpenSettings()}
      >
        <Icon name="settings" />
      </button>
    </div>
  );
}
