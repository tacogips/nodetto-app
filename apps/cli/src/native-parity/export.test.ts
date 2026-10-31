import { expect } from "bun:test";
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { inflateSync } from "node:zlib";
import { Editor, HANDOFF_FORMATS } from "@nodetto/core";
import { serializeDocument } from "@nodetto/io";
import { binary, compare, fixtureRoot, nativeTest } from "./harness.ts";

nativeTest(
  "native renders SVG with byte parity, PNG, PDF and HTML ZIP without a JS runtime",
  () => {
    const cwd = mkdtempSync(join(tmpdir(), "nodetto-native-export-"));
    try {
      for (const name of [
        "erd",
        "uml-class",
        "uml-component",
        "sequence",
        "bpmn",
        "ui-controls",
        "freeform",
      ])
        compare([
          "export",
          join(fixtureRoot, `${name}.jsonl`),
          "--format",
          "svg",
        ]);
      const editor = new Editor();
      const frame = editor.createElement("frame", {
        semantic: { name: "Home", platform: "web" },
        visual: { x: 0, y: 0, width: 500, height: 500 },
      });
      editor.createElement("text.note", {
        semantic: { text: "Hello 日本語 \u{1f469}\u200d\u{1f4bb}" },
        visual: { x: 20, y: 20, width: 240 },
      });
      writeFileSync(
        join(cwd, "design.jsonl"),
        serializeDocument(editor.getSnapshot()),
      );
      for (const format of ["png", "pdf", "html"]) {
        const result = Bun.spawnSync(
          [
            binary!,
            "export",
            "design.jsonl",
            "--format",
            format,
            "--element",
            frame,
            "--output",
            `out.${format}`,
          ],
          { cwd },
        );
        expect(result.exitCode).toBe(0);
        const bytes = readFileSync(join(cwd, `out.${format}`));
        const signature =
          format === "png"
            ? [137, 80, 78, 71]
            : format === "pdf"
              ? [37, 80, 68, 70]
              : [80, 75, 3, 4];
        expect([...bytes.subarray(0, 4)]).toEqual(signature);
      }
    } finally {
      rmSync(cwd, { recursive: true, force: true });
    }
  },
  30000,
);

nativeTest(
  "native CLI exports Mermaid, D2 and every Code panel output",
  () => {
    const cwd = mkdtempSync(join(tmpdir(), "nodetto-native-exports-"));
    try {
      for (const format of ["mermaid", "d2"])
        compare(["export", join(fixtureRoot, "erd.jsonl"), "--format", format]);
      const editor = new Editor();
      const frame = editor.createElement("frame", {
        semantic: { name: "Home", platform: "web" },
        visual: { x: 0, y: 0, width: 400, height: 300 },
      });
      editor.createElement("ui.control", {
        semantic: { control: "button", label: "Submit" },
        visual: { x: 20, y: 20, width: 100, height: 40 },
      });
      editor.createPage({ name: "Sequence", kind: "sequence" });
      editor.createElement("sequence.participant", {
        semantic: { name: "Excluded actor", kind: "actor", order: "a0" },
      });
      const schema = editor.createPage({ name: "Schema", kind: "erd" });
      editor.createElement("erd.table", {
        semantic: { tableName: "selected_users", columns: [] },
      });
      writeFileSync(
        join(cwd, "design.jsonl"),
        serializeDocument(editor.getSnapshot()),
      );
      for (const page of [schema, "Schema"]) {
        for (const format of ["svg", "mermaid", "d2"]) {
          const result = compare(
            ["export", "design.jsonl", "--page", page, "--format", format],
            cwd,
          );
          expect(result.stdout.toString()).toContain("selected_users");
          expect(result.stdout.toString()).not.toContain("Excluded actor");
        }
        for (const format of ["png", "pdf"]) {
          const result = Bun.spawnSync(
            [
              binary!,
              "export",
              "design.jsonl",
              "--page",
              page,
              "--format",
              format,
              "--output",
              `schema.${format}`,
            ],
            { cwd },
          );
          expect(result.exitCode).toBe(0);
          expect([
            ...readFileSync(join(cwd, `schema.${format}`)).slice(0, 4),
          ]).toEqual(format === "png" ? [137, 80, 78, 71] : [37, 80, 68, 70]);
        }
      }
      for (const format of HANDOFF_FORMATS)
        compare(
          [
            "export",
            "design.jsonl",
            "--element",
            frame,
            "--format",
            "code",
            "--code-format",
            format,
          ],
          cwd,
        );
    } finally {
      rmSync(cwd, { recursive: true, force: true });
    }
  },
  60000,
);

function decodeRgbaPng(png: Uint8Array): {
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

nativeTest(
  "native PNG export fills its last row and column when the frame ends inside a pixel",
  () => {
    const cwd = mkdtempSync(join(tmpdir(), "nodetto-native-snap-"));
    try {
      const editor = new Editor();
      // 101 x 77 plus 16 padding a side: 133 x 109 units, 99.75 x 81.75 px at 0.75.
      editor.createElement("shape.geo", {
        semantic: { geo: "rect", label: "" },
        visual: { x: 0, y: 0, width: 101, height: 77 },
      });
      writeFileSync(
        join(cwd, "snap.jsonl"),
        serializeDocument(editor.getSnapshot()),
      );
      const result = Bun.spawnSync(
        [
          binary!,
          "export",
          "snap.jsonl",
          "--format",
          "png",
          "--scale",
          "0.75",
          "--output",
          "snap.png",
        ],
        { cwd },
      );
      expect(result.exitCode).toBe(0);
      const { width, height, pixels } = decodeRgbaPng(
        readFileSync(join(cwd, "snap.png")),
      );
      expect([width, height]).toEqual([100, 82]);
      for (let y = 0; y < height; y++)
        expect(pixels[(y * width + width - 1) * 4 + 3]).toBe(255);
      for (let x = 0; x < width; x++)
        expect(pixels[((height - 1) * width + x) * 4 + 3]).toBe(255);
    } finally {
      rmSync(cwd, { recursive: true, force: true });
    }
  },
  30000,
);
