import { expect, test } from "bun:test";
import { isZip, readZip, ZipReadError } from "./zip-read.ts";

// Self-authored archives made with Info-ZIP: board.gtl stored and
// sub/board.drl deflated; the second archive holds board.gtl stored only.
const DEFLATED =
  "UEsDBAoAAAAAAMBFW10Gy/KGMgAAADIAAAAJAAAAYm9hcmQuZ3RsRzA0IHNhbXBsZSB0b3AgY29wcGVyKgolRlNMQVg0Nlk0NiolCiVNT01NKiUKTTAyKgpQSwMEFAAAAAgAwEVbXez6Pp4eAAAAFwIAAA0AAABzdWIvYm9hcmQuZHJs8zWx4PJ1DQnydOaKMNQzMDCIBJOjnJHL8TU24AIAUEsBAh4DCgAAAAAAwEVbXQbL8oYyAAAAMgAAAAkAAAAAAAAAAQAAAKSBAAAAAGJvYXJkLmd0bFBLAQIeAxQAAAAIAMBFW13s+j6eHgAAABcCAAANAAAAAAAAAAEAAACkgVkAAABzdWIvYm9hcmQuZHJsUEsFBgAAAAACAAIAcgAAAKIAAAAAAA==";
const STORED =
  "UEsDBAoAAAAAAMBFW10Gy/KGMgAAADIAAAAJAAAAYm9hcmQuZ3RsRzA0IHNhbXBsZSB0b3AgY29wcGVyKgolRlNMQVg0Nlk0NiolCiVNT01NKiUKTTAyKgpQSwECHgMKAAAAAADARVtdBsvyhjIAAAAyAAAACQAAAAAAAAAAAAAApIEAAAAAYm9hcmQuZ3RsUEsFBgAAAAABAAEANwAAAFkAAAAAAA==";

const bytes = (base64: string) =>
  Uint8Array.from(atob(base64), (char) => char.charCodeAt(0));
const text = (data: Uint8Array) => new TextDecoder().decode(data);

test("reads stored and deflated entries in directory order", () => {
  const files = readZip(bytes(DEFLATED));
  expect(files.map((file) => file.path)).toEqual([
    "board.gtl",
    "sub/board.drl",
  ]);
  expect(text(files[0]!.contents)).toBe(
    "G04 sample top copper*\n%FSLAX46Y46*%\n%MOMM*%\nM02*\n",
  );
  const drill = text(files[1]!.contents);
  expect(drill.startsWith("M48\nMETRIC\nX1.000Y1.000\n")).toBe(true);
  expect(
    drill.split("\n").filter((line) => line === "X1.000Y1.000"),
  ).toHaveLength(40);
  expect(readZip(bytes(STORED)).map((file) => file.path)).toEqual([
    "board.gtl",
  ]);
  expect(isZip(bytes(STORED))).toBe(true);
});

test("damaged archives are refused with ZipReadError", () => {
  const archive = bytes(DEFLATED);
  expect(isZip(new TextEncoder().encode("M48"))).toBe(false);
  expect(() =>
    readZip(new TextEncoder().encode("not a zip at all, just text")),
  ).toThrow(ZipReadError);
  // Truncating the data breaks the central directory offsets.
  expect(() => readZip(archive.slice(60))).toThrow(ZipReadError);
  const encrypted = archive.slice();
  // General-purpose flag bit 0 in the first central directory entry.
  const directory = new DataView(encrypted.buffer).getUint32(
    encrypted.length - 6,
    true,
  );
  encrypted[directory + 8] = 1;
  expect(() => readZip(encrypted)).toThrow("board.gtl is encrypted");
});
