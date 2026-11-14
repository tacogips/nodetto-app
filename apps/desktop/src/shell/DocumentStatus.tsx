// What the shell says about the open document: its name, dirty marker and
// save progress (or the cloud room's status, peers and history buttons),
// plus the banners for import notes, errors and an on-disk conflict.

import { For, type JSX, Show } from "solid-js";
import { PresenceChip } from "../cloud/PresenceOverlay.tsx";
import type { CloudSessionState } from "../cloud/session.ts";
import type { SessionState } from "../file/session.ts";

export interface DocumentStatusProps {
  readonly isCloud: boolean;
  readonly file: SessionState;
  readonly cloud: CloudSessionState | undefined;
  readonly onUndo: () => void;
  readonly onRedo: () => void;
  /** Receives the status element; the cloud panel is positioned below it. */
  readonly hostRef: (element: HTMLDivElement) => void;
}

export function DocumentStatus(props: DocumentStatusProps): JSX.Element {
  return (
    <div
      class="app-document-status"
      ref={props.hostRef}
      aria-label="Document status"
    >
      <Show
        when={props.isCloud}
        fallback={
          <span class="app-file-name" title={props.file.filePath ?? undefined}>
            {props.file.fileName?.replace(/\.jsonl$/i, "") ?? "untitled"}
            <Show when={props.file.dirty}>
              <span class="app-dirty-marker" title="unsaved changes">
                *
              </span>
            </Show>
          </span>
        }
      >
        <span class="app-file-name">
          {props.cloud?.title ?? props.cloud?.docId}
        </span>
        <span class="app-cloud-badge" data-status={props.cloud?.status}>
          {props.cloud?.status}
          {props.cloud?.role === "viewer" ? " · Viewer" : ""}
        </span>
        <PresenceChip peers={props.cloud?.peers ?? []} />
        <div class="app-file-controls">
          <button
            type="button"
            class="app-file-button"
            aria-label="Undo"
            title="Undo (Cmd/Ctrl+Z)"
            disabled={!props.cloud?.canUndo}
            onClick={() => props.onUndo()}
          >
            <svg
              class="app-history-icon"
              viewBox="0 0 20 20"
              aria-hidden="true"
            >
              <path d="M8 6l-5 5 5 5v-3c5 0 7 2 8 5 0-6-3-9-8-9z" />
            </svg>
          </button>
          <button
            type="button"
            class="app-file-button"
            aria-label="Redo"
            title="Redo (Cmd/Ctrl+Shift+Z)"
            disabled={!props.cloud?.canRedo}
            onClick={() => props.onRedo()}
          >
            <svg
              class="app-history-icon"
              viewBox="0 0 20 20"
              aria-hidden="true"
            >
              <path d="M12 6l5 5-5 5v-3c-5 0-7 2-8 5 0-6 3-9 8-9z" />
            </svg>
          </button>
        </div>
      </Show>
      <Show when={props.file.status === "saving" && !props.isCloud}>
        <span class="app-file-status">saving…</span>
      </Show>
      <Show when={!props.isCloud && props.file.outsideChange}>
        {(change) => (
          <span
            class="app-file-status app-outside-change"
            role="status"
            title="Another program (for example nodetto-cli) changed this file; the canvas shows its changes."
          >
            {`updated from disk +${change().added} ~${change().updated} -${change().removed}${change().merged ? " (merged)" : ""}`}
          </span>
        )}
      </Show>
    </div>
  );
}

export interface DocumentBannersProps {
  readonly file: SessionState;
  readonly isCloud: boolean;
  /** A BPMN or breadboard problems panel lists the import notes instead. */
  readonly problemsPanelOpen: boolean;
  /** The cloud, file or export failure to show, if any. */
  readonly error: string | null | undefined;
  readonly onResolveConflict: (choice: "reload" | "keep") => void;
}

export function DocumentBanners(props: DocumentBannersProps): JSX.Element {
  return (
    <>
      {/* A cloud failure is reported wherever it happens: a refused connect
          leaves the app in file mode, and its message still has to be read. */}
      <Show
        when={!props.problemsPanelOpen && props.file.importWarnings.length > 0}
      >
        <details class="app-import-notes">
          <summary>Import notes ({props.file.importWarnings.length})</summary>
          <ul>
            <For each={props.file.importWarnings}>
              {(warning) => <li>{warning.message}</li>}
            </For>
          </ul>
        </details>
      </Show>
      <Show when={props.error}>
        {(message) => <pre class="app-error">{message()}</pre>}
      </Show>
      <Show when={props.file.conflict && !props.isCloud}>
        <div class="app-conflict" role="alert">
          <span>
            {props.file.conflict?.mergedConflicts?.length
              ? `File changed on disk. ${props.file.conflict?.mergedConflicts?.length} item(s) were changed on both sides; your version was kept.`
              : "File changed on disk."}
          </span>
          <button
            type="button"
            class="app-file-button"
            onClick={() => props.onResolveConflict("reload")}
          >
            {props.file.conflict?.mergedConflicts?.length
              ? "Use disk version"
              : "Reload"}
          </button>
          <button
            type="button"
            class="app-file-button"
            onClick={() => props.onResolveConflict("keep")}
          >
            Keep mine
          </button>
        </div>
      </Show>
    </>
  );
}
