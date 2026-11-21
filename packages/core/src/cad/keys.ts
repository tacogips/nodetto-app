import { isPlainObject } from "@nodetto/ir";

function fnv1aStep(hash: number, unit: number): number {
  const x = hash ^ unit;
  // Multiplication by the FNV prime (0x01000193), modulo 2^32.
  return (x + (x << 1) + (x << 4) + (x << 7) + (x << 8) + (x << 24)) >>> 0;
}

/** Two FNV-1a passes over the same length-delimited UTF-16 string. */
export function contentKey(parts: readonly string[]): string {
  const input = parts.map((part) => `${part.length}:${part}`).join("");
  let forward = 0x811c9dc5;
  let backward = forward;
  for (let i = 0; i < input.length; i += 1) {
    forward = fnv1aStep(forward, input.charCodeAt(i));
    backward = fnv1aStep(backward, input.charCodeAt(input.length - i - 1));
  }
  return (
    forward.toString(16).padStart(8, "0") +
    backward.toString(16).padStart(8, "0")
  );
}

export function canonicalCadJson(value: unknown): string {
  return JSON.stringify(value, (_key, item: unknown) =>
    isPlainObject(item)
      ? Object.fromEntries(
          Object.keys(item)
            .sort()
            .map((key) => [key, item[key]]),
        )
      : item,
  );
}
