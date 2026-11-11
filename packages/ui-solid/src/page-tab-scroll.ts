// Scrolling an overflowing page tab strip. The arrow buttons shift one tab
// at a time, like spreadsheet sheet tabs; a right-button drag pans the
// strip and a fast release keeps it gliding. Left-button drag stays the tab
// reorder gesture (page-tab-drag.ts).

/** A tab's horizontal extent in strip content coordinates. */
export interface PageTabSpan {
  readonly start: number;
  readonly end: number;
}
export interface PageTabViewport {
  readonly scrollLeft: number;
  readonly width: number;
  readonly scrollWidth: number;
}

// Sub-pixel layout leaves fractional overflow; ignore anything under a pixel.
const EDGE = 1;
const PAN_SLOP = 4;
// Only the recent part of a drag counts toward the release velocity, so a
// drag that stopped before release does not glide.
const FLING_WINDOW_MS = 80;
// Per-millisecond velocity retention, close to iOS's normal deceleration.
const FLING_DECAY = 0.998;
const FLING_MIN_VELOCITY = 0.02;

export function pageTabScrollEdges(view: PageTabViewport): {
  back: boolean;
  forward: boolean;
} {
  return {
    back: view.scrollLeft > EDGE,
    forward: view.scrollLeft + view.width < view.scrollWidth - EDGE,
  };
}

/** The scroll offset that shifts the strip by one tab, left-aligning it. */
export function pageTabScrollStep(
  spans: readonly PageTabSpan[],
  view: PageTabViewport,
  direction: -1 | 1,
): number {
  const max = Math.max(0, view.scrollWidth - view.width);
  const left = view.scrollLeft;
  const target =
    direction === 1
      ? (spans.find((span) => span.start > left + EDGE)?.start ?? max)
      : (spans.filter((span) => span.start < left - EDGE).at(-1)?.start ?? 0);
  return Math.min(max, Math.max(0, target));
}

/**
 * The scroll offset that brings `span` fully into view, or null when it is
 * already visible. A tab wider than the strip aligns its start.
 */
export function pageTabRevealTarget(
  span: PageTabSpan,
  view: PageTabViewport,
): number | null {
  const max = Math.max(0, view.scrollWidth - view.width);
  const left = view.scrollLeft;
  const right = left + view.width;
  let target: number;
  if (span.start < left - EDGE || span.end - span.start > view.width)
    target = span.start;
  else if (span.end > right + EDGE) target = span.end - view.width;
  else return null;
  const clamped = Math.min(max, Math.max(0, target));
  return Math.abs(clamped - left) < EDGE ? null : clamped;
}

/** Advance a release glide by `elapsed` ms; it stops once it slows down. */
export function pageTabFlingStep(
  velocity: number,
  elapsed: number,
): { distance: number; velocity: number } {
  const next = velocity * FLING_DECAY ** elapsed;
  return {
    distance: velocity * elapsed,
    velocity: Math.abs(next) < FLING_MIN_VELOCITY ? 0 : next,
  };
}

/** A right-button drag that pans the strip under the pointer. */
export class PageTabPan {
  private pending: {
    pointerId: number;
    startX: number;
    startScroll: number;
    moved: boolean;
    samples: { x: number; time: number }[];
  } | null = null;

  owns(pointerId: number): boolean {
    return this.pending?.pointerId === pointerId;
  }
  get moved(): boolean {
    return this.pending?.moved ?? false;
  }
  start(pointerId: number, x: number, scrollLeft: number, time: number): void {
    this.pending = {
      pointerId,
      startX: x,
      startScroll: scrollLeft,
      moved: false,
      samples: [{ x, time }],
    };
  }
  /** The scroll offset that keeps the content under the pointer, once moved. */
  move(pointerId: number, x: number, time: number): number | null {
    const pending = this.pending;
    if (!pending || pending.pointerId !== pointerId) return null;
    if (Math.abs(x - pending.startX) > PAN_SLOP) pending.moved = true;
    pending.samples.push({ x, time });
    pending.samples = pending.samples.filter(
      (sample) => time - sample.time <= FLING_WINDOW_MS,
    );
    return pending.moved ? pending.startScroll - (x - pending.startX) : null;
  }
  /** End the drag; returns the glide velocity in scroll px per ms. */
  finish(pointerId: number, time: number): number {
    const pending = this.pending;
    if (!pending || pending.pointerId !== pointerId) return 0;
    this.pending = null;
    const samples = pending.samples.filter(
      (sample) => time - sample.time <= FLING_WINDOW_MS,
    );
    const first = samples[0];
    const last = samples.at(-1);
    if (!pending.moved || !first || !last || last.time <= first.time) return 0;
    return -(last.x - first.x) / (last.time - first.time);
  }
  cancel(): void {
    this.pending = null;
  }
}

// A context menu event that arrives this soon after a right-button press
// belongs to that press (macOS fires it on press, Windows and Linux on
// release) and is ignored; the press itself decides on release.
const CONTEXT_MENU_PRESS_WINDOW_MS = 1000;

/**
 * Tells a right-button click on a page tab, which opens the tab's page menu,
 * from a right-button drag, which pans the strip (PageTabPan). A press that
 * moved past the pan slop is a pan and opens nothing. A context menu event
 * with no right press behind it (the keyboard menu key, Shift+F10, or
 * Control-click on macOS) opens the menu directly.
 */
export class PageTabContextPress {
  private tab: string | null = null;
  private pressedAt = Number.NEGATIVE_INFINITY;

  /** A right-button press began on `tab` (null: not on a tab). */
  press(tab: string | null, time: number): void {
    this.tab = tab;
    this.pressedAt = time;
  }
  /** The press ended; returns the tab whose menu opens, if any. */
  release(moved: boolean): string | null {
    const tab = this.tab;
    this.tab = null;
    return moved ? null : tab;
  }
  cancel(): void {
    this.tab = null;
  }
  /** A context menu event on `tab`; returns the tab whose menu opens. */
  contextMenu(tab: string | null, time: number): string | null {
    return time - this.pressedAt < CONTEXT_MENU_PRESS_WINDOW_MS ? null : tab;
  }
}
