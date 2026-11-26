import type { SchematicNetlist } from "@nodetto/ir";
import { referenceWarnings } from "../breadboard/bom.ts";
import type { BreadboardFormatterResult } from "../breadboard/index.ts";

function token(value: string): string {
  if (value && !/[\s"#\\]/.test(value)) return value;
  return `"${value.replaceAll("\\", "\\\\").replaceAll('"', '\\"')}"`;
}

export function exportSchematicNetlistText(
  netlist: SchematicNetlist,
): BreadboardFormatterResult {
  const lines = [
    "# nodetto schematic netlist 1",
    `# document ${token(netlist.documentTitle)}`,
    `# page ${token(netlist.pageName)}`,
    ...netlist.components.map(
      (part) =>
        `component ${token(part.reference)} ${token(part.value)} ${token(part.partName)}`,
    ),
    ...netlist.nets.map((net) =>
      [
        "net",
        String(net.code),
        token(net.name),
        ...net.nodes.map((node) => token(`${node.reference}.${node.pin}`)),
      ].join(" "),
    ),
  ];
  return {
    text: `${lines.join("\n")}\n`,
    warnings: referenceWarnings(netlist),
  };
}
