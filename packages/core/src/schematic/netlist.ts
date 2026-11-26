import {
  compareReferences,
  isSchematicPartType,
  type Document,
  type PageId,
  type SchematicNetlist,
  type SchematicNetlistComponent,
  type SchematicPartType,
} from "@nodetto/ir";
import { compareFractional } from "../fractional.ts";
import type { SchematicConnectivity } from "./connectivity.ts";
import { assignNetNames } from "./net-names.ts";
import {
  schematicDescription,
  schematicPartName,
  schematicPinDefs,
} from "./symbols.ts";

export function toSchematicNetlist(
  document: Document,
  pageId: PageId,
  connectivity: SchematicConnectivity,
): SchematicNetlist {
  const elements = new Map(
    document.elements.map((element) => [element.id, element]),
  );
  const parts = document.elements
    .filter(
      (element) =>
        element.page === pageId &&
        !element.visual.hidden &&
        isSchematicPartType(element.type),
    )
    .sort(
      (a, b) =>
        compareReferences(
          (a.semantic as { reference: string }).reference,
          (b.semantic as { reference: string }).reference,
        ) || compareFractional(a.id, b.id),
    );
  const components: SchematicNetlistComponent[] = parts.map((element) => {
    const semantic = element.semantic as { reference: string; value: string };
    return {
      elementId: element.id,
      type: element.type as SchematicPartType,
      reference: semantic.reference,
      value: semantic.value,
      partName: schematicPartName(element),
      description: schematicDescription(element),
      footprint: "",
      pins: schematicPinDefs(element)
        .map(({ number, name }) => ({ number, name }))
        .sort((a, b) => a.number - b.number),
    };
  });
  const groups = new Map<
    number,
    { reference: string; pin: number; pinName: string }[]
  >();
  for (const component of components)
    for (const pin of component.pins) {
      const id = connectivity.netOfPin({
        elementId: component.elementId,
        pin: pin.number,
      });
      if (id === undefined) continue;
      const nodes = groups.get(id) ?? [];
      nodes.push({
        reference: component.reference,
        pin: pin.number,
        pinName: pin.name,
      });
      groups.set(id, nodes);
    }
  const netInfo = new Map(connectivity.nets.map((net) => [net.id, net]));
  const nameOf = (ids: readonly string[]) =>
    ids
      .map((id) =>
        (elements.get(id)?.semantic as { net: string } | undefined)?.net.trim(),
      )
      .filter((name): name is string => name !== undefined)
      .sort()[0];
  const rows = [...groups].map(([id, nodes], index) => {
    const net = netInfo.get(id);
    const first = nodes[0];
    return {
      code: index + 1,
      nodes,
      explicit: net
        ? (nameOf(net.powerIds) ?? nameOf(net.labelIds))
        : undefined,
      base: `N_${first?.reference ?? ""}_${first?.pin ?? 0}`,
    };
  });
  const names = assignNetNames(rows);
  return {
    pageId,
    pageName: document.pages.find((page) => page.id === pageId)?.name ?? "",
    documentTitle: document.title,
    components,
    nets: rows.map((row, index) => ({
      code: row.code,
      name: names[index] ?? "",
      nodes: row.nodes,
    })),
  };
}
