import { expect } from "bun:test";
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { Editor, pngInfo } from "@nodetto/core";
import { parseDocument, serializeDocument } from "@nodetto/io";
import {
  binary,
  cliEntry,
  compare,
  compareFile,
  nativeTest,
} from "./harness.ts";

nativeTest(
  "native text, icon and thin geometry edits and SVG match Bun",
  () => {
    const cwd = mkdtempSync(join(tmpdir(), "nodetto-app-parity-"));
    try {
      const doc = join(cwd, "doc.jsonl");
      const ops = join(cwd, "ops.json");
      const seed = serializeDocument(new Editor().getSnapshot());
      writeFileSync(
        ops,
        JSON.stringify([
          { op: "add", shape: "text:layer", id: "title", label: "Inbox" },
          {
            op: "update",
            id: "title",
            visual: { style: { fontSize: 24, fontWeight: 700 } },
          },
          {
            op: "add",
            shape: "icon:search",
            id: "search",
            visual: { x: 80, y: 40 },
          },
          {
            op: "add",
            type: "ui.control",
            id: "tabs",
            semantic: {
              control: "tabs",
              label: "Tabs",
              options: ["A", "B"],
              indicator: "underline",
            },
            visual: {
              x: 0,
              y: 120,
              width: 180,
              height: 40,
              style: { fill: "#ffffff", accentColor: "#e0531f" },
            },
          },
          {
            op: "add",
            type: "ui.control",
            id: "pills",
            semantic: {
              control: "tabs",
              label: "Tabs",
              options: ["A", "B"],
              indicator: "pill",
            },
            visual: { x: 0, y: 170, width: 180, height: 40 },
          },
          {
            op: "add",
            type: "ui.control",
            id: "button",
            semantic: {
              control: "button",
              label: "Mark\nread",
              leadingIcon: "bell",
              badge: "3",
            },
            visual: {
              x: 0,
              y: 220,
              width: 180,
              height: 60,
              style: { textAlign: "start" },
            },
          },
          {
            op: "add",
            shape: "text:layer",
            id: "truncated",
            label: "A long label that should truncate",
            visual: {
              x: 200,
              y: 0,
              width: 50,
              height: 40,
              textResize: "fixed",
              textTruncate: "ellipsis",
            },
          },
          {
            op: "add",
            type: "shape.geo",
            id: "inside",
            semantic: { geo: "rect" },
            visual: {
              x: 200,
              y: 60,
              width: 50,
              height: 30,
              style: {
                strokeAlign: "inside",
                strokeWidth: 4,
                strokeSides: { bottom: 2 },
              },
            },
          },
          {
            op: "add",
            type: "shape.geo",
            id: "outside",
            semantic: { geo: "rect" },
            visual: {
              x: 260,
              y: 60,
              width: 50,
              height: 30,
              style: { strokeAlign: "outside", strokeWidth: 4 },
            },
          },
          {
            op: "add",
            type: "shape.geo",
            id: "divider",
            semantic: { geo: "rect" },
            visual: { x: 0, y: 80, width: 120, height: 1 },
          },
        ]),
      );
      const paths = ["bun.jsonl", "native.jsonl"];
      const results = paths.map((path, i) => {
        writeFileSync(join(cwd, path), seed);
        return Bun.spawnSync(
          [
            ...(i === 0 ? [process.execPath, cliEntry] : [binary as string]),
            "edit",
            path,
            "--ops",
            ops,
          ],
          { cwd },
        );
      });
      expect(results[0]?.exitCode).toBe(0);
      expect(results[1]?.exitCode).toBe(results[0]?.exitCode);
      expect(
        results[1]?.stdout.toString().replaceAll(paths[1] as string, "doc"),
      ).toBe(
        results[0]?.stdout.toString().replaceAll(paths[0] as string, "doc"),
      );
      expect(
        results[1]?.stderr.toString().replaceAll(paths[1] as string, "doc"),
      ).toBe(
        results[0]?.stderr.toString().replaceAll(paths[0] as string, "doc"),
      );
      const records = paths.map((path) =>
        readFileSync(join(cwd, path), "utf8")
          .trim()
          .split("\n")
          .map((line) => JSON.parse(line) as Record<string, unknown>),
      );
      for (const document of records) {
        const elements = document.filter(
          (record) => record["kind"] === "element",
        );
        elements.sort((a, b) =>
          String(a["index"]) < String(b["index"])
            ? -1
            : String(a["index"]) > String(b["index"])
              ? 1
              : 0,
        );
        expect(
          elements.findIndex((record) => record["id"] === "title"),
        ).toBeLessThan(
          elements.findIndex((record) => record["id"] === "search"),
        );
        expect(
          elements.findIndex((record) => record["id"] === "search"),
        ).toBeLessThan(
          elements.findIndex((record) => record["id"] === "divider"),
        );
        const expectedOrder = [
          "title",
          "search",
          "tabs",
          "pills",
          "button",
          "truncated",
          "inside",
          "outside",
          "divider",
        ];
        expect(elements.map((element) => element["id"])).toEqual(expectedOrder);
        for (const element of elements) element["index"] = undefined;
      }
      expect(records[1]).toEqual(records[0]);
      writeFileSync(doc, readFileSync(join(cwd, paths[0] as string)));
      expect(readFileSync(doc, "utf8")).toContain('"divider"');
      const svg = compare(["export", doc, "--format", "svg"]);
      expect(svg.exitCode).toBe(0);
      expect(svg.stdout.toString()).toContain('font-size="24"');
      expect(svg.stdout.toString()).toContain("Mark");
      expect(svg.stdout.toString()).toContain("read");
      expect(svg.stdout.toString()).toContain("#e0531f");
      expect(svg.stdout.toString()).toContain("…");
      expect(svg.stdout.toString()).toContain('text-anchor="start"');
      expect(svg.stdout.toString()).toContain(">3</text>");
      expect(svg.stdout.toString()).toContain('height="2"');
      expect(svg.stdout.toString()).toContain('rx="18"');
      const pngs = ["bun.png", "native.png"].map((output, i) => {
        const result = Bun.spawnSync(
          [
            ...(i === 0 ? [process.execPath, cliEntry] : [binary as string]),
            "export",
            doc,
            "--format",
            "png",
            "--scale",
            "2",
            "--output",
            output,
          ],
          { cwd },
        );
        expect(result.exitCode).toBe(0);
        return pngInfo(readFileSync(join(cwd, output)));
      });
      expect(pngs[0]?.width).toBeGreaterThan(0);
      expect(pngs[1]).toEqual(pngs[0]);
      expect(compare(["shapes", "icon", "bell"]).exitCode).toBe(0);
      expect(compare(["shapes", "icon:bell"]).exitCode).toBe(0);
    } finally {
      rmSync(cwd, { recursive: true, force: true });
    }
  },
  60000,
);

nativeTest(
  "native frame parenting and layout operations match Bun",
  () => {
    const cwd = mkdtempSync(join(tmpdir(), "nodetto-frame-parity-"));
    try {
      const seed = serializeDocument(new Editor().getSnapshot());
      const paths = ["bun.jsonl", "native.jsonl"];
      const create = [
        {
          op: "add",
          type: "frame",
          id: "frame",
          semantic: {
            name: "Screen",
            platform: "ios",
            memberIds: [],
            safeArea: { top: 47, right: 0, bottom: 34, left: 0 },
          },
          visual: { x: 100, y: 200, width: 390, height: 500 },
        },
        {
          op: "add",
          type: "shape.geo",
          id: "a",
          parent: "frame",
          visual: { x: 16, y: 60, width: 40, height: 30 },
        },
        {
          op: "add",
          type: "shape.geo",
          id: "b",
          parent: "frame",
          visual: { x: 16, y: 110, width: 40, height: 30 },
        },
        {
          op: "add",
          type: "shape.geo",
          id: "c",
          parent: "frame",
          visual: { x: 16, y: 160, width: 40, height: 30 },
        },
        {
          op: "add",
          type: "frame",
          id: "layout-frame",
          semantic: {
            name: "Layout",
            memberIds: [],
            layout: {
              direction: "vertical",
              gap: 8,
              padding: 8,
              sizing: "fixed",
              align: "start",
            },
          },
          visual: { x: 600, y: 0, width: 300, height: 400 },
        },
        {
          op: "add",
          type: "shape.geo",
          id: "auto",
          visual: { x: 620, y: 20, width: 40, height: 30 },
        },
      ];
      const ops = join(cwd, "create.json");
      writeFileSync(ops, JSON.stringify(create));
      const results = paths.map((path, i) => {
        writeFileSync(join(cwd, path), seed);
        return Bun.spawnSync(
          [
            ...(i === 0 ? [process.execPath, cliEntry] : [binary as string]),
            "edit",
            path,
            "--ops",
            ops,
          ],
          { cwd },
        );
      });
      expect(results[0]?.exitCode).toBe(0);
      expect(results[1]?.exitCode).toBe(results[0]?.exitCode);
      expect(
        results[1]?.stdout.toString().replaceAll(paths[1] as string, "doc"),
      ).toBe(
        results[0]?.stdout.toString().replaceAll(paths[0] as string, "doc"),
      );
      expect(
        results[1]?.stderr.toString().replaceAll(paths[1] as string, "doc"),
      ).toBe(
        results[0]?.stderr.toString().replaceAll(paths[0] as string, "doc"),
      );
      const records = paths.map((path) =>
        readFileSync(join(cwd, path), "utf8")
          .trim()
          .split("\n")
          .map((line) => JSON.parse(line) as Record<string, unknown>),
      );
      for (const doc of records) {
        const elements = doc
          .filter((record) => record["kind"] === "element")
          .sort((a, b) => (String(a["index"]) < String(b["index"]) ? -1 : 1));
        expect(elements.findIndex((e) => e["id"] === "a")).toBeLessThan(
          elements.findIndex((e) => e["id"] === "b"),
        );
        expect(elements.findIndex((e) => e["id"] === "b")).toBeLessThan(
          elements.findIndex((e) => e["id"] === "c"),
        );
        for (const e of elements) e["index"] = undefined;
      }
      expect(records[1]).toEqual(records[0]);
      const doc = join(cwd, "doc.jsonl");
      const created = readFileSync(join(cwd, paths[0] as string), "utf8");
      writeFileSync(doc, created);
      const inspection = compare(["inspect", doc]);
      expect(inspection.exitCode).toBe(0);
      expect(inspection.stdout.toString()).toContain("rel 16,60");
      expect(created).toContain('"memberIds":["auto"]');
      const svg = compare(["export", doc, "--format", "svg"]);
      expect(svg.exitCode).toBe(0);
      const titleY = svg.stdout
        .toString()
        .match(/<text\b[^>]*\by="([^"]+)"[^>]*>Screen<\/text>/);
      expect(titleY).not.toBeNull();
      expect(Number(titleY?.[1])).toBeLessThan(200);
      const commands = [
        { op: "align", ids: ["a"], edge: "right", to: "parent" },
        { op: "align", ids: ["a"], edge: "top", to: "safe-area" },
        { op: "distribute", ids: ["a", "b", "c"], axis: "vertical", gap: 12 },
        { op: "snap", ids: ["a"], grid: 4 },
        {
          op: "layout",
          id: "frame",
          direction: "vertical",
          gap: 8,
          padding: 8,
          align: "stretch",
        },
        { op: "update", id: "a", sizing: { height: "fill" } },
      ];
      let current = created;
      for (const [index, command] of commands.entries()) {
        writeFileSync(ops, JSON.stringify([command]));
        expect(
          compareFile(["edit", doc, "--ops", ops], doc, current).exitCode,
        ).toBe(0);
        current = readFileSync(doc, "utf8");
        const elements = parseDocument(current).elements;
        const a = elements.find((element) => element.id === "a");
        if (index === 0) expect(a?.visual.x).toBe(450);
        if (index === 1) expect(a?.visual.y).toBe(247);
        if (index === 2) {
          const b = elements.find((element) => element.id === "b");
          const c = elements.find((element) => element.id === "c");
          expect(b?.visual.y).toBe(289);
          expect(c?.visual.y).toBe(331);
        }
        if (index === 3) expect(a?.visual.y).toBe(248);
        if (index === 4) expect(current).toContain('"layout"');
        if (index === 5) expect(a?.visual.layoutGrow).toBe(1);
      }
    } finally {
      rmSync(cwd, { recursive: true, force: true });
    }
  },
  60000,
);

nativeTest(
  "native draw and linked typography and icon warnings match Bun",
  () => {
    const cwd = mkdtempSync(join(tmpdir(), "nodetto-draw-parity-"));
    try {
      const doc = join(cwd, "doc.jsonl");
      const seed = serializeDocument(new Editor().getSnapshot());
      for (const shape of ["text:layer", "icon:search"]) {
        const paths = ["draw-bun.jsonl", "draw-native.jsonl"];
        const results = paths.map((path, i) => {
          writeFileSync(join(cwd, path), seed);
          return Bun.spawnSync(
            [
              ...(i === 0 ? [process.execPath, cliEntry] : [binary as string]),
              "draw",
              path,
              shape,
              "--at",
              "10,10",
              ...(shape === "text:layer" ? ["--label", "Inbox"] : []),
            ],
            { cwd },
          );
        });
        expect(results[0]?.exitCode).toBe(0);
        expect(results[1]?.exitCode).toBe(results[0]?.exitCode);
        expect(
          results[1]?.stderr.toString().replaceAll(paths[1] as string, "doc"),
        ).toBe(
          results[0]?.stderr.toString().replaceAll(paths[0] as string, "doc"),
        );
        for (const path of paths) {
          const elements = parseDocument(
            readFileSync(join(cwd, path), "utf8"),
          ).elements;
          expect(elements).toHaveLength(1);
          expect(elements[0]).toMatchObject(
            shape === "text:layer"
              ? {
                  type: "text.note",
                  semantic: { text: "Inbox" },
                  visual: { x: 10, y: 10 },
                }
              : {
                  type: "ui.icon",
                  semantic: { icon: "search" },
                  visual: { x: 10, y: 10 },
                },
          );
        }
        const drawn = readFileSync(join(cwd, paths[0] as string), "utf8");
        writeFileSync(doc, drawn);
        expect(drawn).toContain(shape === "text:layer" ? "Inbox" : "search");
        expect(compare(["export", doc, "--format", "svg"]).exitCode).toBe(0);
      }
      const ops = join(cwd, "ops.json");
      writeFileSync(doc, seed);
      writeFileSync(
        ops,
        JSON.stringify([
          {
            op: "add",
            type: "design.text-style",
            id: "style",
            semantic: {
              name: "Heading",
              value: {
                fontFamily: "Inter, sans-serif",
                fontSize: 32,
                fontWeight: 700,
                fontStyle: "normal",
                lineHeight: 1.2,
                letterSpacing: -0.5,
                textAlign: "start",
                textDecoration: "none",
                verticalAlign: "top",
              },
            },
          },
          {
            op: "add",
            type: "text.note",
            id: "note",
            semantic: { text: "Title" },
            visual: { textStyle: "style" },
          },
          {
            op: "add",
            type: "ui.icon",
            id: "unknown",
            semantic: { icon: "nope" },
          },
        ]),
      );
      const create = Bun.spawnSync(
        [process.execPath, cliEntry, "edit", doc, "--ops", ops],
        { cwd },
      );
      expect(create.exitCode).toBe(0);
      const created = readFileSync(doc, "utf8");
      const validation = compare(["validate", doc]);
      expect(validation.exitCode).toBe(0);
      expect(validation.stderr.toString()).toContain("icon.unknown");
      writeFileSync(
        ops,
        JSON.stringify([
          {
            op: "update",
            id: "note",
            visual: { style: { fontSize: 24, fontWeight: 700 } },
          },
        ]),
      );
      const updated = compareFile(["edit", doc, "--ops", ops], doc, created);
      expect(updated.exitCode).toBe(0);
      expect(updated.stdout.toString() + updated.stderr.toString()).toContain(
        "detached text style",
      );
    } finally {
      rmSync(cwd, { recursive: true, force: true });
    }
  },
  60000,
);
