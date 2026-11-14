import { buildBpmnModel, frameParents, type Editor } from "@nodetto/core";
import { isPlainObject, type Element, type ElementId } from "@nodetto/ir";
import { shortIds } from "../ids.ts";
import { OperationError } from "./operation-input.ts";

export const CARRY_CONTAINER_TYPES: readonly string[] = [
  "frame",
  "bpmn.participant",
  "bpmn.lane",
  "bpmn.subProcess",
  "breadboard.board",
];

export function heldMembers(
  editor: Editor,
  element: Element,
  visual: unknown,
  index: number,
): ReadonlySet<ElementId> {
  if (element.type === "group")
    throw new OperationError(
      index,
      "carryMembers does not apply to a group: a group has no box of its own; move its members, or ungroup it.",
    );
  if (!CARRY_CONTAINER_TYPES.includes(element.type))
    throw new OperationError(
      index,
      `carryMembers applies only to frame, bpmn.participant, bpmn.lane, bpmn.subProcess and breadboard.board; ${element.type} does not move other elements.`,
    );
  const semantic = isPlainObject(element.semantic) ? element.semantic : {};
  const name =
    typeof semantic["name"] === "string" && semantic["name"]
      ? semantic["name"]
      : (shortIds(editor.store.listElements().map((item) => item.id)).get(
          element.id,
        ) ?? element.id);
  if (element.type === "frame") {
    if (semantic["layout"])
      throw new OperationError(
        index,
        `carryMembers:false cannot be used on frame "${name}": it lays out its members ("layout"); remove "layout" first.`,
      );
    editor.setCurrentPage(element.page);
    const parents = frameParents(
      editor.store,
      element.page,
      editor.createShapeContext(1),
    );
    const held = new Set<ElementId>();
    for (const [child] of parents) {
      let parent = parents.get(child);
      while (parent) {
        if (parent === element.id) {
          held.add(child);
          break;
        }
        parent = parents.get(parent);
      }
    }
    return held;
  }
  if (
    element.type === "bpmn.lane" &&
    isPlainObject(visual) &&
    (["x", "y", "width"] as const).some(
      (key) => visual[key] !== undefined && visual[key] !== element.visual[key],
    )
  )
    throw new OperationError(
      index,
      `carryMembers:false on lane "${name}": a lane's x, y and width follow its pool; change the pool, or change only "height".`,
    );
  if (element.type === "breadboard.board")
    return new Set(
      editor.store
        .getPageElements(element.page)
        .filter((item) => item.id !== element.id)
        .map((item) => item.id),
    );
  const model = buildBpmnModel(editor.getSnapshot(), element.page);
  if (
    (element.type === "bpmn.participant" || element.type === "bpmn.lane") &&
    isPlainObject(visual)
  ) {
    const children = (parent: ElementId): Element[] =>
      model.order.flatMap((id) => {
        const lane = model.get(id);
        return lane?.type === "bpmn.lane" && model.parentOf(id) === parent
          ? [lane]
          : [];
      });
    const minimumHeight = (parent: ElementId): number => {
      const lanes = children(parent);
      let height = 0;
      for (const [position, lane] of lanes.entries())
        height +=
          position === lanes.length - 1
            ? Math.max(
                minimumHeight(lane.id),
                children(lane.id).reduce(
                  (sum, child) => sum + (child.visual.height ?? 120),
                  0,
                ),
              )
            : (lane.visual.height ?? 120);
      return lanes.length ? height : 30;
    };
    const laneDepth = (parent: ElementId): number => {
      const lanes = children(parent);
      return lanes.length
        ? 1 + Math.max(...lanes.map((lane) => laneDepth(lane.id)))
        : 0;
    };
    const lanes = children(element.id);
    if (lanes.length) {
      const height = visual["height"];
      const minimum = minimumHeight(element.id);
      if (
        typeof height === "number" &&
        height !== element.visual.height &&
        height < minimum
      )
        throw new OperationError(
          index,
          `carryMembers:false on "${name}": its lanes need a height of at least ${minimum}; shrink the lanes first.`,
        );
      const width = visual["width"];
      const minimumWidth = 30 * laneDepth(element.id);
      if (
        element.type === "bpmn.participant" &&
        typeof width === "number" &&
        width !== element.visual.width &&
        width <= minimumWidth
      )
        throw new OperationError(
          index,
          `carryMembers:false on "${name}": its lanes need a width greater than ${minimumWidth}.`,
        );
      if (
        element.type === "bpmn.participant" &&
        typeof width === "number" &&
        width !== element.visual.width
      ) {
        let extent = 0;
        for (const lane of lanes) {
          for (const id of model.descendantsOf(lane.id)) {
            const nested = model.get(id);
            if (nested?.type === "bpmn.lane")
              extent = Math.max(
                extent,
                (nested.visual.x ?? 0) +
                  (nested.visual.width ?? 0) -
                  (element.visual.x ?? 0),
              );
          }
        }
        if (width < extent)
          throw new OperationError(
            index,
            `carryMembers:false on "${name}": its nested lanes need a width of at least ${extent}.`,
          );
      }
    }
  }
  return new Set(
    model.descendantsOf(element.id).filter((id) => {
      const member = model.get(id);
      return (
        member?.type !== "bpmn.lane" &&
        !(
          member?.type === "bpmn.boundaryEvent" &&
          isPlainObject(member.semantic) &&
          member.semantic["attachedTo"] === element.id
        )
      );
    }),
  );
}
