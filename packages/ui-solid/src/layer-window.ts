// Which rows of a long layer list are worth mounting.
//
// The Layers panel draws one row per element. On a page of thousands of
// elements that is tens of thousands of DOM nodes the browser styles, lays
// out and paints through on every edit, for rows nobody can see. Past a
// threshold only the rows near the scrolled view are mounted; padding stands
// in for the rest so the scrollbar keeps its size. Short lists are untouched.

/** Lists up to this long are mounted whole. */
export const LAYER_WINDOW_THRESHOLD = 200;
/** Rows kept mounted beyond each edge of the view. */
const OVERSCAN = 12;

export interface LayerWindowInput {
  /** Rows in the list. */
  readonly count: number;
  /** The scroll container's offset and height. */
  readonly scrollTop: number;
  readonly viewHeight: number;
  /** Where the first row starts inside the scrolled content. */
  readonly rowsTop: number;
  /** Height of one row; zero until one has been measured. */
  readonly rowHeight: number;
  /** A row that must stay mounted wherever the view is (one being renamed). */
  readonly keep?: number;
}

export interface LayerWindow {
  /** First mounted row, and one past the last. */
  readonly start: number;
  readonly end: number;
  /** Heights standing in for the rows before and after the window. */
  readonly before: number;
  readonly after: number;
}

export function layerWindow(input: LayerWindowInput): LayerWindow {
  const { count } = input;
  if (count <= LAYER_WINDOW_THRESHOLD)
    return { start: 0, end: count, before: 0, after: 0 };
  // Nothing measured yet (first render, or no layout at all): the head of
  // the list, which is where the view starts.
  if (!(input.rowHeight > 0) || !(input.viewHeight > 0))
    return { start: 0, end: LAYER_WINDOW_THRESHOLD, before: 0, after: 0 };
  // A list that just got shorter can leave the scroll offset past its end
  // until the browser clamps it; show the last rows meanwhile, not nothing.
  const scrollTop = Math.min(
    input.scrollTop,
    Math.max(0, input.rowsTop + count * input.rowHeight - input.viewHeight),
  );
  const first = Math.floor((scrollTop - input.rowsTop) / input.rowHeight);
  const last = Math.ceil(
    (scrollTop + input.viewHeight - input.rowsTop) / input.rowHeight,
  );
  let start = Math.max(0, Math.min(count, first - OVERSCAN));
  let end = Math.max(start, Math.min(count, last + OVERSCAN));
  if (input.keep !== undefined && input.keep >= 0 && input.keep < count) {
    start = Math.min(start, input.keep);
    end = Math.max(end, input.keep + 1);
  }
  return {
    start,
    end,
    before: start * input.rowHeight,
    after: (count - end) * input.rowHeight,
  };
}
