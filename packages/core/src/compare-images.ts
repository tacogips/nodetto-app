export function pngInfo(bytes: Uint8Array): {
  readonly width: number;
  readonly height: number;
} {
  const signature = [137, 80, 78, 71, 13, 10, 26, 10];
  if (bytes.length < 24) throw new Error("not a PNG: truncated header");
  if (!signature.every((byte, i) => bytes[i] === byte))
    throw new Error("not a PNG: invalid signature");
  if (
    bytes[8] !== 0 ||
    bytes[9] !== 0 ||
    bytes[10] !== 0 ||
    bytes[11] !== 13 ||
    bytes[12] !== 73 ||
    bytes[13] !== 72 ||
    bytes[14] !== 68 ||
    bytes[15] !== 82
  )
    throw new Error("not a PNG: missing IHDR");
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  const width = view.getUint32(16);
  const height = view.getUint32(20);
  if (!width || !height) throw new Error("not a PNG: invalid dimensions");
  return { width, height };
}

export function leadingNumber(name: string): number | undefined {
  const base = name.split(/[\\/]/).pop() ?? name;
  const match = /^\d+/.exec(base);
  return match ? Number(match[0]) : undefined;
}

export function pairByLeadingNumber<T>(
  actual: readonly { name: string; value: T }[],
  reference: readonly { name: string; value: T }[],
): readonly { number: number; actual: T; reference: T }[] {
  const collect = (items: readonly { name: string; value: T }[]) => {
    const map = new Map<number, { name: string; value: T }>();
    for (const item of items) {
      const number = leadingNumber(item.name);
      if (number === undefined || !Number.isSafeInteger(number))
        throw new Error(`missing leading number: ${item.name}`);
      const previous = map.get(number);
      if (previous)
        throw new Error(`duplicate number: ${previous.name}, ${item.name}`);
      map.set(number, item);
    }
    return map;
  };
  const a = collect(actual);
  const r = collect(reference);
  const unmatched = [...a.entries()]
    .filter(([n]) => !r.has(n))
    .map(([, item]) => item.name)
    .concat(
      [...r.entries()].filter(([n]) => !a.has(n)).map(([, item]) => item.name),
    );
  if (unmatched.length)
    throw new Error(`unmatched numbers: ${unmatched.join(", ")}`);
  return [...a.keys()]
    .sort((x, y) => x - y)
    .map((number) => {
      const actualItem = a.get(number);
      const referenceItem = r.get(number);
      if (!actualItem || !referenceItem)
        throw new Error(`unmatched number: ${number}`);
      return {
        number,
        actual: actualItem.value,
        reference: referenceItem.value,
      };
    });
}

export interface ComparisonBand {
  readonly y0: number;
  readonly y1: number;
  readonly dy: number;
}
export function parseBand(text: string): ComparisonBand {
  const parts = text.split(":");
  if (parts.length !== 3 || parts.some((part) => !part.trim()))
    throw new Error(`invalid band: ${text}`);
  const [y0, y1, dy] = parts.map(Number);
  if (![y0, y1, dy].every(Number.isFinite) || y0 >= y1)
    throw new Error(`invalid band: ${text}`);
  return { y0, y1, dy };
}

const BASE64 =
  "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/";
function base64(bytes: Uint8Array): string {
  const chunks: string[] = [];
  for (let start = 0; start < bytes.length; start += 12288) {
    let chunk = "";
    const end = Math.min(start + 12288, bytes.length);
    for (let i = start; i < end; i += 3) {
      const a = bytes[i];
      const b = bytes[i + 1] ?? 0;
      const c = bytes[i + 2] ?? 0;
      chunk +=
        BASE64[a >> 2] +
        BASE64[((a & 3) << 4) | (b >> 4)] +
        (i + 1 < bytes.length ? BASE64[((b & 15) << 2) | (c >> 6)] : "=") +
        (i + 2 < bytes.length ? BASE64[c & 63] : "=");
    }
    chunks.push(chunk);
  }
  return chunks.join("");
}
const escapeXml = (s: string) =>
  s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");

export function composeComparisonSvg(options: {
  readonly reference: Uint8Array;
  readonly actual: Uint8Array;
  readonly scale: number;
  readonly bands?: readonly ComparisonBand[];
  readonly grid?: number;
  readonly labels?: readonly [string, string, string];
}): { readonly svg: string; readonly warnings: readonly string[] } {
  const ref = pngInfo(options.reference);
  const actual = pngInfo(options.actual);
  if (!Number.isFinite(options.scale) || options.scale <= 0)
    throw new Error("scale must be positive");
  if (
    options.grid !== undefined &&
    (!Number.isFinite(options.grid) || options.grid <= 0)
  )
    throw new Error("grid must be positive");
  const w = ref.width / options.scale;
  const h = ref.height / options.scale;
  const actualH = (actual.height * w) / actual.width;
  const warnings =
    ref.width === actual.width && ref.height === actual.height
      ? []
      : [
          `actual is ${actual.width}x${actual.height}, reference is ${ref.width}x${ref.height}`,
        ];
  const bands = options.bands?.length
    ? options.bands
    : [{ y0: 0, y1: h, dy: 0 }];
  if (
    bands.some(
      (b) => ![b.y0, b.y1, b.dy].every(Number.isFinite) || b.y0 >= b.y1,
    )
  )
    throw new Error("invalid band");
  const refUrl = `data:image/png;base64,${base64(options.reference)}`;
  const actualUrl = `data:image/png;base64,${base64(options.actual)}`;
  const labels = options.labels ?? ["reference", "nodetto", "difference"];
  const image = (url: string, height: number) =>
    `<image href="${url}" x="0" y="0" width="${w}" height="${height}" preserveAspectRatio="none"/>`;
  const defs = bands
    .map(
      (b, i) =>
        `<clipPath id="band${i}"><rect x="0" y="${b.y0}" width="${w}" height="${b.y1 - b.y0}"/></clipPath>`,
    )
    .join("");
  const diff = bands
    .map(
      (b, i) =>
        `<g clip-path="url(#band${i})">${image(refUrl, h)}<g style="mix-blend-mode:difference" transform="translate(0 ${-b.dy})">${image(actualUrl, actualH)}</g></g>`,
    )
    .join("");
  const grid: string[] = [];
  if (options.grid) {
    for (let x = 0; x <= w; x += options.grid)
      grid.push(`<path d="M${x} 0V${h}"/>`);
    for (let y = 0; y <= h; y += options.grid)
      grid.push(`<path d="M0 ${y}H${w}"/>`);
  }
  const panels = [
    image(refUrl, h),
    image(actualUrl, actualH),
    `${diff}<g stroke="white" stroke-opacity="0.25" stroke-width="1">${grid.join("")}</g>`,
  ];
  const body = panels
    .map(
      (panel, i) =>
        `<g transform="translate(${i * (w + 16)} 0)"><text x="0" y="16" font-size="12">${escapeXml(labels[i])}</text><g transform="translate(0 24)">${panel}</g></g>`,
    )
    .join("");
  return {
    svg: `<svg xmlns="http://www.w3.org/2000/svg" width="${3 * w + 32}" height="${h + 24}" viewBox="0 0 ${3 * w + 32} ${h + 24}"><defs>${defs}</defs><rect width="${3 * w + 32}" height="24" fill="white"/>${body}</svg>`,
    warnings,
  };
}
