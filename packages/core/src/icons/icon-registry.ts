import { LUCIDE_DATA, LUCIDE_VERSION } from "./lucide-data.generated.ts";

export interface IconNode {
  readonly element: string;
  readonly attrs: Readonly<Record<string, string>>;
}
export interface IconDefinition {
  readonly name: string;
  readonly tags: readonly string[];
  readonly nodes: readonly IconNode[];
}
export const ICON_SET_VERSION = LUCIDE_VERSION;
let cache: Map<string, IconDefinition> | undefined;
function registry(): Map<string, IconDefinition> {
  if (!cache) {
    const rows = JSON.parse(LUCIDE_DATA) as [
      string,
      string[],
      [string, Record<string, string>][],
    ][];
    cache = new Map(
      rows.map(([name, tags, nodes]) => [
        name,
        {
          name,
          tags,
          nodes: nodes.map(([element, attrs]) => ({ element, attrs })),
        },
      ]),
    );
  }
  return cache;
}
export function normalizeIconName(name: string): string | undefined {
  const value = name.startsWith("lucide:") ? name.slice(7) : name;
  return /^[a-z0-9]+(-[a-z0-9]+)*$/.test(value) ? value : undefined;
}
export function findIcon(name: string): IconDefinition | undefined {
  const normalized = normalizeIconName(name);
  return normalized === undefined ? undefined : registry().get(normalized);
}
export function iconNames(): readonly string[] {
  return [...registry().keys()].sort();
}
export function searchIcons(query: string, limit = 50): readonly string[] {
  const needle = query.trim().toLowerCase();
  const ranked: [string, number][] = [];
  for (const icon of registry().values()) {
    const rank =
      !needle || icon.name === needle
        ? 0
        : icon.name.startsWith(needle)
          ? 1
          : icon.name.includes(needle)
            ? 2
            : icon.tags.some((tag) => tag.toLowerCase().includes(needle))
              ? 3
              : -1;
    if (rank >= 0) ranked.push([icon.name, rank]);
  }
  ranked.sort(
    (a, b) => a[1] - b[1] || (a[0] < b[0] ? -1 : a[0] > b[0] ? 1 : 0),
  );
  const names = ranked.map(([name]) => name);
  return limit <= 0 ? names : names.slice(0, limit);
}
