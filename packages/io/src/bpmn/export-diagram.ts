// BPMN DI: shape bounds, labels and edge waypoints of the exported plane.

import { connectorWaypointToPage } from "@nodetto/ir";
import type { XmlElement } from "./xml.ts";
import { bpmnExportId } from "./ids.ts";
import {
  type BpmnExportOptions,
  element,
  num,
  type Point,
  semantic,
} from "./export-common.ts";
import type { BpmnExportScope } from "./export-scope.ts";

function border(
  box: { x: number; y: number; width: number; height: number },
  toward: Point,
): Point {
  const cx = box.x + box.width / 2;
  const cy = box.y + box.height / 2;
  const dx = toward.x - cx;
  const dy = toward.y - cy;
  if (!dx && !dy) return { x: cx, y: cy };
  const scale = Math.min(
    dx ? box.width / 2 / Math.abs(dx) : Number.POSITIVE_INFINITY,
    dy ? box.height / 2 / Math.abs(dy) : Number.POSITIVE_INFINITY,
  );
  return { x: cx + dx * scale, y: cy + dy * scale };
}

export function diagramElement(
  scope: BpmnExportScope,
  collaborationId: string,
  options: BpmnExportOptions,
): XmlElement {
  const { pageId, records, byId, participants, flows, processId } = scope;
  const shapeRecords = records
    .filter(
      (item) =>
        item.type === "bpmn.participant" ||
        item.type === "bpmn.lane" ||
        !flows.includes(item),
    )
    .sort((a, b) => a.id.localeCompare(b.id));
  const planeShapes = shapeRecords.map((item) => {
    const visual = item.visual;
    const attrs: Record<string, string | undefined> = {
      id: `${bpmnExportId(item)}_di`,
      bpmnElement: bpmnExportId(item),
      isHorizontal: item.type === "bpmn.participant" ? "true" : undefined,
      isExpanded:
        item.type === "bpmn.participant" && semantic(item)["collapsed"] === true
          ? "false"
          : item.type === "bpmn.subProcess" &&
              typeof semantic(item)["expanded"] === "boolean"
            ? semantic(item)["expanded"] === true
              ? "true"
              : "false"
            : undefined,
      isMarkerVisible:
        item.type === "bpmn.gateway" &&
        typeof semantic(item)["markerVisible"] === "boolean"
          ? semantic(item)["markerVisible"] === true
            ? "true"
            : "false"
          : undefined,
    };
    const bounds = element("dc:Bounds", {
      x: num(visual.x, 0),
      y: num(visual.y, 0),
      width: num(visual.width, 100),
      height: num(visual.height, 60),
    });
    const labels = visual.labelBounds
      ? [
          element("bpmndi:BPMNLabel", {}, [
            element("dc:Bounds", {
              x: num(visual.labelBounds.x, 0),
              y: num(visual.labelBounds.y, 0),
              width: num(visual.labelBounds.width, 90),
              height: num(visual.labelBounds.height, 20),
            }),
          ]),
        ]
      : [];
    return element("bpmndi:BPMNShape", attrs, [bounds, ...labels]);
  });
  const planeEdges = flows
    .slice()
    .sort((a, b) => a.id.localeCompare(b.id))
    .map((flow) => {
      let points = options.routeOf?.(flow);
      if (!points) {
        const s = semantic(flow);
        const from = byId.get(String(s["from"]));
        const to = byId.get(String(s["to"]));
        const fromBox = {
          x: from?.visual.x ?? 0,
          y: from?.visual.y ?? 0,
          width: from?.visual.width ?? 100,
          height: from?.visual.height ?? 60,
        };
        const toBox = {
          x: to?.visual.x ?? 0,
          y: to?.visual.y ?? 0,
          width: to?.visual.width ?? 100,
          height: to?.visual.height ?? 60,
        };
        const a = {
          x: fromBox.x + fromBox.width / 2,
          y: fromBox.y + fromBox.height / 2,
        };
        const b = {
          x: toBox.x + toBox.width / 2,
          y: toBox.y + toBox.height / 2,
        };
        const middle = Array.isArray(s["routingWaypoints"])
          ? (s["routingWaypoints"] as Array<{ u: number; v: number }>).map(
              (wp) => connectorWaypointToPage(wp, a, b),
            )
          : [];
        points = [border(fromBox, b), ...middle, border(toBox, a)];
      }
      const nodes = (points ?? []).map((point) =>
        element("di:waypoint", { x: num(point.x, 0), y: num(point.y, 0) }),
      );
      const label = flow.visual.labelBounds
        ? [
            element("bpmndi:BPMNLabel", {}, [
              element("dc:Bounds", {
                x: num(flow.visual.labelBounds.x, 0),
                y: num(flow.visual.labelBounds.y, 0),
                width: num(flow.visual.labelBounds.width, 90),
                height: num(flow.visual.labelBounds.height, 20),
              }),
            ]),
          ]
        : [];
      return element(
        "bpmndi:BPMNEdge",
        { id: `${bpmnExportId(flow)}_di`, bpmnElement: bpmnExportId(flow) },
        [...nodes, ...label],
      );
    });
  return element("bpmndi:BPMNDiagram", { id: `Diagram_${pageId}` }, [
    element(
      "bpmndi:BPMNPlane",
      {
        id: `Plane_${pageId}`,
        bpmnElement: participants.length ? collaborationId : processId(""),
      },
      [...planeShapes, ...planeEdges],
    ),
  ]);
}
