import {
  SCHEMATIC_REFERENCE_PREFIX,
  isSchematicPartType,
  type Element,
  type SchematicPartType,
  type SchematicIcSemantic,
} from "@nodetto/ir";
import type { Box, Vec } from "../geometry.ts";

export type PinDirection = "left" | "right" | "up" | "down";
export interface SchematicPinDef {
  readonly number: number;
  readonly name: string;
  readonly offset: Vec;
  readonly direction: PinDirection;
}
export interface SchematicPagePin {
  readonly number: number;
  readonly name: string;
  readonly x: number;
  readonly y: number;
  readonly direction: PinDirection;
}
type RawPin = {
  number: number;
  name: string;
  x: number;
  y: number;
  direction: PinDirection;
};
type Shape = { pins: RawPin[]; body: Box };
const pin = (
  number: number,
  name: string,
  x: number,
  y: number,
  direction: PinDirection,
): RawPin => ({ number, name, x, y, direction });
function shape(element: Element): Shape | undefined {
  if (
    element.visual.hidden ||
    (!isSchematicPartType(element.type) && element.type !== "schematic.power")
  )
    return undefined;
  const s = element.semantic as Record<string, unknown>;
  const t = element.type;
  if (t === "schematic.ic") {
    const entries = (s.pins ?? []) as SchematicIcSemantic["pins"];
    const counts = { left: 0, right: 0, top: 0, bottom: 0 };
    for (const entry of entries) counts[entry.side]++;
    const w = Math.max(6, Math.max(counts.top, counts.bottom, 1) + 1);
    const h = Math.max(counts.left, counts.right, 1) + 1;
    const seen = { left: 0, right: 0, top: 0, bottom: 0 };
    const pins = entries.map((entry) => {
      const i = seen[entry.side]++;
      switch (entry.side) {
        case "left":
          return pin(entry.number, entry.name, -2, i + 1, "left");
        case "right":
          return pin(entry.number, entry.name, w + 2, h - 1 - i, "right");
        case "top":
          return pin(entry.number, entry.name, w - 1 - i, -2, "up");
        case "bottom":
          return pin(entry.number, entry.name, i + 1, h + 2, "down");
      }
    });
    return { pins, body: { x: 0, y: 0, width: w, height: h } };
  }
  if (t === "schematic.connector")
    return {
      pins: Array.from({ length: (s.pinCount as number) ?? 2 }, (_, i) =>
        pin(i + 1, String(i + 1), 0, i, "left"),
      ),
      body: {
        x: 0,
        y: 0,
        width: 3,
        height: Math.max(0, ((s.pinCount as number) ?? 2) - 1),
      },
    };
  if (t === "schematic.power")
    return {
      pins: [pin(1, "1", 0, 0, s.style === "rail" ? "down" : "up")],
      body: { x: -1, y: s.style === "rail" ? -2 : 0, width: 2, height: 2 },
    };
  if (t === "schematic.bjt")
    return {
      pins: [
        pin(1, "E", 0, 0, "down"),
        pin(2, "B", -3, -2, "left"),
        pin(3, "C", 0, -4, "up"),
      ],
      body: { x: -2, y: -4, width: 3, height: 4 },
    };
  if (t === "schematic.mosfet")
    return {
      pins: [
        pin(1, "G", 0, 0, "left"),
        pin(2, "D", 3, -2, "up"),
        pin(3, "S", 3, 2, "down"),
      ],
      body: { x: 0, y: -2, width: 4, height: 4 },
    };
  if (t === "schematic.potentiometer")
    return {
      pins: [
        pin(1, "1", 0, 0, "left"),
        pin(2, "W", 2, -2, "up"),
        pin(3, "3", 4, 0, "right"),
      ],
      body: { x: 0, y: -2, width: 4, height: 3 },
    };
  const polarized =
    t === "schematic.battery" ||
    t === "schematic.voltageSource" ||
    (t === "schematic.capacitor" && s.polarized);
  const diode = t === "schematic.diode" || t === "schematic.led";
  return {
    pins: [
      pin(1, polarized ? "+" : diode ? "A" : "1", 0, 0, "left"),
      pin(2, polarized ? "-" : diode ? "K" : "2", 4, 0, "right"),
    ],
    body: {
      x: 0,
      y:
        t === "schematic.led" ||
        (t === "schematic.switch" && s.style === "push")
          ? -2
          : -1,
      width: 4,
      height:
        t === "schematic.led" ||
        (t === "schematic.switch" && s.style === "push")
          ? 3
          : 2,
    },
  };
}
function geometry(
  element: Element,
): { pins: SchematicPinDef[]; box: Box } | undefined {
  const result = shape(element);
  if (!result || result.pins.length === 0) return undefined;
  let minX = result.body.x;
  let minY = result.body.y;
  let maxX = minX + result.body.width;
  let maxY = minY + result.body.height;
  for (const p of result.pins) {
    minX = Math.min(minX, p.x);
    minY = Math.min(minY, p.y);
    maxX = Math.max(maxX, p.x);
    maxY = Math.max(maxY, p.y);
  }
  minX -= 0.5;
  minY -= 0.5;
  maxX += 0.5;
  maxY += 0.5;
  return {
    box: { x: 0, y: 0, width: (maxX - minX) * 10, height: (maxY - minY) * 10 },
    pins: result.pins.map((p) => ({
      number: p.number,
      name: p.name,
      direction: p.direction,
      offset: { x: (p.x - minX) * 10, y: (p.y - minY) * 10 },
    })),
  };
}
export function schematicPinDefs(element: Element): readonly SchematicPinDef[] {
  return geometry(element)?.pins ?? [];
}
export function schematicLocalBox(element: Element): Box {
  return geometry(element)?.box ?? { x: 0, y: 0, width: 0, height: 0 };
}
function turns(element: Element): number {
  return ((((element.visual.rotation ?? 0) / 90) % 4) + 4) % 4;
}
export function schematicBox(element: Element): Box | undefined {
  const g = geometry(element);
  if (!g) return undefined;
  const { width, height } = g.box;
  const odd = turns(element) % 2 === 1;
  return {
    x: (element.visual.x ?? 0) + (odd ? (width - height) / 2 : 0),
    y: (element.visual.y ?? 0) + (odd ? (height - width) / 2 : 0),
    width: odd ? height : width,
    height: odd ? width : height,
  };
}
export function schematicPins(element: Element): readonly SchematicPagePin[] {
  const g = geometry(element);
  if (!g) return [];
  const { width, height } = g.box;
  const n = turns(element);
  const directions: PinDirection[] = ["right", "down", "left", "up"];
  return g.pins.map((p) => {
    let x =
      (element.visual.flipX ? width - p.offset.x : p.offset.x) - width / 2;
    let y = p.offset.y - height / 2;
    for (let i = 0; i < n; i++) [x, y] = [-y, x];
    let direction = p.direction;
    if (element.visual.flipX)
      direction =
        direction === "left"
          ? "right"
          : direction === "right"
            ? "left"
            : direction;
    return {
      number: p.number,
      name: p.name,
      x: x + width / 2 + (element.visual.x ?? 0),
      y: y + height / 2 + (element.visual.y ?? 0),
      direction:
        directions[(directions.indexOf(direction) + n) % 4] ?? direction,
    };
  });
}
export function schematicAnchorPin(
  element: Element,
): SchematicPagePin | undefined {
  return schematicPins(element)[0];
}
const values: Record<SchematicPartType, string> = {
  "schematic.resistor": "10k",
  "schematic.capacitor": "100n",
  "schematic.inductor": "10u",
  "schematic.diode": "1N4148",
  "schematic.led": "LED",
  "schematic.bjt": "NPN",
  "schematic.mosfet": "NMOS",
  "schematic.switch": "SW",
  "schematic.potentiometer": "10k",
  "schematic.battery": "9V",
  "schematic.voltageSource": "5V",
  "schematic.connector": "CONN",
  "schematic.ic": "IC",
};
export function schematicDefaultSemantic(
  type: SchematicPartType | "schematic.power",
  patch: object = {},
): object {
  if (type === "schematic.power")
    return { style: "ground", net: "GND", ...patch };
  const extra: Partial<Record<SchematicPartType, object>> = {
    "schematic.capacitor": { polarized: false },
    "schematic.bjt": { polarity: "npn" },
    "schematic.mosfet": { channel: "n" },
    "schematic.switch": { style: "toggle" },
    "schematic.connector": { pinCount: 2 },
    "schematic.ic": {
      pins: Array.from({ length: 8 }, (_, i) => ({
        number: i + 1,
        name: "",
        side: i < 4 ? "left" : "right",
      })),
    },
  };
  return {
    reference: `${SCHEMATIC_REFERENCE_PREFIX[type]}?`,
    value: values[type],
    ...extra[type],
    ...patch,
  };
}
export function schematicPartName(element: Element): string {
  const s = element.semantic as Record<string, unknown>;
  switch (element.type) {
    case "schematic.resistor":
      return "Resistor";
    case "schematic.capacitor":
      return s.polarized ? "CapacitorPolarized" : "Capacitor";
    case "schematic.inductor":
      return "Inductor";
    case "schematic.diode":
      return "Diode";
    case "schematic.led":
      return "LED";
    case "schematic.bjt":
      return s.polarity === "pnp" ? "TransistorPNP" : "TransistorNPN";
    case "schematic.mosfet":
      return s.channel === "p" ? "MOSFET_P" : "MOSFET_N";
    case "schematic.switch":
      return "SW_Push";
    case "schematic.potentiometer":
      return "Potentiometer";
    case "schematic.battery":
      return "Battery";
    case "schematic.voltageSource":
      return "VoltageSource";
    case "schematic.connector":
      return "Header";
    case "schematic.ic": {
      const pins = (s.pins ?? []) as SchematicIcSemantic["pins"];
      const numbers = new Set(pins.map((p) => p.number));
      const dense =
        pins.length <= 40 &&
        pins.every((p) => p.number >= 1 && p.number <= pins.length) &&
        numbers.size === pins.length;
      return dense
        ? pins.length >= 4 && pins.length % 2 === 0
          ? "DIP"
          : "Header"
        : "IC_Generic";
    }
    default:
      return "";
  }
}
export function schematicDescription(element: Element): string {
  const s = element.semantic as Record<string, unknown>;
  switch (element.type) {
    case "schematic.capacitor":
      return s.polarized ? "Capacitor polarized" : "Capacitor";
    case "schematic.bjt":
      return `BJT ${String(s.polarity ?? "npn").toUpperCase()}`;
    case "schematic.mosfet":
      return `MOSFET ${String(s.channel ?? "n").toUpperCase()}`;
    case "schematic.connector":
      return `Connector 1x${s.pinCount}`;
    case "schematic.ic":
      return `IC ${((s.pins ?? []) as unknown[]).length} pins`;
    case "schematic.power":
      return s.style === "rail" ? "Power rail" : "Ground";
    default:
      return schematicPartName(element);
  }
}
