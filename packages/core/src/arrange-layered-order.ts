import type { ElementId } from "@nodetto/ir";

export type MemberOrder = "rank" | "input" | "barycenter";

export function orderColumnMembers(
  kind: MemberOrder,
  columns: readonly (readonly ElementId[])[],
  neighbors: ReadonlyMap<ElementId, readonly ElementId[]>,
  stackPosition: (id: ElementId) => number,
): ElementId[][] {
  const result = columns.map((column) => [...column]);
  if (kind === "input") {
    for (const column of result)
      column.sort((a, b) => stackPosition(a) - stackPosition(b));
  }
  if (kind !== "barycenter") return result;
  const owners = new Map<ElementId, number>();
  for (const [index, column] of result.entries())
    for (const id of column) owners.set(id, index);
  for (let sweep = 0; sweep < 4; sweep++) {
    for (let step = 0; step < result.length; step++) {
      const columnIndex = sweep % 2 === 0 ? step : result.length - 1 - step;
      const column = result[columnIndex];
      if (!column) continue;
      const positions = new Map<ElementId, number>();
      for (const other of result)
        for (const [index, id] of other.entries())
          positions.set(id, index / Math.max(other.length - 1, 1));
      const keys = new Map<ElementId, number>();
      for (const [index, id] of column.entries()) {
        let total = 0;
        let count = 0;
        for (const neighbor of neighbors.get(id) ?? []) {
          const position = positions.get(neighbor);
          if (
            position !== undefined &&
            owners.get(neighbor) !== columnIndex &&
            owners.has(neighbor)
          ) {
            total += position;
            count++;
          }
        }
        keys.set(
          id,
          count ? total / count : index / Math.max(column.length - 1, 1),
        );
      }
      column.sort((a, b) => (keys.get(a) ?? 0) - (keys.get(b) ?? 0));
    }
  }
  return result;
}
