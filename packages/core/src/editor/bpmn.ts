// BPMN editing rules of the editor: which connections, reconnections,
// semantic edits and lanes are valid, and the commands each one becomes.
// A rejection is returned, not thrown, so the editor can announce it.

import type {
  ConnectorPort,
  ConnectorPorts,
  Element,
  ElementId,
  FractionalIndex,
  PageId,
} from "@nodetto/ir";
import {
  type BpmnConnectionResult,
  type BpmnFlowType,
  resolveBpmnConnection,
} from "../bpmn/connection.ts";
import { addBpmnLaneCommands } from "../bpmn/containment.ts";
import { buildBpmnModel } from "../bpmn/model.ts";
import type { Command } from "../commands.ts";
import type { Editor } from "../editor.ts";
import { compareFractional, keyBetween, type Rng } from "../fractional.ts";
import type { IdSource } from "../ids.ts";
import { referencesOf } from "../references.ts";
import type { ShapeContext } from "../shape-util.ts";
import type { Store } from "../store.ts";

export type BpmnRejected = Extract<BpmnConnectionResult, { ok: false }>;

/** The connector a BPMN connection between `from` and `to` creates. */
export function planBpmnConnection(
  store: Store,
  context: ShapeContext,
  from: ElementId,
  to: ElementId,
  requested: BpmnFlowType | undefined,
  ports: ConnectorPorts,
):
  | BpmnRejected
  | {
      readonly ok: true;
      readonly type: BpmnFlowType;
      readonly page: PageId;
      readonly semantic: Record<string, unknown>;
    } {
  const source = store.get(from);
  const target = store.get(to);
  if (!source || !target || source.page !== target.page)
    return {
      ok: false,
      code: "bpmn.connection.invalidEndpoint",
      message: "Choose two BPMN elements on the same page.",
    };
  if (context.isLocked?.(from) || context.isLocked?.(to))
    return {
      ok: false,
      code: "bpmn.connection.invalidEndpoint",
      message: "Unlock both BPMN elements before connecting them.",
    };
  const result = resolveBpmnConnection(
    store.getSnapshot(),
    from,
    to,
    requested,
  );
  if (!result.ok) return result;
  const semantic: Record<string, unknown> = {
    from,
    to,
    routing: "orthogonal",
    ...ports,
    ...(result.type === "bpmn.association" ? { direction: "none" } : {}),
  };
  return { ok: true, type: result.type, page: source.page, semantic };
}

/**
 * Move one end of a BPMN flow. A flow whose type the new endpoints change is
 * recreated under the same id, with every element that references it.
 */
export function planBpmnReconnect(
  store: Store,
  id: ElementId,
  end: "from" | "to",
  target: ElementId,
  port: ConnectorPort | undefined,
):
  | BpmnRejected
  | { readonly ok: true; readonly type: string; readonly commands: Command[] } {
  const flow = store.get(id);
  const endpoint = store.get(target);
  if (
    !flow ||
    !flow.type.startsWith("bpmn.") ||
    !endpoint ||
    flow.page !== endpoint.page
  )
    return {
      ok: false,
      code: "bpmn.connection.invalidEndpoint",
      message: "Choose a BPMN flow and an endpoint on the same page.",
    };
  const payload = { ...(flow.semantic as Record<string, unknown>) };
  delete payload[end === "from" ? "fromPort" : "toPort"];
  if (port) payload[end === "from" ? "fromPort" : "toPort"] = port;
  const from = end === "from" ? target : String(payload.from);
  const to = end === "to" ? target : String(payload.to);
  const result = resolveBpmnConnection(
    store.getSnapshot(),
    from,
    to,
    flow.type as BpmnFlowType,
  );
  if (!result.ok) return result;
  if (result.type === flow.type) {
    return {
      ok: true,
      type: flow.type,
      commands: [
        { type: "updateSemantic", id, semantic: { ...payload, from, to } },
      ],
    };
  }
  const dependants = new Map<ElementId, Element>();
  let changed = true;
  const references = new Set<ElementId>([id]);
  while (changed) {
    changed = false;
    for (const element of store.listElements()) {
      if (element.id === id || dependants.has(element.id)) continue;
      if (
        referencesOf(element).some((reference) => references.has(reference.id))
      ) {
        dependants.set(element.id, element);
        references.add(element.id);
        changed = true;
      }
    }
  }
  const retained = Object.fromEntries(
    Object.entries(payload).filter(([key]) =>
      [
        "name",
        "routing",
        "routingAxis",
        "routingBend",
        "routingAvoidObstacles",
        "routingWaypoints",
        "fromPort",
        "toPort",
      ].includes(key),
    ),
  );
  const replacement: Element = {
    ...flow,
    type: result.type,
    semantic: {
      ...retained,
      from,
      to,
      ...(result.type === "bpmn.association" ? { direction: "none" } : {}),
    },
  };
  const commands: Command[] = [
    { type: "deleteElements", ids: [id] },
    { type: "createElement", element: replacement },
    ...[...dependants.values()]
      .sort((a, b) => compareFractional(a.index, b.index))
      .map((element): Command => ({ type: "createElement", element })),
  ];
  return { ok: true, type: result.type, commands };
}

/** Whether `semantic` is a valid replacement for a BPMN element's semantic. */
export function checkBpmnSemantic(
  store: Store,
  id: ElementId,
  semantic: unknown,
): BpmnRejected | { readonly ok: true; readonly type: string } {
  const element = store.get(id);
  if (!element || !element.type.startsWith("bpmn."))
    return {
      ok: false,
      code: "bpmn.connection.invalidEndpoint",
      message: "The element is not a BPMN element.",
    };
  if (element.type === "bpmn.event") {
    const position = (semantic as Record<string, unknown>).position;
    const model = buildBpmnModel(store.getSnapshot(), element.page);
    if (position === "start" && model.incoming(id).length)
      return {
        ok: false,
        code: "bpmn.connection.startEventIncoming",
        message:
          "An event with incoming sequence flows cannot become a start event.",
      };
    if (position === "end" && model.outgoing(id).length)
      return {
        ok: false,
        code: "bpmn.connection.endEventOutgoing",
        message:
          "An event with outgoing sequence flows cannot become an end event.",
      };
  }
  return { ok: true, type: element.type };
}

/** A new lane under a participant or lane, stacked above its siblings. */
export function planBpmnLane(
  editor: Editor,
  rng: Rng,
  idSource: IdSource,
  parentId: ElementId,
):
  | BpmnRejected
  | {
      readonly ok: true;
      readonly id: ElementId;
      readonly commands: Command[];
    } {
  const parent = editor.store.get(parentId);
  if (
    !parent ||
    (parent.type !== "bpmn.participant" && parent.type !== "bpmn.lane")
  )
    return {
      ok: false,
      code: "bpmn.connection.invalidEndpoint",
      message: "A lane must be added to a participant or lane.",
    };
  const document = editor.store.getSnapshot();
  const model = buildBpmnModel(document, parent.page);
  const ordered = editor.store.getPageElements(parent.page);
  const children = model.order
    .map((id) => model.get(id))
    .filter(
      (element): element is Element =>
        element?.type === "bpmn.lane" &&
        model.parentOf(element.id) === parentId,
    );
  const lowerElement = children.length
    ? children.reduce((highest, lane) =>
        compareFractional(lane.index, highest.index) > 0 ? lane : highest,
      )
    : parent;
  const lowerAt = ordered.findIndex(
    (element) => element.id === lowerElement.id,
  );
  const upper = ordered[lowerAt + 1]?.index ?? null;
  let index: FractionalIndex;
  try {
    index = keyBetween(lowerElement.index, upper, rng);
  } catch (error) {
    if (!(error instanceof RangeError)) throw error;
    index = editor.nextIndex(parent.page);
  }
  const id = idSource();
  const commands = addBpmnLaneCommands(document, parentId, id, index);
  return { ok: true, id, commands };
}
