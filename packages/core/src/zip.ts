export interface ZipEntry {
  readonly path: string;
  readonly contents: Uint8Array;
}

const encoder = new TextEncoder();

function crc32(bytes: Uint8Array): number {
  let crc = 0xffffffff;
  for (const byte of bytes) {
    crc ^= byte;
    for (let i = 0; i < 8; i++) crc = (crc >>> 1) ^ (crc & 1 ? 0xedb88320 : 0);
  }
  return (crc ^ 0xffffffff) >>> 0;
}

/**
 * Portable ZIP (stored entries), usable by both browser and desktop without a
 * filesystem API. Timestamps are fixed so equal input gives equal bytes.
 * `label` names the archive in the size-limit error.
 */
export function encodeStoredZip(
  files: readonly ZipEntry[],
  label: string,
): Uint8Array {
  if (
    files.length > 65535 ||
    files.reduce((sum, file) => sum + file.contents.length, 0) >
      512 * 1024 * 1024
  )
    throw new Error(`${label} exceeds the ZIP export size limit.`);
  const parts: Uint8Array[] = [];
  const central: Uint8Array[] = [];
  let offset = 0;
  for (const file of files) {
    if (
      !/^[a-zA-Z0-9_./-]+$/.test(file.path) ||
      file.path.split("/").some((p) => !p || p === "." || p === "..")
    )
      throw new Error("Invalid bundle path");
    const name = encoder.encode(file.path);
    if (name.length > 65535) throw new Error("Bundle filename is too long.");
    const header = new Uint8Array(30 + name.length);
    const view = new DataView(header.buffer);
    const checksum = crc32(file.contents);
    view.setUint32(0, 0x04034b50, true);
    view.setUint16(4, 20, true);
    view.setUint16(12, 33, true); // 1980-01-01, deterministic archive.
    view.setUint32(14, checksum, true);
    view.setUint32(18, file.contents.length, true);
    view.setUint32(22, file.contents.length, true);
    view.setUint16(26, name.length, true);
    header.set(name, 30);
    const entry = new Uint8Array(46 + name.length);
    const cv = new DataView(entry.buffer);
    cv.setUint32(0, 0x02014b50, true);
    cv.setUint16(4, 20, true);
    cv.setUint16(6, 20, true);
    cv.setUint16(14, 33, true);
    cv.setUint32(16, checksum, true);
    cv.setUint32(20, file.contents.length, true);
    cv.setUint32(24, file.contents.length, true);
    cv.setUint16(28, name.length, true);
    cv.setUint32(42, offset, true);
    entry.set(name, 46);
    parts.push(header, file.contents);
    central.push(entry);
    offset += header.length + file.contents.length;
  }
  const size = central.reduce((sum, p) => sum + p.length, 0);
  const end = new Uint8Array(22);
  const ev = new DataView(end.buffer);
  ev.setUint32(0, 0x06054b50, true);
  ev.setUint16(8, central.length, true);
  ev.setUint16(10, central.length, true);
  ev.setUint32(12, size, true);
  ev.setUint32(16, offset, true);
  const result = new Uint8Array(offset + size + end.length);
  let at = 0;
  for (const part of [...parts, ...central, end]) {
    result.set(part, at);
    at += part.length;
  }
  return result;
}
