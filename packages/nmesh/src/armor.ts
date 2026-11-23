import { NmeshError } from "./types.ts";

export const NMESH_INLINE_PREFIX = "nmesh1:";
export const NMESH_INLINE_MAX_CHARS = 1_048_576;

const alphabet =
  "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/";
const padding = "=".charCodeAt(0);
const alphabetIndex = new Int8Array(128).fill(-1);
for (let index = 0; index < alphabet.length; index++) {
  alphabetIndex[alphabet.charCodeAt(index)] = index;
}

export function toInline(bytes: Uint8Array): string {
  const length = 4 * Math.ceil(bytes.length / 3);
  if (
    length === 0 ||
    length + NMESH_INLINE_PREFIX.length > NMESH_INLINE_MAX_CHARS
  ) {
    throw new NmeshError("nmesh.inline");
  }
  const output = new Uint8Array(length);
  for (
    let index = 0, offset = 0;
    index < bytes.length;
    index += 3, offset += 4
  ) {
    const first = bytes[index] as number;
    const second = bytes[index + 1] ?? 0;
    const third = bytes[index + 2] ?? 0;
    output[offset] = alphabet.charCodeAt(first >>> 2);
    output[offset + 1] = alphabet.charCodeAt(
      ((first & 3) << 4) | (second >>> 4),
    );
    output[offset + 2] =
      index + 1 < bytes.length
        ? alphabet.charCodeAt(((second & 15) << 2) | (third >>> 6))
        : padding;
    output[offset + 3] =
      index + 2 < bytes.length ? alphabet.charCodeAt(third & 63) : padding;
  }
  return NMESH_INLINE_PREFIX + new TextDecoder().decode(output);
}

export function fromInline(text: string): Uint8Array {
  const start = NMESH_INLINE_PREFIX.length;
  const length = text.length - start;
  if (
    text.length > NMESH_INLINE_MAX_CHARS ||
    !text.startsWith(NMESH_INLINE_PREFIX) ||
    length <= 0 ||
    length % 4 !== 0
  ) {
    throw new NmeshError("nmesh.inline");
  }
  const padCount = text.endsWith("==") ? 2 : text.endsWith("=") ? 1 : 0;
  const dataEnd = text.length - padCount;
  const output = new Uint8Array((length / 4) * 3 - padCount);
  let bits = 0;
  let bitCount = 0;
  let offset = 0;
  for (let index = start; index < dataEnd; index++) {
    const value = alphabetIndex[text.charCodeAt(index)] ?? -1;
    if (value < 0) throw new NmeshError("nmesh.inline");
    bits = (bits << 6) | value;
    bitCount += 6;
    if (bitCount >= 8) {
      bitCount -= 8;
      output[offset++] = bits >>> bitCount;
      bits &= (1 << bitCount) - 1;
    }
  }
  if (bits !== 0) throw new NmeshError("nmesh.inline");
  return output;
}
