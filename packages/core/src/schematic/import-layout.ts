import {
  SCHEMA_VERSION,
  type BreadboardImportDiagnostic,
  type BreadboardImportPart,
  type BreadboardImportPlan,
  type Document,
  type Element,
  type SchematicPartType,
} from "@nodetto/ir";
import { keyAfter } from "../fractional.ts";
import { firstUnusedName } from "./net-names.ts";
import {
  schematicDefaultSemantic,
  schematicLocalBox,
  schematicPins,
} from "./symbols.ts";

type Node = { readonly reference: string; readonly pin: number };
type Mapping = {
  type: SchematicPartType;
  patch: object;
  pinMap: Map<number, number>;
};

function mapPart(
  part: BreadboardImportPart,
  pins: number[],
  nets: Map<number, number>,
): Mapping {
  const identity = new Map(pins.map((pin) => [pin, pin]));
  const subset = (max: number) => pins.every((pin) => pin >= 1 && pin <= max);
  const simple: Partial<
    Record<BreadboardImportPart["type"], [SchematicPartType, number]>
  > = {
    "breadboard.resistor": ["schematic.resistor", 2],
    "breadboard.led": ["schematic.led", 2],
    "breadboard.diode": ["schematic.diode", 2],
    "breadboard.potentiometer": ["schematic.potentiometer", 3],
    "breadboard.battery": ["schematic.battery", 2],
  };
  const direct = simple[part.type];
  if (direct && subset(direct[1]))
    return { type: direct[0], patch: {}, pinMap: identity };
  if (part.type === "breadboard.capacitor" && subset(2))
    return {
      type: "schematic.capacitor",
      patch: { polarized: part.parameters["style"] === "electrolytic" },
      pinMap: identity,
    };
  if (part.type === "breadboard.transistor" && subset(3)) {
    const pinout =
      typeof part.parameters["pinout"] === "string"
        ? part.parameters["pinout"]
        : "EBC";
    const mapped = new Map(
      pins.map((pin) => [pin, "EBC".indexOf(pinout[pin - 1] ?? "?") + 1]),
    );
    if ([...mapped.values()].every((pin) => pin > 0))
      return {
        type: "schematic.bjt",
        patch: {
          polarity: part.parameters["polarity"] === "pnp" ? "pnp" : "npn",
        },
        pinMap: mapped,
      };
  }
  if (
    part.type === "breadboard.header" &&
    pins.length <= 40 &&
    pins.every((pin, i) => pin === i + 1)
  )
    return {
      type: "schematic.connector",
      patch: { pinCount: pins.length },
      pinMap: identity,
    };
  if (part.type === "breadboard.button") {
    if (pins.length === 2)
      return {
        type: "schematic.switch",
        patch: { style: "push" },
        pinMap: new Map(pins.map((pin, i) => [pin, i + 1])),
      };
    if (
      subset(4) &&
      [1, 3].every(
        (start) =>
          nets.get(start) === undefined ||
          nets.get(start + 1) === undefined ||
          nets.get(start) === nets.get(start + 1),
      )
    )
      return {
        type: "schematic.switch",
        patch: { style: "push" },
        pinMap: new Map(pins.map((pin) => [pin, pin <= 2 ? 1 : 2])),
      };
  }
  return {
    type: "schematic.ic",
    patch: {
      pins: pins.map((number, i) => ({
        number,
        name: "",
        side: i < Math.ceil(pins.length / 2) ? "left" : "right",
      })),
    },
    pinMap: identity,
  };
}

export function layoutSchematicImport(plan: BreadboardImportPlan): {
  readonly document?: Document;
  readonly diagnostics: readonly BreadboardImportDiagnostic[];
} {
  const diagnostics: BreadboardImportDiagnostic[] = [];
  const byPart = new Map<string, Map<number, number>>();
  const uniqueNets: Node[][] = [];
  for (const [index, net] of plan.target.nets.entries()) {
    const unique: Node[] = [];
    for (const node of net.nodes) {
      const pins = byPart.get(node.reference) ?? new Map<number, number>();
      byPart.set(node.reference, pins);
      const previous = pins.get(node.pin);
      if (previous !== undefined) {
        if (previous !== index)
          diagnostics.push({
            severity: "error",
            code: "schematic.importPinInTwoNets",
            reference: node.reference,
            message: `${node.reference}.${node.pin} occurs in ${plan.target.nets[previous]?.name} and ${net.name}`,
          });
        continue;
      }
      pins.set(node.pin, index);
      unique.push(node);
    }
    uniqueNets.push(unique);
  }
  for (const [reference, pins] of byPart)
    if (pins.size > 256)
      diagnostics.push({
        severity: "error",
        code: "schematic.importTooManyPins",
        reference,
        message: `${reference} has more than 256 pins`,
      });
  if (diagnostics.length) return { diagnostics };
  const reserved = new Set<string>();
  const first = new Set<number>();
  for (const [i, net] of plan.target.nets.entries()) {
    const name = net.name.trim();
    if (name && !reserved.has(name)) {
      reserved.add(name);
      first.add(i);
    }
  }
  function* suffixes(): Generator<string> {
    for (let i = 2; ; i++) yield `_${i}`;
  }
  const names = plan.target.nets.map((net, i) => {
    const name = net.name.trim();
    if (first.has(i)) return name;
    const node = uniqueNets[i]?.[0];
    const base = name || `N_${node?.reference ?? ""}_${node?.pin ?? 0}`;
    const result = firstUnusedName(base, suffixes(), reserved);
    reserved.add(result);
    diagnostics.push({
      severity: "warning",
      code: name
        ? "schematic.importRenamedNet"
        : "schematic.importEmptyNetName",
      message: `Net ${net.name} renamed to ${result}`,
    });
    return result;
  });
  const elements: Element[] = [];
  let index: string | null = null;
  const add = (element: Omit<Element, "index" | "page">) => {
    index = keyAfter(index, () => 0.5);
    elements.push({ ...element, page: "page-1", index });
  };
  let x = 0;
  let y = 0;
  let height = 0;
  const mappedParts = new Map<
    string,
    {
      pins: Map<number, ReturnType<typeof schematicPins>[number]>;
      mapping: Mapping;
    }
  >();
  for (const part of plan.parts) {
    const netMap = byPart.get(part.reference) ?? new Map<number, number>();
    const pins = [...netMap.keys()].sort((a, b) => a - b);
    if (!pins.length) {
      diagnostics.push({
        severity: "warning",
        code: "schematic.importSkippedPart",
        reference: part.reference,
        message: `${part.reference} has no mapped pins`,
      });
      continue;
    }
    const mapping = mapPart(part, pins, netMap);
    if (mapping.type === "schematic.ic" && part.type !== "breadboard.ic")
      diagnostics.push({
        severity: "warning",
        code: "schematic.importPartAsBox",
        reference: part.reference,
        message: `${part.reference} imported as a box`,
      });
    const semantic = schematicDefaultSemantic(mapping.type, {
      reference: part.reference,
      value: part.value,
      ...mapping.patch,
    });
    const prototype: Element = {
      id: `part-${mappedParts.size + 1}`,
      page: "page-1",
      index: "",
      type: mapping.type,
      semantic,
      visual: {},
    };
    const box = schematicLocalBox(prototype);
    if (x > 0 && x + box.width > 1200) {
      x = 0;
      y += height + 60;
      height = 0;
    }
    // Half-pitch box margins place every pin on the pitch lattice.
    const element = {
      ...prototype,
      visual: {
        x: x - 5,
        y: y - 5,
        width: box.width,
        height: box.height,
        rotation: 0,
      },
    };
    add(element);
    mappedParts.set(part.reference, {
      pins: new Map(schematicPins(element).map((pin) => [pin.number, pin])),
      mapping,
    });
    x += Math.ceil(box.width / 10) * 10 + 40;
    height = Math.max(height, Math.ceil(box.height / 10) * 10);
  }
  let wire = 0;
  for (const [i, nodes] of uniqueNets.entries()) {
    const name = names[i] ?? "";
    const emitted = new Set<string>();
    for (const node of nodes) {
      if (nodes.length === 1 && name === `N_${node.reference}_${node.pin}`)
        continue;
      const part = mappedParts.get(node.reference);
      const mappedPin = part?.mapping.pinMap.get(node.pin);
      const key = `${node.reference}\0${mappedPin}`;
      if (!part || mappedPin === undefined || emitted.has(key)) continue;
      emitted.add(key);
      const pin = part.pins.get(mappedPin);
      if (!pin) continue;
      const end = {
        x:
          pin.x +
          (pin.direction === "left" ? -20 : pin.direction === "right" ? 20 : 0),
        y:
          pin.y +
          (pin.direction === "up" ? -20 : pin.direction === "down" ? 20 : 0),
      };
      wire++;
      add({
        id: `wire-${wire}`,
        type: "schematic.wire",
        semantic: { points: [{ x: pin.x, y: pin.y }, end] },
        visual: {},
      });
      add({
        id: `label-${wire}`,
        type: "schematic.label",
        semantic: { net: name },
        visual: end,
      });
    }
  }
  return {
    document: {
      schemaVersion: SCHEMA_VERSION,
      id: "schematic-import",
      title: plan.title,
      pages: [{ id: "page-1", kind: "schematic", name: "Schematic" }],
      elements,
    },
    diagnostics,
  };
}
