import type {
  BreadboardNetlist,
  BreadboardNetlistComponent,
} from "@nodetto/ir";
import { parseComponentValue } from "@nodetto/ir";
import type { BreadboardFormatterResult } from "./index.ts";
import { referenceWarnings } from "./bom.ts";

const SUFFIXES = [
  [1e9, "G"],
  [1e6, "Meg"],
  [1e3, "k"],
  [1, ""],
  [1e-3, "m"],
  [1e-6, "u"],
  [1e-9, "n"],
  [1e-12, "p"],
] as const;

function spiceValue(value: number): string {
  if (value === 0) return "0";
  for (const [scale, suffix] of SUFFIXES) {
    const mantissa = value / scale;
    if (mantissa >= 1) return `${Number(mantissa.toPrecision(6))}${suffix}`;
  }
  return `${Number(value.toPrecision(6))}`;
}

function safeNode(name: string): string {
  return name === "GND" ? "0" : name.replace(/[^A-Za-z0-9_]/g, "_") || "NC";
}

function pinNodes(
  netlist: BreadboardNetlist,
  reference: string,
): Map<string, string> {
  const nodes = new Map<string, string>();
  for (const net of netlist.nets)
    for (const node of net.nodes)
      if (node.reference === reference) {
        nodes.set(node.pinName, safeNode(net.name));
        nodes.set(String(node.pin), safeNode(net.name));
      }
  return nodes;
}

function node(
  component: BreadboardNetlistComponent,
  pins: Map<string, string>,
  name: string,
): string {
  const pin = component.pins.find((candidate) => candidate.name === name);
  return (
    pins.get(name) ?? (pin ? pins.get(String(pin.number)) : undefined) ?? "NC"
  );
}

export function exportBreadboardSpiceNetlist(
  netlist: BreadboardNetlist,
): BreadboardFormatterResult {
  const lines = [
    `* ${netlist.documentTitle} / ${netlist.pageName} (nodetto breadboard)`,
  ];
  const warnings = referenceWarnings(netlist);
  const models = new Set<string>();
  for (const component of netlist.components) {
    const pins = pinNodes(netlist, component.reference);
    const ref = component.reference;
    const value = parseComponentValue(component.value);
    const validValue = (): string | undefined => {
      if (value === undefined) {
        warnings.push(`${ref}: value "${component.value}" is not a number`);
        lines.push(`* ${ref} ${component.value} (value is not a number)`);
        return undefined;
      }
      return spiceValue(value);
    };
    switch (component.type) {
      case "breadboard.resistor": {
        const v = validValue();
        if (v)
          lines.push(
            `${ref} ${component.pins.map((pin) => node(component, pins, pin.name)).join(" ")} ${v}`,
          );
        break;
      }
      case "breadboard.capacitor": {
        const v = validValue();
        if (v)
          lines.push(
            `${ref} ${component.pins.map((pin) => node(component, pins, pin.name)).join(" ")} ${v}`,
          );
        break;
      }
      case "breadboard.led":
      case "breadboard.diode": {
        const model =
          component.type === "breadboard.led" ? "D_LED" : "D_GENERIC";
        models.add(model);
        lines.push(
          `${ref.startsWith("D") ? ref : `D${ref}`} ${node(component, pins, "A")} ${node(component, pins, "K")} ${model}`,
        );
        break;
      }
      case "breadboard.transistor": {
        const description = `${component.partName} ${component.description} ${component.value}`;
        const polarity = description.toUpperCase().includes("PNP")
          ? "QPNP"
          : "QNPN";
        models.add(polarity);
        const pinout = component.pins.map((pin) => pin.name);
        lines.push(
          `${ref.startsWith("Q") ? ref : `Q${ref}`} ${node(component, pins, pinout.find((p) => p === "C") ?? "C")} ${node(component, pins, pinout.find((p) => p === "B") ?? "B")} ${node(component, pins, pinout.find((p) => p === "E") ?? "E")} ${polarity}`,
        );
        break;
      }
      case "breadboard.potentiometer": {
        const v = validValue();
        if (v) {
          const parsed = value as number;
          const half = spiceValue(parsed / 2);
          const a = node(component, pins, "1");
          const w = node(component, pins, "W");
          const b = node(component, pins, "3");
          lines.push(
            `R${ref}A ${a} ${w} ${half}`,
            `R${ref}B ${w} ${b} ${half}`,
          );
        }
        break;
      }
      case "breadboard.battery": {
        const v = validValue();
        if (v)
          lines.push(
            `V${ref} ${node(component, pins, "+")} ${node(component, pins, "-")} DC ${v}`,
          );
        break;
      }
      case "breadboard.ic": {
        const pinsInOrder = [...component.pins].sort(
          (a, b) => a.number - b.number,
        );
        const pinList = pinsInOrder
          .map((pin) => node(component, pins, pin.name))
          .join(" ");
        const name = component.value.replace(/[^A-Za-z0-9_]/g, "_") || "IC";
        lines.push(
          `X${ref} ${pinList} ${name}`,
          `* subcircuit ${name} not defined`,
        );
        break;
      }
      case "breadboard.button":
        lines.push(
          `* ${ref} push button (open): 1-2 ${node(component, pins, "1")}, 3-4 ${node(component, pins, "3")}`,
        );
        break;
      case "breadboard.header":
        lines.push(
          `* ${ref} header: ${component.pins.map((pin) => node(component, pins, pin.name)).join(" ")}`,
        );
        break;
    }
  }
  for (const model of ["D_LED", "D_GENERIC", "QNPN", "QPNP"])
    if (models.has(model))
      lines.push(
        `.model ${model} ${model.startsWith("D_") ? "D" : model.slice(1)}`,
      );
  lines.push(".end", "");
  return { text: lines.join("\n"), warnings };
}
