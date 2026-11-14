import {
  SCHEMA_VERSION,
  type BreadboardImportPlan,
  type BreadboardPartSemantic,
  type BreadboardPartType,
  type Document,
  type Element,
} from "@nodetto/ir";
import { breadboardDefaultSemantic, breadboardLocalBox } from "./catalogue.ts";
import { boardLayout } from "./board.ts";
import { NETLIST_CARD_SIZE } from "./catalogue.ts";
import { keyAfter } from "../fractional.ts";
import { BREADBOARD_PITCH } from "@nodetto/ir";

const PART_PARAMETER_KEYS: Readonly<
  Record<BreadboardPartType, readonly string[]>
> = {
  "breadboard.resistor": ["span", "bands", "tolerance"],
  "breadboard.led": ["color"],
  "breadboard.capacitor": ["style", "span"],
  "breadboard.diode": ["span"],
  "breadboard.transistor": ["polarity", "pinout"],
  "breadboard.button": [],
  "breadboard.potentiometer": [],
  "breadboard.ic": ["pinCount"],
  "breadboard.header": ["pinCount"],
  "breadboard.battery": [],
};

function stableDocumentId(plan: BreadboardImportPlan): string {
  const input = JSON.stringify(plan);
  let hash = 2166136261;
  for (let index = 0; index < input.length; index += 1) {
    hash ^= input.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return `breadboard-${(hash >>> 0).toString(16).padStart(8, "0")}`;
}

function nextIndex(previous: string | null): string {
  return keyAfter(previous, () => 0.5);
}

function partSemantic(
  type: BreadboardPartType,
  reference: string,
  value: string,
  parameters: Readonly<Record<string, unknown>>,
): BreadboardPartSemantic {
  const defaults = breadboardDefaultSemantic(type);
  const allowed = PART_PARAMETER_KEYS[type];
  const selected = Object.fromEntries(
    Object.entries(parameters).filter(([key]) => allowed.includes(key)),
  );
  return {
    ...(defaults as Record<string, unknown>),
    reference,
    value,
    ...selected,
  } as BreadboardPartSemantic;
}

export function layoutBreadboardImport(plan: BreadboardImportPlan): Document {
  const pitch = BREADBOARD_PITCH;
  const layout = boardLayout("half");
  const elements: Element[] = [];
  let index: string | null = null;

  const boardIndex = nextIndex(index);
  index = boardIndex;
  elements.push({
    id: "board-1",
    page: "page-1",
    type: "breadboard.board",
    index: boardIndex,
    semantic: { size: "half" },
    visual: {
      x: 0,
      y: 0,
      width: layout.width * pitch,
      height: layout.height * pitch,
    },
  });

  const cardIndex = nextIndex(index);
  index = cardIndex;
  elements.push({
    id: "target-netlist",
    page: "page-1",
    type: "breadboard.netlist",
    index: cardIndex,
    semantic: plan.target,
    visual: {
      x: (layout.width + 2) * pitch,
      y: 0,
      width: NETLIST_CARD_SIZE.width * pitch,
      height: NETLIST_CARD_SIZE.height * pitch,
    },
  });

  let cursorX = 0;
  let rowY = layout.height + 4;
  let rowHeight = 0;

  for (const [partIndex, part] of plan.parts.entries()) {
    const semantic = partSemantic(
      part.type,
      part.reference,
      part.value,
      part.parameters,
    );
    const box = breadboardLocalBox(part.type, semantic);
    let pin1X = Math.ceil(cursorX - box.x);
    let boxLeft = pin1X + box.x;

    if (boxLeft + box.width > 66) {
      rowY += rowHeight + 2;
      cursorX = 0;
      rowHeight = 0;
      pin1X = Math.ceil(cursorX - box.x);
      boxLeft = pin1X + box.x;
    }

    const pin1Y = Math.ceil(rowY - box.y);
    const partIndexKey = nextIndex(index);
    index = partIndexKey;
    elements.push({
      id: `part-${partIndex + 1}`,
      page: "page-1",
      type: part.type,
      index: partIndexKey,
      semantic,
      visual: {
        x: (pin1X + box.x) * pitch,
        y: (pin1Y + box.y) * pitch,
        width: box.width * pitch,
        height: box.height * pitch,
        rotation: 0,
      },
    });
    cursorX = boxLeft + box.width + 2;
    rowHeight = Math.max(rowHeight, box.height);
  }

  return {
    schemaVersion: SCHEMA_VERSION,
    id: stableDocumentId(plan),
    title: plan.title,
    pages: [{ id: "page-1", kind: "breadboard", name: "Breadboard" }],
    elements,
  };
}
