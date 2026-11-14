// A tiny self-authored TrueType face with a single visible glyph.
export function buildTestFont(
  codePoints: readonly number[],
  options?: { cmapFormats?: readonly (4 | 12)[] },
): Uint8Array {
  const points = [...new Set(codePoints)].sort((a, b) => a - b);
  const bmp = points.filter((cp) => cp < 0xffff);
  const segments = bmp.length + 1;
  const fmt4 = Buffer.alloc(16 + segments * 8);
  fmt4.writeUInt16BE(4, 0);
  fmt4.writeUInt16BE(fmt4.length, 2);
  fmt4.writeUInt16BE(segments * 2, 6);
  const power = 2 ** Math.floor(Math.log2(segments));
  fmt4.writeUInt16BE(power * 2, 8);
  fmt4.writeUInt16BE(Math.log2(power), 10);
  fmt4.writeUInt16BE(segments * 2 - power * 2, 12);
  const ends = 14;
  const starts = ends + segments * 2 + 2;
  const deltas = starts + segments * 2;
  for (let i = 0; i < segments; i++) {
    const cp = bmp[i] ?? 0xffff;
    fmt4.writeUInt16BE(cp, ends + i * 2);
    fmt4.writeUInt16BE(cp, starts + i * 2);
    fmt4.writeUInt16BE(
      (i === bmp.length ? 1 : 1 - cp) & 0xffff,
      deltas + i * 2,
    );
  }
  const fmt12 = Buffer.alloc(16 + points.length * 12);
  fmt12.writeUInt16BE(12, 0);
  fmt12.writeUInt32BE(fmt12.length, 4);
  fmt12.writeUInt32BE(points.length, 12);
  points.forEach((cp, i) => {
    fmt12.writeUInt32BE(cp, 16 + i * 12);
    fmt12.writeUInt32BE(cp, 20 + i * 12);
    fmt12.writeUInt32BE(1, 24 + i * 12);
  });
  const formats = options?.cmapFormats ?? [4, 12];
  const subtables = [
    ...(formats.includes(4) ? [{ encoding: 1, data: fmt4 }] : []),
    ...(formats.includes(12) ? [{ encoding: 10, data: fmt12 }] : []),
  ];
  let cmapOffset = 4 + subtables.length * 8;
  const cmap = Buffer.alloc(
    cmapOffset + subtables.reduce((sum, table) => sum + table.data.length, 0),
  );
  cmap.writeUInt16BE(subtables.length, 2);
  subtables.forEach((table, i) => {
    const record = 4 + i * 8;
    cmap.writeUInt16BE(3, record);
    cmap.writeUInt16BE(table.encoding, record + 2);
    cmap.writeUInt32BE(cmapOffset, record + 4);
    table.data.copy(cmap, cmapOffset);
    cmapOffset += table.data.length;
  });
  const head = Buffer.alloc(54);
  head.writeUInt32BE(0x00010000, 0);
  head.writeUInt32BE(0x5f0f3cf5, 12);
  head.writeUInt16BE(1000, 18);
  head.writeInt16BE(1, 50);
  const hhea = Buffer.alloc(36);
  hhea.writeUInt32BE(0x00010000, 0);
  hhea.writeInt16BE(800, 4);
  hhea.writeInt16BE(-200, 6);
  hhea.writeUInt16BE(2, 34);
  const maxp = Buffer.alloc(32);
  maxp.writeUInt32BE(0x00010000, 0);
  maxp.writeUInt16BE(2, 4);
  const hmtx = Buffer.alloc(8);
  hmtx.writeUInt16BE(600, 0);
  hmtx.writeUInt16BE(600, 4);
  const glyf = Buffer.alloc(24);
  glyf.writeInt16BE(1, 0);
  glyf.writeInt16BE(200, 6);
  glyf.writeInt16BE(200, 8);
  glyf.writeUInt16BE(2, 10);
  glyf.writeUInt16BE(0, 12);
  glyf.set([0x31, 0x33, 0x35, 200, 200], 14);
  const loca = Buffer.alloc(12);
  loca.writeUInt32BE(0, 0);
  loca.writeUInt32BE(0, 4);
  loca.writeUInt32BE(glyf.length, 8);
  const label = Buffer.from("NodettoFixture", "utf16le").swap16();
  const name = Buffer.alloc(30 + label.length);
  name.writeUInt16BE(2, 2);
  name.writeUInt16BE(30, 4);
  for (let i = 0; i < 2; i++) {
    const pos = 6 + i * 12;
    name.writeUInt16BE(3, pos);
    name.writeUInt16BE(1, pos + 2);
    name.writeUInt16BE(0x409, pos + 4);
    name.writeUInt16BE(i === 0 ? 1 : 6, pos + 6);
    name.writeUInt16BE(label.length, pos + 8);
  }
  label.copy(name, 30);
  const os2 = Buffer.alloc(78);
  os2.writeUInt16BE(400, 4);
  os2.writeUInt16BE(5, 6);
  os2.writeInt16BE(800, 68);
  os2.writeInt16BE(-200, 70);
  os2.writeUInt16BE(800, 74);
  os2.writeUInt16BE(200, 76);
  const post = Buffer.alloc(32);
  post.writeUInt32BE(0x00030000, 0);
  const tables: [string, Buffer][] = [
    ["OS/2", os2],
    ["cmap", cmap],
    ["glyf", glyf],
    ["head", head],
    ["hhea", hhea],
    ["hmtx", hmtx],
    ["loca", loca],
    ["maxp", maxp],
    ["name", name],
    ["post", post],
  ];
  let offset = 12 + tables.length * 16;
  const total =
    offset +
    tables.reduce((sum, [, data]) => sum + ((data.length + 3) & ~3), 0);
  const result = Buffer.alloc(total);
  result.writeUInt32BE(0x00010000, 0);
  result.writeUInt16BE(tables.length, 4);
  tables.forEach(([tag, data], i) => {
    const entry = 12 + i * 16;
    result.write(tag, entry, 4, "ascii");
    result.writeUInt32BE(offset, entry + 8);
    result.writeUInt32BE(data.length, entry + 12);
    data.copy(result, offset);
    offset += (data.length + 3) & ~3;
  });
  return result;
}

export function buildTestCollection(fonts: readonly Uint8Array[]): Uint8Array {
  let offset = 12 + fonts.length * 4;
  const result = Buffer.alloc(
    offset + fonts.reduce((sum, font) => sum + ((font.length + 3) & ~3), 0),
  );
  result.write("ttcf", 0);
  result.writeUInt32BE(0x00010000, 4);
  result.writeUInt32BE(fonts.length, 8);
  fonts.forEach((font, i) => {
    result.writeUInt32BE(offset, 12 + i * 4);
    Buffer.from(font).copy(result, offset);
    const count = result.readUInt16BE(offset + 4);
    for (let n = 0; n < count; n++) {
      const pos = offset + 12 + n * 16 + 8;
      result.writeUInt32BE(result.readUInt32BE(pos) + offset, pos);
    }
    offset += (font.length + 3) & ~3;
  });
  return result;
}
