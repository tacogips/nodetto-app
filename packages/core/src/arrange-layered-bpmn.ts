import type { Element, ElementId, PageId } from "@nodetto/ir";
import type { Command } from "./commands.ts";
import { Editor } from "./editor.ts";
import { createShapeContext } from "./hit-test.ts";
import type { ShapeUtilRegistry } from "./shape-util.ts";
import type { Store } from "./store.ts";
import { buildBpmnModel, isBpmnFlowType } from "./bpmn/model.ts";

const compare = (a: string, b: string) => (a < b ? -1 : a > b ? 1 : 0);
const unitTypes = new Set([
  "bpmn.task",
  "bpmn.event",
  "bpmn.gateway",
  "bpmn.callActivity",
  "bpmn.subProcess",
  "bpmn.dataObject",
  "bpmn.dataStore",
  "bpmn.textAnnotation",
]);
const field = (e: Element, key: string): unknown =>
  (e.semantic as Record<string, unknown>)[key];

export function planLayeredBpmn(
  store: Store,
  pageId: PageId,
  registry: ShapeUtilRegistry,
):
  | {
      containerCommands: Command[];
      unitCommands: Command[];
      placed: ReadonlySet<ElementId>;
    }
  | { error: string } {
  if (store.getPage(pageId)?.kind !== "bpmn")
    return { error: "arrange --mode layered requires a BPMN page" };
  const model = buildBpmnModel(store.getSnapshot(), pageId);
  const context = createShapeContext(store, registry, 1);
  const elements = [...store.getPageElements(pageId)].sort((a, b) =>
    compare(a.id, b.id),
  );
  const ancestors = (id: ElementId): Element[] => {
    const result: Element[] = [];
    const seen = new Set<ElementId>([id]);
    let parent = model.parentOf(id);
    while (parent && !seen.has(parent)) {
      seen.add(parent);
      const e = model.get(parent);
      if (!e) break;
      result.push(e);
      parent = model.parentOf(parent);
    }
    return result;
  };
  const collapsed = elements.filter(
    (e) => e.type === "bpmn.participant" && field(e, "collapsed") === true,
  );
  const carried = new Set(
    collapsed.flatMap((pool) => model.descendantsOf(pool.id)),
  );
  const units = elements.filter(
    (e) =>
      unitTypes.has(e.type) &&
      !carried.has(e.id) &&
      !ancestors(e.id).some((a) => a.type === "bpmn.subProcess") &&
      context.boundsOf(e.id) !== null,
  );
  const placed = new Set<ElementId>(carried);
  for (const unit of units) {
    placed.add(unit.id);
    if (unit.type === "bpmn.subProcess")
      for (const id of model.descendantsOf(unit.id)) placed.add(id);
  }
  if (!units.length) return { containerCommands: [], unitCommands: [], placed };
  const ids = new Set(units.map((e) => e.id));
  const unitOf = (id: ElementId): ElementId | undefined => {
    let e = model.get(id);
    if (e?.type === "bpmn.boundaryEvent") {
      const host = field(e, "attachedTo");
      e = typeof host === "string" ? model.get(host) : undefined;
    }
    if (!e) return undefined;
    const subprocess = ancestors(e.id)
      .filter((a) => a.type === "bpmn.subProcess")
      .pop();
    const candidate = subprocess?.id ?? e.id;
    return ids.has(candidate) ? candidate : undefined;
  };
  const outgoing = new Map<ElementId, ElementId[]>();
  const incoming = new Map<ElementId, number>();
  for (const e of elements) {
    if (!isBpmnFlowType(e.type)) continue;
    const fromField = field(e, "from");
    const toField = field(e, "to");
    const from = typeof fromField === "string" ? unitOf(fromField) : undefined;
    const to = typeof toField === "string" ? unitOf(toField) : undefined;
    if (!from || !to || from === to) continue;
    const targets = outgoing.get(from) ?? [];
    targets.push(to);
    outgoing.set(from, targets);
    incoming.set(to, (incoming.get(to) ?? 0) + 1);
  }
  const ranked: Element[] = [];
  const layers = new Map<ElementId, number>();
  let start: Element | undefined =
    units.find(
      (e) => e.type === "bpmn.event" && field(e, "position") === "start",
    ) ??
    units.find((e) => !incoming.get(e.id)) ??
    units[0];
  while (start) {
    const queue: { id: ElementId; depth: number }[] = [
      { id: start.id, depth: 0 },
    ];
    for (let i = 0; i < queue.length; i++) {
      const entry = queue[i];
      if (!entry || layers.has(entry.id)) continue;
      const e = model.get(entry.id);
      if (!e) continue;
      layers.set(entry.id, entry.depth);
      ranked.push(e);
      for (const id of outgoing.get(entry.id) ?? [])
        if (!layers.has(id)) queue.push({ id, depth: entry.depth + 1 });
    }
    const unvisitedIncoming = new Set<ElementId>();
    for (const [from, targets] of outgoing)
      if (!layers.has(from))
        for (const to of targets)
          if (!layers.has(to)) unvisitedIncoming.add(to);
    start =
      units.find((e) => !layers.has(e.id) && !unvisitedIncoming.has(e.id)) ??
      units.find((e) => !layers.has(e.id));
  }
  const pools = elements
    .filter((e) => e.type === "bpmn.participant")
    .sort(
      (a, b) => (a.visual.y ?? 0) - (b.visual.y ?? 0) || compare(a.id, b.id),
    );
  type Row = {
    id: string;
    pool?: Element;
    members: Element[];
    height: number;
    y: number;
  };
  const rows: Row[] = [];
  const poolRows = new Map<ElementId, Row[]>();
  for (const pool of pools) {
    if (field(pool, "collapsed") === true) {
      poolRows.set(pool.id, []);
      continue;
    }
    const lanes = model.order
      .map((id) => model.get(id))
      .filter(
        (e): e is Element =>
          !!e &&
          e.type === "bpmn.lane" &&
          model.participantOf(e.id) === pool.id,
      );
    const children = new Map<ElementId, Element[]>();
    for (const lane of lanes) {
      const parent = model.parentOf(lane.id);
      if (!parent) continue;
      const siblings = children.get(parent) ?? [];
      siblings.push(lane);
      children.set(parent, siblings);
    }
    const leaves: Element[] = [];
    const visit = (parent: ElementId) => {
      for (const lane of children.get(parent) ?? []) {
        if (children.has(lane.id)) visit(lane.id);
        else leaves.push(lane);
      }
    };
    visit(pool.id);
    const group = (leaves.length ? leaves.map((e) => e.id) : [pool.id]).map(
      (id) => ({ id, pool, members: [], height: 120, y: 0 }) as Row,
    );
    rows.push(...group);
    poolRows.set(pool.id, group);
  }
  const free: Row = { id: "", members: [], height: 120, y: 0 };
  for (const unit of ranked) {
    const chain = ancestors(unit.id);
    const pool = chain.find((e) => e.type === "bpmn.participant");
    const lane = chain.find((e) => e.type === "bpmn.lane");
    const group = pool ? (poolRows.get(pool.id) ?? []) : [];
    const row =
      rows.find((r) => r.id === lane?.id) ??
      (lane
        ? group.find((r) => ancestors(r.id).some((a) => a.id === lane.id))
        : group[0]) ??
      free;
    row.members.push(unit);
  }
  if (free.members.length) rows.push(free);
  const widths: number[] = [];
  for (const unit of ranked) {
    const layer = layers.get(unit.id) ?? 0;
    const box = context.boundsOf(unit.id);
    if (box) widths[layer] = Math.max(widths[layer] ?? 0, box.width);
  }
  const cells = (row: Row, layer: number) =>
    row.members.filter((e) => layers.get(e.id) === layer);
  const stackHeight = (members: Element[]) =>
    members.reduce((n, e) => n + (context.boundsOf(e.id)?.height ?? 0), 0) +
    Math.max(0, members.length - 1) * 60;
  for (const row of rows)
    row.height = Math.round(
      Math.max(
        row === free ? 0 : 120,
        ...widths.map(
          (_, layer) =>
            stackHeight(cells(row, layer)) + (row === free ? 0 : 80),
        ),
      ),
    );
  const boxes = [...pools, ...units]
    .map((e) => context.boundsOf(e.id))
    .filter((b): b is NonNullable<typeof b> => b !== null);
  const originX = Math.round(Math.min(...boxes.map((b) => b.x)));
  const originY = Math.round(Math.min(...boxes.map((b) => b.y)));
  const width = Math.round(
    110 +
      widths.reduce((a, b) => a + b, 0) +
      Math.max(0, widths.length - 1) * 120,
  );
  const containerCommands: Command[] = [];
  let y = originY;
  for (const pool of pools) {
    const group = poolRows.get(pool.id) ?? [];
    const height =
      field(pool, "collapsed") === true
        ? (pool.visual.height ?? 0)
        : group.reduce((n, row) => n + row.height, 0);
    const visual = {
      x: originX,
      y: Math.round(y),
      width,
      height: Math.round(height),
    };
    if (
      Object.entries(visual).some(
        ([k, v]) => pool.visual[k as keyof typeof pool.visual] !== v,
      )
    )
      containerCommands.push({ type: "updateVisual", id: pool.id, visual });
    const laneHeights = new Map<ElementId, number>();
    for (const row of group) {
      for (const ancestor of ancestors(row.id)) {
        if (ancestor.type === "bpmn.lane")
          laneHeights.set(
            ancestor.id,
            (laneHeights.get(ancestor.id) ?? 0) + row.height,
          );
      }
    }
    for (const [id, laneHeight] of laneHeights) {
      if (model.get(id)?.visual.height !== laneHeight)
        containerCommands.push({
          type: "updateVisual",
          id,
          visual: { height: laneHeight },
        });
    }
    for (const row of group) {
      row.y = y;
      y += row.height;
      if (row.id !== pool.id && model.get(row.id)?.visual.height !== row.height)
        containerCommands.push({
          type: "updateVisual",
          id: row.id,
          visual: { height: row.height },
        });
    }
    if (!group.length) y += height;
    y += 120;
  }
  if (free.members.length) free.y = y;
  const draft = new Editor({ document: store.getSnapshot(), registry });
  if (containerCommands.length) draft.apply(containerCommands);
  const unitCommands: Command[] = [];
  for (const row of rows) {
    let x = originX + (pools.length ? 70 : 0);
    for (let layer = 0; layer < widths.length; layer++) {
      const columnWidth = widths[layer] ?? 0;
      const members = cells(row, layer);
      let top = row.y + (row.height - stackHeight(members)) / 2;
      for (const unit of members) {
        const box = context.boundsOf(unit.id);
        const current = draft.store.get(unit.id);
        if (!box || !current) continue;
        const nx = Math.round(
          x + (columnWidth - box.width) / 2 + (unit.visual.x ?? 0) - box.x,
        );
        const ny = Math.round(top + (unit.visual.y ?? 0) - box.y);
        if (nx !== current.visual.x || ny !== current.visual.y)
          unitCommands.push({
            type: "updateVisual",
            id: unit.id,
            visual: { x: nx, y: ny },
          });
        top += box.height + 60;
      }
      x += columnWidth + 120;
    }
  }
  return { containerCommands, unitCommands, placed };
}
