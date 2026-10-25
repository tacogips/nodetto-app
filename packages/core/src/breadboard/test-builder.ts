import type { Document, Element, PageId } from "@nodetto/ir";
import type { BreadboardPartType } from "@nodetto/ir";
import type { Vec } from "../geometry.ts";
import { breadboardDefaultSemantic, breadboardPins } from "./catalogue.ts";

export interface BreadboardTestPart {
  readonly id: string;
  readonly type: BreadboardPartType;
  readonly reference: string;
  readonly value?: string;
  readonly pin1: Vec;
  readonly rotation?: number;
  readonly semantic?: Readonly<Record<string, unknown>>;
  readonly hidden?: boolean;
}
export interface BreadboardTestBoard {
  readonly id: string;
  readonly size?: "full" | "half" | "mini";
  readonly x?: number;
  readonly y?: number;
  readonly rotation?: number;
  readonly hidden?: boolean;
}
export interface BreadboardTestWire {
  readonly id: string;
  readonly points: readonly Vec[];
  readonly color?: string;
  readonly hidden?: boolean;
}
export interface BreadboardTestSpec {
  readonly boards?: readonly BreadboardTestBoard[];
  readonly parts?: readonly BreadboardTestPart[];
  readonly wires?: readonly BreadboardTestWire[];
  readonly netlist?: {
    readonly id?: string;
    readonly parts: readonly {
      readonly reference: string;
      readonly value: string;
      readonly pins: readonly {
        readonly number: number;
        readonly name: string;
      }[];
    }[];
    readonly nets: readonly {
      readonly name: string;
      readonly nodes: readonly {
        readonly reference: string;
        readonly pin: number;
      }[];
    }[];
  };
}
const PAGE_ID: PageId = "breadboard-page";
function coordinate(value: number): number {
  return Math.round(value * 1_000_000) / 1_000_000;
}
function element(
  id: string,
  type: string,
  index: number,
  semantic: Readonly<Record<string, unknown>>,
  visual: Element["visual"],
): Element {
  return {
    id,
    page: PAGE_ID,
    type,
    index: `a${String(index).padStart(3, "0")}`,
    semantic,
    visual,
  };
}
export function buildBreadboardDocument(
  spec: BreadboardTestSpec = {},
): Document {
  const elements: Element[] = [];
  let order = 1;
  for (const board of spec.boards ?? [{ id: "board-1", size: "half" }]) {
    elements.push(
      element(
        board.id,
        "breadboard.board",
        order++,
        { size: board.size ?? "half" },
        {
          x: board.x ?? 0,
          y: board.y ?? 0,
          ...(board.rotation === undefined ? {} : { rotation: board.rotation }),
          ...(board.hidden ? { hidden: true } : {}),
        },
      ),
    );
  }
  for (const part of spec.parts ?? []) {
    const semantic = {
      ...(breadboardDefaultSemantic(part.type) as Record<string, unknown>),
      reference: part.reference,
      value: part.value ?? "220",
      ...part.semantic,
    };
    const candidate = element(part.id, part.type, order, semantic, {
      rotation: part.rotation ?? 0,
    });
    const firstPin = breadboardPins(candidate)[0];
    order += 1;
    if (!firstPin) continue;
    elements.push({
      ...candidate,
      index: `a${String(order - 1).padStart(3, "0")}`,
      visual: {
        ...candidate.visual,
        x: coordinate(part.pin1.x - firstPin.x),
        y: coordinate(part.pin1.y - firstPin.y),
        ...(part.hidden ? { hidden: true } : {}),
      },
    });
  }
  for (const wire of spec.wires ?? []) {
    const first = wire.points[0] ?? { x: 0, y: 0 };
    elements.push(
      element(
        wire.id,
        "breadboard.wire",
        order++,
        {
          color: wire.color ?? "red",
          points: wire.points.map((point) => ({
            x: point.x - first.x,
            y: point.y - first.y,
          })),
        },
        {
          x: first.x,
          y: first.y,
          ...(wire.hidden ? { hidden: true } : {}),
        },
      ),
    );
  }
  if (spec.netlist) {
    elements.push(
      element(
        spec.netlist.id ?? "target-netlist",
        "breadboard.netlist",
        order++,
        {
          source: "test.net",
          format: "kicad_net",
          parts: spec.netlist.parts,
          nets: spec.netlist.nets.map((net, index) => ({
            code: index + 1,
            name: net.name,
            nodes: net.nodes.map((node) => ({
              pinName: String(node.pin),
              ...node,
            })),
          })),
        },
        { x: 700, y: 0 },
      ),
    );
  }
  return {
    schemaVersion: 1,
    id: "breadboard-test-document",
    title: "Breadboard test",
    pages: [{ id: PAGE_ID, name: "Breadboard", kind: "breadboard" }],
    elements,
  };
}
