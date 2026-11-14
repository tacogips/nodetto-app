import { expect } from "bun:test";
import {
  mkdirSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  symlinkSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { Editor } from "@nodetto/core";
import { serializeDocument } from "@nodetto/io";
import { textLayoutProblemDocument } from "../__fixtures__/text-layout.ts";
import { compare, compareFile, fixtureRoot, nativeTest } from "./harness.ts";

nativeTest(
  "native lint rules and fix match Bun",
  () => {
    const dir = mkdtempSync(join(tmpdir(), "nodetto-lint-"));
    try {
      const doc = join(dir, "doc.jsonl");
      const editor = new Editor();
      editor.setPageKind(editor.currentPageId, "erd");
      for (const id of ["one", "two"])
        editor.createElement("erd.table", {
          id,
          semantic: { tableName: id, columns: [] },
          visual: { x: 0, y: 0, width: 100, height: 100 },
        });
      writeFileSync(doc, serializeDocument(editor.getSnapshot()));
      expect(compare(["lint", doc]).stdout.toString()).toContain(
        "node-overlap",
      );
      const source = textLayoutProblemDocument();
      const result = compareFile(["lint", doc, "--fix"], doc, source);
      expect(result.exitCode).toBe(0);
      const fixed = readFileSync(doc, "utf8");
      expect(compareFile(["lint", doc, "--fix"], doc, fixed).exitCode).toBe(0);
      expect(readFileSync(doc, "utf8")).toBe(fixed);
      expect(
        compare([
          "lint",
          join(fixtureRoot, "bpmn/purchase-request.bpmn"),
          "--fix",
        ]).exitCode,
      ).toBe(2);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  },
  60000,
);

nativeTest(
  "native image lint respects missing files and attachment containment",
  () => {
    const root = mkdtempSync(join(tmpdir(), "nodetto-images-"));
    try {
      const dir = join(root, "document");
      mkdirSync(dir);
      mkdirSync(join(dir, "assets"));
      writeFileSync(join(root, "outside.png"), "image");
      writeFileSync(join(dir, "assets", "good.png"), "image");
      symlinkSync(join(root, "outside.png"), join(dir, "assets", "link.png"));
      const editor = new Editor();
      for (const name of ["good", "missing", "link"])
        editor.createElement("image.raster", {
          id: name,
          semantic: { src: `assets/${name}.png`, alt: "Image" },
          visual: { x: 0, y: 0, width: 100, height: 100 },
        });
      const doc = join(dir, "doc.jsonl");
      writeFileSync(doc, serializeDocument(editor.getSnapshot()));
      const result = compare(["lint", doc]);
      expect(result.exitCode).toBe(1);
      expect(result.stdout.toString()).toContain("file not found");
      expect(result.stdout.toString()).toContain(
        "cannot be read (outside the document folder, too large, or unreadable)",
      );
      const good = new Editor();
      good.createElement("image.raster", {
        semantic: { src: "assets/good.png", alt: "Image" },
        visual: { x: 0, y: 0, width: 100, height: 100 },
      });
      writeFileSync(doc, serializeDocument(good.getSnapshot()));
      expect(compare(["lint", "../document/doc.jsonl"], dir).exitCode).toBe(0);
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  },
  60000,
);
