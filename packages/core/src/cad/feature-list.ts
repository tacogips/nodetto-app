import {
  type Element,
  type ElementId,
  isCadTypeName,
  isPlainObject,
} from "@nodetto/ir";
import { layerName } from "../layer-name.ts";
import { compareCadHistoryOrder, isSketchEntity } from "./history.ts";

export interface CadFeatureRow {
  readonly id: ElementId;
  readonly depth: 0 | 1;
  readonly name: string;
  readonly type: string;
}

/** Keep each sketch's entities with it, even when their indices interleave. */
export function cadFeatureRows(
  elements: readonly Element[],
): readonly CadFeatureRow[] {
  const ordered = elements
    .filter(({ type }) => isCadTypeName(type))
    .sort(compareCadHistoryOrder);
  const sketches = new Map(
    ordered
      .filter(({ type }) => type === "cad.sketch")
      .map(({ id, page }) => [id, { page, entities: [] as CadFeatureRow[] }]),
  );
  const features: CadFeatureRow[] = [];
  const orphans: CadFeatureRow[] = [];
  for (const element of ordered) {
    const { id, page, type, semantic } = element;
    const row = { id, type, name: layerName(element), depth: 0 as const };
    if (!isSketchEntity(type)) {
      features.push(row);
      continue;
    }
    const sketch = isPlainObject(semantic) ? semantic.sketch : undefined;
    const parent =
      typeof sketch === "string" ? sketches.get(sketch) : undefined;
    if (parent?.page === page) parent.entities.push({ ...row, depth: 1 });
    else orphans.push(row);
  }
  return [
    ...features.flatMap((row) => [
      row,
      ...(sketches.get(row.id)?.entities ?? []),
    ]),
    ...orphans,
  ];
}
