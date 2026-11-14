import type { BreadboardNetlist } from "@nodetto/ir";
import { compareReferences } from "@nodetto/ir";
import type { BreadboardFormatterResult } from "./index.ts";

function csv(value: string): string {
  return /[,"\r\n]/.test(value) ? `"${value.replaceAll('"', '""')}"` : value;
}

function firstReference(
  components: readonly { readonly reference: string }[],
): string {
  const [first] = components;
  return first?.reference ?? "";
}

export function exportBreadboardBomCsv(
  netlist: BreadboardNetlist,
): BreadboardFormatterResult {
  const groups = new Map<string, typeof netlist.components>();
  for (const component of netlist.components) {
    const key = JSON.stringify([
      component.type,
      component.value,
      component.description,
      component.footprint,
    ]);
    groups.set(key, [...(groups.get(key) ?? []), component]);
  }
  const ordered = [...groups.values()].map((components) =>
    [...components].sort((a, b) => compareReferences(a.reference, b.reference)),
  );
  ordered.sort((a, b) =>
    compareReferences(firstReference(a), firstReference(b)),
  );
  const rows = ["Item,Qty,References,Value,Part,Footprint"];
  ordered.forEach((components, index) => {
    const [first] = components;
    if (!first) return;
    rows.push(
      [
        String(index + 1),
        String(components.length),
        components.map((component) => component.reference).join(", "),
        first.value,
        first.description,
        first.footprint,
      ]
        .map(csv)
        .join(","),
    );
  });
  return { text: `${rows.join("\n")}\n`, warnings: referenceWarnings(netlist) };
}

export function referenceWarnings(netlist: BreadboardNetlist): string[] {
  const counts = new Map<string, number>();
  for (const component of netlist.components)
    counts.set(component.reference, (counts.get(component.reference) ?? 0) + 1);
  const warnings: string[] = [];
  for (const component of netlist.components) {
    if (component.reference.endsWith("?"))
      warnings.push(`${component.reference}: unannotated reference`);
    else if ((counts.get(component.reference) ?? 0) > 1)
      warnings.push(`${component.reference}: duplicate reference`);
  }
  return warnings;
}
