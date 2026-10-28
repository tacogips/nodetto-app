// Publishing this user's presence to a cloud room: the pointer over the
// canvas, the marquee being dragged, and the selection and page, which
// change without the pointer moving (design 6). Nothing is published while
// the editor shows a local file.

import type { Box, Editor } from "@nodetto/core";
import { onCleanup } from "solid-js";
import type { CloudSession } from "../cloud/session.ts";

/** Presence is a pointer trail; 20 Hz is plenty and keeps the socket quiet. */
const CURSOR_THROTTLE_MS = 50;

/** The shell props presence reads; the App's props satisfy it. */
export interface PresenceSource {
  readonly editor: Editor;
  readonly cloud?: CloudSession;
}

export interface PresencePublisher {
  readonly onMarquee: (rect: Box | null) => void;
  readonly onCanvasPointerMove: (event: PointerEvent) => void;
  readonly onCanvasPointerLeave: () => void;
}

/**
 * Track the pointer and marquee and republish them with every selection or
 * page change. Must run in the shell's setup: it subscribes with
 * `onCleanup`.
 */
export function createPresencePublisher(
  source: PresenceSource,
  isCloud: () => boolean,
  canvasHost: () => HTMLDivElement | undefined,
): PresencePublisher {
  let lastCursorAt = 0;
  /** Where this user's pointer was, so a republish does not lose it. */
  let cursor: { x: number; y: number } | null = null;
  let lastBrushAt = 0;
  /** The marquee this user is dragging, so a republish does not lose it. */
  let brush: Box | null = null;

  const onMarquee = (rect: Box | null): void => {
    const ended = rect === null && brush !== null;
    const started = rect !== null && brush === null;
    brush = rect;
    if (!isCloud()) {
      return;
    }
    // Start and end publish immediately so the remote brush never lingers;
    // growth in between is throttled like the cursor.
    const now = Date.now();
    if (!started && !ended && now - lastBrushAt < CURSOR_THROTTLE_MS) {
      return;
    }
    lastBrushAt = now;
    source.cloud?.publishPresence(cursor, brush);
  };

  const onCanvasPointerMove = (event: PointerEvent): void => {
    const host = canvasHost();
    if (!isCloud() || !host) {
      return;
    }
    const now = Date.now();
    if (now - lastCursorAt < CURSOR_THROTTLE_MS) {
      return;
    }
    lastCursorAt = now;
    const rect = host.getBoundingClientRect();
    cursor = source.editor.camera.screenToPage({
      x: event.clientX - rect.left,
      y: event.clientY - rect.top,
    });
    source.cloud?.publishPresence(cursor, brush);
  };

  const onCanvasPointerLeave = (): void => {
    cursor = null;
    if (isCloud()) {
      source.cloud?.publishPresence(null, brush);
    }
  };

  // Selection and page changes are part of presence too, and neither of them
  // moves the pointer (design 6).
  onCleanup(
    source.editor.selection.subscribe(() => {
      if (isCloud()) {
        source.cloud?.publishPresence(cursor, brush);
      }
    }),
  );
  onCleanup(
    source.editor.subscribe((diff) => {
      if (isCloud() && diff.pagesChanged) {
        source.cloud?.publishPresence(cursor, brush);
      }
    }),
  );

  return { onMarquee, onCanvasPointerMove, onCanvasPointerLeave };
}
