// Creation tools: what a click with a shape tool (or a palette drop through
// `placeTool`) puts on the page.

import type { Box, Vec } from "@nodetto/core";
import type { BreadboardElementType, Element } from "@nodetto/ir";
import { Tool, type ToolKind, creationFor } from "../tools.ts";
import type { CircuitTools } from "./circuit.ts";
import type { InteractionContext } from "./context.ts";

/** Types whose creation tool opens the text editor right away (design 3.3). */
const EDIT_ON_CREATE: ReadonlySet<string> = new Set([
  "text.note",
  "node.generic",
]);

export interface CreationTools {
  placeShape(point: Vec, tool: ToolKind): void;
}

export function createCreationTools(
  ctx: InteractionContext,
  circuit: CircuitTools,
): CreationTools {
  const { editor, options } = ctx;

  const placeShape = (point: Vec, tool: ToolKind): void => {
    const creation = creationFor(tool);
    if (!creation) {
      return;
    }
    if (tool === Tool.PcbTrack || tool === Tool.PcbVia) {
      circuit.placePcbTool(point, tool);
      return;
    }
    if (tool === Tool.BreadboardWire) {
      circuit.placeBreadboardWirePoint(point);
      return;
    }
    if (creation.type.startsWith("breadboard.")) {
      const id = editor.createBreadboardPart(
        creation.type as BreadboardElementType,
        point,
        typeof creation.semantic === "object" && creation.semantic !== null
          ? (creation.semantic as Readonly<Record<string, unknown>>)
          : undefined,
      );
      if (id) {
        editor.selection.set([id]);
        options.setTool(Tool.Select);
      }
      return;
    }
    if (tool === Tool.Port) {
      const owner = editor.hitTest(point);
      if (owner) {
        const id = editor.createUmlPort(owner, point);
        if (id) {
          editor.selection.set([id]);
          options.setTool(Tool.Select);
        }
      }
      return;
    }
    if (tool === "bpmn:lane") {
      const container = editor.store
        .getPageElements(editor.currentPageId)
        .filter(
          (element) =>
            element.type === "bpmn.lane" || element.type === "bpmn.participant",
        )
        .map((element) => ({ element, bounds: editor.getBounds(element.id) }))
        .filter(
          (
            candidate,
          ): candidate is {
            element: Element;
            bounds: Box;
          } =>
            candidate.bounds !== null &&
            point.x >= candidate.bounds.x &&
            point.x <= candidate.bounds.x + candidate.bounds.width &&
            point.y >= candidate.bounds.y &&
            point.y <= candidate.bounds.y + candidate.bounds.height,
        )
        .sort(
          (left, right) =>
            left.bounds.width * left.bounds.height -
            right.bounds.width * right.bounds.height,
        )[0]?.element;
      if (container) {
        const result = editor.addBpmnLane(container.id);
        if (result.ok) editor.selection.set([result.id]);
      }
      options.setTool("select");
      return;
    }
    if (creation.type === "sequence.participant") {
      const semantic = creation.semantic as {
        kind?: "actor" | "service" | "db";
      };
      const id = editor.createSequenceParticipant(
        semantic.kind ?? "service",
        point,
      );
      editor.selection.set([id]);
      options.setTool("select");
      return;
    }
    const draft = editor.buildElement(creation.type, {
      semantic: creation.semantic,
      visual: { ...creation.visual, x: point.x, y: point.y },
    });
    const box = editor
      .getShapeUtil(creation.type)
      .getBounds(draft, editor.createShapeContext());
    const semantic =
      creation.type.startsWith("bpmn.") &&
      (creation.type === "bpmn.event" || creation.type === "bpmn.boundaryEvent")
        ? {
            ...(draft.semantic as Record<string, unknown>),
            definitions: (
              (draft.semantic as { definitions?: readonly { id: string }[] })
                .definitions ?? []
            ).map((definition, index) => ({
              ...definition,
              id: `def-${draft.id}-${index + 1}`,
            })),
          }
        : draft.semantic;
    const element: Element = {
      ...draft,
      semantic,
      visual: {
        ...draft.visual,
        x: point.x - (box?.width ?? 0) / 2,
        y: point.y - (box?.height ?? 0) / 2,
      },
    };
    editor.apply([{ type: "createElement", element }]);
    editor.selection.set([element.id]);
    options.setTool("select");
    if (EDIT_ON_CREATE.has(creation.type)) {
      // A text-bearing element is typed into the moment it lands (3.3).
      options.onEditRequest?.(element.id, "body");
    }
  };

  return { placeShape };
}
