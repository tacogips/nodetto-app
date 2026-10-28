// Pure sizes and geometry shared by the canvas layers and handle overlays.

import type { Box, Editor, Vec } from "@nodetto/core";
import {
  type Element,
  type ElementId,
  getElementTypeDefinition,
} from "@nodetto/ir";
import type { ResizeHandle } from "../interaction.ts";

/** Handle side length in CSS pixels; divided by zoom to stay constant. */
export const HANDLE_SIZE = 9;
/** Radius of a connector endpoint handle, in CSS pixels. */
export const ENDPOINT_HANDLE_RADIUS = 6;
/** Radius of a quick-connect handle, in CSS pixels. */
export const CONNECT_HANDLE_RADIUS = 5;
/** Quick-connect handles sit this far outside the bounds (design 3.4). */
export const GRID_SPACING = 24;

export interface ConnectorHandles {
  readonly id: ElementId;
  readonly start: Vec;
  readonly end: Vec;
  readonly bend?: Vec;
  readonly waypoints?: readonly Vec[];
}

export function isConnector(element: Element): boolean {
  return getElementTypeDefinition(element.type)?.category === "edge";
}

export function handleCenter(
  box: Box,
  handle: ResizeHandle,
): { x: number; y: number } {
  const x = handle.includes("w")
    ? box.x
    : handle.includes("e")
      ? box.x + box.width
      : box.x + box.width / 2;
  const y = handle.includes("n")
    ? box.y
    : handle.includes("s")
      ? box.y + box.height
      : box.y + box.height / 2;
  return { x, y };
}

/** A pointer's client position in page space, relative to `container`. */
export function clientToPage(
  editor: Editor,
  container: HTMLElement | undefined,
  event: { readonly clientX: number; readonly clientY: number },
): Vec {
  const bounds = container?.getBoundingClientRect();
  return editor.camera.screenToPage({
    x: event.clientX - (bounds?.left ?? 0),
    y: event.clientY - (bounds?.top ?? 0),
  });
}
