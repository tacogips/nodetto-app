// Raw DEFLATE (RFC 1951) decoding for compressed draw.io diagrams.
//
// draw.io stores each page as base64(deflateRaw(encodeURIComponent(xml))).
// The io package runs in browsers, Bun and the native CLI's embedded engine,
// which has neither zlib nor DecompressionStream, so this is a small
// synchronous decoder in the style of zlib's `puff`: canonical Huffman codes
// decoded bit by bit, which is plenty fast for diagram-sized inputs.

export class InflateError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "InflateError";
  }
}

const LENGTH_BASE = [
  3, 4, 5, 6, 7, 8, 9, 10, 11, 13, 15, 17, 19, 23, 27, 31, 35, 43, 51, 59, 67,
  83, 99, 115, 131, 163, 195, 227, 258,
];
const LENGTH_EXTRA = [
  0, 0, 0, 0, 0, 0, 0, 0, 1, 1, 1, 1, 2, 2, 2, 2, 3, 3, 3, 3, 4, 4, 4, 4, 5, 5,
  5, 5, 0,
];
const DISTANCE_BASE = [
  1, 2, 3, 4, 5, 7, 9, 13, 17, 25, 33, 49, 65, 97, 129, 193, 257, 385, 513, 769,
  1025, 1537, 2049, 3073, 4097, 6145, 8193, 12289, 16385, 24577,
];
const DISTANCE_EXTRA = [
  0, 0, 0, 0, 1, 1, 2, 2, 3, 3, 4, 4, 5, 5, 6, 6, 7, 7, 8, 8, 9, 9, 10, 10, 11,
  11, 12, 12, 13, 13,
];
const CODE_LENGTH_ORDER = [
  16, 17, 18, 0, 8, 7, 9, 6, 10, 5, 11, 4, 12, 3, 13, 2, 14, 1, 15,
];
const MAX_BITS = 15;

interface Huffman {
  /** Number of codes of each bit length. */
  readonly counts: Uint16Array;
  /** Symbols ordered by code. */
  readonly symbols: Uint16Array;
}

function huffman(lengths: ArrayLike<number>): Huffman {
  const counts = new Uint16Array(MAX_BITS + 1);
  for (let index = 0; index < lengths.length; index += 1)
    counts[lengths[index] ?? 0] = (counts[lengths[index] ?? 0] ?? 0) + 1;
  counts[0] = 0;
  let left = 1;
  for (let bits = 1; bits <= MAX_BITS; bits += 1) {
    left = left * 2 - (counts[bits] ?? 0);
    if (left < 0) throw new InflateError("over-subscribed Huffman code");
  }
  const offsets = new Uint16Array(MAX_BITS + 1);
  for (let bits = 1; bits < MAX_BITS; bits += 1)
    offsets[bits + 1] = (offsets[bits] ?? 0) + (counts[bits] ?? 0);
  const symbols = new Uint16Array(lengths.length);
  for (let symbol = 0; symbol < lengths.length; symbol += 1) {
    const bits = lengths[symbol] ?? 0;
    if (bits !== 0) {
      symbols[offsets[bits] ?? 0] = symbol;
      offsets[bits] = (offsets[bits] ?? 0) + 1;
    }
  }
  return { counts, symbols };
}

const FIXED_LITERALS = huffman(
  Array.from({ length: 288 }, (_, symbol) =>
    symbol < 144 ? 8 : symbol < 256 ? 9 : symbol < 280 ? 7 : 8,
  ),
);
const FIXED_DISTANCES = huffman(Array.from({ length: 30 }, () => 5));

/** Decode a raw DEFLATE stream; `maxOutput` bounds decompression bombs. */
export function inflateRaw(
  input: Uint8Array,
  maxOutput = 64 * 1024 * 1024,
): Uint8Array {
  let position = 0;
  let bitBuffer = 0;
  let bitCount = 0;
  let output = new Uint8Array(Math.max(1024, input.length * 4));
  let length = 0;

  const bits = (need: number): number => {
    let value = bitBuffer;
    while (bitCount < need) {
      if (position >= input.length)
        throw new InflateError("unexpected end of compressed data");
      value |= (input[position++] ?? 0) << bitCount;
      bitCount += 8;
    }
    bitBuffer = value >>> need;
    bitCount -= need;
    return value & ((1 << need) - 1);
  };
  const reserve = (extra: number): void => {
    if (length + extra > maxOutput)
      throw new InflateError("decompressed data is too large");
    if (length + extra <= output.length) return;
    const grown = new Uint8Array(
      Math.min(maxOutput, Math.max(output.length * 2, length + extra)),
    );
    grown.set(output.subarray(0, length));
    output = grown;
  };
  const decode = (code: Huffman): number => {
    let value = 0;
    let first = 0;
    let index = 0;
    for (let size = 1; size <= MAX_BITS; size += 1) {
      value |= bits(1);
      const count = code.counts[size] ?? 0;
      if (value - first < count)
        return code.symbols[index + value - first] ?? 0;
      index += count;
      first = (first + count) << 1;
      value <<= 1;
    }
    throw new InflateError("invalid Huffman code");
  };
  const codes = (literals: Huffman, distances: Huffman): void => {
    for (;;) {
      const symbol = decode(literals);
      if (symbol < 256) {
        reserve(1);
        output[length++] = symbol;
        continue;
      }
      if (symbol === 256) return;
      const lengthIndex = symbol - 257;
      if (lengthIndex >= 29) throw new InflateError("invalid length symbol");
      const run =
        (LENGTH_BASE[lengthIndex] ?? 0) + bits(LENGTH_EXTRA[lengthIndex] ?? 0);
      const distanceIndex = decode(distances);
      if (distanceIndex >= 30)
        throw new InflateError("invalid distance symbol");
      const distance =
        (DISTANCE_BASE[distanceIndex] ?? 0) +
        bits(DISTANCE_EXTRA[distanceIndex] ?? 0);
      if (distance > length) throw new InflateError("distance too far back");
      reserve(run);
      for (let copied = 0; copied < run; copied += 1) {
        output[length] = output[length - distance] ?? 0;
        length += 1;
      }
    }
  };

  let final = 0;
  while (final === 0) {
    final = bits(1);
    const type = bits(2);
    if (type === 0) {
      bitBuffer = 0;
      bitCount = 0;
      if (position + 4 > input.length)
        throw new InflateError("unexpected end of stored block");
      const size = (input[position] ?? 0) | ((input[position + 1] ?? 0) << 8);
      const check =
        (input[position + 2] ?? 0) | ((input[position + 3] ?? 0) << 8);
      position += 4;
      if (size !== (~check & 0xffff))
        throw new InflateError("stored block length mismatch");
      if (position + size > input.length)
        throw new InflateError("unexpected end of stored block");
      reserve(size);
      output.set(input.subarray(position, position + size), length);
      length += size;
      position += size;
    } else if (type === 1) {
      codes(FIXED_LITERALS, FIXED_DISTANCES);
    } else if (type === 2) {
      const literalCount = bits(5) + 257;
      const distanceCount = bits(5) + 1;
      const codeLengthCount = bits(4) + 4;
      if (literalCount > 286 || distanceCount > 30)
        throw new InflateError("bad dynamic block counts");
      const codeLengths = new Uint8Array(19);
      for (let index = 0; index < codeLengthCount; index += 1)
        codeLengths[CODE_LENGTH_ORDER[index] ?? 0] = bits(3);
      const lengthCode = huffman(codeLengths);
      const lengths = new Uint8Array(literalCount + distanceCount);
      let index = 0;
      while (index < lengths.length) {
        const symbol = decode(lengthCode);
        if (symbol < 16) {
          lengths[index++] = symbol;
          continue;
        }
        let repeat: number;
        let value = 0;
        if (symbol === 16) {
          if (index === 0) throw new InflateError("repeat with no length");
          value = lengths[index - 1] ?? 0;
          repeat = 3 + bits(2);
        } else if (symbol === 17) repeat = 3 + bits(3);
        else repeat = 11 + bits(7);
        if (index + repeat > lengths.length)
          throw new InflateError("too many code lengths");
        lengths.fill(value, index, index + repeat);
        index += repeat;
      }
      if ((lengths[256] ?? 0) === 0)
        throw new InflateError("missing end-of-block code");
      codes(
        huffman(lengths.subarray(0, literalCount)),
        huffman(lengths.subarray(literalCount)),
      );
    } else {
      throw new InflateError("invalid block type");
    }
  }
  return output.slice(0, length);
}

const BASE64 =
  "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/";

/** Decode standard base64, ignoring whitespace; `null` when malformed. */
export function decodeBase64(text: string): Uint8Array | null {
  const clean = text.replace(/\s+/g, "").replace(/=+$/, "");
  if (!/^[A-Za-z0-9+/]*$/.test(clean) || clean.length % 4 === 1) return null;
  const bytes = new Uint8Array(Math.floor((clean.length * 3) / 4));
  let buffer = 0;
  let count = 0;
  let at = 0;
  for (const character of clean) {
    buffer = (buffer << 6) | BASE64.indexOf(character);
    count += 6;
    if (count >= 8) {
      count -= 8;
      bytes[at++] = (buffer >> count) & 0xff;
    }
  }
  return bytes.subarray(0, at);
}

/** Decode UTF-8 bytes; malformed sequences become U+FFFD. */
export function decodeUtf8(bytes: Uint8Array): string {
  let text = "";
  let index = 0;
  while (index < bytes.length) {
    const lead = bytes[index++] ?? 0;
    let point = 0xfffd;
    let extra = 0;
    if (lead < 0x80) point = lead;
    else if (lead >= 0xc2 && lead < 0xe0) {
      point = lead & 0x1f;
      extra = 1;
    } else if (lead >= 0xe0 && lead < 0xf0) {
      point = lead & 0x0f;
      extra = 2;
    } else if (lead >= 0xf0 && lead < 0xf5) {
      point = lead & 0x07;
      extra = 3;
    }
    for (let at = 0; at < extra; at += 1) {
      const next = bytes[index];
      if (next === undefined || (next & 0xc0) !== 0x80) {
        point = 0xfffd;
        break;
      }
      point = (point << 6) | (next & 0x3f);
      index += 1;
    }
    if (point > 0x10ffff || (point >= 0xd800 && point <= 0xdfff))
      point = 0xfffd;
    text += String.fromCodePoint(point);
  }
  return text;
}
