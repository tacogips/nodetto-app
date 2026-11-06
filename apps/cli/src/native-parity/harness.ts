import { expect, test } from "bun:test";
import { readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { inflateSync } from "node:zlib";

export const binary = process.env.NODETTO_CLI_TEST_BINARY;
export const cliSrcDir = join(import.meta.dir, "..");
export const cliEntry = join(cliSrcDir, "main.ts");
export const fixtureRoot = join(
  cliSrcDir,
  "../../../packages/io/src/__fixtures__",
);
export const nativeTest = binary ? test : test.skip;

export function compare(args: string[], cwd?: string, stdin?: string) {
  const expected = Bun.spawnSync([process.execPath, cliEntry, ...args], {
    cwd,
    stdin: stdin === undefined ? undefined : new TextEncoder().encode(stdin),
  });
  // biome-ignore lint/style/noNonNullAssertion: nativeTest runs only when the binary is set.
  const actual = Bun.spawnSync([binary!, ...args], {
    cwd,
    stdin: stdin === undefined ? undefined : new TextEncoder().encode(stdin),
  });
  expect(actual.exitCode).toBe(expected.exitCode);
  expect(actual.stdout.toString()).toBe(expected.stdout.toString());
  expect(actual.stderr.toString()).toBe(expected.stderr.toString());
  return actual;
}

export function compareFile(
  args: string[],
  documentPath: string,
  source: string,
  cwd?: string,
) {
  writeFileSync(documentPath, source);
  const expected = Bun.spawnSync([process.execPath, cliEntry, ...args], {
    cwd,
  });
  const expectedFile = readFileSync(documentPath);
  writeFileSync(documentPath, source);
  const actual = Bun.spawnSync([binary as string, ...args], { cwd });
  expect(actual.exitCode).toBe(expected.exitCode);
  expect(actual.stdout.toString()).toBe(expected.stdout.toString());
  expect(actual.stderr.toString()).toBe(expected.stderr.toString());
  expect(readFileSync(documentPath)).toEqual(expectedFile);
  return actual;
}

export function decodeRgbaPng(png: Uint8Array): {
  width: number;
  height: number;
  pixels: Uint8Array;
} {
  const view = new DataView(png.buffer, png.byteOffset, png.byteLength);
  let offset = 8;
  let width = 0;
  let height = 0;
  const data: Uint8Array[] = [];
  while (offset < png.length) {
    const length = view.getUint32(offset);
    const type = new TextDecoder().decode(png.subarray(offset + 4, offset + 8));
    const body = png.subarray(offset + 8, offset + 8 + length);
    if (type === "IHDR") {
      width = view.getUint32(offset + 8);
      height = view.getUint32(offset + 12);
      expect([body[8], body[9]]).toEqual([8, 6]);
    } else if (type === "IDAT") data.push(body);
    offset += 12 + length;
  }
  const raw = inflateSync(Buffer.concat(data));
  const stride = width * 4;
  const pixels = new Uint8Array(height * stride);
  for (let y = 0; y < height; y++) {
    const filter = raw[y * (stride + 1)];
    for (let x = 0; x < stride; x++) {
      const value = raw[y * (stride + 1) + 1 + x] as number;
      const left = x >= 4 ? (pixels[y * stride + x - 4] as number) : 0;
      const up = y > 0 ? (pixels[(y - 1) * stride + x] as number) : 0;
      const corner =
        x >= 4 && y > 0 ? (pixels[(y - 1) * stride + x - 4] as number) : 0;
      const estimate = left + up - corner;
      const paeth =
        Math.abs(estimate - left) <= Math.abs(estimate - up) &&
        Math.abs(estimate - left) <= Math.abs(estimate - corner)
          ? left
          : Math.abs(estimate - up) <= Math.abs(estimate - corner)
            ? up
            : corner;
      const predictor = [0, left, up, (left + up) >> 1, paeth][
        filter as number
      ] as number;
      pixels[y * stride + x] = (value + predictor) & 0xff;
    }
  }
  return { width, height, pixels };
}
