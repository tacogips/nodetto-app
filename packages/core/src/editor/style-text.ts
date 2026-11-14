// Style and text edits on the selection: which field a double-click edits,
// and the visual rewrites a style patch or a text-resize mode implies,
// including the token links an explicit value breaks.

import {
  type ElementId,
  type TextResizeMode,
  UmlComponentType,
  type Visual,
  type VisualStyle,
} from "@nodetto/ir";
import { COLOR_FIELDS } from "../color-tokens.ts";
import type { Command } from "../commands.ts";
import { leafElements } from "../group.ts";
import {
  CORNER_NUMBER_FIELDS,
  CORNER_STYLE_FIELDS,
  STYLE_NUMBER_FIELDS,
} from "../number-tokens.ts";
import type { Store } from "../store.ts";
import { TYPOGRAPHY_FIELDS } from "../text-styles.ts";
import type { EditableField, StylePatch } from "./types.ts";

const EDITABLE_FIELDS: Readonly<Record<string, EditableField>> = {
  "shape.geo": "label",
  "node.generic": "label",
  "text.note": "text",
  frame: "name",
  "erd.table": "tableName",
  "ui.control": "label",
  "erd.view": "name",
  "erd.materialized-view": "name",
  "erd.function": "name",
  "erd.procedure": "name",
  "uml.class": "name",
  "state.node": "name",
  "state.transition": "trigger",
  "usecase.node": "name",
  "usecase.relationship": "label",
  [UmlComponentType.Component]: "name",
  [UmlComponentType.Interface]: "name",
  [UmlComponentType.Port]: "name",
  [UmlComponentType.Relationship]: "label",
  "edge.generic": "label",
  "erd.relation": "label",
  "uml.association": "label",
  "sequence.message": "label",
  "bpmn.participant": "name",
  "bpmn.lane": "name",
  "bpmn.task": "name",
  "bpmn.subProcess": "name",
  "bpmn.callActivity": "name",
  "bpmn.event": "name",
  "bpmn.boundaryEvent": "name",
  "bpmn.gateway": "name",
  "bpmn.dataObject": "name",
  "bpmn.dataStore": "name",
  "bpmn.textAnnotation": "text",
  "bpmn.group": "name",
  "bpmn.sequenceFlow": "name",
  "bpmn.messageFlow": "name",
};

/** Types whose label is optional in the registry: empty text drops the key. */
export const OPTIONAL_LABEL_TYPES: ReadonlySet<string> = new Set([
  "shape.geo",
  "edge.generic",
  "erd.relation",
  "uml.association",
  UmlComponentType.Relationship,
  "usecase.relationship",
  "sequence.message",
]);

/** The text field a double-click on `id` edits, or `null`. */
export function editableFieldOf(
  store: Store,
  id: ElementId,
): EditableField | null {
  const element = store.get(id);
  if (
    element?.type === "state.node" &&
    (element.semantic as { kind: string }).kind !== "state"
  )
    return null;
  return element ? (EDITABLE_FIELDS[element.type] ?? null) : null;
}

/**
 * The `replaceVisual` commands that merge a style patch into every element
 * `ids` reach through groups. Elements the patch would not change are left
 * out.
 */
export function planSelectionStyle(
  store: Store,
  ids: Iterable<ElementId>,
  patch: StylePatch,
): Command[] {
  const commands: Command[] = [];
  for (const leaf of leafElements(store, ids)) {
    const previous: Record<string, unknown> = {
      ...(leaf.visual.style ?? {}),
    };
    let next: Record<string, unknown> = { ...previous };
    for (const [key, value] of Object.entries(patch)) {
      if (value === null) {
        delete next[key];
      } else if (value !== undefined) {
        next[key] = value;
      }
    }
    if (patch.fill !== undefined && patch.fillGradient === undefined) {
      const { fillGradient: _gradient, ...solid } = next;
      next = solid;
    }
    if (patch.stroke !== undefined && patch.strokeGradient === undefined) {
      const { strokeGradient: _gradient, ...solid } = next;
      next = solid;
    }
    if (
      patch.fillGradient !== undefined &&
      patch.fillGradient !== null &&
      patch.fill === undefined
    ) {
      const fallback = patch.fillGradient.stops[0]?.color;
      if (fallback) next.fill = fallback;
    }
    if (
      patch.strokeGradient !== undefined &&
      patch.strokeGradient !== null &&
      patch.stroke === undefined
    ) {
      const fallback = patch.strokeGradient.stops[0]?.color;
      if (fallback) next.stroke = fallback;
    }
    let links = { ...leaf.visual.colorTokens };
    for (const field of COLOR_FIELDS) {
      if (patch[field] !== undefined) delete links[field];
    }
    if (patch.fillGradient !== undefined && patch.fillGradient !== null) {
      const { fill: _fill, ...withoutFill } = links;
      links = withoutFill;
    }
    if (patch.strokeGradient !== undefined && patch.strokeGradient !== null) {
      const { stroke: _stroke, ...withoutStroke } = links;
      links = withoutStroke;
    }
    const numberLinks = { ...leaf.visual.numberTokens };
    for (const field of STYLE_NUMBER_FIELDS) {
      if (patch[field] !== undefined) delete numberLinks[field];
    }
    if (patch.cornerRadii !== undefined) {
      for (const field of CORNER_NUMBER_FIELDS) {
        const corner = CORNER_STYLE_FIELDS[field];
        if (
          patch.cornerRadii === null ||
          leaf.visual.style?.cornerRadii?.[corner] !== patch.cornerRadii[corner]
        )
          delete numberLinks[field];
      }
    }
    const textStyleEdited = TYPOGRAPHY_FIELDS.some(
      (field) => patch[field] !== undefined,
    );
    if (
      JSON.stringify(previous) === JSON.stringify(next) &&
      JSON.stringify(links) === JSON.stringify(leaf.visual.colorTokens ?? {}) &&
      JSON.stringify(numberLinks) ===
        JSON.stringify(leaf.visual.numberTokens ?? {}) &&
      (!textStyleEdited || leaf.visual.textStyle === undefined)
    ) {
      continue;
    }
    const {
      style: _dropped,
      colorTokens: _links,
      numberTokens: _numberLinks,
      textStyle: linkedTextStyle,
      ...unlinked
    } = leaf.visual;
    const rest = {
      ...unlinked,
      ...(Object.keys(links).length ? { colorTokens: links } : {}),
      ...(Object.keys(numberLinks).length ? { numberTokens: numberLinks } : {}),
      ...(!textStyleEdited && linkedTextStyle
        ? { textStyle: linkedTextStyle }
        : {}),
    };
    const visual: Visual =
      Object.keys(next).length === 0
        ? rest
        : { ...rest, style: next as VisualStyle };
    commands.push({ type: "replaceVisual", id: leaf.id, visual });
  }
  return commands;
}

/** The commands that give every text note `ids` reach the sizing `mode`. */
export function planSelectionTextResize(
  store: Store,
  ids: Iterable<ElementId>,
  mode: TextResizeMode,
): Command[] {
  const commands: Command[] = [];
  for (const leaf of leafElements(store, ids)) {
    if (leaf.type !== "text.note" || leaf.visual.textResize === mode) continue;
    const { numberTokens: oldLinks, ...rest } = leaf.visual;
    const links = Object.fromEntries(
      Object.entries(oldLinks ?? {}).filter(
        ([field]) =>
          !(mode !== "fixed" && field === "height") &&
          !(mode === "auto-width" && field === "width"),
      ),
    );
    const visual: Visual = {
      ...rest,
      textResize: mode,
      ...(Object.keys(links).length ? { numberTokens: links } : {}),
    };
    commands.push({ type: "replaceVisual", id: leaf.id, visual });
  }
  return commands;
}
