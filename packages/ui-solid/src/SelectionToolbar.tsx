// Floating toolbar above the selection (design editor-ux 3.7).
//
// Screen-anchored: the selection bounds are projected through the camera on
// every change and the toolbar is clamped to the canvas host, so it never
// zooms with the page and never leaves the visible area. It disappears while
// the primary button is held on the host — a drag, a marquee, a resize — and
// comes back on release.
//
// Colour swatches and text controls write through `setSelectionStyle`;
// action buttons use the shared action table.

import {
  leafElements,
  type Editor,
  type StylePatch,
  type Vec,
} from "@nodetto/core";
import { ToolbarIcon, type ToolbarIconKey } from "./ToolbarIcon.tsx";
import {
  boldPatch,
  italicPatch,
  decorationPatch,
  fontSizePatch,
  textAlignPatch,
  verticalAlignPatch,
  verticalAlignKind,
  verticalAlignValue,
  textFormatState,
} from "./text-format.ts";
import {
  createEffect,
  createMemo,
  createSignal,
  For,
  type JSX,
  onCleanup,
  Show,
} from "solid-js";
import { createEditorSignals } from "./adapter.ts";
import {
  type ActionContext,
  type ActionId,
  actionTitle,
  type EditorAction,
  getAction,
  runAction,
} from "./shortcuts.ts";
import { STYLE_PALETTE } from "./inspector/palette.ts";
import "./SelectionToolbar.css";

export interface SelectionToolbarProps {
  readonly context: ActionContext;
  readonly simple?: boolean;
  /** The canvas host: the toolbar is clamped to it and hides while pressed. */
  readonly host: HTMLElement | undefined;
  /** "More": the shell focuses the Inspector on the selection. */
  readonly onMore: () => void;
}

export interface Swatch {
  /** `null` clears the field so the stylesheet default applies again. */
  readonly value: string | null;
  readonly label: string;
}

/** The shared preset palette (Inspector and toolbar agree), plus "none". */
export const FILL_PALETTE: readonly Swatch[] = [
  { value: null, label: "No fill" },
  ...STYLE_PALETTE.fills.map((entry) => ({
    value: entry.value,
    label: entry.name,
  })),
];

export const STROKE_PALETTE: readonly Swatch[] = [
  { value: null, label: "Default stroke" },
  ...STYLE_PALETTE.strokes.map((entry) => ({
    value: entry.value,
    label: entry.name,
  })),
];

/** Space between the selection's top edge and the toolbar. */
const GAP = 10;
const EDGE_MARGIN = 4;

interface Size {
  readonly width: number;
  readonly height: number;
}

/**
 * Where a toolbar of `size` goes for a selection whose screen-space top edge
 * runs from `left` to `right` at `top`, inside a host of `bounds`. Centred
 * above the selection, slid inside the host; when there is no room above it
 * sits at the top margin rather than covering the selection.
 */
export function placeAbove(
  left: number,
  right: number,
  top: number,
  size: Size,
  bounds: Size,
): Vec {
  const x = (left + right) / 2 - size.width / 2;
  const y = top - GAP - size.height;
  const maxX = Math.max(EDGE_MARGIN, bounds.width - size.width - EDGE_MARGIN);
  const maxY = Math.max(EDGE_MARGIN, bounds.height - size.height - EDGE_MARGIN);
  return {
    x: Math.min(Math.max(EDGE_MARGIN, x), maxX),
    y: Math.min(Math.max(EDGE_MARGIN, y), maxY),
  };
}

export const ARRANGE_BUTTONS: readonly {
  id: ActionId;
  icon: ToolbarIconKey;
}[] = [
  { id: "alignLeft", icon: "alignLeft" },
  { id: "alignHCenter", icon: "alignHCenter" },
  { id: "alignRight", icon: "alignRight" },
  { id: "alignTop", icon: "alignTop" },
  { id: "alignVCenter", icon: "alignVCenter" },
  { id: "alignBottom", icon: "alignBottom" },
];

export function SelectionToolbar(props: SelectionToolbarProps): JSX.Element {
  const editor = (): Editor => props.context.editor;
  const signals = createEditorSignals(props.context.editor);
  const [size, setSize] = createSignal<Size>({ width: 0, height: 0 });
  const [pressed, setPressed] = createSignal(false);
  let root: HTMLDivElement | undefined;

  const closeDisclosures = () => {
    const open = root?.querySelectorAll<HTMLDetailsElement>("details[open]");
    if (!open) return;
    for (const details of open) details.open = false;
  };

  const isEnabled = (action: EditorAction): boolean => {
    signals.rev();
    signals.selection();
    signals.camera();
    return action.enabled(props.context);
  };

  // Hidden while the primary button is down on the host: the toolbar would
  // otherwise chase a moving selection and sit under the pointer.
  createEffect(() => {
    const host = props.host;
    if (!host) {
      return;
    }
    const onDown = (event: PointerEvent): void => {
      if (
        event.button === 0 &&
        !(root?.contains(event.target as Node) ?? false)
      ) {
        closeDisclosures();
        setPressed(true);
      }
    };
    const onUp = (): void => {
      setPressed(false);
    };
    host.addEventListener("pointerdown", onDown, true);
    window.addEventListener("pointerup", onUp, true);
    window.addEventListener("pointercancel", onUp, true);
    onCleanup(() => {
      host.removeEventListener("pointerdown", onDown, true);
      window.removeEventListener("pointerup", onUp, true);
      window.removeEventListener("pointercancel", onUp, true);
    });
  });

  const measure = (element: HTMLDivElement): void => {
    root = element;
    if (typeof ResizeObserver === "undefined") {
      return;
    }
    const observer = new ResizeObserver(() => {
      setSize({ width: element.offsetWidth, height: element.offsetHeight });
    });
    observer.observe(element);
    onCleanup(() => observer.disconnect());
  };

  const anchor = createMemo<Vec | null>(() => {
    signals.rev();
    signals.selection();
    const camera = signals.camera();
    const bounds = editor().getSelectionBounds();
    const host = props.host;
    if (!bounds || !host) {
      return null;
    }
    // screen = (page + camera) * zoom, the same equation the viewport uses.
    const left = (bounds.x + camera.x) * camera.z;
    const right = (bounds.x + bounds.width + camera.x) * camera.z;
    const top = (bounds.y + camera.y) * camera.z;
    return placeAbove(left, right, top, size(), {
      width: host.clientWidth,
      height: host.clientHeight,
    });
  });

  const visible = (): boolean =>
    signals.selection().size > 0 && !pressed() && anchor() !== null;

  const setStyle = (field: "fill" | "stroke", value: string | null): void => {
    editor().setSelectionStyle({ [field]: value });
  };

  const disclosureKey = (event: KeyboardEvent) => {
    if (event.key !== "Escape") return;
    const details = event.currentTarget as HTMLDetailsElement;
    if (!details.open) return;
    event.preventDefault();
    event.stopPropagation();
    details.open = false;
    queueMicrotask(() =>
      details.querySelector<HTMLElement>("summary")?.focus(),
    );
  };

  // Popovers hang below the toolbar; opening one closes the others.
  const disclosureToggle = (event: Event) => {
    const details = event.currentTarget as HTMLDetailsElement;
    if (!details.open) return;
    const open = root?.querySelectorAll<HTMLDetailsElement>("details[open]");
    if (!open) return;
    for (const other of open) if (other !== details) other.open = false;
  };
  // Keep a popover inside the host: hang it from whichever toolbar edge is
  // further from the host's edge.
  const popoverEnd = (): boolean => {
    const host = props.host;
    const at = anchor();
    if (!host || !at) return false;
    return at.x + size().width / 2 > host.clientWidth / 2;
  };

  const leaves = createMemo(() => {
    signals.rev();
    return leafElements(editor().store, signals.selection());
  });
  const textStyle = () => leaves()[0]?.visual.style;
  const state = () => textFormatState(textStyle());
  const apply = (patch: StylePatch) => editor().setSelectionStyle(patch);
  const textButton = (
    icon: ToolbarIconKey,
    label: string,
    click: () => void,
    pressed?: boolean,
    disabled = false,
  ): JSX.Element => (
    <button
      type="button"
      class="nodetto-float-button"
      title={label}
      aria-label={label}
      aria-pressed={pressed}
      disabled={disabled}
      onClick={click}
    >
      <ToolbarIcon name={icon} />
    </button>
  );

  const button = (id: ActionId, icon: ToolbarIconKey): JSX.Element => {
    const action = getAction(id);
    return (
      <button
        type="button"
        class="nodetto-float-button"
        title={actionTitle(action)}
        aria-label={actionTitle(action)}
        disabled={!isEnabled(action)}
        onClick={() => runAction(action, props.context)}
      >
        <ToolbarIcon name={icon} />
      </button>
    );
  };

  const swatches = (
    field: "fill" | "stroke",
    palette: readonly Swatch[],
  ): JSX.Element => (
    <div class="nodetto-swatch-row" role="group" aria-label={`${field} colour`}>
      <For each={palette}>
        {(swatch) => (
          <button
            type="button"
            class="nodetto-swatch"
            classList={{
              "nodetto-swatch-none": swatch.value === null,
              "nodetto-swatch-stroke": field === "stroke",
            }}
            title={`${field === "fill" ? "Fill" : "Stroke"}: ${swatch.label}`}
            aria-label={`${field === "fill" ? "Fill" : "Stroke"}: ${swatch.label}`}
            style={
              swatch.value === null
                ? undefined
                : field === "fill"
                  ? { background: swatch.value }
                  : { "border-color": swatch.value }
            }
            onClick={() => setStyle(field, swatch.value)}
          />
        )}
      </For>
    </div>
  );

  return (
    <Show when={visible()}>
      <div
        class="nodetto-selection-toolbar"
        classList={{ "nodetto-selection-toolbar-end": popoverEnd() }}
        role="toolbar"
        aria-label="Selection"
        ref={measure}
        style={{
          transform: `translate(${anchor()?.x ?? 0}px, ${anchor()?.y ?? 0}px)`,
          visibility: size().width === 0 ? "hidden" : "visible",
        }}
        // A press on the toolbar must not reach the canvas host's gesture
        // handlers, and must not count as "pressed on the canvas" either.
        onPointerDown={(event) => event.stopPropagation()}
      >
        <div class="nodetto-float-group">
          {button("duplicate", "duplicate")}
          {button("delete", "delete")}
          {button("comment", "comment")}
          <Show when={isEnabled(getAction("straightenConnector"))}>
            {button("straightenConnector", "straightenConnector")}
          </Show>
        </div>
        <details
          class="nodetto-selection-disclosure"
          onKeyDown={disclosureKey}
          onToggle={disclosureToggle}
        >
          <summary
            class="nodetto-float-button"
            title="Colors"
            aria-label="Colors"
          >
            <ToolbarIcon name="colors" />
          </summary>
          <div class="nodetto-selection-disclosure-body nodetto-float-colours">
            {swatches("fill", FILL_PALETTE)}
            {swatches("stroke", STROKE_PALETTE)}
          </div>
        </details>
        <details
          class="nodetto-selection-disclosure"
          onKeyDown={disclosureKey}
          onToggle={disclosureToggle}
        >
          <summary class="nodetto-float-button" title="Text" aria-label="Text">
            <ToolbarIcon name="text" />
          </summary>
          <div class="nodetto-selection-disclosure-body nodetto-float-text">
            <div>
              {textButton(
                "fontSmaller",
                "Smaller text",
                () => {
                  const patch = fontSizePatch(textStyle(), -1);
                  if (patch) apply(patch);
                },
                undefined,
                fontSizePatch(textStyle(), -1) === null,
              )}
              <output class="nodetto-float-size" aria-label="Font size">
                {state().fontSize}
              </output>
              {textButton(
                "fontLarger",
                "Larger text",
                () => {
                  const patch = fontSizePatch(textStyle(), 1);
                  if (patch) apply(patch);
                },
                undefined,
                fontSizePatch(textStyle(), 1) === null,
              )}
            </div>
            <div>
              {textButton(
                "bold",
                "Bold",
                () => apply(boldPatch(textStyle())),
                state().bold,
              )}
              {textButton(
                "italic",
                "Italic",
                () => apply(italicPatch(textStyle())),
                state().italic,
              )}
              {textButton(
                "underline",
                "Underline",
                () => apply(decorationPatch(textStyle(), "underline")),
                state().underline,
              )}
              {textButton(
                "strikethrough",
                "Strikethrough",
                () => apply(decorationPatch(textStyle(), "line-through")),
                state().strikethrough,
              )}
            </div>
            <div>
              {textButton(
                "textAlignStart",
                "Align text left (click again for default)",
                () => apply(textAlignPatch(textStyle(), "start")),
                state().textAlign === "start",
              )}
              {textButton(
                "textAlignMiddle",
                "Center text (click again for default)",
                () => apply(textAlignPatch(textStyle(), "middle")),
                state().textAlign === "middle",
              )}
              {textButton(
                "textAlignEnd",
                "Align text right (click again for default)",
                () => apply(textAlignPatch(textStyle(), "end")),
                state().textAlign === "end",
              )}
            </div>
            <Show when={verticalAlignKind(leaves())} keyed>
              {(kind) => (
                <div>
                  {textButton(
                    "verticalTop",
                    "Align text top",
                    () => apply(verticalAlignPatch(textStyle(), "top", kind)),
                    verticalAlignValue(textStyle(), kind) === "top",
                  )}
                  {textButton(
                    "verticalMiddle",
                    "Align text middle",
                    () =>
                      apply(verticalAlignPatch(textStyle(), "middle", kind)),
                    verticalAlignValue(textStyle(), kind) === "middle",
                  )}
                  {textButton(
                    "verticalBottom",
                    "Align text bottom",
                    () =>
                      apply(verticalAlignPatch(textStyle(), "bottom", kind)),
                    verticalAlignValue(textStyle(), kind) === "bottom",
                  )}
                </div>
              )}
            </Show>
          </div>
        </details>
        <details
          class="nodetto-selection-disclosure"
          onKeyDown={disclosureKey}
          onToggle={disclosureToggle}
        >
          <summary
            class="nodetto-float-button"
            title="Arrange"
            aria-label="Arrange"
          >
            <ToolbarIcon name="arrange" />
          </summary>
          <div class="nodetto-selection-disclosure-body nodetto-float-arrange">
            <div>
              {button("bringToFront", "bringToFront")}
              {button("sendToBack", "sendToBack")}
            </div>
            <div>
              <Show when={!props.simple}>
                {button("frameSelection", "frameSelection")}
              </Show>
              {button("group", "group")}
              {button("ungroup", "ungroup")}
            </div>
            <Show when={!props.simple}>
              <div>
                {button("booleanUnion", "booleanUnion")}
                {button("booleanSubtract", "booleanSubtract")}
                {button("booleanIntersect", "booleanIntersect")}
                {button("booleanExclude", "booleanExclude")}
                {button("flattenBoolean", "flattenBoolean")}
              </div>
            </Show>
            <Show when={isEnabled(getAction("alignLeft"))}>
              <div>
                <For each={ARRANGE_BUTTONS}>
                  {(entry) => button(entry.id, entry.icon)}
                </For>
              </div>
            </Show>
          </div>
        </details>
        <div class="nodetto-float-group">
          <button
            type="button"
            class="nodetto-float-button"
            title="Edit selection properties"
            aria-label="Edit selection properties"
            onClick={() => props.onMore()}
          >
            <ToolbarIcon name="properties" />
          </button>
        </div>
      </div>
    </Show>
  );
}
