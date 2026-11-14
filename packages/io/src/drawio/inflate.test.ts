import { describe, expect, test } from "bun:test";
import { deflateRawSync } from "node:zlib";
import {
  decodeBase64,
  decodeUtf8,
  InflateError,
  inflateRaw,
} from "./inflate.ts";

function roundTrip(data: Uint8Array, level: number): Uint8Array {
  return inflateRaw(new Uint8Array(deflateRawSync(data, { level })));
}

describe("inflateRaw", () => {
  test("matches zlib for stored, fixed and dynamic blocks", () => {
    const text = new TextEncoder().encode(
      `${'<mxCell id="node" value="Hello" vertex="1"/>'.repeat(400)}ü→𝄞`,
    );
    let seed = 7;
    const noise = Uint8Array.from({ length: 70_000 }, () => {
      seed = (seed * 1103515245 + 12345) & 0x7fffffff;
      return seed & 0xff;
    });
    for (const level of [0, 1, 6, 9]) {
      expect(roundTrip(text, level)).toEqual(text);
      expect(roundTrip(noise, level)).toEqual(noise);
    }
    expect(roundTrip(new Uint8Array(0), 6)).toEqual(new Uint8Array(0));
  });

  test("rejects truncated, corrupt and oversized streams", () => {
    const packed = new Uint8Array(
      deflateRawSync(new TextEncoder().encode("a".repeat(5000))),
    );
    expect(() => inflateRaw(packed.subarray(0, 3))).toThrow(InflateError);
    expect(() => inflateRaw(Uint8Array.of(0xff, 0xff))).toThrow(InflateError);
    expect(() => inflateRaw(packed, 100)).toThrow("too large");
  });
});

describe("decodeBase64 and decodeUtf8", () => {
  test("decode what the platform encodes", () => {
    const text = "Diagram ü → 𝄞";
    const bytes = new TextEncoder().encode(text);
    const encoded = Buffer.from(bytes).toString("base64");
    expect(decodeUtf8(decodeBase64(encoded) ?? new Uint8Array())).toBe(text);
    expect(decodeBase64(`${encoded.slice(0, 4)}\n${encoded.slice(4)}`)).toEqual(
      bytes,
    );
    expect(decodeBase64("not base64!")).toBeNull();
    expect(decodeUtf8(Uint8Array.of(0x61, 0xc3))).toBe("a�");
  });
});
