import { expect, test } from "bun:test";
import {
  mkdtempSync,
  mkdirSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { Editor } from "@nodetto/core";
import { serializeDocument } from "@nodetto/io";

test("SVG export is independent of locale, timezone, cwd and formatting", () => {
  const root = mkdtempSync(join(tmpdir(), "nodetto-determinism-"));
  try {
    const editor = new Editor();
    editor.createElement("image.raster", {
      semantic: { src: "artifacts/logo.png", alt: "Logo" },
      visual: { width: 50, height: 50 },
    });
    editor.createElement("node.generic", {
      semantic: { label: "widgets" },
      visual: { x: 100, y: 0 },
    });
    const content = serializeDocument(editor.getSnapshot());
    const lines = content.trimEnd().split("\n");
    const header = lines.shift();
    const noncanonical = [header, ...lines.reverse(), "", ""].join("\n");
    const run = (cwd: string, args: string[], env: Record<string, string>) =>
      Bun.spawnSync(
        [process.execPath, join(import.meta.dir, "main.ts"), ...args],
        { cwd, env: { ...process.env, ...env } },
      );
    const exports: string[] = [];
    for (const [name, tz, lang] of [
      ["one", "UTC", "C"],
      ["two", "Asia/Tokyo", "ja_JP.UTF-8"],
    ] as const) {
      const dir = join(root, name);
      mkdirSync(join(dir, "artifacts"), { recursive: true });
      writeFileSync(
        join(dir, "artifacts/logo.png"),
        Buffer.from("iVBORw0KGgo=", "base64"),
      );
      writeFileSync(join(dir, "doc.jsonl"), noncanonical);
      const env = { TZ: tz, LANG: lang };
      const before = run(dir, ["export", "doc.jsonl", "--format", "svg"], env);
      expect(before.exitCode).toBe(0);
      expect(before.stdout.toString()).toContain("data:image/png;base64,");
      const formatted = run(dir, ["format", "doc.jsonl", "--write"], env);
      expect(formatted.exitCode).toBe(0);
      const formattedContent = readFileSync(join(dir, "doc.jsonl"), "utf8");
      expect(formattedContent).not.toBe(noncanonical);
      expect(formattedContent).toBe(content);
      const after = run(dir, ["export", "doc.jsonl", "--format", "svg"], env);
      expect(after.exitCode).toBe(0);
      expect(after.stdout.toString()).toBe(before.stdout.toString());
      exports.push(before.stdout.toString());
    }
    expect(exports[0]).toBe(exports[1]);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

import type { Element } from "@nodetto/ir";
import { document, element } from "../../../packages/core/src/test-helpers.ts";

const orderNode = element({
  id: "node",
  type: "shape.geo",
  semantic: { geo: "rect" },
  visual: { x: 10, y: 10, width: 20, height: 20, style: { fill: "#336699" } },
});
const orderFrame = (id: string, x = 0, y = 0, width = 200, height = 200) =>
  element({
    id,
    type: "frame",
    semantic: { name: id },
    visual: { x, y, width, height },
  });
const orderGroup = (id: string, member: string) =>
  element({ id, type: "group", semantic: { memberIds: [member] } });
const orderConnector = element({
  id: "connector",
  type: "bpmn.sequenceFlow",
  semantic: { from: "node", to: "node" },
});

function exportOrderPair(first: Element[], second: Element[]) {
  const root = mkdtempSync(join(tmpdir(), "nodetto-order-determinism-"));
  try {
    const outputs: { svg: string; png: Buffer }[] = [];
    for (const [number, entries] of [first, second].entries()) {
      const input = join(root, `${number}.jsonl`);
      const indexed = entries.map((entry, i) => ({
        ...entry,
        index: `a${i + 1}`,
      }));
      writeFileSync(input, serializeDocument(document(indexed)));
      const svg = Bun.spawnSync([
        process.execPath,
        join(import.meta.dir, "main.ts"),
        "export",
        input,
        "--format",
        "svg",
      ]);
      expect(svg.exitCode).toBe(0);
      const output = join(root, `${number}.png`);
      const png = Bun.spawnSync([
        process.execPath,
        join(import.meta.dir, "main.ts"),
        "export",
        input,
        "--format",
        "png",
        "--output",
        output,
      ]);
      expect(png.exitCode).toBe(0);
      outputs.push({ svg: svg.stdout.toString(), png: readFileSync(output) });
    }
    expect(outputs[0]?.svg).toBe(outputs[1]?.svg);
    expect(outputs[0]?.png).toEqual(outputs[1]?.png);
    return outputs[0]?.svg ?? "";
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
}

function layerRoots(svg: string, layer: string): string[] {
  const stack: string[] = [];
  const roots: string[] = [];
  let layerDepth = -1;
  for (const match of svg.matchAll(/<\/?[a-zA-Z][^>]*>/g)) {
    const tag = match[0];
    if (tag.startsWith("</")) {
      if (stack.length === layerDepth) layerDepth = -1;
      stack.pop();
      continue;
    }
    if (layerDepth >= 0 && stack.length === layerDepth) {
      const id = /data-id="([^"]+)"/.exec(tag)?.[1];
      if (id) roots.push(id);
    }
    if (!tag.endsWith("/>")) {
      stack.push(tag);
      if (tag.includes(`data-layer="${layer}"`)) layerDepth = stack.length;
    }
  }
  return roots;
}

test("already correct backdrop order remains deterministic", () => {
  const panel = orderFrame("panel", 150, 150, 100, 100);
  const frame = orderFrame("frame");
  const svg = exportOrderPair(
    [orderNode, panel, frame, orderConnector],
    [panel, frame, orderNode, orderConnector],
  );
  expect(layerRoots(svg, "backdrops")).toEqual(["panel", "frame"]);
  expect(layerRoots(svg, "connectors")).toEqual(["connector"]);
  expect(layerRoots(svg, "shapes")).toEqual(["node"]);
});

test("already correct grouped order remains deterministic", () => {
  const panel = orderFrame("panel", 150, 150, 100, 100);
  const frame = orderFrame("frame");
  const group = orderGroup("group", "node");
  const other = orderFrame("other", 500, 500, 100, 100);
  const svg = exportOrderPair(
    [orderNode, panel, frame, group, other],
    [panel, frame, orderNode, group, other],
  );
  expect(layerRoots(svg, "shapes")).toEqual([
    "panel",
    "frame",
    "group",
    "other",
  ]);
});

test("already correct nested groups remain deterministic", () => {
  const inner = orderGroup("inner", "node");
  const outer = orderGroup("outer", "inner");
  const panel = orderFrame("panel", 150, 150, 100, 100);
  const frame = orderFrame("frame");
  const other = orderFrame("other", 500, 500, 100, 100);
  exportOrderPair(
    [orderNode, inner, panel, frame, outer, other],
    [panel, frame, orderNode, inner, outer, other],
  );
});
