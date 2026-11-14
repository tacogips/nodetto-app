import {
  closeSync,
  existsSync,
  openSync,
  readdirSync,
  readSync,
} from "node:fs";
import { extname, join } from "node:path";
import { FALLBACK_FONT_FILES, FONT_FILES } from "./render-profile.ts";

function ignored(cp: number): boolean {
  return (
    cp <= 0x7f ||
    (cp >= 0xd800 && cp <= 0xdfff) ||
    (cp >= 0x200b && cp <= 0x200f) ||
    (cp >= 0x2028 && cp <= 0x202e) ||
    (cp >= 0x2060 && cp <= 0x206f) ||
    (cp >= 0xfe00 && cp <= 0xfe0f) ||
    cp === 0xfeff ||
    (cp >= 0xe0100 && cp <= 0xe01ef)
  );
}

function directoryFonts(dir: string): string[] {
  const result: string[] = [];
  try {
    for (const entry of readdirSync(dir, { withFileTypes: true })) {
      const path = join(dir, entry.name);
      if (entry.isDirectory()) result.push(...directoryFonts(path));
      else if (
        entry.isFile() &&
        [".ttf", ".otf", ".ttc", ".otc"].includes(
          extname(entry.name).toLowerCase(),
        )
      )
        result.push(path);
    }
  } catch {
    /* Ignore inaccessible directories. */
  }
  return result;
}

function coverFile(path: string, missing: Set<number>): void {
  let fd: number | undefined;
  try {
    fd = openSync(path, "r");
    const file = fd;
    const read = (offset: number, length: number): Buffer => {
      if (
        !Number.isSafeInteger(offset) ||
        offset < 0 ||
        length < 0 ||
        length > 1_000_000
      )
        throw new Error("Invalid font offset");
      const data = Buffer.alloc(length);
      if (readSync(file, data, 0, length, offset) !== length)
        throw new Error("Truncated font");
      return data;
    };
    const header = read(0, 12);
    const collection = header.toString("ascii", 0, 4) === "ttcf";
    const count = collection ? header.readUInt32BE(8) : 1;
    if (count > 4096) throw new Error("Invalid collection");
    const offsets = collection ? read(12, count * 4) : undefined;
    for (let face = 0; face < count && missing.size; face++) {
      const start = offsets ? offsets.readUInt32BE(face * 4) : 0;
      const sfnt = read(start, 12);
      const tables = sfnt.readUInt16BE(4);
      const entries = read(start + 12, tables * 16);
      let cmap = -1;
      for (let i = 0; i < tables; i++) {
        if (entries.toString("ascii", i * 16, i * 16 + 4) === "cmap") {
          cmap = entries.readUInt32BE(i * 16 + 8);
          break;
        }
      }
      if (cmap < 0) continue;
      const cmapHeader = read(cmap, 4);
      const records = read(cmap + 4, cmapHeader.readUInt16BE(2) * 8);
      for (let i = 0; i < records.length && missing.size; i += 8) {
        const platform = records.readUInt16BE(i);
        const encoding = records.readUInt16BE(i + 2);
        if (
          platform !== 0 &&
          !(platform === 3 && (encoding === 1 || encoding === 10))
        )
          continue;
        const offset = cmap + records.readUInt32BE(i + 4);
        const prefix = read(offset, 16);
        const format = prefix.readUInt16BE(0);
        if (format === 4) {
          const length = prefix.readUInt16BE(2);
          const sub = read(offset, length);
          const segments = sub.readUInt16BE(6) / 2;
          const ends = 14;
          const starts = ends + segments * 2 + 2;
          const deltas = starts + segments * 2;
          const ranges = deltas + segments * 2;
          for (const cp of missing) {
            if (cp > 0xffff) continue;
            for (let n = 0; n < segments; n++) {
              if (cp > sub.readUInt16BE(ends + n * 2)) continue;
              if (cp < sub.readUInt16BE(starts + n * 2)) break;
              const delta = sub.readInt16BE(deltas + n * 2);
              const range = sub.readUInt16BE(ranges + n * 2);
              const glyphOffset =
                ranges +
                n * 2 +
                range +
                (cp - sub.readUInt16BE(starts + n * 2)) * 2;
              const glyph =
                range === 0
                  ? (cp + delta) & 0xffff
                  : sub.readUInt16BE(glyphOffset);
              if (
                glyph !== 0 &&
                (range === 0 || ((glyph + delta) & 0xffff) !== 0)
              )
                missing.delete(cp);
              break;
            }
          }
        } else if (format === 12) {
          const groups = prefix.readUInt32BE(12);
          if (groups > 100_000) throw new Error("Invalid cmap");
          const data = read(offset + 16, groups * 12);
          for (const cp of missing) {
            let low = 0;
            let high = groups;
            while (low < high) {
              const mid = Math.floor((low + high) / 2);
              const pos = mid * 12;
              const first = data.readUInt32BE(pos);
              const last = data.readUInt32BE(pos + 4);
              if (cp < first) high = mid;
              else if (cp > last) low = mid + 1;
              else {
                if (data.readUInt32BE(pos + 8) + cp - first !== 0)
                  missing.delete(cp);
                break;
              }
            }
          }
        }
      }
    }
  } catch {
    /* Ignore unreadable and invalid faces. */
  } finally {
    if (fd !== undefined) closeSync(fd);
  }
}

export function fontCoverage(
  text: string,
  fontDir: string | undefined,
):
  | { readonly needsFallback: boolean; readonly missing: readonly number[] }
  | undefined {
  const missing = new Set<number>();
  for (const char of text) {
    const cp = char.codePointAt(0);
    if (cp !== undefined && !ignored(cp)) missing.add(cp);
  }
  if (!missing.size) return { needsFallback: false, missing: [] };
  const base = FONT_FILES.filter(existsSync);
  if (!base.length && fontDir === undefined) return undefined;
  if (fontDir !== undefined) base.push(...directoryFonts(fontDir));
  for (const file of base) {
    coverFile(file, missing);
    if (!missing.size) break;
  }
  const needsFallback = missing.size > 0;
  if (needsFallback)
    for (const file of FALLBACK_FONT_FILES.filter(existsSync)) {
      coverFile(file, missing);
      if (!missing.size) break;
    }
  return { needsFallback, missing: [...missing].sort((a, b) => a - b) };
}
