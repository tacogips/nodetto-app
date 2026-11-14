import type { BreadboardNetlist } from "@nodetto/ir";
import type { BreadboardFormatterResult } from "./index.ts";
import { referenceWarnings } from "./bom.ts";

function quote(value: string): string {
  return `"${value.replaceAll("\\", "\\\\").replaceAll('"', '\\"')}"`;
}

export function exportBreadboardKicadNetlist(
  netlist: BreadboardNetlist,
): BreadboardFormatterResult {
  const lines = [
    '(export (version "E")',
    `  (design (source ${quote(netlist.documentTitle)}) (tool "nodetto"))`,
    "  (components",
    ...netlist.components.map(
      (component) =>
        `    (comp (ref ${quote(component.reference)}) (value ${quote(component.value)}) (footprint ${quote(component.footprint)})\n      (libsource (lib "nodetto") (part ${quote(component.partName)}) (description ${quote(component.description)})))`,
    ),
    "  )",
    "  (nets",
    ...netlist.nets.map(
      (net) =>
        `    (net (code ${quote(String(net.code))}) (name ${quote(net.name)})\n${net.nodes
          .map(
            (node) =>
              `      (node (ref ${quote(node.reference)}) (pin ${quote(String(node.pin))}) (pinfunction ${quote(node.pinName)}))`,
          )
          .join("\n")})`,
    ),
    "  )",
    ")",
    "",
  ];
  return { text: lines.join("\n"), warnings: referenceWarnings(netlist) };
}
