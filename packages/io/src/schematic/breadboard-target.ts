import {
  compareReferences,
  type BreadboardImportDiagnostic,
  type BreadboardNetlistSemantic,
  type SchematicNetlist,
} from "@nodetto/ir";
import { mapKicadSymbol } from "../kicad/symbol-map.ts";

export function breadboardTargetFromSchematic(
  netlist: SchematicNetlist,
  options: { pageName: string },
): {
  readonly target?: BreadboardNetlistSemantic;
  readonly diagnostics: readonly BreadboardImportDiagnostic[];
} {
  const diagnostics: BreadboardImportDiagnostic[] = [];
  const holders = new Map<string, string[]>();
  for (const component of netlist.components) {
    const ids = holders.get(component.reference) ?? [];
    ids.push(component.elementId);
    holders.set(component.reference, ids);
    if (component.reference.endsWith("?"))
      diagnostics.push({
        severity: "error",
        code: "schematic.unannotatedReference",
        reference: component.reference,
        message: `Run Fix references for '${component.reference}'.`,
      });
    const numbers = new Set(component.pins.map((pin) => pin.number));
    if (
      component.pins.length > 40 ||
      numbers.size !== component.pins.length ||
      component.pins.some(
        (pin) =>
          !Number.isInteger(pin.number) ||
          pin.number < 1 ||
          pin.number > component.pins.length,
      ) ||
      component.pins.length === 0
    )
      diagnostics.push({
        severity: "error",
        code: "schematic.unprojectablePart",
        reference: component.reference,
        message: `Pins for '${component.reference}' must be numbered 1..n, with at most 40 pins.`,
      });
  }
  for (const [reference, ids] of holders)
    if (ids.length > 1)
      diagnostics.push({
        severity: "error",
        code: "schematic.duplicateReference",
        reference,
        message: `Duplicate reference '${reference}': ${ids.join(", ")}.`,
      });
  if (diagnostics.length) return { diagnostics };
  const mappings = new Map<string, ReturnType<typeof mapKicadSymbol>>();
  const parts: BreadboardNetlistSemantic["parts"][number][] = [];
  for (const component of netlist.components) {
    const mapping = mapKicadSymbol({
      lib: "nodetto",
      name: component.partName,
      reference: component.reference,
      value: component.value,
      footprint: "",
      pins: component.pins.map((pin) => ({
        number: String(pin.number),
        name: pin.name,
      })),
    });
    diagnostics.push(...mapping.diagnostics);
    if (mapping.kind === "skip") {
      diagnostics.push({
        severity: "error",
        code: "schematic.unprojectablePart",
        reference: component.reference,
        message: `Cannot project '${component.reference}'.`,
      });
      continue;
    }
    mappings.set(component.reference, mapping);
    parts.push({
      reference: component.reference,
      value: component.value,
      type: mapping.type,
    });
  }
  if (diagnostics.some((diagnostic) => diagnostic.severity === "error"))
    return { diagnostics };
  parts.sort((a, b) => compareReferences(a.reference, b.reference));
  const order = new Map(parts.map((part, index) => [part.reference, index]));
  const compareNodes = (
    a: { reference: string; pin: number },
    b: { reference: string; pin: number },
  ) =>
    (order.get(a.reference) ?? 0) - (order.get(b.reference) ?? 0) ||
    a.pin - b.pin;
  const nets: BreadboardNetlistSemantic["nets"][number][] = [];
  for (const net of netlist.nets) {
    const nodes: { reference: string; pin: number }[] = [];
    for (const node of net.nodes) {
      const mapping = mappings.get(node.reference);
      const pin =
        mapping?.kind === "part"
          ? mapping.pinMap.get(String(node.pin))
          : undefined;
      if (pin === undefined) {
        diagnostics.push({
          severity: "error",
          code: "schematic.unprojectablePart",
          reference: node.reference,
          message: `Cannot map pin ${node.pin} on '${node.reference}'.`,
        });
        continue;
      }
      nodes.push({ reference: node.reference, pin });
    }
    nodes.sort(compareNodes);
    nets.push({ name: net.name, nodes });
  }
  if (diagnostics.some((diagnostic) => diagnostic.severity === "error"))
    return { diagnostics };
  nets.sort((a, b) =>
    a.nodes[0] && b.nodes[0]
      ? compareNodes(a.nodes[0], b.nodes[0])
      : a.nodes.length - b.nodes.length,
  );
  return {
    target: {
      source: `${options.pageName}.net`,
      format: "kicad_net",
      parts,
      nets,
    },
    diagnostics,
  };
}
