import {
  compareReferences,
  type BreadboardImportDiagnostic,
  type BreadboardImportPart,
  type BreadboardImportPlan,
} from "@nodetto/ir";
import {
  atomAt,
  child,
  children,
  SEXPR_SLOT,
  type SexprList,
} from "./sexpr.ts";
import { mapKicadSymbol } from "./symbol-map.ts";

const atom = (list: SexprList | undefined, key: string) => {
  const item = list ? child(list, key) : undefined;
  return item ? atomAt(item, SEXPR_SLOT.value) : undefined;
};
const listHead = (list: SexprList, key: string) => children(list, key);
type Part = BreadboardImportPart & {
  readonly sourcePins: ReadonlyMap<string, number>;
  readonly pinCount: number;
};

export function importNetlist(
  root: SexprList,
  fileName: string,
  diagnostics: BreadboardImportDiagnostic[],
): BreadboardImportPlan {
  const components = child(root, "components");
  const libparts = child(root, "libparts");
  const componentRows = components ? listHead(components, "comp") : [];
  const libRows = libparts ? listHead(libparts, "libpart") : [];
  const libPins = new Map<string, { number: string; name?: string }[]>();
  for (const row of libRows) {
    const lib = atom(row, "lib") ?? "";
    const name = atom(row, "part") ?? "";
    const pinsBlock = child(row, "pins");
    libPins.set(
      `${lib}:${name}`,
      pinsBlock
        ? listHead(pinsBlock, "pin").flatMap((pin) => {
            const number = atom(pin, "num");
            const pinName = atom(pin, "name");
            return number
              ? [{ number, ...(pinName ? { name: pinName } : {}) }]
              : [];
          })
        : [],
    );
  }
  const parts = new Map<string, Part>();
  for (const row of componentRows) {
    const reference = atom(row, "ref");
    if (!reference) {
      diagnostics.push({
        severity: "warning",
        code: "kicad.missingReference",
        message: "A component without a reference was skipped.",
      });
      continue;
    }
    if (parts.has(reference)) {
      diagnostics.push({
        severity: "warning",
        code: "kicad.duplicateReference",
        reference,
        message: `Duplicate component '${reference}' was skipped.`,
      });
      continue;
    }
    const value = atom(row, "value") ?? "";
    const libsource = child(row, "libsource");
    const lib = atom(libsource, "lib") ?? "";
    const name = atom(libsource, "part") ?? "";
    const key = `${lib}:${name}`;
    const listedPins = libPins.get(key) ?? [];
    const nodeRows = child(root, "nets")
      ? listHead(child(root, "nets") as SexprList, "net").flatMap((net) =>
          listHead(net, "node").filter(
            (node) => atom(node, "ref") === reference,
          ),
        )
      : [];
    const nodePins = nodeRows.map((node) => atom(node, "pin") ?? "");
    const largest = nodePins.reduce(
      (max, pin) => (/^\d+$/.test(pin) ? Math.max(max, Number(pin)) : max),
      0,
    );
    const pinFunctions = new Map(
      nodeRows.flatMap((node) => {
        const number = atom(node, "pin");
        const functionName = atom(node, "pinfunction");
        return number && functionName ? [[number, functionName] as const] : [];
      }),
    );
    const pins = (
      listedPins.length
        ? listedPins
        : Array.from({ length: largest }, (_, index) => ({
            number: String(index + 1),
          }))
    ).map((pin) => ({
      ...pin,
      ...(pinFunctions.get(pin.number)
        ? { name: pinFunctions.get(pin.number) }
        : {}),
    }));
    const mapping = mapKicadSymbol({
      lib,
      name,
      reference,
      value,
      pins,
      footprint: atom(row, "footprint"),
    });
    diagnostics.push(...mapping.diagnostics);
    if (mapping.kind === "skip") continue;
    const map = mapping.pinMap;
    parts.set(reference, {
      reference,
      value,
      type: mapping.type,
      parameters: mapping.parameters,
      sourcePins: map,
      pinCount: pins.length,
    });
  }

  const netRows = child(root, "nets");
  const netParts: {
    name: string;
    nodes: { reference: string; pin: number; order: number }[];
    order: number;
  }[] = [];
  if (netRows)
    for (const [netIndex, net] of listHead(netRows, "net").entries()) {
      const name = atom(net, "name") ?? `N_${netIndex + 1}`;
      const nodes: { reference: string; pin: number; order: number }[] = [];
      for (const [nodeIndex, node] of listHead(net, "node").entries()) {
        const reference = atom(node, "ref") ?? "";
        const sourcePin = atom(node, "pin") ?? "";
        const part = parts.get(reference);
        if (!part) continue;
        const pin = part.sourcePins.get(sourcePin);
        if (!pin || !/^[1-9]\d*$/.test(sourcePin)) {
          diagnostics.push({
            severity: "warning",
            code: "kicad.unmappedPin",
            reference,
            message: `Pin '${sourcePin}' on '${reference}' cannot be mapped.`,
          });
          continue;
        }
        nodes.push({ reference, pin, order: netIndex * 10000 + nodeIndex });
      }
      if (nodes.length) netParts.push({ name, nodes, order: netIndex });
    }
  for (const part of parts.values())
    for (const pin of new Set(part.sourcePins.values())) {
      if (
        !netParts.some((net) =>
          net.nodes.some(
            (node) => node.reference === part.reference && node.pin === pin,
          ),
        )
      ) {
        netParts.push({
          name: `N_${part.reference}_${pin}`,
          nodes: [
            { reference: part.reference, pin, order: Number.MAX_SAFE_INTEGER },
          ],
          order: Number.MAX_SAFE_INTEGER,
        });
      }
    }
  const sortedParts = [...parts.values()].sort((a, b) =>
    compareReferences(a.reference, b.reference),
  );
  const partOrder = new Map(
    sortedParts.map((part, index) => [part.reference, index]),
  );
  const nets = netParts
    .map((net) => ({
      ...net,
      nodes: [...net.nodes].sort(
        (a, b) =>
          (partOrder.get(a.reference) ?? 0) -
            (partOrder.get(b.reference) ?? 0) || a.pin - b.pin,
      ),
    }))
    .sort((a, b) => {
      const [an] = a.nodes;
      const [bn] = b.nodes;
      return (
        (an ? (partOrder.get(an.reference) ?? 0) : 0) -
          (bn ? (partOrder.get(bn.reference) ?? 0) : 0) ||
        (an?.pin ?? 0) - (bn?.pin ?? 0) ||
        a.order - b.order
      );
    });
  const planParts = sortedParts.map(
    ({ reference, value, type, parameters }) => ({
      reference,
      value,
      type,
      parameters,
    }),
  );
  return {
    title: fileName.replace(/\.[^.]*$/, ""),
    source: fileName,
    format: "kicad_net",
    parts: planParts,
    target: {
      source: fileName,
      format: "kicad_net",
      parts: planParts.map(({ reference, value, type }) => ({
        reference,
        value,
        type,
      })),
      nets: nets.map(({ name, nodes }) => ({
        name,
        nodes: nodes.map(({ reference, pin }) => ({ reference, pin })),
      })),
    },
  };
}
