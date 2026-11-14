import { afterEach, expect, test } from "bun:test";
import { Editor } from "@nodetto/core";
import { Resvg } from "@resvg/resvg-js";
import { createHash } from "node:crypto";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import {
  buildTestCollection,
  buildTestFont,
} from "./__fixtures__/test-font.ts";
import { fontCoverage } from "./font-coverage.ts";
import { rasterize } from "./raster-backend.ts";

const dirs: string[] = [];
function dir(): string {
  const path = mkdtempSync(join(tmpdir(), "nodetto-font-"));
  dirs.push(path);
  return path;
}
afterEach(() => {
  for (const path of dirs.splice(0))
    rmSync(path, { recursive: true, force: true });
});

test("sfnt and collection coverage with corrupt files", () => {
  for (const collection of [false, true]) {
    const path = dir();
    const font = buildTestFont([0xe001, 0xf0000]);
    writeFileSync(
      join(path, "fixture.ttf"),
      collection ? buildTestCollection([font]) : font,
    );
    writeFileSync(join(path, "corrupt.ttf"), "invalid");
    expect(fontCoverage("\ue001\u{f0000}", path)).toEqual({
      needsFallback: false,
      missing: [],
    });
  }
});
test("isolated format 4 coverage and unmapped code point", () => {
  const path = dir();
  const font = Buffer.from(buildTestFont([0xe001], { cmapFormats: [4] }));
  const count = font.readUInt16BE(4);
  let cmap = -1;
  for (let i = 0; i < count; i++) {
    const entry = 12 + i * 16;
    if (font.toString("ascii", entry, entry + 4) === "cmap") {
      cmap = font.readUInt32BE(entry + 8);
      break;
    }
  }
  expect(cmap).toBeGreaterThanOrEqual(0);
  expect(font.readUInt16BE(cmap + 2)).toBe(1);
  expect(font.readUInt16BE(cmap + 4)).toBe(3);
  expect(font.readUInt16BE(cmap + 6)).toBe(1);
  expect(font.readUInt16BE(cmap + font.readUInt32BE(cmap + 8))).toBe(4);
  writeFileSync(join(path, "fixture.ttf"), font);
  expect(fontCoverage("\ue001", path)).toEqual({
    needsFallback: false,
    missing: [],
  });
  expect(fontCoverage("\ue0ff", path)).toEqual({
    needsFallback: true,
    missing: [0xe0ff],
  });
});
test("isolated format 12 coverage", () => {
  const path = dir();
  writeFileSync(
    join(path, "fixture.ttf"),
    buildTestFont([0xf0000], { cmapFormats: [12] }),
  );
  expect(fontCoverage("\u{f0000}", path)).toEqual({
    needsFallback: false,
    missing: [],
  });
});
test("default fixture output remains byte-identical", () => {
  const digest = createHash("sha256")
    .update(buildTestFont([0xe001, 0xf0000]))
    .digest("hex");
  expect(digest).toBe(
    "949656db94ab8439b5d32f8f2020077e0a385c93699e449a7226087a146ae48a",
  );
});
test("fixture loads in resvg", () => {
  const path = join(dir(), "fixture.ttf");
  writeFileSync(path, buildTestFont([0xf0000]));
  const render = (text: string) =>
    new Resvg(
      `<svg xmlns="http://www.w3.org/2000/svg" width="100" height="50"><text x="5" y="35" font-family="NodettoFixture" font-size="30">${text}</text></svg>`,
      {
        font: {
          loadSystemFonts: false,
          fontFiles: [path],
          defaultFontFamily: "NodettoFixture",
        },
      },
    )
      .render()
      .asPng();
  expect(render("\u{f0000}")).not.toEqual(render("\u{f0001}"));
});
test("missing, ASCII, and ignorable characters", () => {
  expect(fontCoverage("\u{f0000}", dir())).toEqual({
    needsFallback: true,
    missing: [0xf0000],
  });
  expect(fontCoverage("ASCII", "/nonexistent")).toEqual({
    needsFallback: false,
    missing: [],
  });
  expect(fontCoverage("\u200b\ufe0f", undefined)).toEqual({
    needsFallback: false,
    missing: [],
  });
});
const svg = (text: string) =>
  `<svg xmlns="http://www.w3.org/2000/svg" width="100" height="50" viewBox="0 0 100 50"><text x="5" y="35" font-family="Helvetica" font-size="30">${text}</text></svg>`;
test("default raster equals explicit false", async () => {
  expect(await rasterize(svg("ASCII"), 1, undefined)).toEqual(
    await rasterize(svg("ASCII"), 1, undefined, false),
  );
});
test.skipIf(process.platform !== "darwin")(
  "macOS bounded fonts cover required glyphs",
  () => {
    const text = String.fromCodePoint(
      ...Array.from({ length: 20 }, (_, i) => 0x2460 + i),
      0x301c,
      0xff5e,
    );
    expect(fontCoverage(text, undefined)?.missing).toEqual([]);
  },
);
test.skipIf(process.platform !== "darwin")(
  "macOS fallback renders distinct glyphs",
  async () => {
    expect(await rasterize(svg("⑪"), 1, undefined, true)).not.toEqual(
      await rasterize(svg("⑫"), 1, undefined, true),
    );
  },
);
test.skipIf(process.platform !== "darwin")(
  "macOS fallback preserves base-covered glyphs",
  async () => {
    expect(await rasterize(svg("A中"), 1, undefined, true)).toEqual(
      await rasterize(svg("A中"), 1, undefined, false),
    );
  },
);

test.skipIf(process.platform !== "darwin")(
  "macOS separate and mixed text runs",
  async () => {
    const separate = `<svg xmlns="http://www.w3.org/2000/svg" width="100" height="50" viewBox="0 0 100 50"><text x="5" y="35" font-family="Helvetica" font-size="30">A</text><text x="150" y="35" font-family="Helvetica" font-size="30">⑪</text></svg>`;
    expect(await rasterize(separate, 1, undefined, true)).toEqual(
      await rasterize(separate, 1, undefined, false),
    );
    expect(await rasterize(svg("A⑪"), 1, undefined, true)).not.toEqual(
      await rasterize(svg("A⑫"), 1, undefined, true),
    );
  },
);

test.skipIf(process.platform !== "darwin")(
  "macOS separate exported label lines retain their face",
  async () => {
    const label = (second: string) => {
      const editor = new Editor();
      const element = editor.buildElement("node.generic", {
        id: "widget",
        semantic: { label: `Idle\n${second}` },
        visual: { x: 0, y: 0, width: 200, height: 100 },
      });
      editor.apply([{ type: "createElement", element }]);
      const output = editor.exportPageSvg() ?? "";
      const lines = [...output.matchAll(/<text\b[^>]*y="([^"]+)"[^>]*>/g)];
      expect(lines.length).toBeGreaterThanOrEqual(2);
      const firstY = Number(lines[0]?.[1]);
      const secondY = Number(lines[1]?.[1]);
      const cutoff = (firstY + secondY) / 2;
      return output
        .replace(/viewBox="[^"]+"/, `viewBox="0 0 200 ${cutoff}"`)
        .replace(/height="[^"]+"/, `height="${cutoff}"`);
    };
    expect(await rasterize(label("⑪"), 1, undefined, true)).toEqual(
      await rasterize(label("X"), 1, undefined, true),
    );
  },
);
