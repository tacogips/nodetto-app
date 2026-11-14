// Connector rules by diagram type: which connector a drag between two
// elements creates, and the validated ERD relation, UML component
// relationship and port placements. Each one creates through the editor, so
// it is validated and undoable like any other edit.

import {
  type ConnectorPorts,
  type ElementId,
  UmlComponentRelationship,
  type UmlComponentRelationshipKind,
  UmlComponentType,
} from "@nodetto/ir";
import type { Editor } from "../editor.ts";
import type { Rng } from "../fractional.ts";
import type { Vec } from "../geometry.ts";
import {
  isUmlComponentEndpoint,
  nearestUmlPortAnchor,
  umlPortAnchor,
} from "../shapes/umlComponent.ts";
import { planSequenceMessage } from "./sequence.ts";
import type { ApplyOptions } from "./types.ts";

/**
 * Connect two elements with the connector their types call for: two ERD
 * tables get a relation, two UML classes an association, two sequence
 * participants a timeline message, and anything else a generic edge.
 * `null` for the same cases `connect` refuses.
 */
export function connectByType(
  editor: Editor,
  rng: Rng,
  from: ElementId,
  to: ElementId,
  applyOptions: ApplyOptions,
  ports: ConnectorPorts,
): ElementId | null {
  const source = editor.store.get(from);
  const target = editor.store.get(to);
  // Self-transitions and self-referencing foreign keys are the only
  // connections an element may make to itself.
  if (
    (from === to &&
      source?.type !== "state.node" &&
      source?.type !== "erd.table") ||
    !source ||
    !target ||
    source.page !== target.page
  ) {
    return null;
  }
  if (source.type === "state.node" && target.type === "state.node") {
    const context = editor.createShapeContext();
    if (editor.readOnly || context.isLocked?.(from) || context.isLocked?.(to))
      return null;
    return editor.createElement(
      "state.transition",
      { page: source.page, semantic: { from, to, ...ports } },
      applyOptions,
    );
  }
  if (source.type.startsWith("bpmn.") && target.type.startsWith("bpmn.")) {
    const result = editor.connectBpmn(from, to, undefined, applyOptions, ports);
    return result.ok ? result.id : null;
  }
  if (
    source.type === "sequence.participant" &&
    target.type === "sequence.participant"
  ) {
    const plan = planSequenceMessage(editor, rng, source, target);
    if (!plan) return null;
    editor.apply(plan.commands, applyOptions);
    return plan.id;
  }
  if (source.type === "erd.table" && target.type === "erd.table") {
    return editor.connectErdRelation(from, to, false, applyOptions, ports);
  }
  if (source.type === "uml.class" && target.type === "uml.class") {
    return editor.createElement(
      "uml.association",
      { page: source.page, semantic: { from, to, kind: "assoc", ...ports } },
      applyOptions,
    );
  }
  if (
    isUmlComponentEndpoint(source.type) &&
    isUmlComponentEndpoint(target.type)
  )
    return editor.connectComponent(
      from,
      to,
      UmlComponentRelationship.Connector,
      applyOptions,
      ports,
    );
  return editor.connect(from, to, source.page, applyOptions, ports);
}

/** Logical relations and enforced foreign keys share endpoint mappings. */
export function connectErdTables(
  editor: Editor,
  from: ElementId,
  to: ElementId,
  logical: boolean,
  options: ApplyOptions,
  ports: ConnectorPorts,
): ElementId | null {
  const source = editor.store.get(from);
  const target = editor.store.get(to);
  const context = editor.createShapeContext();
  if (
    editor.readOnly ||
    !source ||
    !target ||
    source.page !== target.page ||
    source.type !== "erd.table" ||
    target.type !== "erd.table" ||
    context.isLocked?.(from) ||
    context.isLocked?.(to)
  )
    return null;
  return editor.createElement(
    "erd.relation",
    {
      page: source.page,
      semantic: {
        from: { table: from },
        to: { table: to },
        ...ports,
        cardinality: "1:*",
        ...(logical ? { logical: true } : {}),
      },
    },
    options,
  );
}

/** Component relationships never borrow class-association semantics. */
export function connectUmlComponents(
  editor: Editor,
  from: ElementId,
  to: ElementId,
  kind: UmlComponentRelationshipKind,
  options: ApplyOptions,
  ports: ConnectorPorts,
): ElementId | null {
  const source = editor.store.get(from);
  const target = editor.store.get(to);
  const context = editor.createShapeContext();
  if (
    editor.readOnly ||
    from === to ||
    !source ||
    !target ||
    source.page !== target.page ||
    !isUmlComponentEndpoint(source.type) ||
    !isUmlComponentEndpoint(target.type) ||
    context.isLocked?.(from) ||
    context.isLocked?.(to)
  )
    return null;
  return editor.createElement(
    UmlComponentType.Relationship,
    { page: source.page, semantic: { from, to, kind, ...ports } },
    options,
  );
}

/** Attach a port to the boundary of component `ownerId` nearest `point`. */
export function placeUmlPort(
  editor: Editor,
  ownerId: ElementId,
  point: Vec,
): ElementId | null {
  const owner = editor.store.get(ownerId);
  if (
    editor.readOnly ||
    !owner ||
    owner.type !== UmlComponentType.Component ||
    editor.createShapeContext().isLocked?.(ownerId)
  )
    return null;
  const anchor = nearestUmlPortAnchor(owner, point);
  const position = umlPortAnchor(owner, anchor.side, anchor.offset);
  return editor.createElement(UmlComponentType.Port, {
    page: owner.page,
    semantic: { name: "Port", owner: ownerId, ...anchor },
    visual: { x: position.x - 7, y: position.y - 7 },
  });
}
