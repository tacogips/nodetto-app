// ZIP reader for stored and deflated entries, enough for fabrication
// archives. Encrypted entries, ZIP64 and multi-disk archives are refused.

import { inflateRaw } from "./drawio/inflate.ts";

export interface ZipFile {
  readonly path: string;
  readonly contents: Uint8Array;
}

export class ZipReadError extends Error {
  override readonly name = "ZipReadError";
}

const END_OF_DIRECTORY = 0x06054b50;
const DIRECTORY_ENTRY = 0x02014b50;
const LOCAL_HEADER = 0x04034b50;
const END_RECORD_SIZE = 22;
const MAX_COMMENT = 0xffff;
const MAX_TOTAL_BYTES = 256 * 1024 * 1024;

/** True when the bytes start like a ZIP archive. */
export function isZip(bytes: Uint8Array): boolean {
  return (
    bytes[0] === 0x50 && bytes[1] === 0x4b && bytes[2] === 3 && bytes[3] === 4
  );
}

/** Files of a ZIP archive, in directory order; folders are left out. */
export function readZip(bytes: Uint8Array): ZipFile[] {
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  const u16 = (at: number) => view.getUint16(at, true);
  const u32 = (at: number) => view.getUint32(at, true);
  let end = -1;
  const earliest = Math.max(0, bytes.length - END_RECORD_SIZE - MAX_COMMENT);
  for (let at = bytes.length - END_RECORD_SIZE; at >= earliest; at--)
    if (u32(at) === END_OF_DIRECTORY) {
      end = at;
      break;
    }
  if (end < 0)
    throw new ZipReadError("not a ZIP archive (no end of central directory)");
  if (u16(end + 4) !== 0 || u16(end + 6) !== 0)
    throw new ZipReadError("multi-disk ZIP archives are not supported");
  const count = u16(end + 10);
  let at = u32(end + 16);
  const files: ZipFile[] = [];
  let total = 0;
  for (let index = 0; index < count; index++) {
    if (at + 46 > bytes.length || u32(at) !== DIRECTORY_ENTRY)
      throw new ZipReadError("corrupt ZIP central directory");
    const flags = u16(at + 8);
    const method = u16(at + 10);
    const compressedSize = u32(at + 20);
    const size = u32(at + 24);
    const nameLength = u16(at + 28);
    const extraLength = u16(at + 30);
    const commentLength = u16(at + 32);
    const localOffset = u32(at + 42);
    const path = new TextDecoder().decode(
      bytes.subarray(at + 46, at + 46 + nameLength),
    );
    at += 46 + nameLength + extraLength + commentLength;
    if (path.endsWith("/")) continue;
    if (flags & 1) throw new ZipReadError(`${path} is encrypted`);
    if (compressedSize === 0xffffffff || size === 0xffffffff)
      throw new ZipReadError("ZIP64 archives are not supported");
    total += size;
    if (total > MAX_TOTAL_BYTES)
      throw new ZipReadError("the archive expands to more than 256 MiB");
    if (localOffset + 30 > bytes.length || u32(localOffset) !== LOCAL_HEADER)
      throw new ZipReadError(`corrupt local header for ${path}`);
    const start =
      localOffset + 30 + u16(localOffset + 26) + u16(localOffset + 28);
    const data = bytes.subarray(start, start + compressedSize);
    if (data.length !== compressedSize)
      throw new ZipReadError(`${path} is truncated`);
    if (method === 0) files.push({ path, contents: data });
    else if (method === 8) {
      const contents = inflateRaw(data, size);
      if (contents.length !== size)
        throw new ZipReadError(`${path} inflates to the wrong size`);
      files.push({ path, contents });
    } else
      throw new ZipReadError(
        `${path} uses unsupported compression method ${method}`,
      );
  }
  return files;
}
