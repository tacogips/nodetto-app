export function firstUnusedName(
  base: string,
  suffixes: Iterable<string>,
  taken: Set<string>,
): string {
  if (!taken.has(base)) return base;
  for (const suffix of suffixes) {
    const candidate = `${base}${suffix}`;
    if (!taken.has(candidate)) return candidate;
  }
  throw new Error("No unused net name candidate");
}

export function assignNetNames(
  nets: readonly { code: number; explicit?: string; base: string }[],
): readonly string[] {
  const taken = new Set(
    nets.flatMap((net) => (net.explicit === undefined ? [] : [net.explicit])),
  );
  return nets.map((net) => {
    if (net.explicit !== undefined) return net.explicit;
    function* suffixes(): Generator<string> {
      yield `_${net.code}`;
      for (let i = 2; ; i++) yield `_${net.code}_${i}`;
    }
    const name = firstUnusedName(net.base, suffixes(), taken);
    taken.add(name);
    return name;
  });
}
