import type {
  ConnectorPorts,
  ElementId,
  PageId,
  TextMark,
  TextMarkKind,
  TextNoteSemantic,
} from "@nodetto/ir";
import {
  editableFieldOf,
  OPTIONAL_LABEL_TYPES,
} from "../../editor/style-text.ts";
import { planElementMoves, resizedVisual } from "../../editor/transform.ts";
import type { ApplyOptions, EditableField } from "../../editor/types.ts";
import { planReparent } from "../../frame-membership.ts";
import type { Box } from "../../geometry.ts";
import {
  normalizeTextMarks,
  rebaseTextMarks,
  textNoteMarks,
  toggleTextMarkRange,
} from "../../rich-text.ts";
import { EditorCore } from "./core.ts";

export class ElementEditing extends EditorCore {
  reparentElement(id: ElementId, parent: ElementId | null): boolean {
    const commands = planReparent(
      this.store,
      this.createShapeContext(),
      id,
      parent,
    );
    if (!commands.length) return false;
    this.apply(commands);
    return true;
  }

  /**
   * Connect two elements with an `edge.generic`. Returns `null` rather than
   * throwing for the cases a drag gesture routinely produces: a self
   * connection, or an endpoint that is no longer there.
   */
  connect(
    from: ElementId,
    to: ElementId,
    page: PageId = this.pageId,
    applyOptions: ApplyOptions = {},
    ports: ConnectorPorts = {},
  ): ElementId | null {
    if (from === to || !this.store.has(from) || !this.store.has(to)) {
      return null;
    }
    return this.createElement(
      "edge.generic",
      {
        page,
        semantic: {
          ...ports,
          from,
          to,
          arrowheads: { end: "arrow" },
          ...(this.store.getPage(page)?.kind === "flowchart"
            ? { routing: "orthogonal" }
            : {}),
        },
      },
      applyOptions,
    );
  }

  // ------------------------------------------------------- move and resize

  /** Move elements by a page-space delta, relative to given origins. */
  moveElements(
    moves: readonly {
      readonly id: ElementId;
      readonly x: number;
      readonly y: number;
    }[],
    applyOptions: ApplyOptions = {},
  ): void {
    const commands = planElementMoves(this.store, moves);
    if (commands.length > 0) {
      this.apply(commands, applyOptions);
    }
  }

  /** Resize through the element's ShapeUtil; a no-op for fixed shapes. */
  resizeElement(
    id: ElementId,
    box: Box,
    applyOptions: ApplyOptions = {},
  ): void {
    const element = this.store.get(id);
    if (!element) {
      return;
    }
    const util = this.registry.getOrFallback(element.type);
    if (!util.canResize || !util.resize) {
      return;
    }
    const visual = resizedVisual(element, util, this.getBounds(id), box);
    if (!visual) return;
    this.apply([{ type: "replaceVisual", id, visual }], applyOptions);
  }

  // ------------------------------------------------------ delete and copies

  deleteElements(
    ids: readonly ElementId[],
    applyOptions: ApplyOptions = {},
  ): void {
    const present = ids.filter((id) => this.store.has(id));
    if (present.length === 0) {
      return;
    }
    this.apply([{ type: "deleteElements", ids: present }], applyOptions);
  }

  /** The text field a double-click on `id` edits, or `null`. */
  editableField(id: ElementId): EditableField | null {
    return editableFieldOf(this.store, id);
  }

  /** Current value of the editable text field, or `null` when none. */
  getText(id: ElementId): string | null {
    const field = this.editableField(id);
    const element = this.store.get(id);
    if (!field || !element) {
      return null;
    }
    const semantic = element.semantic;
    if (typeof semantic !== "object" || semantic === null) {
      return "";
    }
    const value = (semantic as Record<string, unknown>)[field];
    return typeof value === "string" ? value : "";
  }

  /**
   * Write the editable text field. One `updateSemantic`; the rest of the
   * payload is carried over untouched. False when the element has no such
   * field or the text did not change.
   */
  setText(
    id: ElementId,
    text: string,
    applyOptions: ApplyOptions = {},
  ): boolean {
    if (this.readOnly) return false;
    const field = this.editableField(id);
    const element = this.store.get(id);
    if (!field || !element || this.getText(id) === text) {
      return false;
    }
    const base =
      typeof element.semantic === "object" && element.semantic !== null
        ? { ...(element.semantic as Record<string, unknown>) }
        : {};
    if (element.type === "text.note") {
      const previous = this.getText(id) ?? "";
      const marks = rebaseTextMarks(previous, text, textNoteMarks(base));
      return this.setRichText(id, text, marks, applyOptions);
    }
    if (
      text === "" &&
      field === "label" &&
      OPTIONAL_LABEL_TYPES.has(element.type)
    ) {
      delete base[field];
    } else {
      base[field] = text;
    }
    this.apply([{ type: "updateSemantic", id, semantic: base }], applyOptions);
    return true;
  }

  /** Replace one text note's content and portable inline marks atomically. */
  setRichText(
    id: ElementId,
    text: string,
    marks: readonly TextMark[],
    applyOptions: ApplyOptions = {},
  ): boolean {
    const element = this.store.get(id);
    if (element?.type !== "text.note") return false;
    const semantic = element.semantic as TextNoteSemantic;
    const normalized = normalizeTextMarks(text, marks);
    const { marks: _marks, ...rest } = semantic;
    const next = {
      ...rest,
      text,
      ...(normalized.length ? { marks: normalized } : {}),
    };
    if (JSON.stringify(next) === JSON.stringify(semantic)) return false;
    this.apply([{ type: "updateSemantic", id, semantic: next }], applyOptions);
    return true;
  }

  /** Toggle formatting over a text note's half-open UTF-16 range. */
  toggleTextMark(
    id: ElementId,
    start: number,
    end: number,
    kind: TextMarkKind,
    href?: string,
    applyOptions: ApplyOptions = {},
  ): boolean {
    const element = this.store.get(id);
    if (element?.type !== "text.note") return false;
    const semantic = element.semantic as TextNoteSemantic;
    return this.setRichText(
      id,
      semantic.text,
      toggleTextMarkRange(
        semantic.text,
        textNoteMarks(semantic),
        start,
        end,
        kind,
        href,
      ),
      applyOptions,
    );
  }
}
