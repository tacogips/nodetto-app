import { expect, test } from "bun:test";
import {
  mkdtempSync,
  readFileSync,
  readdirSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { inflateSync } from "node:zlib";
import { join } from "node:path";
import {
  Editor,
  HANDOFF_FORMATS,
  resolveConnector,
  endpointReaderFor,
} from "@nodetto/core";
import { parseDocument, serializeDocument } from "@nodetto/io";
import {
  textLayoutCleanDocument,
  textLayoutDenseDocument,
  textLayoutProblemDocument,
  textLayoutWideDocument,
} from "./__fixtures__/text-layout.ts";

const binary = process.env.NODETTO_CLI_TEST_BINARY;
const fixtureRoot = join(
  import.meta.dir,
  "../../../packages/io/src/__fixtures__",
);
const source = join(import.meta.dir, "main.ts");
const nativeTest = binary ? test : test.skip;

function compare(args: string[], cwd?: string, stdin?: string) {
  const expected = Bun.spawnSync([process.execPath, source, ...args], {
    cwd,
    stdin: stdin === undefined ? undefined : new TextEncoder().encode(stdin),
  });
  const actual = Bun.spawnSync([binary!, ...args], {
    cwd,
    stdin: stdin === undefined ? undefined : new TextEncoder().encode(stdin),
  });
  expect(actual.exitCode).toBe(expected.exitCode);
  expect(actual.stdout.toString()).toBe(expected.stdout.toString());
  expect(actual.stderr.toString()).toBe(expected.stderr.toString());
  return actual;
}

const goldenFixtures = readdirSync(fixtureRoot).filter((name) =>
  name.endsWith(".jsonl"),
);

nativeTest(
  "native CLI matches every JSONL golden fixture for validate, canonical format and both inspect formats",
  () => {
    for (const name of goldenFixtures) {
      const path = join(fixtureRoot, name);
      for (const args of [
        ["validate", path],
        ["format", path],
        ["inspect", path],
        ["inspect", path, "--format", "json"],
      ])
        compare(args);
    }
  },
  // Eight CLI launches per fixture (TypeScript and native, four commands);
  // the budget guards each launch, so it grows with the fixture count.
  goldenFixtures.length * 5000,
);

nativeTest(
  "native CLI matches help, element catalogue, DDL, layout, diff, errors and BPMN",
  () => {
    for (const args of [
      ["--help"],
      ["--version"],
      ["help", "mcp"],
      ["types"],
      ["types", "erd.table", "--format", "json"],
      ["ddl", join(fixtureRoot, "erd.jsonl"), "--dialect", "mysql"],
      ["arrange", join(fixtureRoot, "erd.jsonl"), "--mode", "overlaps"],
      [
        "diff",
        join(fixtureRoot, "erd.jsonl"),
        join(fixtureRoot, "erd-unsorted.jsonl"),
        "--format",
        "json",
      ],
      [
        "lint",
        join(fixtureRoot, "bpmn/purchase-request.bpmn"),
        "--format",
        "json",
      ],
      ["bpmn", "export", join(fixtureRoot, "bpmn/purchase-request.jsonl")],
      ["validate", "/missing/document.jsonl"],
      ["export", "missing.jsonl", "--format", "bmp"],
      ["mcp", "--port", "1234"],
    ]) {
      // OS error wording differs between Node and std::fs; result codes and
      // contextual paths are checked separately for missing local files.
      if (args[0] === "validate" && args[1]?.startsWith("/missing")) {
        const result = Bun.spawnSync([binary!, ...args]);
        expect(result.exitCode).toBe(2);
        expect(result.stderr.toString()).toContain(
          "Cannot read /missing/document.jsonl:",
        );
      } else compare(args);
    }
  },
  60000,
);

nativeTest(
  "native edit handles refs, arrangement, snapshots and rollback using the shared engine",
  () => {
    const cwd = mkdtempSync(join(tmpdir(), "nodetto-native-edit-"));
    try {
      const source = serializeDocument(new Editor().getSnapshot());
      writeFileSync(join(cwd, "doc.jsonl"), source);
      const operations = [
        { op: "add-page", name: "Flow", kind: "freeform", ref: "flow" },
        {
          op: "add",
          page: "@flow",
          type: "node.generic",
          ref: "one",
          semantic: { label: "First" },
        },
        {
          op: "add",
          page: "@flow",
          type: "node.generic",
          ref: "two",
          place: { rightOf: "@one", gap: 80 },
          semantic: { label: "Second" },
        },
        { op: "connect", from: "@one", to: "@two", label: "Next" },
        { op: "update", id: "@one", visual: { x: 40 } },
        { op: "move", id: "@two", x: 400, y: 100 },
        { op: "rename-page", id: "@flow", name: "Renamed" },
      ];
      const applied = Bun.spawnSync(
        [
          binary!,
          "edit",
          "doc.jsonl",
          "--ops",
          "-",
          "--snapshot",
          "last.jsonl",
          "--arrange",
        ],
        { cwd, stdin: new TextEncoder().encode(JSON.stringify(operations)) },
      );
      expect(applied.exitCode).toBe(0);
      const saved = readFileSync(join(cwd, "doc.jsonl"), "utf8");
      const document = parseDocument(saved);
      expect(document.elements).toHaveLength(3);
      expect(document.pages.some((page) => page.name === "Renamed")).toBe(true);
      expect(readFileSync(join(cwd, "last.jsonl"), "utf8")).toBe(saved);
      compare(["inspect", "doc.jsonl"], cwd);
      compare(["format", "doc.jsonl", "--check"], cwd);
      const invalid = Bun.spawnSync(
        [binary!, "edit", "doc.jsonl", "--ops", "-"],
        {
          cwd,
          stdin: new TextEncoder().encode(
            '[{"op":"move","id":"missing","x":0,"y":0}]',
          ),
        },
      );
      expect(invalid.exitCode).toBe(2);
      expect(readFileSync(join(cwd, "doc.jsonl"), "utf8")).toBe(saved);
      const importResult = Bun.spawnSync(
        [
          binary!,
          "bpmn",
          "import",
          join(fixtureRoot, "bpmn/purchase-request.bpmn"),
          "--output",
          "process.jsonl",
        ],
        { cwd },
      );
      expect(importResult.exitCode).toBe(0);
      expect(
        parseDocument(readFileSync(join(cwd, "process.jsonl"), "utf8")).pages[0]
          ?.kind,
      ).toBe("bpmn");
    } finally {
      rmSync(cwd, { recursive: true, force: true });
    }
  },
  15000,
);

nativeTest(
  "native --cwd supports document commands and preserves check/strict exit codes",
  () => {
    const cwd = mkdtempSync(join(tmpdir(), "nodetto-native-cwd-"));
    try {
      const erd = readFileSync(join(fixtureRoot, "erd.jsonl"), "utf8");
      writeFileSync(join(cwd, "doc.jsonl"), erd);
      writeFileSync(join(cwd, "stale.sql"), "-- stale\n");
      const native = Bun.spawnSync([
        binary!,
        "--cwd",
        cwd,
        "inspect",
        "doc.jsonl",
        "--format",
        "json",
      ]);
      const expected = Bun.spawnSync(
        [process.execPath, source, "inspect", "doc.jsonl", "--format", "json"],
        { cwd },
      );
      expect(native.exitCode).toBe(0);
      expect(native.stdout.toString()).toBe(expected.stdout.toString());
      expect(
        Bun.spawnSync([
          binary!,
          "--cwd",
          cwd,
          "ddl",
          "doc.jsonl",
          "--check",
          "stale.sql",
        ]).exitCode,
      ).toBe(1);
      writeFileSync(
        join(cwd, "unsafe.jsonl"),
        erd.replace(/"dataType":"[^"]+"/, '"dataType":"uuid;drop"'),
      );
      expect(
        Bun.spawnSync([
          binary!,
          "--cwd",
          cwd,
          "ddl",
          "unsafe.jsonl",
          "--strict",
        ]).exitCode,
      ).toBe(3);
    } finally {
      rmSync(cwd, { recursive: true, force: true });
    }
  },
);

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

nativeTest(
  "native CLI lists stable page aliases and accepts them for page commands",
  () => {
    const cwd = mkdtempSync(join(tmpdir(), "nodetto-native-page-ids-"));
    try {
      const document = parseDocument(
        readFileSync(join(fixtureRoot, "erd.jsonl"), "utf8"),
      );
      const editor = new Editor({ document });
      const schema = editor.currentPageId;
      editor.createPage({ name: "Other page", kind: "sequence" });
      writeFileSync(
        join(cwd, "mixed.jsonl"),
        serializeDocument(editor.getSnapshot()),
      );
      const listing = compare(
        ["pages", "mixed.jsonl", "--format", "json"],
        cwd,
      );
      const pages = JSON.parse(listing.stdout.toString()) as {
        id: string;
        shortId: string;
      }[];
      const alias = pages.find((page) => page.id === schema)!.shortId;
      expect(alias).toHaveLength(11);
      compare(["pages", "mixed.jsonl", "--kind", "erd"], cwd);
      for (const args of [
        ["inspect", "mixed.jsonl", "--page", alias, "--format", "json"],
        ["export", "mixed.jsonl", "--page", alias, "--format", "svg"],
        ["ddl", "mixed.jsonl", "--page", alias],
        ["arrange", "mixed.jsonl", "--page", alias],
        ["edit", "mixed.jsonl", "--ops", "-", "--dry-run"],
      ])
        compare(
          args,
          cwd,
          args[0] === "edit"
            ? JSON.stringify([
                { op: "rename-page", id: alias, name: "Renamed" },
              ])
            : undefined,
        );
      for (const format of ["png", "pdf"]) {
        const result = Bun.spawnSync(
          [
            binary!,
            "export",
            "mixed.jsonl",
            "--page",
            alias,
            "--format",
            format,
            "--output",
            `out.${format}`,
          ],
          { cwd },
        );
        expect(result.exitCode).toBe(0);
        expect([
          ...readFileSync(join(cwd, `out.${format}`)).subarray(0, 4),
        ]).toEqual(format === "png" ? [137, 80, 78, 71] : [37, 80, 68, 70]);
      }
    } finally {
      rmSync(cwd, { recursive: true, force: true });
    }
  },
  60000,
);

nativeTest(
  "native CLI draws and exports a state flow",
  () => {
    const dir = mkdtempSync(join(tmpdir(), "nodetto-state-"));
    try {
      const file = join(dir, "flow.jsonl");
      writeFileSync(
        file,
        '{"kind":"document","schemaVersion":1,"id":"state-flow","title":"Flow"}\n{"kind":"page","id":"p1","name":"Flow","pageKind":"state"}\n',
      );
      const ops = join(
        import.meta.dir,
        "../../../examples/state-transition/flow.ops.json",
      );
      const edit = Bun.spawnSync([
        binary!,
        "edit",
        file,
        "--ops",
        ops,
        "--format",
        "json",
      ]);
      expect(edit.exitCode).toBe(0);
      const document = parseDocument(readFileSync(file, "utf8"));
      expect(
        document.elements.filter((element) => element.type === "state.node"),
      ).toHaveLength(5);
      const transitions = document.elements.filter(
        (element) => element.type === "state.transition",
      );
      expect(transitions).toHaveLength(6);
      expect(
        transitions.some(
          (element) =>
            (element.semantic as { from: string; to: string }).from ===
            (element.semantic as { from: string; to: string }).to,
        ),
      ).toBe(true);
      expect(transitions.map((element) => element.semantic)).toContainEqual(
        expect.objectContaining({
          trigger: "start",
          guard: "ready",
          effect: "begin()",
        }),
      );
      compare(["validate", file]);
      compare(["inspect", file, "--format", "json"]);
      for (const format of ["svg", "png", "pdf", "mermaid"]) {
        const output = join(dir, `flow.${format}`);
        const args = ["export", file, "--format", format, "--output", output];
        if (format === "mermaid")
          args.push("--mermaid-kind", "stateDiagram-v2");
        const result = Bun.spawnSync([binary!, ...args]);
        expect(result.exitCode).toBe(0);
        const bytes = readFileSync(output);
        expect(bytes.byteLength).toBeGreaterThan(100);
        if (format === "svg") {
          expect(bytes.toString()).toContain("start [ready] / begin()");
          expect(bytes.toString()).not.toContain("unsupported");
        } else if (format === "png")
          expect(bytes.subarray(1, 4).toString()).toBe("PNG");
        else if (format === "pdf")
          expect(bytes.subarray(0, 5).toString()).toBe("%PDF-");
        else expect(bytes.toString()).toContain("stateDiagram-v2");
      }
      compare([
        "export",
        file,
        "--format",
        "mermaid",
        "--mermaid-kind",
        "stateDiagram-v2",
      ]);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  },
  60000,
);

nativeTest(
  "native CLI creates a flowchart with decisions and retry paths",
  () => {
    const dir = mkdtempSync(join(tmpdir(), "nodetto-flowchart-"));
    try {
      const file = join(dir, "flowchart.jsonl");
      writeFileSync(
        file,
        '{"kind":"document","schemaVersion":1,"id":"flowchart","title":"Request flowchart"}\n{"kind":"page","id":"p1","name":"Flowchart","pageKind":"flowchart"}\n',
      );
      const ops = join(
        import.meta.dir,
        "../../../examples/flowchart/request.ops.json",
      );
      const result = Bun.spawnSync([binary!, "edit", file, "--ops", ops]);
      expect(result.exitCode).toBe(0);
      const document = parseDocument(readFileSync(file, "utf8"));
      expect(
        document.elements.filter((element) => element.type === "shape.geo"),
      ).toHaveLength(7);
      expect(
        document.elements.filter((element) => element.type === "edge.generic"),
      ).toHaveLength(7);
      compare(["validate", file]);
      compare(["inspect", file, "--format", "json"]);
      compare([
        "export",
        file,
        "--format",
        "mermaid",
        "--mermaid-kind",
        "flowchart",
      ]);
      for (const format of ["svg", "png", "pdf"]) {
        const output = join(dir, `flowchart.${format}`);
        expect(
          Bun.spawnSync([
            binary!,
            "export",
            file,
            "--format",
            format,
            "--output",
            output,
          ]).exitCode,
        ).toBe(0);
        const bytes = readFileSync(output);
        expect(bytes.byteLength).toBeGreaterThan(100);
        if (format === "svg") {
          expect(bytes.toString()).toContain("Read request");
          expect(bytes.toString()).toContain("Retry");
        }
        if (format === "png")
          expect(bytes.subarray(1, 4).toString()).toBe("PNG");
        if (format === "pdf")
          expect(bytes.subarray(0, 5).toString()).toBe("%PDF-");
      }
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  },
  60000,
);

nativeTest(
  "native CLI keeps manual bends fixed when moving the attached shape",
  () => {
    const dir = mkdtempSync(join(tmpdir(), "nodetto-manual-bends-"));
    try {
      const editor = new Editor();
      const shape = editor.createElement("node.generic", {
        id: "shape",
        visual: { x: 0, y: 0, width: 100, height: 100 },
      });
      editor.createElement("edge.generic", {
        id: "arrow",
        semantic: {
          from: shape,
          toPoint: { x: 450, y: 50 },
          routing: "manual",
          routingWaypoints: [{ u: 0.5, v: 150 }],
        },
      });
      const file = join(dir, "bends.jsonl");
      const ops = join(dir, "move.json");
      writeFileSync(file, serializeDocument(editor.getSnapshot()));
      writeFileSync(
        ops,
        JSON.stringify([{ op: "move", id: shape, x: 100, y: 100 }]),
      );
      const result = Bun.spawnSync([binary!, "edit", file, "--ops", ops]);
      expect(result.exitCode).toBe(0);
      const moved = new Editor({
        document: parseDocument(readFileSync(file, "utf8")),
      });
      const arrow = moved.store.get("arrow")!;
      const resolved = resolveConnector(
        arrow,
        moved.createShapeContext(),
        endpointReaderFor(arrow.type),
      )!;
      expect(resolved.waypointPoints![0]!.x).toBeCloseTo(250);
      expect(resolved.waypointPoints![0]!.y).toBeCloseTo(200);
      compare(["validate", file]);
      compare(["export", file, "--format", "svg"]);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  },
  60000,
);

nativeTest(
  "native CLI writes the same breadboard PCB archive as the TypeScript CLI",
  () => {
    const example = join(
      import.meta.dir,
      "../../../examples/breadboard/led-button.jsonl",
    );
    for (const extra of [[], ["--outline", "used"]]) {
      const expectedDir = mkdtempSync(join(tmpdir(), "nodetto-pcb-ts-"));
      const actualDir = mkdtempSync(join(tmpdir(), "nodetto-pcb-native-"));
      try {
        const args = [
          "breadboard",
          "gerber",
          example,
          "--output",
          "led-button.zip",
          ...extra,
        ];
        const expected = Bun.spawnSync([process.execPath, source, ...args], {
          cwd: expectedDir,
        });
        const actual = Bun.spawnSync([binary!, ...args], { cwd: actualDir });
        expect(actual.exitCode).toBe(0);
        expect(actual.exitCode).toBe(expected.exitCode);
        expect(actual.stdout.toString()).toBe(expected.stdout.toString());
        expect(actual.stderr.toString()).toBe(expected.stderr.toString());
        expect(readFileSync(join(actualDir, "led-button.zip"))).toEqual(
          readFileSync(join(expectedDir, "led-button.zip")),
        );
      } finally {
        rmSync(expectedDir, { recursive: true, force: true });
        rmSync(actualDir, { recursive: true, force: true });
      }
    }
  },
  60000,
);

nativeTest(
  "native pcb import and gerber match the TypeScript CLI",
  () => {
    const fixture = join(
      import.meta.dir,
      "../../../test-fixtures/kicad/two-layer.kicad_pcb",
    );
    const expectedDir = mkdtempSync(join(tmpdir(), "nodetto-pcb-ts-"));
    const actualDir = mkdtempSync(join(tmpdir(), "nodetto-pcb-native-"));
    try {
      const both = (args: string[]) => {
        const expected = Bun.spawnSync([process.execPath, source, ...args], {
          cwd: expectedDir,
        });
        const actual = Bun.spawnSync([binary!, ...args], { cwd: actualDir });
        expect(actual.exitCode).toBe(0);
        expect(actual.exitCode).toBe(expected.exitCode);
        expect(actual.stdout.toString()).toBe(expected.stdout.toString());
        expect(actual.stderr.toString()).toBe(expected.stderr.toString());
        return expected.stdout.toString();
      };
      both(["pcb", "import", fixture, "--output", "board.jsonl"]);
      both(["pcb", "gerber", "board.jsonl", "--output", "board.zip"]);
      const svg = both(["export", "board.jsonl", "--format", "svg"]);
      expect(svg).toContain('data-layer="pcb-board"');
      expect(readFileSync(join(actualDir, "board.jsonl"), "utf8")).toBe(
        readFileSync(join(expectedDir, "board.jsonl"), "utf8"),
      );
      expect(readFileSync(join(actualDir, "board.zip"))).toEqual(
        readFileSync(join(expectedDir, "board.zip")),
      );
    } finally {
      rmSync(expectedDir, { recursive: true, force: true });
      rmSync(actualDir, { recursive: true, force: true });
    }
  },
  120000,
);

nativeTest(
  "native gerber import matches the TypeScript CLI for files, a ZIP and --into",
  () => {
    const example = join(import.meta.dir, "../../../examples/breadboard");
    const layers = ["GTL", "GBL", "GTS", "GBS", "GTO", "GKO", "DRL"].map(
      (extension) => join(example, `led-button.${extension}`),
    );
    const expectedDir = mkdtempSync(join(tmpdir(), "nodetto-gerber-ts-"));
    const actualDir = mkdtempSync(join(tmpdir(), "nodetto-gerber-native-"));
    try {
      const both = (args: string[]) => {
        const expected = Bun.spawnSync([process.execPath, source, ...args], {
          cwd: expectedDir,
        });
        const actual = Bun.spawnSync([binary!, ...args], { cwd: actualDir });
        expect(actual.exitCode).toBe(0);
        expect(actual.exitCode).toBe(expected.exitCode);
        expect(actual.stdout.toString()).toBe(expected.stdout.toString());
        expect(actual.stderr.toString()).toBe(expected.stderr.toString());
      };
      both([
        "breadboard",
        "gerber",
        join(example, "led-button.jsonl"),
        "--output",
        "board.zip",
      ]);
      both(["gerber", "import", ...layers]);
      both(["gerber", "import", "board.zip", "--output", "pcb.jsonl"]);
      both([
        "gerber",
        "import",
        ...layers,
        "--into",
        "pcb.jsonl",
        "--page-name",
        "Again",
      ]);
      expect(readFileSync(join(actualDir, "pcb.jsonl"), "utf8")).toBe(
        readFileSync(join(expectedDir, "pcb.jsonl"), "utf8"),
      );
    } finally {
      rmSync(expectedDir, { recursive: true, force: true });
      rmSync(actualDir, { recursive: true, force: true });
    }
  },
  120000,
);

/** RGBA pixels of an 8-bit RGBA PNG, enough to inspect native output. */
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

nativeTest(
  "native CLI reads a document with a 20,000-point path quickly",
  () => {
    const cwd = mkdtempSync(join(tmpdir(), "nodetto-native-large-"));
    try {
      const editor = new Editor();
      const contours = Array.from({ length: 1000 }, (_, contour) => ({
        points: Array.from({ length: 20 }, (_, index) => ({
          x: (contour % 40) * 30 + 10 * Math.cos((index / 20) * 2 * Math.PI),
          y:
            Math.floor(contour / 40) * 30 +
            10 * Math.sin((index / 20) * 2 * Math.PI),
        })),
      }));
      editor.createElement("draw.path", {
        semantic: { contours, fillRule: "nonzero" },
      });
      writeFileSync(
        join(cwd, "large.jsonl"),
        serializeDocument(editor.getSnapshot()),
      );
      // Splitting such a line on a regular expression took minutes in the
      // native interpreter; the whole command now takes about a second.
      const started = performance.now();
      const result = Bun.spawnSync([binary!, "validate", "large.jsonl"], {
        cwd,
      });
      expect(result.exitCode).toBe(0);
      expect(performance.now() - started).toBeLessThan(20000);
    } finally {
      rmSync(cwd, { recursive: true, force: true });
    }
  },
  120000,
);

nativeTest(
  "native CLI matches text-layout lint and export, including dense pages",
  () => {
    const cwd = mkdtempSync(join(tmpdir(), "nodetto-native-text-layout-"));
    try {
      writeFileSync(join(cwd, "clean.jsonl"), textLayoutCleanDocument());
      writeFileSync(join(cwd, "problem.jsonl"), textLayoutProblemDocument());
      writeFileSync(join(cwd, "dense.jsonl"), textLayoutDenseDocument(300));
      for (const args of [
        ["lint", "clean.jsonl"],
        ["lint", "problem.jsonl"],
        ["lint", "problem.jsonl", "--format", "json"],
        ["lint", "problem.jsonl", "--page", "Architecture"],
      ]) {
        const result = compare(args, cwd);
        expect(result.exitCode).toBe(0);
      }
      for (const args of [
        ["export", "problem.jsonl", "--format", "svg"],
        ["export", "problem.jsonl", "--format", "svg", "--output", "out.svg"],
      ]) {
        const result = compare(args, cwd);
        expect(result.exitCode).toBe(0);
        expect(result.stderr.toString()).toContain(
          "warning: label-overflow node-clipped:",
        );
      }
      const args = ["lint", "dense.jsonl", "--format", "json"];
      const expected = Bun.spawnSync([process.execPath, source, ...args], {
        cwd,
      });
      const actual = Bun.spawnSync([binary!, ...args], { cwd, timeout: 60000 });
      expect(expected.exitCode).toBe(0);
      expect(actual.exitCode).toBe(0);
      expect(actual.stderr.toString()).not.toContain("panicked");
      expect(actual.stdout.toString()).toBe(expected.stdout.toString());
    } finally {
      rmSync(cwd, { recursive: true, force: true });
    }
  },
  // Three dense-launch budgets of 60000 ms cover the paired CLI launches.
  180000,
);

nativeTest(
  "native CLI matches text-layout lint on wide labels, freeform and flowchart pages",
  () => {
    const cwd = mkdtempSync(join(tmpdir(), "nodetto-native-text-layout-wide-"));
    try {
      writeFileSync(join(cwd, "wide.jsonl"), textLayoutWideDocument());
      writeFileSync(
        join(cwd, "problem-freeform.jsonl"),
        textLayoutProblemDocument("freeform"),
      );
      writeFileSync(
        join(cwd, "problem-flowchart.jsonl"),
        textLayoutProblemDocument("flowchart"),
      );
      for (const file of [
        "wide.jsonl",
        "problem-freeform.jsonl",
        "problem-flowchart.jsonl",
      ]) {
        const lint = compare(["lint", file], cwd);
        expect(lint.exitCode).toBe(0);
        if (file === "wide.jsonl")
          expect(lint.stdout.toString()).toContain("note-overflow");
        expect(compare(["lint", file, "--format", "json"], cwd).exitCode).toBe(
          0,
        );
        const exported = compare(["export", file, "--format", "svg"], cwd);
        expect(exported.exitCode).toBe(0);
        if (file === "wide.jsonl") {
          expect(exported.stderr.toString()).toContain(
            "warning: label-overflow node-wide:",
          );
          expect(exported.stderr.toString()).not.toContain("node-ascii");
        } else {
          expect(exported.stderr.toString()).toContain(
            "warning: label-overflow node-clipped:",
          );
        }
      }
      expect(
        compare(
          ["lint", "problem-flowchart.jsonl", "--page", "Architecture"],
          cwd,
        ).exitCode,
      ).toBe(0);
    } finally {
      rmSync(cwd, { recursive: true, force: true });
    }
  },
  // Twenty launches cover ten comparisons of small documents.
  120000,
);
