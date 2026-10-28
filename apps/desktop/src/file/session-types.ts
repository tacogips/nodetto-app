// The document session's public shapes: the state it publishes to the UI and
// the options it is constructed with. `session.ts` re-exports all of them.

import type { DocumentChangeSource, Editor } from "@nodetto/core";
import type { BpmnImportWarning } from "@nodetto/io";
import type { FileBackend, RecentEntry } from "./backend.ts";
import type { SaveMode } from "./save-mode.ts";

export type SessionStatus = "idle" | "loading" | "saving";

export interface SessionConflict {
  /** What the file holds now, ready to be loaded if the user reloads. */
  readonly diskText: string;
  /**
   * Ids changed on both sides when an outside change was merged into unsaved
   * local edits; the local version of those was kept. Absent when the disk
   * change could not be merged at all.
   */
  readonly mergedConflicts?: readonly string[];
}

/** The last change another writer made to the open file, shown live. */
export interface OutsideChange {
  readonly added: number;
  readonly updated: number;
  readonly removed: number;
  /** True when it was merged into unsaved local edits. */
  readonly merged: boolean;
}

export interface SessionState {
  readonly saveMode: SaveMode;
  readonly filePath: string | null;
  readonly fileName: string | null;
  readonly dirty: boolean;
  readonly conflict: SessionConflict | null;
  /** Cleared by the next local edit, open or new document. */
  readonly outsideChange: OutsideChange | null;
  readonly recent: readonly RecentEntry[];
  readonly importWarnings: readonly BpmnImportWarning[];
  readonly status: SessionStatus;
  readonly error: string | null;
}

export type SessionListener = (state: SessionState) => void;

/** Opaque timer token, so tests can hand over their own scheduler. */
export type TimerHandle = unknown;

export interface DocumentSessionOptions {
  readonly editor: Editor;
  readonly backend: FileBackend;
  readonly changes?: DocumentChangeSource;
  readonly saveMode?: SaveMode;
  /** Quiet period after the last edit before autosave writes. */
  readonly autosaveDelayMs?: number;
  readonly scheduleTimer?: (
    callback: () => void,
    delayMs: number,
  ) => TimerHandle;
  readonly cancelTimer?: (handle: TimerHandle) => void;
}
