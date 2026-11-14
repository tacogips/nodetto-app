// Vertex style entries: paint, text and transform keys plus the draw.io
// shape reproducing each geo kind.

import type { Element, FillGradient, GeoKind, VisualStyle } from "@nodetto/ir";
import { type Box, type Entry, round } from "./export-common.ts";

function gradientDirection(gradient: FillGradient): string {
  if (gradient.type !== "linear") return "south";
  const quarter = Math.round((((gradient.angle % 360) + 360) % 360) / 90) % 4;
  return ["north", "east", "south", "west"][quarter] ?? "south";
}

/** Paint, text and transform entries shared by every vertex. */
export function paintEntries(visual: Element["visual"]): Entry[] {
  const style: VisualStyle = visual.style ?? {};
  const gradient = style.fillGradient;
  const stops = gradient?.stops ?? [];
  const fontStyle =
    ((style.fontWeight ?? 400) >= 600 ? 1 : 0) +
    (style.fontStyle === "italic" ? 2 : 0) +
    (style.textDecoration?.includes("underline") ? 4 : 0) +
    (style.textDecoration?.includes("line-through") ? 8 : 0);
  const dashArray =
    style.strokeDashArray && style.strokeDashArray.length > 0
      ? style.strokeDashArray.join(" ")
      : style.dash === "dotted"
        ? "1 4"
        : undefined;
  const shadow =
    style.shadow !== undefined ||
    (style.effects ?? []).some(
      (effect) => effect.type === "drop-shadow" && effect.enabled !== false,
    );
  return [
    ["fillColor", stops[0]?.color ?? style.fill],
    ...(gradient && stops.length > 1
      ? ([
          ["gradientColor", stops.at(-1)?.color],
          ["gradientDirection", gradientDirection(gradient)],
        ] as Entry[])
      : []),
    ["strokeColor", style.stroke],
    ["strokeWidth", style.strokeWidth],
    ...(style.dash === "dashed" || style.dash === "dotted" || dashArray
      ? ([
          ["dashed", 1],
          ["dashPattern", dashArray],
        ] as Entry[])
      : []),
    [
      "opacity",
      style.opacity === undefined ? undefined : round(style.opacity * 100),
    ],
    ["fontColor", style.color],
    ["fontSize", style.fontSize],
    ["fontFamily", style.fontFamily],
    ["fontStyle", fontStyle || undefined],
    [
      "align",
      style.textAlign === "start"
        ? "left"
        : style.textAlign === "end"
          ? "right"
          : undefined,
    ],
    [
      "verticalAlign",
      style.verticalAlign === "middle" ? undefined : style.verticalAlign,
    ],
    ["shadow", shadow ? 1 : undefined],
    ["rotation", visual.rotation ? round(visual.rotation) : undefined],
  ];
}

/** Normalized polygon coordinates of a regular outline for draw.io. */
function polyCoords(points: readonly (readonly [number, number])[]): string {
  return `[${points.map(([x, y]) => `[${round(x)},${round(y)}]`).join(",")}]`;
}

function starCoords(): string {
  return polyCoords(
    Array.from({ length: 10 }, (_, index) => {
      const angle = (Math.PI / 5) * index - Math.PI / 2;
      const scale = index % 2 === 0 ? 0.5 : 0.2;
      return [0.5 + Math.cos(angle) * scale, 0.5 + Math.sin(angle) * scale];
    }),
  );
}

/** Named styles and shape entries reproducing one geo kind in draw.io. */
export function geoStyle(
  geo: GeoKind,
  box: Box,
  visual: Element["visual"],
): { names: string[]; entries: Entry[] } {
  const short = Math.min(box.width, box.height);
  const flipX = visual.flipX === true;
  const flipY = visual.flipY === true;
  const flips: Entry[] = [
    ["flipH", flipX ? 1 : undefined],
    ["flipV", flipY ? 1 : undefined],
  ];
  const shape = (
    name: string,
    entries: Entry[] = [],
    flipped: Entry[] = flips,
  ): { names: string[]; entries: Entry[] } => ({
    names: [],
    entries: [["shape", name], ...entries, ...flipped],
  });
  const polygon = (coords: string) =>
    shape("mxgraph.basic.polygon", [
      ["polyCoords", coords],
      ["polyline", 0],
    ]);
  switch (geo) {
    case "rect": {
      const radius =
        visual.style?.cornerRadius ?? visual.style?.cornerRadii?.topLeft ?? 0;
      return {
        names: [],
        entries: [
          ...(radius > 0
            ? ([
                ["rounded", 1],
                ["absoluteArcSize", 1],
                ["arcSize", round(radius * 2)],
              ] as Entry[])
            : ([["rounded", 0]] as Entry[])),
          ...flips,
        ],
      };
    }
    // Symmetric outlines: flips change nothing visible but round-trip.
    case "ellipse":
      return { names: ["ellipse"], entries: flips };
    case "diamond":
      return { names: ["rhombus"], entries: flips };
    case "triangle":
      return {
        names: ["triangle"],
        entries: [
          ["direction", flipY ? "south" : "north"],
          ["flipH", flipX ? 1 : undefined],
        ],
      };
    case "hexagon":
      return shape("hexagon", [
        ["perimeter", "hexagonPerimeter2"],
        ["fixedSize", 0],
        ["size", 0.25],
      ]);
    case "parallelogram":
      return shape("parallelogram", [
        ["perimeter", "parallelogramPerimeter"],
        ["fixedSize", 0],
        ["size", 0.25],
      ]);
    case "cylinder":
      // nodetto never mirrors a cylinder; draw.io would turn it upside down.
      return shape(
        "cylinder3",
        [
          ["boundedLbl", 1],
          ["backgroundOutline", 1],
          ["size", round(Math.min(box.height * 0.15, 18))],
        ],
        [],
      );
    case "star":
      return polygon(starCoords());
    case "trapezoid":
      return shape("trapezoid", [
        ["perimeter", "trapezoidPerimeter"],
        ["fixedSize", 0],
        ["size", 0.2],
      ]);
    case "pentagon":
      return polygon(
        polyCoords([
          [0.5, 0],
          [1, 0.38],
          [0.81, 1],
          [0.19, 1],
          [0, 0.38],
        ]),
      );
    case "octagon": {
      const cx = (short * 0.29) / box.width;
      const cy = (short * 0.29) / box.height;
      return polygon(
        polyCoords([
          [cx, 0],
          [1 - cx, 0],
          [1, cy],
          [1, 1 - cy],
          [1 - cx, 1],
          [cx, 1],
          [0, 1 - cy],
          [0, cy],
        ]),
      );
    }
    case "cross":
      return polygon(
        polyCoords([
          [0.33, 0],
          [0.67, 0],
          [0.67, 0.33],
          [1, 0.33],
          [1, 0.67],
          [0.67, 0.67],
          [0.67, 1],
          [0.33, 1],
          [0.33, 0.67],
          [0, 0.67],
          [0, 0.33],
          [0.33, 0.33],
        ]),
      );
    case "arrow":
      return shape(
        "singleArrow",
        [
          ["arrowWidth", 0.4],
          [
            "arrowSize",
            round(Math.min(box.width * 0.4, box.height) / box.width),
          ],
          ["direction", flipX ? "west" : undefined],
        ],
        [],
      );
    case "chevron":
      return shape(
        "step",
        [
          ["perimeter", "stepPerimeter"],
          ["fixedSize", 1],
          ["size", round(Math.min(box.width * 0.25, box.height / 2))],
          ["direction", flipX ? "west" : undefined],
        ],
        [],
      );
    case "cloud":
      return { names: ["ellipse"], entries: [["shape", "cloud"], ...flips] };
    case "callout":
      return shape("callout", [
        ["perimeter", "calloutPerimeter"],
        ["size", round(box.height * 0.25)],
        ["position", 0.3],
        ["position2", 0.25],
        ["base", round(box.width * 0.15)],
      ]);
    case "note":
      return shape("note", [["size", round(Math.min(short * 0.2, 24))]]);
    case "cube":
      return shape("cube", [["size", round(Math.min(short * 0.2, 24))]]);
    case "document": {
      const wave = Math.min(box.height * 0.1, 12);
      return shape("document", [["size", round((wave * 2) / box.height)]]);
    }
    case "manual-input":
      return shape("manualInput", [["size", round(box.height * 0.3)]]);
    case "delay":
      return shape("delay");
    case "predefined-process":
      return shape("process", [
        ["size", round(Math.min(box.width * 0.1, 14) / box.width)],
      ]);
    case "internal-storage": {
      const inset = round(Math.min(short * 0.2, 16));
      return shape("internalStorage", [
        ["dx", inset],
        ["dy", inset],
      ]);
    }
    case "off-page":
      return shape("offPageConnector", [["size", 0.4]]);
    case "card":
      return shape("card", [["size", round(Math.min(short * 0.25, 24))]]);
    case "tape":
      // draw.io's quadratic wave peaks at 0.45 of its `size` band.
      return shape("tape", [
        ["size", round(Math.min(box.height * 0.09, 10) / 0.45 / box.height)],
      ]);
    case "stored-data":
      return shape("dataStorage", [
        ["fixedSize", 1],
        ["size", round(Math.min(box.width * 0.15, 20))],
      ]);
    case "display":
      return shape("display", [
        ["size", round(Math.min(box.width * 0.25, box.height) / box.width)],
      ]);
    case "loop-limit":
      return shape("loopLimit", [["size", round(Math.min(short * 0.25, 20))]]);
    case "collate":
      return shape("collate");
    case "sort":
      return shape("sortShape", [["perimeter", "rhombusPerimeter"]]);
    case "summing-junction":
      return shape("sumEllipse", [["perimeter", "ellipsePerimeter"]]);
    case "or":
      return shape("orEllipse", [["perimeter", "ellipsePerimeter"]]);
    case "multi-document":
      return shape("mxgraph.flowchart.multi-document", [["boundedLbl", 1]]);
    case "direct-data":
      return shape("mxgraph.flowchart.direct_data");
    case "sequential-data":
      return shape("tapeData", [["perimeter", "ellipsePerimeter"]]);
    case "double-arrow":
      return shape("doubleArrow", [
        ["arrowWidth", 0.4],
        [
          "arrowSize",
          round(
            Math.min(box.width * 0.3, box.height, box.width / 2) / box.width,
          ),
        ],
      ]);
    case "right-triangle":
      return shape("mxgraph.basic.orthogonal_triangle");
    case "person":
      return shape("actor");
  }
  return { names: [], entries: [["rounded", 0]] };
}
