import type { Element } from "@nodetto/ir";
import { BREADBOARD_PITCH } from "@nodetto/ir";
import type { Box } from "../geometry.ts";
import { boxCenter, rotatePoint } from "../geometry.ts";
import { breadboardBox } from "./catalogue.ts";

export interface BreadboardHole {
  readonly id: string;
  readonly x: number;
  readonly y: number;
  readonly strip: string;
}

export interface BreadboardLabel {
  readonly text: string;
  readonly x: number;
  readonly y: number;
}

export interface BreadboardBoardLayout {
  readonly columns: number;
  readonly railHoles: number;
  readonly width: number;
  readonly height: number;
  readonly holes: readonly BreadboardHole[];
  readonly labels: readonly BreadboardLabel[];
  readonly channelY?: { readonly from: number; readonly to: number };
}

const layouts = new Map<string, BreadboardBoardLayout>();

function addTerminalHoles(
  holes: BreadboardHole[],
  labels: BreadboardLabel[],
  columns: number,
  top: number,
  bottom: number,
  columnLabelTop: number,
  columnLabelBottom: number,
): void {
  const rows = ["a", "b", "c", "d", "e", "f", "g", "h", "i", "j"];
  for (let column = 1; column <= columns; column += 1) {
    const x = column + 1;
    for (let index = 0; index < 5; index += 1) {
      holes.push({
        id: `${rows[index]}${column}`,
        x,
        y: top + index,
        strip: `col:${column}:top`,
      });
      holes.push({
        id: `${rows[index + 5]}${column}`,
        x,
        y: bottom + index,
        strip: `col:${column}:bot`,
      });
    }
    if (column === 1 || column % 5 === 0) {
      labels.push({ text: String(column), x, y: columnLabelTop });
      labels.push({ text: String(column), x, y: columnLabelBottom });
    }
  }
  for (let index = 0; index < rows.length; index += 1) {
    const row = rows[index];
    if (row === undefined) continue;
    const y = index < 5 ? top + index : bottom + index - 5;
    labels.push({ text: row, x: 0.5, y });
    labels.push({ text: row, x: columns + 2.5, y });
  }
}

function createLayout(size: "full" | "half" | "mini"): BreadboardBoardLayout {
  const columns = size === "full" ? 63 : size === "half" ? 30 : 17;
  const railHoles = size === "full" ? 50 : size === "half" ? 25 : 0;
  const width = size === "full" ? 66 : size === "half" ? 33 : 20;
  const height = size === "mini" ? 16 : 22;
  const holes: BreadboardHole[] = [];
  const labels: BreadboardLabel[] = [];

  if (size === "mini") {
    addTerminalHoles(holes, labels, columns, 2, 9, 1, 14);
  } else {
    for (const [rail, y, polarity] of [
      ["T-", 1, "-"],
      ["T+", 2, "+"],
      ["B+", 19, "+"],
      ["B-", 20, "-"],
    ] as const) {
      for (let index = 1; index <= railHoles; index += 1) {
        const x =
          2 +
          Math.floor((columns - (railHoles + railHoles / 5 - 1)) / 2) +
          (index - 1) +
          Math.floor((index - 1) / 5);
        holes.push({ id: `${rail}${index}`, x, y, strip: `rail:${rail}` });
      }
      labels.push(
        { text: polarity, x: 0.5, y },
        { text: polarity, x: width - 0.5, y },
      );
    }
    addTerminalHoles(holes, labels, columns, 5, 12, 4, 17);
  }

  return {
    columns,
    railHoles,
    width,
    height,
    holes,
    labels,
    channelY: size === "mini" ? { from: 7, to: 8 } : { from: 10, to: 11 },
  };
}

export function boardLayout(
  size: "full" | "half" | "mini",
): BreadboardBoardLayout {
  const cached = layouts.get(size);
  if (cached) return cached;
  const layout = createLayout(size);
  layouts.set(size, layout);
  return layout;
}

function rounded(value: number): number {
  return Math.round(value * 1_000_000) / 1_000_000;
}

export function boardHoles(element: Element): readonly (BreadboardHole & {
  readonly pageX: number;
  readonly pageY: number;
})[] {
  if (element.type !== "breadboard.board") return [];
  const size = (element.semantic as { size?: string }).size;
  const layout = boardLayout(
    size === "full" || size === "mini" ? size : "half",
  );
  const box: Box | undefined = breadboardBox(element);
  if (!box) return [];
  const pivot = boxCenter(box);
  const rotation = element.visual.rotation ?? 0;
  const visualX = element.visual.x ?? 0;
  const visualY = element.visual.y ?? 0;
  return layout.holes.map((hole) => {
    const point = {
      x: visualX + hole.x * BREADBOARD_PITCH,
      y: visualY + hole.y * BREADBOARD_PITCH,
    };
    const page = rotation ? rotatePoint(point, pivot, rotation) : point;
    return { ...hole, pageX: rounded(page.x), pageY: rounded(page.y) };
  });
}
