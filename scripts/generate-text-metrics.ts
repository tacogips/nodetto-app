// Generate Liberation Sans 2.1.5 advances from the official release TTFs.
const [regularPath, boldPath] = process.argv.slice(2);
if (!regularPath || !boldPath) throw new Error("Expected regular.ttf bold.ttf");

async function readFont(path: string) {
  const bytes = await Bun.file(path).arrayBuffer();
  const view = new DataView(bytes);
  const u16 = (offset: number) => view.getUint16(offset);
  const i16 = (offset: number) => view.getInt16(offset);
  const u32 = (offset: number) => view.getUint32(offset);
  const tables = new Map<string, number>();
  for (let i = 0; i < u16(4); i++) {
    const p = 12 + i * 16;
    const name = String.fromCharCode(...new Uint8Array(bytes, p, 4));
    tables.set(name, u32(p + 8));
  }
  const table = (name: string) => {
    const offset = tables.get(name);
    if (offset === undefined) throw new Error(`Missing ${name}`);
    return offset;
  };
  const unitsPerEm = u16(table("head") + 18);
  const metricsCount = u16(table("hhea") + 34);
  const hmtx = table("hmtx");
  const cmap = table("cmap");
  let subtable = 0;
  for (let i = 0; i < u16(cmap + 2); i++) {
    const p = cmap + 4 + i * 8;
    const candidate = cmap + u32(p + 4);
    if (u16(p) === 3 && u16(p + 2) === 1 && u16(candidate) === 4) {
      subtable = candidate;
      break;
    }
  }
  if (!subtable) throw new Error("Missing cmap format 4");
  const count = u16(subtable + 6) / 2;
  const end = subtable + 14;
  const start = end + count * 2 + 2;
  const delta = start + count * 2;
  const range = delta + count * 2;
  const advances: number[] = [];
  for (let cp = 0x20; cp <= 0xff; cp++) {
    let glyph = 0;
    for (let i = 0; i < count; i++) {
      if (cp > u16(end + i * 2)) continue;
      if (cp < u16(start + i * 2)) break;
      const offset = u16(range + i * 2);
      glyph = offset ? u16(range + i * 2 + offset + 2 * (cp - u16(start + i * 2))) : cp;
      if (glyph) glyph = (glyph + i16(delta + i * 2)) & 0xffff;
      break;
    }
    advances.push(glyph ? u16(hmtx + Math.min(glyph, metricsCount - 1) * 4) : -1);
  }
  return { unitsPerEm, advances, hash: new Bun.CryptoHasher("sha256").update(bytes).digest("hex") };
}
const regular = await readFont(regularPath);
const bold = await readFont(boldPath);
if (regular.unitsPerEm !== bold.unitsPerEm) throw new Error("Mismatched unitsPerEm");
const output = `// Liberation Sans 2.1.5; regular SHA-256: ${regular.hash}; bold SHA-256: ${bold.hash}\n// Generator: bun scripts/generate-text-metrics.ts <regular.ttf> <bold.ttf>\nexport const LIBERATION_SANS_ADVANCES = {\n  unitsPerEm: ${regular.unitsPerEm},\n  regular: ${JSON.stringify(regular.advances)},\n  bold: ${JSON.stringify(bold.advances)},\n} as const;\n`;
await Bun.write("packages/core/src/text-metrics/advances.generated.ts", output);
