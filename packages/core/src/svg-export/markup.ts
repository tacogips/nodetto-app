// String-level SVG serialization: escaping, number spelling, tags.

export function escapeXml(text: string): string {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

/**
 * Two decimals, with no trailing zeros and no negative zero, so the same
 * geometry always spells itself the same way.
 */
export function fmt(value: number): string {
  if (!Number.isFinite(value)) {
    return "0";
  }
  const rounded = Math.round(value * 100) / 100;
  return Object.is(rounded, -0) ? "0" : String(rounded);
}

export type Attrs = Record<string, string | number | undefined>;

function serializeAttrs(map: Attrs): string {
  let out = "";
  for (const [name, value] of Object.entries(map)) {
    if (value === undefined) {
      continue;
    }
    const text = typeof value === "number" ? fmt(value) : value;
    out += ` ${name}="${escapeXml(text)}"`;
  }
  return out;
}

export function tag(name: string, map: Attrs): string {
  return `<${name}${serializeAttrs(map)} />`;
}

export function wrap(name: string, map: Attrs, children: string): string {
  return `<${name}${serializeAttrs(map)}>${children}</${name}>`;
}

export function text(map: Attrs, content: string): string {
  return wrap("text", map, escapeXml(content));
}

export function readField(source: unknown, field: string): unknown {
  if (typeof source !== "object" || source === null) {
    return undefined;
  }
  return (source as Record<string, unknown>)[field];
}

export function readString(source: unknown, field: string): string {
  const value = readField(source, field);
  return typeof value === "string" ? value : "";
}

export function readList(source: unknown, field: string): readonly unknown[] {
  const value = readField(source, field);
  return Array.isArray(value) ? value : [];
}
