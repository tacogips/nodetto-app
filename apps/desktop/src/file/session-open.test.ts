// Opening files: our own JSONL, interchange imports, failed opens and
// the recent list.
//
// The harness in `session-test-helpers.ts` mocks the backend with an
// in-memory filesystem and drives the autosave timer by hand.

import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import type { Editor } from "@nodetto/core";
import { serializeDocument } from "@nodetto/io";
import { encodeStoredZip } from "../../../../packages/core/src/zip.ts";
import { addShape, createHarness } from "./session-test-helpers.ts";

const BPMN_FIXTURE = readFileSync(
  `${import.meta.dir}/../../../../packages/io/src/__fixtures__/bpmn/purchase-request.bpmn`,
  "utf8",
);
const KICAD_NET_FIXTURE = readFileSync(
  `${import.meta.dir}/../../../../test-fixtures/kicad/led-button.net`,
  "utf8",
);
const KICAD_SCHEMATIC_FIXTURE = readFileSync(
  `${import.meta.dir}/../../../../test-fixtures/kicad/led-button.kicad_sch`,
  "utf8",
);
const KICAD_UNKNOWN_FIXTURE = readFileSync(
  `${import.meta.dir}/../../../../test-fixtures/kicad/unknown-symbols.net`,
  "utf8",
);
const KICAD_PCB_FIXTURE = readFileSync(
  `${import.meta.dir}/../../../../test-fixtures/kicad/two-layer.kicad_pcb`,
  "utf8",
);

describe("opening", () => {
  async function savedFile(label: string): Promise<{
    readonly path: string;
    readonly text: string;
  }> {
    const harness = createHarness();
    addShape(harness.editor, label);
    harness.backend.saveAnswers.push("/docs/source.jsonl");
    await harness.session.save();
    const text = harness.backend.files.get("/docs/source.jsonl");
    if (text === undefined) {
      throw new Error("the fixture failed to save");
    }
    return { path: "/docs/source.jsonl", text };
  }

  test("open loads the file, stays clean and starts watching", async () => {
    const source = await savedFile("from disk");
    const harness = createHarness();
    harness.backend.files.set(source.path, source.text);
    harness.backend.openAnswers.push(source.path);

    const opened = await harness.session.open();

    expect(opened).toBe(true);
    expect(harness.session.state().filePath).toBe(source.path);
    expect(harness.session.state().dirty).toBe(false);
    expect(harness.backend.watched).toEqual([source.path]);
    expect(harness.session.state().recent.map((entry) => entry.path)).toEqual([
      source.path,
    ]);
  });

  test("opening Mermaid imports a detached document and never rewrites the source", async () => {
    const harness = createHarness();
    const path = "/docs/order-flow.mmd";
    const source = `sequenceDiagram
  actor user as User
  participant api as API
  user->>api: Create order
`;
    harness.backend.files.set(path, source);

    const opened = await harness.session.openPath(path);

    expect(opened).toBe(true);
    expect(harness.session.state()).toMatchObject({
      filePath: null,
      fileName: "order-flow.mmd",
      dirty: true,
      error: null,
    });
    expect(harness.editor.getSnapshot().title).toBe("order-flow");
    expect(harness.editor.getSnapshot().pages[0]?.kind).toBe("sequence");
    expect(harness.editor.store.listElements()).toHaveLength(3);
    expect(harness.backend.watched).toEqual([]);

    addShape(harness.editor, "local edit");
    harness.timers.fire();
    await harness.settle();
    expect(harness.backend.writes).toEqual([]);
    expect(harness.backend.files.get(path)).toBe(source);
  });

  test("a malformed Mermaid file leaves the current document and association intact", async () => {
    const source = await savedFile("original");
    const harness = createHarness();
    harness.backend.files.set(source.path, source.text);
    await harness.session.openPath(source.path);
    const before = serializeDocument(harness.editor.getSnapshot());
    harness.backend.files.set(
      "/docs/broken.mermaid",
      "flowchart LR\n  A --> B",
    );

    const opened = await harness.session.openPath("/docs/broken.mermaid");

    expect(opened).toBe(false);
    expect(serializeDocument(harness.editor.getSnapshot())).toBe(before);
    expect(harness.session.state().filePath).toBe(source.path);
    expect(harness.session.state().error).toContain(
      "could not import broken.mermaid",
    );
    expect(harness.backend.watched).toEqual([source.path]);
  });

  test("opening BPMN imports a detached document and never rewrites the source", async () => {
    const harness = createHarness();
    const path = "/docs/purchase-request.bpmn";
    harness.backend.files.set(path, BPMN_FIXTURE);

    expect(await harness.session.openPath(path)).toBe(true);
    expect(harness.session.state()).toMatchObject({
      filePath: null,
      fileName: "purchase-request.bpmn",
      dirty: true,
      importWarnings: [],
      error: null,
    });
    expect(harness.editor.getSnapshot().pages[0]?.kind).toBe("bpmn");
    expect(
      harness.editor.store
        .listElements()
        .filter((element) =>
          ["bpmn.event", "bpmn.task", "bpmn.gateway"].includes(element.type),
        ),
    ).toHaveLength(13);
    expect(harness.backend.watched).toEqual([]);

    addShape(harness.editor, "local edit");
    harness.timers.fire();
    await harness.settle();
    expect(harness.backend.writes).toEqual([]);
    expect(harness.backend.files.get(path)).toBe(BPMN_FIXTURE);
  });

  test("opening a draw.io file imports a detached document with its warnings", async () => {
    const harness = createHarness();
    const path = "/docs/whiteboard.drawio";
    const source = `<mxfile><diagram name="Board"><mxGraphModel><root><mxCell id="0"/><mxCell id="1" parent="0"/><mxCell id="a" value="Plan" style="shape=cloud;html=1;" vertex="1" parent="1"><mxGeometry x="10" y="20" width="120" height="80" as="geometry"/></mxCell><mxCell id="b" value="" style="shape=image;" vertex="1" parent="1"><mxGeometry width="10" height="10" as="geometry"/></mxCell></root></mxGraphModel></diagram></mxfile>`;
    harness.backend.files.set(path, source);

    expect(await harness.session.openPath(path)).toBe(true);
    expect(harness.session.state()).toMatchObject({
      filePath: null,
      fileName: "whiteboard.drawio",
      dirty: true,
      error: null,
    });
    expect(harness.session.state().importWarnings).toEqual([
      { element: "Board", message: "Board: Images were skipped." },
    ]);
    expect(harness.editor.getSnapshot().title).toBe("whiteboard");
    expect(harness.editor.store.listElements()).toMatchObject([
      { type: "shape.geo", semantic: { geo: "cloud", label: "Plan" } },
    ]);
    expect(harness.backend.watched).toEqual([]);
    addShape(harness.editor, "local edit");
    harness.timers.fire();
    await harness.settle();
    expect(harness.backend.writes).toEqual([]);
    expect(harness.backend.files.get(path)).toBe(source);
  });

  test("opening a KiCad netlist imports a detached breadboard document", async () => {
    const harness = createHarness();
    const path = "/docs/led-button.net";
    harness.backend.files.set(path, KICAD_NET_FIXTURE);

    expect(await harness.session.openPath(path)).toBe(true);
    expect(harness.session.state()).toMatchObject({
      filePath: null,
      fileName: "led-button.net",
      dirty: true,
      error: null,
    });
    expect(harness.editor.getSnapshot().pages[0]?.kind).toBe("breadboard");
    expect(
      harness.editor.store
        .listElements()
        .filter((element) => element.type.startsWith("breadboard.")),
    ).toHaveLength(6);
    expect(
      harness.editor.store
        .listElements()
        .some((element) => element.type === "breadboard.netlist"),
    ).toBe(true);
    expect(harness.backend.watched).toEqual([]);
  });

  test("opening a KiCad schematic imports a detached breadboard document", async () => {
    const harness = createHarness();
    const path = "/docs/led-button.kicad_sch";
    harness.backend.files.set(path, KICAD_SCHEMATIC_FIXTURE);

    expect(await harness.session.openPath(path)).toBe(true);
    expect(harness.session.state().filePath).toBeNull();
    expect(harness.editor.getSnapshot().pages[0]?.kind).toBe("breadboard");
    expect(
      harness.editor.store
        .listElements()
        .filter((element) => element.type.startsWith("breadboard.")),
    ).toHaveLength(6);
    expect(
      harness.editor.store
        .listElements()
        .some((element) => element.type === "breadboard.netlist"),
    ).toBe(true);
    expect(harness.backend.watched).toEqual([]);
  });

  test.each(["board.kicad_pcb", "board.KICAD_PCB"])(
    "opening %s imports a detached PCB document",
    async (fileName) => {
      const harness = createHarness();
      const path = `/docs/${fileName}`;
      harness.backend.files.set(path, KICAD_PCB_FIXTURE);

      expect(await harness.session.openPath(path)).toBe(true);
      expect(harness.session.state()).toMatchObject({
        filePath: null,
        fileName,
        dirty: true,
        error: null,
      });
      expect(harness.editor.getSnapshot().pages).toMatchObject([
        { kind: "pcb", name: "board" },
      ]);
      expect(harness.backend.watched).toEqual([]);
      addShape(harness.editor, "local edit");
      harness.timers.fire();
      await harness.settle();
      expect(harness.backend.writes).toEqual([]);
      expect(harness.backend.files.get(path)).toBe(KICAD_PCB_FIXTURE);
    },
  );

  test("a KiCad PCB suffix with a non-board root leaves the document intact", async () => {
    const harness = createHarness();
    const before = serializeDocument(harness.editor.getSnapshot());
    const path = "/docs/x.kicad_pcb";
    harness.backend.files.set(path, "(kicad_sch (version 20250101))");

    expect(await harness.session.openPath(path)).toBe(false);
    expect(harness.session.state().error).toMatch(
      /^could not import x\.kicad_pcb: Unsupported KiCad root/,
    );
    expect(serializeDocument(harness.editor.getSnapshot())).toBe(before);
  });

  test("KiCad PCB warnings are surfaced as import notes", async () => {
    const harness = createHarness();
    const path = "/docs/warning.kicad_pcb";
    harness.backend.files.set(
      path,
      '(kicad_pcb (version 20240108) (generator "fixture") (dimension))',
    );

    expect(await harness.session.openPath(path)).toBe(true);
    expect(harness.session.state().importWarnings).toEqual([
      {
        element: "warning.kicad_pcb",
        message: expect.stringContaining("Skipped 1 dimension items."),
      },
    ]);
  });

  const gerber = (fileFunction: string, ...body: string[]) =>
    [
      `%TF.FileFunction,${fileFunction}*%`,
      "%FSLAX46Y46*%",
      "%MOMM*%",
      "%ADD10C,0.200000*%",
      ...body,
      "M02*",
    ].join("\n");
  const GERBER_OUTLINE = gerber(
    "Profile,NP",
    "D10*",
    "X0Y0D02*",
    "X20000000Y0D01*",
    "X20000000Y10000000D01*",
    "X0Y0D01*",
  );
  const GERBER_COPPER = gerber("Copper,L1,Top", "D10*", "X5000000Y5000000D03*");
  const DRILL = "M48\nMETRIC\nT1C0.800\n%\nT1\nX5.0Y5.0\nM30\n";
  const layerNames = (editor: Editor) =>
    editor.store
      .listElements()
      .filter((element) => element.type === "group")
      .map((element) => String(element.visual.layerName))
      .sort();

  test("opening a Gerber ZIP imports a detached PCB document", async () => {
    const harness = createHarness();
    const path = "/docs/keyboard-gerbers.zip";
    const encode = (text: string) => new TextEncoder().encode(text);
    harness.backend.binaries.set(
      path,
      encodeStoredZip(
        [
          {
            path: "gerber/board-Edge_Cuts.gm1",
            contents: encode(GERBER_OUTLINE),
          },
          { path: "gerber/board-F_Cu.gtl", contents: encode(GERBER_COPPER) },
          { path: "gerber/board.drl", contents: encode(DRILL) },
          { path: "README.txt", contents: encode("Order 5 boards.\n") },
        ],
        "test",
      ),
    );

    expect(await harness.session.openPath(path)).toBe(true);
    expect(harness.session.state()).toMatchObject({
      filePath: null,
      fileName: "keyboard-gerbers.zip",
      dirty: true,
      error: null,
      importWarnings: [],
    });
    const snapshot = harness.editor.getSnapshot();
    expect(snapshot.pages).toMatchObject([
      { kind: "freeform", name: "keyboard-gerbers" },
    ]);
    expect(layerNames(harness.editor)).toEqual([
      "Board outline (board-Edge_Cuts.gm1)",
      "Drill (board.drl)",
      "Top copper (board-F_Cu.gtl)",
    ]);
    expect(harness.backend.watched).toEqual([]);
  });

  test("opening a single Gerber file imports it as text", async () => {
    const harness = createHarness();
    const path = "/docs/board.gbr";
    harness.backend.files.set(path, GERBER_OUTLINE);

    expect(await harness.session.openPath(path)).toBe(true);
    expect(harness.session.state()).toMatchObject({
      fileName: "board.gbr",
      error: null,
    });
    expect(layerNames(harness.editor)).toEqual(["Board outline (board.gbr)"]);
  });

  test("a ZIP without Gerber or drill files leaves the current document intact", async () => {
    const source = await savedFile("original");
    const harness = createHarness();
    harness.backend.files.set(source.path, source.text);
    await harness.session.openPath(source.path);
    const before = serializeDocument(harness.editor.getSnapshot());
    harness.backend.binaries.set(
      "/docs/notes.zip",
      encodeStoredZip(
        [{ path: "notes.txt", contents: new TextEncoder().encode("hello\n") }],
        "test",
      ),
    );
    harness.backend.binaries.set(
      "/docs/fake.zip",
      new TextEncoder().encode("not an archive"),
    );

    expect(await harness.session.openPath("/docs/notes.zip")).toBe(false);
    expect(harness.session.state().error).toBe(
      "could not import notes.zip: the archive holds no Gerber or drill file",
    );
    expect(await harness.session.openPath("/docs/fake.zip")).toBe(false);
    expect(harness.session.state().error).toBe(
      "could not import fake.zip: not a ZIP archive",
    );
    expect(serializeDocument(harness.editor.getSnapshot())).toBe(before);
    expect(harness.session.state().filePath).toBe(source.path);
    expect(harness.backend.watched).toEqual([source.path]);
  });

  test("a malformed KiCad file leaves the current document intact", async () => {
    const source = await savedFile("original");
    const harness = createHarness();
    harness.backend.files.set(source.path, source.text);
    await harness.session.openPath(source.path);
    const before = serializeDocument(harness.editor.getSnapshot());
    harness.backend.files.set("/docs/bad.net", "(foo)");

    expect(await harness.session.openPath("/docs/bad.net")).toBe(false);
    expect(serializeDocument(harness.editor.getSnapshot())).toBe(before);
    expect(harness.session.state().filePath).toBe(source.path);
    expect(harness.session.state().error).toContain("could not import bad.net");
    expect(harness.backend.watched).toEqual([source.path]);
  });

  test("unknown KiCad symbols are surfaced as import warnings", async () => {
    const harness = createHarness();
    const path = "/docs/unknown-symbols.net";
    harness.backend.files.set(path, KICAD_UNKNOWN_FIXTURE);

    expect(await harness.session.openPath(path)).toBe(true);
    expect(harness.session.state().importWarnings).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          message: expect.stringContaining("kicad.skippedSymbol"),
        }),
      ]),
    );
  });

  test("a malformed BPMN file leaves the current document and association intact", async () => {
    const source = await savedFile("original");
    const harness = createHarness();
    harness.backend.files.set(source.path, source.text);
    await harness.session.openPath(source.path);
    const before = serializeDocument(harness.editor.getSnapshot());
    harness.backend.files.set("/docs/broken.bpmn", "<bpmn:definitions");

    expect(await harness.session.openPath("/docs/broken.bpmn")).toBe(false);
    expect(serializeDocument(harness.editor.getSnapshot())).toBe(before);
    expect(harness.session.state().filePath).toBe(source.path);
    expect(harness.session.state().error).toContain(
      "could not import broken.bpmn",
    );
    expect(harness.backend.watched).toEqual([source.path]);
  });

  test("BPMN import warnings are surfaced and cleared by a JSONL open", async () => {
    const harness = createHarness();
    const path = "/docs/unsupported.bpmn";
    const source =
      '<bpmn:definitions xmlns:bpmn="http://www.omg.org/spec/BPMN/20100524/MODEL" id="Defs"><bpmn:process id="Process"><bpmn:transaction id="Transaction_A"><bpmn:task id="Nested_A" /></bpmn:transaction></bpmn:process></bpmn:definitions>';
    harness.backend.files.set(path, source);

    expect(await harness.session.openPath(path)).toBe(true);
    expect(harness.session.state().importWarnings).toHaveLength(1);
    expect(harness.session.state().importWarnings[0]?.element).toBe(
      "transaction",
    );

    const jsonlPath = "/docs/after-import.jsonl";
    harness.backend.files.set(
      jsonlPath,
      serializeDocument(harness.editor.getSnapshot()),
    );
    expect(await harness.session.openPath(jsonlPath)).toBe(true);
    expect(harness.session.state().importWarnings).toEqual([]);
  });

  test("a cancelled open changes nothing", async () => {
    const { session, editor } = createHarness();
    const before = editor.store.size;

    const opened = await session.open();

    expect(opened).toBe(false);
    expect(editor.store.size).toBe(before);
    expect(session.state().filePath).toBeNull();
  });

  test("a file that cannot be parsed leaves the document untouched", async () => {
    const { session, editor, backend } = createHarness();
    backend.files.set("/docs/broken.jsonl", "not json at all\n");
    const before = serializeDocument(editor.getSnapshot());

    const opened = await session.openPath("/docs/broken.jsonl");

    expect(opened).toBe(false);
    expect(serializeDocument(editor.getSnapshot())).toBe(before);
    expect(session.state().filePath).toBeNull();
    expect(session.state().error).toContain("could not parse");
  });

  test("a recent entry that is only unreachable stays in the list", async () => {
    const source = await savedFile("from disk");
    const harness = createHarness();
    harness.backend.files.set(source.path, source.text);
    harness.backend.openAnswers.push(source.path);
    await harness.session.open();

    // The file is still there; the read failed for another reason (an
    // offline share, a lock). Pruning it would make the user hunt for it.
    harness.backend.failNextRead("resource temporarily unavailable");
    const reopened = await harness.session.openPath(source.path);

    expect(reopened).toBe(false);
    expect(harness.session.state().recent.map((entry) => entry.path)).toEqual([
      source.path,
    ]);
    expect(harness.session.state().error).toContain("could not open");
  });

  test("a recent entry that no longer opens is dropped from the list", async () => {
    const source = await savedFile("from disk");
    const harness = createHarness();
    harness.backend.files.set(source.path, source.text);
    harness.backend.openAnswers.push(source.path);
    await harness.session.open();
    expect(harness.session.state().recent).toHaveLength(1);

    harness.backend.files.delete(source.path);
    const reopened = await harness.session.openPath(source.path);

    expect(reopened).toBe(false);
    expect(harness.session.state().recent).toEqual([]);
    expect(harness.session.state().error).toContain("could not open");
  });
});
