import { expect, test } from "bun:test";
import { Editor, pngInfo } from "@nodetto/core";
import { serializeDocument } from "@nodetto/io";
import { exportCommand } from "./export-command.ts";
import * as backend from "./raster-backend.ts";
import { Resvg } from "@resvg/resvg-js";
import type { CommandIo } from "./commands.ts";
import { compareCommand } from "./compare-command.ts";

function fixture() {
  const image = new Resvg(
    '<svg xmlns="http://www.w3.org/2000/svg" width="40" height="40"><rect width="40" height="40" fill="#a05030"/></svg>',
  )
    .render()
    .asPng();
  const files = new Map<string, Uint8Array>([
    ["a.png", image],
    ["actual/01-a.png", image],
    ["actual/02-b.png", image],
    ["ref/01-ref.png", image],
    ["ref/02-ref.png", image],
  ]);
  let rendered: ReturnType<Resvg["render"]> | undefined;
  const io: CommandIo = {
    readText: () => "",
    writeText: () => {},
    readBytes: (path) => {
      const value = files.get(path);
      if (!value) throw new Error(`missing ${path}`);
      return value;
    },
    writeBytes: (path, data) => {
      files.set(path, data);
    },
    listDir: (path) => {
      if (!["actual", "ref", "out"].includes(path))
        throw new Error(`missing ${path}`);
      return [...files.keys()]
        .filter((file) => file.startsWith(`${path}/`))
        .map((file) => file.slice(path.length + 1));
    },
  };
  const raster = {
    rasterize: async (svg: string, scale: number) => {
      expect(scale).toBe(1);
      rendered = new Resvg(svg).render();
      return rendered.asPng();
    },
  };
  return { files, io, raster, rendered: () => rendered };
}

test("comparison writes three panels and identical pixels yield black difference", async () => {
  const { io, raster, files, rendered } = fixture();
  const result = await compareCommand(
    io,
    ["a.png", "a.png", "--output", "out.png", "--scale", "2"],
    raster,
  );
  expect(result.exitCode).toBe(0);
  expect(pngInfo(files.get("out.png") as Uint8Array).width).toBe(92);
  const image = rendered();
  expect(image).toBeDefined();
  const offset = ((24 + 10) * image!.width + 2 * (20 + 16) + 10) * 4;
  expect([...image!.pixels.slice(offset, offset + 3)]).toEqual([0, 0, 0]);
});

test("comparison pairs directories and reports unmatched names", async () => {
  const { io, raster, files } = fixture();
  expect(
    (
      await compareCommand(
        io,
        ["actual", "ref", "--output", "out", "--band", "0:10:2"],
        raster,
      )
    ).exitCode,
  ).toBe(0);
  expect(files.has("out/01-compare.png")).toBe(true);
  expect(files.has("out/02-compare.png")).toBe(true);
  files.set("actual/03-extra.png", files.get("a.png") as Uint8Array);
  const result = await compareCommand(
    io,
    ["actual", "ref", "--output", "out"],
    raster,
  );
  expect(result.exitCode).toBe(1);
  expect(result.stderr).toContain("03-extra.png");
});

test("invalid band is rejected", async () => {
  const { io, raster } = fixture();
  expect(
    (
      await compareCommand(
        io,
        ["a.png", "a.png", "--output", "out.png", "--band", "x"],
        raster,
      )
    ).exitCode,
  ).toBe(1);
});

test("frame export follows reading order and matches element PNGs", async () => {
  const editor = new Editor();
  const page = editor.createPage({ name: "Screens", kind: "freeform" });
  const ids = [
    editor.createElement("frame", {
      semantic: { name: "Second" },
      visual: { x: 120, y: 0, width: 80, height: 100 },
    }),
    editor.createElement("frame", {
      semantic: { name: "First" },
      visual: { x: 0, y: 2, width: 80, height: 100 },
    }),
    editor.createElement("frame", {
      semantic: { name: "Third" },
      visual: { x: 0, y: 150, width: 80, height: 100 },
    }),
  ];
  const files = new Map<string, Uint8Array>();
  const io: CommandIo = {
    readText: () => serializeDocument(editor.getSnapshot()),
    writeText: () => {},
    writeBytes: (path, bytes) => {
      files.set(path, bytes);
    },
    exists: (path) => path === "out",
  };
  const common = ["sample.jsonl", "--page", page, "--format", "png"];
  const result = await exportCommand(
    io,
    [...common, "--frames", "--output-dir", "out"],
    backend,
  );
  expect(result.exitCode).toBe(0);
  expect(result.stdout).toBe(
    "01-first.png\tFirst\n02-second.png\tSecond\n03-third.png\tThird\n",
  );
  for (const [id, name] of [
    [ids[1], "01-first"],
    [ids[0], "02-second"],
    [ids[2], "03-third"],
  ] as const) {
    expect(
      (
        await exportCommand(
          io,
          [...common, "--element", id, "--output", "single.png"],
          backend,
        )
      ).exitCode,
    ).toBe(0);
    expect(files.get(`out/${name}.png`)).toEqual(files.get("single.png"));
  }
  expect(
    (
      await exportCommand(
        io,
        [...common, "--frames", "--output-dir", "missing"],
        backend,
      )
    ).exitCode,
  ).toBe(1);
  expect(
    (
      await exportCommand(
        io,
        [...common, "--frames", "--output-dir", "out", "--element", ids[0]],
        backend,
      )
    ).exitCode,
  ).toBe(1);
});
