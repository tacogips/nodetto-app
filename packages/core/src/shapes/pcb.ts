import {
  PCB_ELEMENT_TYPES,
  PCB_PAGE_SCALE,
  type PcbElementType,
  type PcbFootprintSemantic,
  type PcbGraphicSemantic,
  type PcbTrackSemantic,
  type PcbXY,
  type PcbZoneSemantic,
} from "@nodetto/ir";
import type { Element } from "@nodetto/ir";
import {
  arcCenter,
  arcIsClockwise,
  footprintBounds,
  shapeBounds,
} from "../pcb-board/geometry.ts";
import { boxContains, type Box, type Vec } from "../geometry.ts";
import type { ShapeUtil } from "../shape-util.ts";

const HIT_RADIUS_MM = 0.1;

function semantic<T>(element: Element): T {
  return element.semantic as T;
}

function pageBounds(
  minX: number,
  minY: number,
  maxX: number,
  maxY: number,
): Box {
  return {
    x: minX * PCB_PAGE_SCALE,
    y: minY * PCB_PAGE_SCALE,
    width: (maxX - minX) * PCB_PAGE_SCALE,
    height: (maxY - minY) * PCB_PAGE_SCALE,
  };
}

/** A track's points, with an arc's midpoint between its two ends. */
function trackPath(track: PcbTrackSemantic): readonly PcbXY[] {
  const [start, end] = track.points;
  return track.mid && start && end ? [start, track.mid, end] : track.points;
}

function boundsFor(type: PcbElementType, element: Element): Box | null {
  switch (type) {
    case "pcb.board":
      return null;
    case "pcb.footprint": {
      const box = footprintBounds(semantic<PcbFootprintSemantic>(element));
      return pageBounds(box.minX, box.minY, box.maxX, box.maxY);
    }
    case "pcb.track": {
      const track = semantic<PcbTrackSemantic>(element);
      const points = trackPath(track);
      const xs = points.map((point) => point[0]);
      const ys = points.map((point) => point[1]);
      const half = track.width / 2;
      return pageBounds(
        Math.min(...xs) - half,
        Math.min(...ys) - half,
        Math.max(...xs) + half,
        Math.max(...ys) + half,
      );
    }
    case "pcb.via": {
      const via = semantic<{ at: PcbXY; diameter: number }>(element);
      const radius = via.diameter / 2;
      return pageBounds(
        via.at[0] - radius,
        via.at[1] - radius,
        via.at[0] + radius,
        via.at[1] + radius,
      );
    }
    case "pcb.zone": {
      const { outline } = semantic<PcbZoneSemantic>(element);
      const xs = outline.map(([x]) => x);
      const ys = outline.map(([, y]) => y);
      return pageBounds(
        Math.min(...xs),
        Math.min(...ys),
        Math.max(...xs),
        Math.max(...ys),
      );
    }
    case "pcb.graphic": {
      const graphic = semantic<PcbGraphicSemantic>(element);
      const box = shapeBounds(graphic.shape, graphic.width);
      return pageBounds(box.minX, box.minY, box.maxX, box.maxY);
    }
  }
}

function distanceToSegment(point: PcbXY, a: PcbXY, b: PcbXY): number {
  const dx = b[0] - a[0];
  const dy = b[1] - a[1];
  const lengthSquared = dx * dx + dy * dy;
  const amount =
    lengthSquared === 0
      ? 0
      : Math.max(
          0,
          Math.min(
            1,
            ((point[0] - a[0]) * dx + (point[1] - a[1]) * dy) / lengthSquared,
          ),
        );
  const x = point[0] - (a[0] + amount * dx);
  const y = point[1] - (a[1] + amount * dy);
  return Math.sqrt(x * x + y * y);
}

function nearSegments(
  point: PcbXY,
  points: readonly PcbXY[],
  tolerance: number,
  closed = false,
): boolean {
  for (let index = 1; index < points.length; index += 1) {
    const a = points[index - 1];
    const b = points[index];
    if (a && b && distanceToSegment(point, a, b) <= tolerance) return true;
  }
  const first = points[0];
  const last = points.at(-1);
  return Boolean(
    closed &&
      first &&
      last &&
      distanceToSegment(point, last, first) <= tolerance,
  );
}

function polygonContains(point: PcbXY, points: readonly PcbXY[]): boolean {
  let inside = false;
  for (let i = 0, j = points.length - 1; i < points.length; j = i, i += 1) {
    const a = points[j];
    const b = points[i];
    if (
      a &&
      b &&
      a[1] > point[1] !== b[1] > point[1] &&
      point[0] < ((b[0] - a[0]) * (point[1] - a[1])) / (b[1] - a[1]) + a[0]
    )
      inside = !inside;
  }
  return inside;
}

function pointInRect(point: PcbXY, start: PcbXY, end: PcbXY): boolean {
  return (
    point[0] >= Math.min(start[0], end[0]) &&
    point[0] <= Math.max(start[0], end[0]) &&
    point[1] >= Math.min(start[1], end[1]) &&
    point[1] <= Math.max(start[1], end[1])
  );
}

function angleHalf(vector: PcbXY): number {
  return vector[1] > 0 || (vector[1] === 0 && vector[0] >= 0) ? 0 : 1;
}

function angleCompare(a: PcbXY, b: PcbXY): number {
  const halfDifference = angleHalf(a) - angleHalf(b);
  if (halfDifference !== 0) return halfDifference;
  const cross = a[0] * b[1] - a[1] * b[0];
  return cross > 0 ? -1 : cross < 0 ? 1 : 0;
}

function angleIncreasingBetween(
  start: PcbXY,
  end: PcbXY,
  value: PcbXY,
): boolean {
  const startEnd = angleCompare(start, end);
  const startValue = angleCompare(start, value);
  const valueEnd = angleCompare(value, end);
  return startEnd <= 0
    ? startValue <= 0 && valueEnd <= 0
    : startValue <= 0 || valueEnd <= 0;
}

function pointToArcDistance(
  point: PcbXY,
  start: PcbXY,
  mid: PcbXY,
  end: PcbXY,
): number {
  const center = arcCenter(start, mid, end);
  if (!center)
    return Math.min(
      distanceToSegment(point, start, mid),
      distanceToSegment(point, mid, end),
    );
  const vectorFromCenter = ([x, y]: PcbXY): PcbXY => [
    x - center[0],
    y - center[1],
  ];
  const startVector = vectorFromCenter(start);
  const endVector = vectorFromCenter(end);
  const pointVector = vectorFromCenter(point);
  const pointRadius = Math.sqrt(
    pointVector[0] * pointVector[0] + pointVector[1] * pointVector[1],
  );
  if (pointRadius === 0)
    return Math.min(
      distanceToSegment(point, start, mid),
      distanceToSegment(point, mid, end),
    );
  const clockwise = arcIsClockwise(start, mid, end);
  const onSweep = clockwise
    ? angleIncreasingBetween(startVector, endVector, pointVector)
    : angleIncreasingBetween(endVector, startVector, pointVector);
  if (onSweep) {
    const startRadius = Math.sqrt(
      startVector[0] * startVector[0] + startVector[1] * startVector[1],
    );
    return Math.abs(pointRadius - startRadius);
  }
  const startDx = point[0] - start[0];
  const startDy = point[1] - start[1];
  const endDx = point[0] - end[0];
  const endDy = point[1] - end[1];
  return Math.min(
    Math.sqrt(startDx * startDx + startDy * startDy),
    Math.sqrt(endDx * endDx + endDy * endDy),
  );
}

function graphicHit(graphic: PcbGraphicSemantic, point: PcbXY): boolean {
  const tolerance = Math.max(graphic.width / 2, HIT_RADIUS_MM);
  const shape = graphic.shape;
  switch (shape.kind) {
    case "line":
      return distanceToSegment(point, shape.start, shape.end) <= tolerance;
    case "arc":
      return (
        pointToArcDistance(point, shape.start, shape.mid, shape.end) <=
        tolerance
      );
    case "circle": {
      const dx = point[0] - shape.center[0];
      const dy = point[1] - shape.center[1];
      const distance = Math.sqrt(dx * dx + dy * dy);
      return graphic.fill
        ? distance <= shape.radius + tolerance
        : Math.abs(distance - shape.radius) <= tolerance;
    }
    case "rect": {
      if (graphic.fill && pointInRect(point, shape.start, shape.end))
        return true;
      return nearSegments(
        point,
        [
          shape.start,
          [shape.end[0], shape.start[1]],
          shape.end,
          [shape.start[0], shape.end[1]],
        ],
        tolerance,
        true,
      );
    }
    case "polygon":
      return (
        (graphic.fill && polygonContains(point, shape.points)) ||
        nearSegments(point, shape.points, tolerance, true)
      );
    case "text": {
      const box = shapeBounds(shape, graphic.width);
      return pointInRect(point, [box.minX, box.minY], [box.maxX, box.maxY]);
    }
  }
}

function hitTest(
  type: PcbElementType,
  element: Element,
  pagePoint: Vec,
): boolean {
  const point: PcbXY = [
    pagePoint.x / PCB_PAGE_SCALE,
    pagePoint.y / PCB_PAGE_SCALE,
  ];
  switch (type) {
    case "pcb.board":
      return false;
    case "pcb.footprint": {
      const bounds = boundsFor(type, element);
      return bounds !== null && boxContains(bounds, pagePoint);
    }
    case "pcb.track": {
      const track = semantic<PcbTrackSemantic>(element);
      const points = trackPath(track);
      return nearSegments(
        point,
        points,
        Math.max(track.width / 2, HIT_RADIUS_MM),
      );
    }
    case "pcb.via": {
      const via = semantic<{ at: PcbXY; diameter: number }>(element);
      const dx = point[0] - via.at[0];
      const dy = point[1] - via.at[1];
      return dx * dx + dy * dy <= (via.diameter / 2) ** 2;
    }
    case "pcb.zone":
      return nearSegments(
        point,
        semantic<PcbZoneSemantic>(element).outline,
        0.25,
        true,
      );
    case "pcb.graphic":
      return graphicHit(semantic<PcbGraphicSemantic>(element), point);
  }
}

function defaultSemantic(type: PcbElementType): unknown {
  switch (type) {
    case "pcb.board":
      return {
        format: "kicad_pcb",
        source: "",
        version: 20240108,
        generator: "",
        maskExpansion: 0,
        layers: [],
        nets: [],
      };
    case "pcb.footprint":
      return {
        reference: "",
        value: "",
        library: "",
        at: [0, 0],
        rotation: 0,
        side: "top",
        pads: [],
        graphics: [],
      };
    case "pcb.track":
      return {
        layer: "F.Cu",
        width: 0.25,
        net: "",
        points: [
          [0, 0],
          [1, 0],
        ],
      };
    case "pcb.via":
      return {
        at: [0, 0],
        diameter: 0.6,
        drill: 0.3,
        layers: ["F.Cu", "B.Cu"],
        net: "",
      };
    case "pcb.zone":
      return {
        layers: ["F.Cu"],
        net: "",
        outline: [
          [0, 0],
          [1, 0],
          [0, 1],
        ],
        filled: [],
      };
    case "pcb.graphic":
      return {
        layer: "Edge.Cuts",
        width: 0.05,
        fill: false,
        shape: { kind: "line", start: [0, 0], end: [1, 0] },
      };
  }
}

export const pcbShapeUtils: readonly ShapeUtil[] = PCB_ELEMENT_TYPES.map(
  (type): ShapeUtil => ({
    type,
    canResize: false,
    getBounds(element) {
      return boundsFor(type, element);
    },
    hitTest(element, point) {
      return hitTest(type, element, point);
    },
    defaultSemantic() {
      return defaultSemantic(type);
    },
    defaultVisual() {
      return {};
    },
  }),
);
