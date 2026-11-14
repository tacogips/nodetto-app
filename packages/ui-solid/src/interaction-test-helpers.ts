// DOM-free unit tests for the interaction layer.
//
// The state machine needs no DOM: give `createInteraction` a container
// accessor that returns `undefined` and it reads client coordinates
// straight off the event, so plain objects shaped like a PointerEvent drive
// it end to end. Only what the browser actually has to supply — real hit
// areas, cursors, pointer capture, focus — is left to the manual canvas
// checklist in `apps/desktop/README.md`.

import { Editor } from "@nodetto/core";
import type { ElementId } from "@nodetto/ir";
import {
  createInteraction,
  type Interaction,
  type InteractionOptions,
} from "./interaction.ts";
import type { ToolKind } from "./tools.ts";

export interface Harness {
  readonly editor: Editor;
  readonly interaction: Interaction;
  readonly shape: ElementId;
  tool(): ToolKind;
  setTool(tool: ToolKind): void;
}

/** An interaction over `editor` whose tool signal the test can read and set. */
export function interactionFor(
  editor: Editor,
  initial: ToolKind,
  extra: Partial<InteractionOptions> = {},
): Pick<Harness, "interaction" | "tool" | "setTool"> {
  let current: ToolKind = initial;
  const setTool = (next: ToolKind): void => {
    current = next;
  };
  const interaction = createInteraction(editor, {
    ...extra,
    tool: () => current,
    setTool,
    container: () => undefined,
  });
  return { interaction, tool: () => current, setTool };
}

/** A selected 100x100 shape at the origin, with the select tool active. */
export function harness(): Harness {
  const editor = new Editor();
  const shape = editor.createElement("shape.geo", {
    visual: { x: 0, y: 0, width: 100, height: 100 },
  });
  editor.selection.set([shape]);
  return { editor, shape, ...interactionFor(editor, "select") };
}

export interface PointerInput {
  readonly clientX?: number;
  readonly clientY?: number;
  readonly button?: number;
  readonly pointerId?: number;
  readonly shiftKey?: boolean;
  readonly metaKey?: boolean;
  readonly ctrlKey?: boolean;
  readonly altKey?: boolean;
  readonly target?: unknown;
}

export function pointer(input: PointerInput = {}): PointerEvent {
  return {
    clientX: input.clientX ?? 50,
    clientY: input.clientY ?? 50,
    button: input.button ?? 0,
    pointerId: input.pointerId ?? 1,
    shiftKey: input.shiftKey ?? false,
    metaKey: input.metaKey ?? false,
    ctrlKey: input.ctrlKey ?? false,
    altKey: input.altKey ?? false,
    target: input.target,
    stopPropagation: () => {},
    preventDefault: () => {},
  } as unknown as PointerEvent;
}

/** A mouse event (double-click, context menu) at a client point. */
export function mouse(
  clientX: number,
  clientY: number,
): MouseEvent & { defaultPrevented: boolean } {
  const event = {
    clientX,
    clientY,
    button: 0,
    defaultPrevented: false,
    preventDefault() {
      event.defaultPrevented = true;
    },
  };
  return event as unknown as MouseEvent & { defaultPrevented: boolean };
}

export interface KeyInput {
  readonly isComposing?: boolean;
  readonly metaKey?: boolean;
  readonly ctrlKey?: boolean;
  readonly shiftKey?: boolean;
  readonly altKey?: boolean;
  readonly repeat?: boolean;
  readonly code?: string;
  readonly target?: unknown;
}

export function keyboard(
  key: string,
  input: KeyInput = {},
): KeyboardEvent & { defaultPrevented: boolean } {
  const event = {
    key,
    code: input.code ?? "",
    isComposing: input.isComposing ?? false,
    metaKey: input.metaKey ?? false,
    ctrlKey: input.ctrlKey ?? false,
    shiftKey: input.shiftKey ?? false,
    altKey: input.altKey ?? false,
    repeat: input.repeat ?? false,
    target: input.target,
    defaultPrevented: false,
    preventDefault() {
      event.defaultPrevented = true;
    },
  };
  return event as unknown as KeyboardEvent & { defaultPrevented: boolean };
}

export function visualOf(
  editor: Editor,
  id: ElementId,
): Record<string, unknown> {
  return editor.store.get(id)?.visual as Record<string, unknown>;
}

export function shortcut(key: string, shiftKey = false): KeyboardEvent {
  return {
    key,
    metaKey: false,
    ctrlKey: true,
    shiftKey,
    preventDefault: () => {},
  } as unknown as KeyboardEvent;
}

// ---------------------------------------------------------------------------
// Editor UX wave 1 (design-docs/specs/editor-ux.md)

export interface GroupedHarness extends Pick<Harness, "interaction" | "tool"> {
  readonly editor: Editor;
  readonly a: ElementId;
  readonly b: ElementId;
  readonly loose: ElementId;
  readonly group: ElementId;
}

/** Two grouped 100x100 shapes (at x=0 and x=200) plus a loose one far away. */
export function grouped(): GroupedHarness {
  const editor = new Editor();
  const a = editor.createElement("shape.geo", {
    visual: { x: 0, y: 0, width: 100, height: 100 },
  });
  const b = editor.createElement("shape.geo", {
    visual: { x: 200, y: 0, width: 100, height: 100 },
  });
  const loose = editor.createElement("shape.geo", {
    visual: { x: 600, y: 600, width: 50, height: 50 },
  });
  editor.selection.set([a, b]);
  const group = editor.groupSelection();
  if (!group) {
    throw new Error("expected a group");
  }
  editor.selection.clear();
  return { editor, a, b, loose, group, ...interactionFor(editor, "select") };
}
