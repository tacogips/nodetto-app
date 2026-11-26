import { isSchematicPartType, type Element } from "@nodetto/ir";
import type { NotationPrimitive } from "../bpmn/notation.ts";
import { type Box, rotatePoint } from "../geometry.ts";
import { schematicPinDefs } from "./symbols.ts";

export interface SchematicInk {
  readonly ink: string;
  readonly muted: string;
  readonly surface: string;
  readonly accent: string;
}
export interface SchematicNotation {
  readonly body: readonly NotationPrimitive[];
  readonly labels: readonly NotationPrimitive[];
}

export function schematicNotation(
  element: Element,
  box: Box,
  ink: SchematicInk,
): SchematicNotation {
  const body: NotationPrimitive[] = [];
  const labels: NotationPrimitive[] = [];
  const s = element.semantic as Record<string, unknown>;
  const flip = element.visual.flipX === true;
  const x = (n: number) => (flip ? box.width - n : n);
  const line = (
    role: string,
    points: readonly (readonly [number, number])[],
    fill = "none",
  ) => {
    body.push(
      fill === "none"
        ? {
            kind: "path",
            role,
            d: points
              .map(([px, py], i) => `${i ? "L" : "M"} ${x(px)} ${py}`)
              .join(" "),
            stroke: ink.ink,
            fill,
            strokeWidth: 1.5,
          }
        : {
            kind: "polygon",
            role,
            points: points.map(([px, py]) => ({ x: x(px), y: py })),
            stroke: ink.ink,
            fill,
            strokeWidth: 1.5,
          },
    );
  };
  const circle = (
    role: string,
    cx: number,
    cy: number,
    r: number,
    fill = "none",
  ) =>
    body.push({
      kind: "circle",
      role,
      cx: x(cx),
      cy,
      r,
      stroke: ink.ink,
      fill,
      strokeWidth: 1.5,
    });
  const text = (
    role: string,
    value: unknown,
    px: number,
    py: number,
    mirror = false,
  ) => {
    if (typeof value !== "string" || !value) return;
    const p = rotatePoint(
      { x: mirror ? x(px) : px, y: py },
      { x: box.width / 2, y: box.height / 2 },
      element.visual.rotation ?? 0,
    );
    labels.push({
      kind: "text",
      role,
      x: p.x,
      y: p.y,
      lines: [value],
      anchor: "middle",
      fontSize: 7,
      lineHeight: 8,
      fill: ink.ink,
      stroke: "none",
    });
  };
  const pins = schematicPinDefs(element);
  const a = pins[0]?.offset;
  const b = pins[element.type === "schematic.potentiometer" ? 2 : 1]?.offset;
  const cx = box.width / 2;
  const cy = box.height / 2;
  if (isSchematicPartType(element.type)) {
    text("ref", s.reference, cx, -6);
    text("value", s.value, cx, box.height + 12);
  }
  if (
    a &&
    b &&
    ![
      "schematic.bjt",
      "schematic.mosfet",
      "schematic.connector",
      "schematic.ic",
    ].includes(element.type)
  ) {
    const y = a.y;
    const mid = (a.x + b.x) / 2;
    const leftEdge =
      element.type === "schematic.capacitor" ||
      element.type === "schematic.battery"
        ? 3
        : element.type === "schematic.diode" || element.type === "schematic.led"
          ? 7
          : 10;
    const rightEdge =
      element.type === "schematic.capacitor" ||
      element.type === "schematic.battery"
        ? 3
        : element.type === "schematic.diode" || element.type === "schematic.led"
          ? 5
          : 10;
    line("pin-stub", [
      [a.x, y],
      [mid - leftEdge, y],
    ]);
    line("pin-stub", [
      [mid + rightEdge, y],
      [b.x, y],
    ]);
    switch (element.type) {
      case "schematic.resistor":
      case "schematic.potentiometer":
        line("resistor", [
          [mid - 10, y - 5],
          [mid + 10, y - 5],
          [mid + 10, y + 5],
          [mid - 10, y + 5],
          [mid - 10, y - 5],
        ]);
        if (element.type === "schematic.potentiometer" && pins[1])
          line("pot-wiper", [
            [pins[1].offset.x, pins[1].offset.y],
            [mid, y - 7],
            [mid - 3, y - 11],
            [mid, y - 7],
            [mid + 3, y - 11],
          ]);
        break;
      case "schematic.capacitor":
        line("capacitor-plate", [
          [mid - 3, y - 9],
          [mid - 3, y + 9],
        ]);
        line("capacitor-plate", [
          [mid + 3, y - 9],
          [mid + 3, y + 9],
        ]);
        if (s.polarized)
          line("capacitor-plus", [
            [mid - 9, y - 12],
            [mid - 5, y - 12],
            [mid - 7, y - 12],
            [mid - 7, y - 14],
            [mid - 7, y - 10],
          ]);
        break;
      case "schematic.inductor":
        line("inductor", [
          [mid - 10, y],
          [mid - 8, y - 5],
          [mid - 5, y - 6],
          [mid - 2, y],
          [mid, y - 5],
          [mid + 2, y],
          [mid + 5, y - 6],
          [mid + 8, y - 5],
          [mid + 10, y],
        ]);
        break;
      case "schematic.diode":
      case "schematic.led":
        line(
          "diode",
          [
            [mid - 7, y - 7],
            [mid + 5, y],
            [mid - 7, y + 7],
            [mid - 7, y - 7],
          ],
          ink.ink,
        );
        line("diode", [
          [mid + 5, y - 8],
          [mid + 5, y + 8],
        ]);
        if (element.type === "schematic.led") {
          line("led-arrow", [
            [mid + 2, y - 10],
            [mid + 8, y - 16],
            [mid + 8, y - 13],
            [mid + 8, y - 16],
            [mid + 5, y - 16],
          ]);
          line("led-arrow", [
            [mid + 7, y - 8],
            [mid + 13, y - 14],
            [mid + 13, y - 11],
            [mid + 13, y - 14],
            [mid + 10, y - 14],
          ]);
        }
        break;
      case "schematic.switch":
        line("switch", [
          [mid - 10, y],
          [mid + 7, y - 7],
        ]);
        circle("switch", mid + 10, y, 1);
        if (s.style === "push")
          line("switch-push", [
            [mid, y - 8],
            [mid, y - 14],
            [mid - 5, y - 14],
            [mid + 5, y - 14],
          ]);
        break;
      case "schematic.battery":
        line("battery-cell", [
          [mid - 3, y - 9],
          [mid - 3, y + 9],
        ]);
        line("battery-cell", [
          [mid + 3, y - 5],
          [mid + 3, y + 5],
        ]);
        break;
      case "schematic.voltageSource":
        circle("source-circle", mid, y, 10);
        line("source-circle", [
          [mid - 5, y],
          [mid - 1, y],
          [mid - 3, y - 2],
          [mid - 3, y + 2],
        ]);
        line("source-circle", [
          [mid + 3, y],
          [mid + 7, y],
        ]);
        break;
    }
  }
  if (element.type === "schematic.bjt" && pins.length === 3) {
    const e = pins[0]?.offset;
    const base = pins[1]?.offset;
    const c = pins[2]?.offset;
    if (e && base && c) {
      line("pin-stub", [
        [base.x, base.y],
        [base.x + 20, base.y],
      ]);
      line("pin-stub", [
        [c.x, c.y],
        [c.x, c.y + 10],
        [base.x + 20, base.y - 5],
        [base.x + 20, base.y + 5],
        [e.x, e.y - 10],
        [e.x, e.y],
      ]);
      const tip =
        s.polarity === "pnp"
          ? ([base.x + 20, base.y + 5] as const)
          : ([e.x, e.y - 10] as const);
      const tail =
        s.polarity === "pnp"
          ? ([e.x, e.y - 10] as const)
          : ([base.x + 20, base.y + 5] as const);
      line("bjt-arrow", [tip, [tip[0] - 4, tip[1] - 3], tail, tip], ink.ink);
    }
  }
  if (element.type === "schematic.mosfet" && pins.length === 3) {
    const gate = pins[0]?.offset;
    const drain = pins[1]?.offset;
    const source = pins[2]?.offset;
    if (gate && drain && source) {
      line("mosfet-gate", [
        [gate.x, gate.y],
        [gate.x + 15, gate.y],
        [gate.x + 15, gate.y - 10],
        [gate.x + 15, gate.y + 10],
      ]);
      line("pin-stub", [
        [drain.x, drain.y],
        [drain.x, gate.y - 8],
        [gate.x + 20, gate.y - 8],
        [gate.x + 20, gate.y + 8],
        [source.x, gate.y + 8],
        [source.x, source.y],
      ]);
      const d = s.channel === "p" ? -1 : 1;
      line(
        "bjt-arrow",
        [
          [gate.x + 20, gate.y],
          [gate.x + 20 + d * 5, gate.y - 3],
          [gate.x + 20 + d * 5, gate.y + 3],
          [gate.x + 20, gate.y],
        ],
        ink.ink,
      );
    }
  }
  if (
    element.type === "schematic.connector" ||
    element.type === "schematic.ic"
  ) {
    if (element.type === "schematic.ic" && pins.length > 0) {
      const left = pins.some((p) => p.direction === "left") ? 25 : 5;
      const top = pins.some((p) => p.direction === "up") ? 25 : 5;
      const right =
        box.width - (pins.some((p) => p.direction === "right") ? 25 : 5);
      const bottom =
        box.height - (pins.some((p) => p.direction === "down") ? 25 : 5);
      line(
        "ic-body",
        [
          [left, top],
          [right, top],
          [right, bottom],
          [left, bottom],
          [left, top],
        ],
        ink.surface,
      );
    }
    for (const p of pins) {
      const dx = p.direction === "left" ? 1 : p.direction === "right" ? -1 : 0;
      const dy = p.direction === "up" ? 1 : p.direction === "down" ? -1 : 0;
      const length = element.type === "schematic.ic" ? 20 : 10;
      line(element.type === "schematic.ic" ? "ic-pin" : "connector-pin", [
        [p.offset.x, p.offset.y],
        [p.offset.x + dx * length, p.offset.y + dy * length],
      ]);
      text(
        "pin-name",
        `${p.number}${p.name && p.name !== String(p.number) ? ` ${p.name}` : ""}`,
        p.offset.x + dx * (length + 5),
        p.offset.y + dy * (length + 5),
        true,
      );
    }
  }
  if (element.type === "schematic.power" && a) {
    const rail = s.style === "rail";
    const end = a.y + (rail ? -12 : 12);
    line("pin-stub", [
      [a.x, a.y],
      [a.x, end],
    ]);
    if (rail)
      line("power-rail", [
        [a.x - 7, end],
        [a.x + 7, end],
      ]);
    else {
      line("power-ground", [
        [a.x - 9, end],
        [a.x + 9, end],
      ]);
      line("power-ground", [
        [a.x - 6, end + 4],
        [a.x + 6, end + 4],
      ]);
      line("power-ground", [
        [a.x - 3, end + 8],
        [a.x + 3, end + 8],
      ]);
    }
    text("net-name", s.net, cx, rail ? -6 : box.height + 10);
  }
  if (element.type === "schematic.wire") {
    const points = (s.points ?? []) as readonly { x: number; y: number }[];
    if (points.length)
      line(
        "wire",
        points.map(
          (p) =>
            [
              p.x + (element.visual.x ?? 0) - box.x,
              p.y + (element.visual.y ?? 0) - box.y,
            ] as const,
        ),
      );
  }
  if (element.type === "schematic.junction")
    circle("junction", cx, cy, 2.5, ink.ink);
  if (element.type === "schematic.label") {
    line("label", [
      [cx, cy],
      [cx + 5, cy],
    ]);
    text("net-name", s.net, cx, cy - 5);
  }
  if (element.type === "schematic.noConnect") {
    line("no-connect", [
      [cx - 4, cy - 4],
      [cx + 4, cy + 4],
    ]);
    line("no-connect", [
      [cx + 4, cy - 4],
      [cx - 4, cy + 4],
    ]);
  }
  return { body, labels };
}

export function schematicLabelBounds(
  notation: SchematicNotation,
  box: Box,
): readonly Box[] {
  return notation.labels.flatMap((p) =>
    p.kind === "text"
      ? [
          {
            x: box.x + p.x - 45,
            y: box.y + p.y - p.fontSize,
            width: 90,
            height: p.lineHeight * p.lines.length,
          },
        ]
      : [],
  );
}
