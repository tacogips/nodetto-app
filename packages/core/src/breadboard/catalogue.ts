import {
  BREADBOARD_PART_TYPES,
  BREADBOARD_PITCH,
  type BreadboardElementType,
  type BreadboardCapacitorSemantic,
  type BreadboardDiodeSemantic,
  type BreadboardHeaderSemantic,
  type BreadboardIcSemantic,
  type BreadboardLedSemantic,
  type BreadboardPartSemantic,
  type BreadboardPartType,
  type BreadboardResistorSemantic,
  type BreadboardTransistorSemantic,
} from "@nodetto/ir";
import type { Element } from "@nodetto/ir";
import type { Box, Vec } from "../geometry.ts";
import { boxCenter, rotatePoint } from "../geometry.ts";
import { boardLayout } from "./board.ts";

export interface BreadboardPinDef {
  readonly number: number;
  readonly name: string;
  readonly dx: number;
  readonly dy: number;
}

export interface BreadboardPagePin {
  readonly number: number;
  readonly name: string;
  readonly x: number;
  readonly y: number;
}

export const NETLIST_CARD_SIZE = { width: 16, height: 4 } as const;

const PART_NAMES: Readonly<Record<BreadboardPartType, string>> = {
  "breadboard.resistor": "Resistor",
  "breadboard.led": "LED",
  "breadboard.capacitor": "Capacitor",
  "breadboard.diode": "Diode",
  "breadboard.transistor": "Transistor",
  "breadboard.button": "PushButton",
  "breadboard.potentiometer": "Potentiometer",
  "breadboard.ic": "DIP",
  "breadboard.header": "Header",
  "breadboard.battery": "Battery",
};

function roundNoise(value: number): number {
  return Math.round(value * 1_000_000) / 1_000_000;
}

function pin(
  number: number,
  name: string,
  dx: number,
  dy = 0,
): BreadboardPinDef {
  return { number, name, dx, dy };
}

export function breadboardPinDefs(
  type: BreadboardPartType,
  semantic: BreadboardPartSemantic,
): readonly BreadboardPinDef[] {
  switch (type) {
    case "breadboard.resistor":
      return [
        pin(1, "1", 0),
        pin(2, "2", (semantic as BreadboardResistorSemantic).span),
      ];
    case "breadboard.led":
      return [pin(1, "A", 0), pin(2, "K", 1)];
    case "breadboard.capacitor":
      return (semantic as BreadboardCapacitorSemantic).style === "electrolytic"
        ? [
            pin(1, "+", 0),
            pin(2, "-", (semantic as BreadboardCapacitorSemantic).span),
          ]
        : [
            pin(1, "1", 0),
            pin(2, "2", (semantic as BreadboardCapacitorSemantic).span),
          ];
    case "breadboard.diode":
      return [
        pin(1, "A", 0),
        pin(2, "K", (semantic as BreadboardDiodeSemantic).span),
      ];
    case "breadboard.transistor":
      return [...(semantic as BreadboardTransistorSemantic).pinout].map(
        (name, index) => pin(index + 1, name, index),
      );
    case "breadboard.button":
      return [
        pin(1, "1", 0),
        pin(2, "2", 0, 3),
        pin(3, "3", 2),
        pin(4, "4", 2, 3),
      ];
    case "breadboard.potentiometer":
      return [pin(1, "1", 0), pin(2, "W", 1), pin(3, "3", 2)];
    case "breadboard.ic": {
      const pinCount = (semantic as BreadboardIcSemantic).pinCount;
      const half = pinCount / 2;
      return Array.from({ length: pinCount }, (_, index) => {
        const number = index + 1;
        return number <= half
          ? pin(number, String(number), number - 1)
          : pin(number, String(number), pinCount - number, -3);
      });
    }
    case "breadboard.header":
      return Array.from(
        { length: (semantic as BreadboardHeaderSemantic).pinCount },
        (_, index) => pin(index + 1, String(index + 1), index),
      );
    case "breadboard.battery":
      return [pin(1, "+", 0), pin(2, "-", 0, -1)];
  }
}

function bodyExtent(
  type: BreadboardPartType,
  semantic: BreadboardPartSemantic,
): Box {
  switch (type) {
    case "breadboard.led":
      return { x: 0, y: -1, width: 1, height: 2 };
    case "breadboard.capacitor":
      return (semantic as BreadboardCapacitorSemantic).style === "electrolytic"
        ? {
            x: (semantic as BreadboardCapacitorSemantic).span / 2 - 1,
            y: -1,
            width: 2,
            height: 2,
          }
        : { x: 0, y: 0, width: 0, height: 0 };
    case "breadboard.transistor":
      return { x: 0, y: -1, width: 2, height: 1.5 };
    case "breadboard.potentiometer":
      return { x: 0, y: -2, width: 2, height: 2.5 };
    case "breadboard.battery":
      return { x: -3, y: -1, width: 3, height: 1 };
    default:
      return { x: 0, y: 0, width: 0, height: 0 };
  }
}

export function breadboardLocalBox(
  type: BreadboardPartType,
  semantic: BreadboardPartSemantic,
): Box {
  const pins = breadboardPinDefs(type, semantic);
  const xs = pins.map(({ dx }) => dx);
  const ys = pins.map(({ dy }) => dy);
  const pinBox = {
    x: Math.min(...xs) - 0.5,
    y: Math.min(...ys) - 0.5,
    width: Math.max(...xs) - Math.min(...xs) + 1,
    height: Math.max(...ys) - Math.min(...ys) + 1,
  };
  const body = bodyExtent(type, semantic);
  const x = Math.min(pinBox.x, body.x);
  const y = Math.min(pinBox.y, body.y);
  return {
    x,
    y,
    width: Math.max(pinBox.x + pinBox.width, body.x + body.width) - x,
    height: Math.max(pinBox.y + pinBox.height, body.y + body.height) - y,
  };
}

function partSemantic(element: Element): BreadboardPartSemantic {
  return element.semantic as BreadboardPartSemantic;
}

function boardSize(element: Element): "full" | "half" | "mini" {
  const size = (element.semantic as { size?: string }).size;
  return size === "full" || size === "mini" ? size : "half";
}

export function breadboardBox(element: Element): Box | undefined {
  if (BREADBOARD_PART_TYPES.includes(element.type as BreadboardPartType)) {
    const local = breadboardLocalBox(
      element.type as BreadboardPartType,
      partSemantic(element),
    );
    return {
      x: element.visual.x ?? 0,
      y: element.visual.y ?? 0,
      width: local.width * BREADBOARD_PITCH,
      height: local.height * BREADBOARD_PITCH,
    };
  }
  if (element.type === "breadboard.board") {
    const layout = boardLayout(boardSize(element));
    return {
      x: element.visual.x ?? 0,
      y: element.visual.y ?? 0,
      width: layout.width * BREADBOARD_PITCH,
      height: layout.height * BREADBOARD_PITCH,
    };
  }
  if (element.type === "breadboard.netlist") {
    return {
      x: element.visual.x ?? 0,
      y: element.visual.y ?? 0,
      width: NETLIST_CARD_SIZE.width * BREADBOARD_PITCH,
      height: NETLIST_CARD_SIZE.height * BREADBOARD_PITCH,
    };
  }
  return undefined;
}

export function breadboardPins(element: Element): readonly BreadboardPagePin[] {
  if (!BREADBOARD_PART_TYPES.includes(element.type as BreadboardPartType))
    return [];
  const type = element.type as BreadboardPartType;
  const semantic = partSemantic(element);
  const box = breadboardBox(element);
  if (!box) return [];
  const local = breadboardLocalBox(type, semantic);
  const pivot = boxCenter(box);
  const rotation = element.visual.rotation ?? 0;
  const visualX = element.visual.x ?? 0;
  const visualY = element.visual.y ?? 0;
  return breadboardPinDefs(type, semantic).map((definition) => {
    const point = {
      x: visualX + (-local.x + definition.dx) * BREADBOARD_PITCH,
      y: visualY + (-local.y + definition.dy) * BREADBOARD_PITCH,
    };
    const rotated = rotation ? rotatePoint(point, pivot, rotation) : point;
    return {
      number: definition.number,
      name: definition.name,
      x: roundNoise(rotated.x),
      y: roundNoise(rotated.y),
    };
  });
}

export function breadboardWirePoints(element: Element): readonly Vec[] {
  if (element.type !== "breadboard.wire") return [];
  const semantic = element.semantic as { points: readonly Vec[] };
  const x = element.visual.x ?? 0;
  const y = element.visual.y ?? 0;
  return semantic.points.map((point) => ({ x: x + point.x, y: y + point.y }));
}

export function breadboardWireEnds(
  element: Element,
): readonly [Vec, Vec] | undefined {
  const points = breadboardWirePoints(element);
  if (points.length < 2) return undefined;
  const first = points.at(0);
  const last = points.at(-1);
  return first && last ? [first, last] : undefined;
}

export function breadboardBondGroups(
  type: BreadboardPartType,
): readonly (readonly number[])[] {
  return type === "breadboard.button"
    ? [
        [1, 2],
        [3, 4],
      ]
    : [];
}

export function breadboardPartName(
  type: BreadboardPartType,
  semantic: BreadboardPartSemantic,
): string {
  if (type === "breadboard.transistor")
    return (semantic as BreadboardTransistorSemantic).polarity === "pnp"
      ? "TransistorPNP"
      : "TransistorNPN";
  if (
    type === "breadboard.capacitor" &&
    (semantic as BreadboardCapacitorSemantic).style === "electrolytic"
  )
    return "CapacitorPolarized";
  return PART_NAMES[type];
}

export function breadboardDescription(
  type: BreadboardPartType,
  semantic: BreadboardPartSemantic,
): string {
  switch (type) {
    case "breadboard.resistor":
      return `Resistor ${(semantic as BreadboardResistorSemantic).tolerance ?? ((semantic as BreadboardResistorSemantic).bands === 4 ? 5 : 1)}%`;
    case "breadboard.led":
      return `LED ${(semantic as BreadboardLedSemantic).color}`;
    case "breadboard.capacitor":
      return (semantic as BreadboardCapacitorSemantic).style === "electrolytic"
        ? "Capacitor electrolytic"
        : "Capacitor ceramic";
    case "breadboard.diode":
      return "Diode";
    case "breadboard.transistor":
      return `Transistor ${(semantic as BreadboardTransistorSemantic).polarity.toUpperCase()} ${(semantic as BreadboardTransistorSemantic).pinout}`;
    case "breadboard.button":
      return "Push button";
    case "breadboard.potentiometer":
      return "Potentiometer";
    case "breadboard.ic":
      return `DIP-${(semantic as BreadboardIcSemantic).pinCount} IC`;
    case "breadboard.header":
      return `Pin header 1x${(semantic as BreadboardHeaderSemantic).pinCount}`;
    case "breadboard.battery":
      return "Battery";
  }
}

export function breadboardFootprint(
  type: BreadboardPartType,
  semantic: BreadboardPartSemantic,
): string {
  switch (type) {
    case "breadboard.resistor":
      return `nodetto:Resistor_P${(semantic as BreadboardResistorSemantic).span}`;
    case "breadboard.led":
      return "nodetto:LED_P1";
    case "breadboard.capacitor":
      return (semantic as BreadboardCapacitorSemantic).style === "electrolytic"
        ? `nodetto:CapacitorPolarized_P${(semantic as BreadboardCapacitorSemantic).span}`
        : `nodetto:Capacitor_P${(semantic as BreadboardCapacitorSemantic).span}`;
    case "breadboard.diode":
      return `nodetto:Diode_P${(semantic as BreadboardDiodeSemantic).span}`;
    case "breadboard.transistor":
      return `nodetto:Transistor_${(semantic as BreadboardTransistorSemantic).polarity.toUpperCase()}_${(semantic as BreadboardTransistorSemantic).pinout}`;
    case "breadboard.button":
      return "nodetto:PushButton_P2.54x5.08";
    case "breadboard.potentiometer":
      return "nodetto:Potentiometer_P5.08";
    case "breadboard.ic":
      return `nodetto:DIP-${(semantic as BreadboardIcSemantic).pinCount}`;
    case "breadboard.header":
      return `nodetto:Header_1x${(semantic as BreadboardHeaderSemantic).pinCount}_P2.54`;
    case "breadboard.battery":
      return "nodetto:Battery_P2.54";
  }
}

export function breadboardDefaultSemantic(
  type: BreadboardElementType,
): unknown {
  switch (type) {
    case "breadboard.board":
      return { size: "half" };
    case "breadboard.wire":
      return {
        color: "red",
        points: [
          { x: 0, y: 0 },
          { x: 10, y: 0 },
        ],
      };
    case "breadboard.resistor":
      return { reference: "R?", value: "220", span: 4, bands: 4 };
    case "breadboard.led":
      return { reference: "D?", value: "red", color: "red" };
    case "breadboard.capacitor":
      return { reference: "C?", value: "100n", style: "ceramic", span: 1 };
    case "breadboard.diode":
      return { reference: "D?", value: "1N4148", span: 4 };
    case "breadboard.transistor":
      return { reference: "Q?", value: "NPN", polarity: "npn", pinout: "EBC" };
    case "breadboard.button":
      return { reference: "SW?", value: "PUSH" };
    case "breadboard.potentiometer":
      return { reference: "RV?", value: "10k" };
    case "breadboard.ic":
      return { reference: "U?", value: "IC", pinCount: 8 };
    case "breadboard.header":
      return { reference: "J?", value: "HEADER", pinCount: 4 };
    case "breadboard.battery":
      return { reference: "BT?", value: "5V" };
    case "breadboard.netlist":
      return { source: "", format: "kicad_net", parts: [], nets: [] };
  }
}

export interface BreadboardCatalogueEntry {
  readonly type: BreadboardPartType;
  readonly name: string;
  readonly semantic: BreadboardPartSemantic;
  readonly pins: readonly BreadboardPinDef[];
}

export const breadboardCatalogue: readonly BreadboardCatalogueEntry[] =
  BREADBOARD_PART_TYPES.map((type) => {
    const semantic = breadboardDefaultSemantic(type) as BreadboardPartSemantic;
    return {
      type,
      name: breadboardPartName(type, semantic),
      semantic,
      pins: breadboardPinDefs(type, semantic),
    };
  });
