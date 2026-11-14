import type {
  BreadboardBoardSemantic,
  BreadboardCapacitorSemantic,
  BreadboardIcSemantic,
  BreadboardLedSemantic,
  BreadboardNetlistSemantic,
  BreadboardPartSemantic,
  BreadboardResistorSemantic,
  BreadboardWireSemantic,
  Element,
} from "@nodetto/ir";
import { BREADBOARD_PITCH, isBreadboardPartType } from "@nodetto/ir";
import type { Box } from "../geometry.ts";
import { rotatePoint } from "../geometry.ts";
import type { NotationPrimitive } from "../bpmn/notation.ts";
import { boardLayout } from "./board.ts";
import { breadboardLocalBox, breadboardWirePoints } from "./catalogue.ts";
import { resistorBands } from "./resistor-bands.ts";

export type BreadboardPrimitive = NotationPrimitive & {
  readonly role: string;
  readonly opacity?: number;
};
export interface BreadboardNotation {
  readonly body: readonly BreadboardPrimitive[];
  readonly labels: readonly BreadboardPrimitive[];
}

export const BREADBOARD_COLORS: Readonly<Record<string, string>> = {
  board: "#d9cba5",
  boardEdge: "#a38d5d",
  hole: "#4a4335",
  ink: "#34434a",
  muted: "#667277",
  railPlus: "#d9473f",
  railMinus: "#426fbb",
  resistor: "#d9b77e",
  resistorFiveBand: "#c4d9e2",
  brown: "#805238",
  violet: "#75529a",
  grey: "#8d9293",
  gold: "#c49d38",
  silver: "#c6cbcc",
  lead: "#9a9b96",
  led: "#e0463d",
  capacitor: "#d9c45c",
  diode: "#d9d4c5",
  transistor: "#53636a",
  button: "#d8dadd",
  potentiometer: "#b8bdc0",
  ic: "#303940",
  header: "#2f3334",
  battery: "#e8e4d9",
  wireOutline: "#343a3d",
  red: "#d9473f",
  black: "#242a2d",
  blue: "#426fbb",
  green: "#3c8a5c",
  yellow: "#dbbd42",
  orange: "#dd873e",
  white: "#f5f3ec",
  gray: "#858c8d",
};

function rect(
  role: string,
  x: number,
  y: number,
  width: number,
  height: number,
  fill: string,
  stroke = BREADBOARD_COLORS.ink,
  strokeWidth = 1,
  rx?: number,
): BreadboardPrimitive {
  return {
    kind: "rect",
    role,
    x,
    y,
    width,
    height,
    fill,
    stroke,
    strokeWidth,
    ...(rx === undefined ? {} : { rx }),
  };
}
function circle(
  role: string,
  cx: number,
  cy: number,
  r: number,
  fill: string,
  stroke = BREADBOARD_COLORS.ink,
  strokeWidth = 1,
): BreadboardPrimitive {
  return { kind: "circle", role, cx, cy, r, fill, stroke, strokeWidth };
}
function path(
  role: string,
  d: string,
  stroke: string,
  fill = "none",
  strokeWidth = 1,
): BreadboardPrimitive {
  return { kind: "path", role, d, stroke, fill, strokeWidth };
}
function text(
  role: string,
  value: string,
  x: number,
  y: number,
  fill = BREADBOARD_COLORS.ink,
  fontSize = 7,
  anchor: "start" | "middle" = "middle",
  opacity?: number,
): BreadboardPrimitive {
  return {
    kind: "text",
    role,
    x,
    y,
    lines: [value],
    anchor,
    fontSize,
    lineHeight: fontSize + 1,
    fill,
    stroke: "none",
    ...(opacity === undefined ? {} : { opacity }),
  };
}
function localSemantic<T>(element: Element): T {
  return element.semantic as T;
}
function fromPartLocal(value: number, min: number): number {
  return (value - min) * BREADBOARD_PITCH;
}

function boardNotation(element: Element, box: Box): BreadboardPrimitive[] {
  const semantic = localSemantic<BreadboardBoardSemantic>(element);
  const size =
    semantic.size === "full" || semantic.size === "mini"
      ? semantic.size
      : "half";
  const layout = boardLayout(size);
  const body: BreadboardPrimitive[] = [
    rect(
      "board",
      0,
      0,
      box.width,
      box.height,
      BREADBOARD_COLORS.board,
      BREADBOARD_COLORS.boardEdge,
      2,
      7,
    ),
  ];
  if (layout.channelY) {
    body.push(
      rect(
        "board-channel",
        BREADBOARD_PITCH,
        layout.channelY.from * BREADBOARD_PITCH,
        (layout.width - 2) * BREADBOARD_PITCH,
        (layout.channelY.to - layout.channelY.from + 1) * BREADBOARD_PITCH,
        "#eee7d4",
        "none",
        0,
      ),
    );
  }
  for (const hole of layout.holes) {
    body.push(
      circle(
        "board-hole",
        hole.x * BREADBOARD_PITCH,
        hole.y * BREADBOARD_PITCH,
        1.65,
        BREADBOARD_COLORS.hole,
        "#81775f",
        0.45,
      ),
    );
  }
  if (size !== "mini") {
    for (const [y, role, color] of [
      [1, "rail-minus", BREADBOARD_COLORS.railMinus],
      [2, "rail-plus", BREADBOARD_COLORS.railPlus],
      [19, "rail-plus", BREADBOARD_COLORS.railPlus],
      [20, "rail-minus", BREADBOARD_COLORS.railMinus],
    ] as const) {
      body.push(
        path(
          role,
          `M ${2 * BREADBOARD_PITCH} ${y * BREADBOARD_PITCH} L ${(layout.width - 2) * BREADBOARD_PITCH} ${y * BREADBOARD_PITCH}`,
          color,
          "none",
          1.8,
        ),
      );
    }
  }
  for (const label of layout.labels) {
    body.push(
      text(
        "board-label",
        label.text,
        label.x * BREADBOARD_PITCH,
        label.y * BREADBOARD_PITCH,
        BREADBOARD_COLORS.muted,
        5,
      ),
    );
  }
  return body;
}

function partNotation(element: Element, box: Box): BreadboardPrimitive[] {
  const type = element.type;
  const semantic = localSemantic<BreadboardPartSemantic>(element);
  const local = breadboardLocalBox(
    type as Parameters<typeof breadboardLocalBox>[0],
    semantic,
  );
  const width = box.width;
  const height = box.height;
  const centerX = width / 2;
  const centerY = height / 2;
  const body: BreadboardPrimitive[] = [];
  const pinX = (dx: number) => fromPartLocal(dx, local.x);

  switch (type) {
    case "breadboard.resistor": {
      const resistor = semantic as BreadboardResistorSemantic;
      const left = pinX(0);
      const right = pinX(resistor.span);
      const middle = (left + right) / 2;
      const bodyWidth = Math.min(28, Math.max(12, right - left - 8));
      const fill =
        resistor.bands === 5
          ? BREADBOARD_COLORS.resistorFiveBand
          : BREADBOARD_COLORS.resistor;
      body.push(
        path(
          "resistor-leads",
          `M ${left} ${centerY} L ${middle - bodyWidth / 2} ${centerY} M ${middle + bodyWidth / 2} ${centerY} L ${right} ${centerY}`,
          BREADBOARD_COLORS.lead,
          "none",
          1.6,
        ),
        rect(
          "resistor-body",
          middle - bodyWidth / 2,
          centerY - 5,
          bodyWidth,
          10,
          fill,
          "#76654c",
          1,
          4,
        ),
      );
      const colors = resistorBands(
        resistor.value,
        resistor.bands,
        resistor.tolerance,
      );
      colors?.forEach((color, index) => {
        const x =
          middle -
          bodyWidth / 2 +
          3 +
          index * ((bodyWidth - 6) / Math.max(1, colors.length - 1));
        body.push(
          rect(
            `resistor-band-${index + 1}`,
            x,
            centerY - 5,
            2.2,
            10,
            BREADBOARD_COLORS[color] ?? color,
            "none",
            0,
          ),
        );
      });
      return body;
    }
    case "breadboard.led": {
      const led = semantic as BreadboardLedSemantic;
      const left = pinX(0);
      const right = pinX(1);
      body.push(
        path(
          "led-leads",
          `M ${left} ${centerY} L ${centerX - 5} ${centerY} M ${centerX + 5} ${centerY} L ${right} ${centerY}`,
          BREADBOARD_COLORS.lead,
          "none",
          1.5,
        ),
        circle(
          "led-dome",
          centerX,
          centerY,
          Math.max(6, Math.min(width, height) * 0.32),
          BREADBOARD_COLORS[led.color] ?? BREADBOARD_COLORS.led,
          "#853b38",
          1,
        ),
        path(
          "led-flat",
          `M ${centerX + 3} ${centerY - 5} L ${centerX + 3} ${centerY + 5}`,
          "#7b2928",
          "none",
          1.5,
        ),
      );
      return body;
    }
    case "breadboard.capacitor": {
      const cap = semantic as BreadboardCapacitorSemantic;
      if (cap.style === "electrolytic") {
        body.push(
          path(
            "capacitor-leads",
            `M ${pinX(0)} ${centerY} L ${centerX - 5} ${centerY} M ${centerX + 5} ${centerY} L ${pinX(cap.span)} ${centerY}`,
            BREADBOARD_COLORS.lead,
            "none",
            1.5,
          ),
          rect(
            "capacitor-can",
            centerX - 6,
            centerY - 9,
            12,
            18,
            "#56636a",
            "#354047",
            1,
            3,
          ),
          rect(
            "cap-minus-stripe",
            centerX + 3,
            centerY - 8,
            2,
            16,
            "#e9e5d9",
            "none",
            0,
          ),
        );
      } else {
        body.push(
          path(
            "capacitor-leads",
            `M ${pinX(0)} ${centerY} L ${centerX - 5} ${centerY} M ${centerX + 5} ${centerY} L ${pinX(cap.span)} ${centerY}`,
            BREADBOARD_COLORS.lead,
            "none",
            1.5,
          ),
          circle(
            "capacitor-disc",
            centerX,
            centerY,
            6,
            BREADBOARD_COLORS.capacitor,
            "#776d3d",
            1,
          ),
        );
      }
      return body;
    }
    case "breadboard.diode": {
      const middle = centerX;
      body.push(
        path(
          "diode-leads",
          `M ${pinX(0)} ${centerY} L ${middle - 6} ${centerY} M ${middle + 6} ${centerY} L ${pinX((semantic as { span: number }).span)} ${centerY}`,
          BREADBOARD_COLORS.lead,
          "none",
          1.5,
        ),
        path(
          "diode-body",
          `M ${middle - 6} ${centerY - 5} L ${middle + 3} ${centerY} L ${middle - 6} ${centerY + 5} Z`,
          BREADBOARD_COLORS.ink,
          BREADBOARD_COLORS.diode,
          1,
        ),
        path(
          "diode-band",
          `M ${middle + 3} ${centerY - 5} L ${middle + 3} ${centerY + 5}`,
          "#343b3e",
          "none",
          2,
        ),
      );
      return body;
    }
    case "breadboard.transistor":
      body.push(
        path(
          "transistor-leads",
          `M ${pinX(0)} ${height - 2} L ${centerX - 4} ${centerY + 3} M ${pinX(1)} ${height - 2} L ${centerX} ${centerY + 4} M ${pinX(2)} ${height - 2} L ${centerX + 4} ${centerY + 3}`,
          BREADBOARD_COLORS.lead,
          "none",
          1.4,
        ),
        path(
          "transistor-body",
          `M ${centerX - 8} ${centerY + 2} A 10 10 0 0 1 ${centerX + 8} ${centerY + 2} L ${centerX + 7} ${centerY - 5} L ${centerX - 7} ${centerY - 5} Z`,
          BREADBOARD_COLORS.ink,
          BREADBOARD_COLORS.transistor,
          1,
        ),
      );
      return body;
    case "breadboard.button":
      body.push(
        rect(
          "button-body",
          centerX - 11,
          centerY - 8,
          22,
          16,
          BREADBOARD_COLORS.button,
          "#697277",
          1,
          3,
        ),
        circle("button-cap", centerX, centerY, 4.5, "#727b80", "#4b555a", 1),
      );
      return body;
    case "breadboard.potentiometer":
      body.push(
        rect(
          "potentiometer-body",
          centerX - 11,
          centerY - 8,
          22,
          16,
          BREADBOARD_COLORS.potentiometer,
          "#687277",
          1,
          3,
        ),
        circle(
          "potentiometer-knob",
          centerX,
          centerY - 1,
          4,
          "#e7e9e7",
          "#59666b",
          1,
        ),
        path(
          "potentiometer-wiper",
          `M ${centerX} ${centerY - 1} L ${centerX + 2} ${centerY - 5}`,
          BREADBOARD_COLORS.ink,
          "none",
          1.2,
        ),
      );
      return body;
    case "breadboard.ic": {
      const count = (semantic as BreadboardIcSemantic).pinCount;
      const half = count / 2;
      const left = 4;
      const right = width - 4;
      const top = centerY - Math.max(10, (half - 1) * 5);
      const bottom = centerY + Math.max(10, (half - 1) * 5);
      body.push(
        rect(
          "ic-body",
          left,
          top,
          right - left,
          bottom - top,
          BREADBOARD_COLORS.ic,
          "#171d20",
          1.2,
          2,
        ),
      );
      body.push(
        path(
          "ic-notch",
          `M ${centerX - 5} ${top} A 5 4 0 0 0 ${centerX + 5} ${top}`,
          "#b6c0c3",
          "none",
          1.2,
        ),
      );
      body.push(
        circle("ic-pin1", left + 4, top + 4, 1.7, "#e9e5d9", "none", 0),
      );
      for (let index = 0; index < half; index += 1) {
        const y =
          top + 7 + index * ((bottom - top - 14) / Math.max(1, half - 1));
        body.push(
          path(
            "ic-leg",
            `M ${left} ${y} L 0 ${y} M ${right} ${y} L ${width} ${y}`,
            BREADBOARD_COLORS.lead,
            "none",
            1.4,
          ),
        );
      }
      body.push(
        text(
          "ic-value",
          String((semantic as { value: string }).value),
          centerX,
          centerY + 3,
          "#e8ecec",
          6,
        ),
      );
      body.push(
        text(
          "ic-reference",
          String((semantic as { reference: string }).reference),
          centerX,
          centerY - 4,
          "#e8ecec",
          6,
        ),
      );
      return body;
    }
    case "breadboard.header": {
      const count = (semantic as { pinCount: number }).pinCount;
      for (let index = 0; index < count; index += 1) {
        const x = 4 + (index * (width - 8)) / Math.max(1, count - 1);
        body.push(
          rect(
            "header-pin",
            x - 2.3,
            centerY - 3,
            4.6,
            6,
            BREADBOARD_COLORS.header,
            "#aeb4b4",
            0.6,
            0.6,
          ),
        );
      }
      return body;
    }
    case "breadboard.battery":
      body.push(
        rect(
          "battery-body",
          2,
          centerY - 7,
          width - 4,
          14,
          BREADBOARD_COLORS.battery,
          "#677176",
          1,
          2,
        ),
        text(
          "battery-plus",
          "+",
          6,
          centerY + 2,
          BREADBOARD_COLORS.railPlus,
          9,
        ),
        text(
          "battery-minus",
          "-",
          width - 6,
          centerY + 2,
          BREADBOARD_COLORS.railMinus,
          9,
        ),
      );
      return body;
  }
  return body;
}

function wireNotation(
  element: Element,
  box: Box,
  inert: boolean,
): BreadboardPrimitive[] {
  const semantic = localSemantic<BreadboardWireSemantic>(element);
  const points = breadboardWirePoints(element).map((point) => ({
    x: point.x - box.x,
    y: point.y - box.y,
  }));
  const first = points[0];
  const last = points.at(-1);
  if (!first || !last || points.length < 2) return [];
  const d = points
    .map((point, index) => `${index ? "L" : "M"} ${point.x} ${point.y}`)
    .join(" ");
  const color = BREADBOARD_COLORS[semantic.color] ?? BREADBOARD_COLORS.red;
  const opacity = inert ? 0.5 : undefined;
  return [
    {
      ...path(
        "wire-outline",
        d,
        BREADBOARD_COLORS.wireOutline,
        "none",
        BREADBOARD_PITCH * 0.58,
      ),
      ...(opacity === undefined ? {} : { opacity }),
    },
    {
      ...path("wire-color", d, color, "none", BREADBOARD_PITCH * 0.45),
      ...(opacity === undefined ? {} : { opacity }),
    },
    {
      ...rect(
        "wire-end",
        first.x - 2,
        first.y - 2,
        4,
        4,
        color,
        BREADBOARD_COLORS.wireOutline,
        0.6,
      ),
      ...(opacity === undefined ? {} : { opacity }),
    },
    {
      ...rect(
        "wire-end",
        last.x - 2,
        last.y - 2,
        4,
        4,
        color,
        BREADBOARD_COLORS.wireOutline,
        0.6,
      ),
      ...(opacity === undefined ? {} : { opacity }),
    },
  ];
}

function netlistNotation(
  semantic: BreadboardNetlistSemantic,
  box: Box,
  inert: boolean,
): BreadboardPrimitive[] {
  const opacity = inert ? 0.5 : undefined;
  return [
    {
      ...rect(
        "netlist-card",
        0,
        0,
        box.width,
        box.height,
        "#f5f6f3",
        "#65747a",
        1,
        4,
      ),
      ...(opacity === undefined ? {} : { opacity }),
    },
    text(
      "netlist-label",
      "Target netlist",
      box.width / 2,
      11,
      BREADBOARD_COLORS.ink,
      8,
      "middle",
      opacity,
    ),
    text(
      "netlist-label",
      semantic.source || "No source",
      box.width / 2,
      21,
      BREADBOARD_COLORS.muted,
      6,
      "middle",
      opacity,
    ),
    text(
      "netlist-label",
      `${semantic.parts.length} parts, ${semantic.nets.length} nets`,
      box.width / 2,
      31,
      BREADBOARD_COLORS.muted,
      6,
      "middle",
      opacity,
    ),
  ];
}

function labelForPart(element: Element, box: Box): BreadboardPrimitive[] {
  if (!isBreadboardPartType(element.type) || element.type === "breadboard.ic")
    return [];
  const semantic = element.semantic as BreadboardPartSemantic;
  const center = { x: box.width / 2, y: box.height / 2 };
  const anchor = rotatePoint(
    { x: center.x, y: -6 },
    center,
    element.visual.rotation ?? 0,
  );
  return [
    text(
      "breadboard-label",
      semantic.reference,
      anchor.x,
      anchor.y,
      BREADBOARD_COLORS.ink,
      7,
    ),
  ];
}

export function breadboardNotation(
  element: Element,
  box: Box,
  options: { readonly inert?: boolean } = {},
): BreadboardNotation {
  const inert = options.inert === true;
  let body: BreadboardPrimitive[];
  if (element.type === "breadboard.board") {
    body = boardNotation(element, box);
  } else if (element.type === "breadboard.wire") {
    body = wireNotation(element, box, inert);
  } else if (isBreadboardPartType(element.type)) {
    body = partNotation(element, box);
  } else if (element.type === "breadboard.netlist") {
    body = netlistNotation(
      element.semantic as BreadboardNetlistSemantic,
      box,
      inert,
    );
  } else {
    body = [];
  }
  return { body, labels: labelForPart(element, box) };
}

export function breadboardLabelBounds(
  notation: BreadboardNotation,
  box: Box,
): readonly Box[] {
  return notation.labels.flatMap((primitive) =>
    primitive.kind === "text"
      ? [
          {
            x: box.x + primitive.x - 45,
            y: box.y + primitive.y - primitive.fontSize,
            width: 90,
            height: primitive.lineHeight * primitive.lines.length,
          },
        ]
      : [],
  );
}
