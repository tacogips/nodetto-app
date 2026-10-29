import { describe, expect, test } from "bun:test";
import { Editor } from "@nodetto/core";
import { parseDocument, serializeDocument } from "@nodetto/io";
import { type CommandIo, runCli } from "./commands.ts";

function memoryIo(
  document: string,
  stdin = "",
): CommandIo & {
  readonly saved: () => string;
} {
  let saved = document;
  return {
    readText: () => saved,
    writeText: (_path, value) => {
      saved = value;
    },
    readStdin: () => stdin,
    saved: () => saved,
  };
}

function singlePage(): string {
  return serializeDocument(new Editor().getSnapshot());
}

const run = (args: readonly string[], io: CommandIo = memoryIo("")) =>
  runCli(args, io, "test");

describe("nodetto-cli shapes", () => {
  test("lists shapes by category with words and connector filters", () => {
    const uml = run(["shapes", "--category", "uml"]);
    expect(uml.exitCode).toBe(0);
    expect(uml.stdout).toContain("UML class (uml-class)");
    expect(uml.stdout).toContain("sequence.actor");
    expect(uml.stdout).not.toContain("Flowchart (flowchart)");

    const json = JSON.parse(
      run(["shapes", "decision", "--format", "json"]).stdout,
    ) as { id: string }[];
    expect(json.map((shape) => shape.id)).toContain("flowchart:decision");

    const connectors = JSON.parse(
      run(["shapes", "--category", "erd", "--connectors", "--format", "json"])
        .stdout,
    ) as { id: string; connector: boolean }[];
    expect(connectors.every((shape) => shape.connector)).toBe(true);
    expect(connectors.map((shape) => shape.id)).toEqual([
      "erd.relation",
      "erd.foreign-key",
    ]);
  });

  test("describes one shape ID and rejects unknown categories", () => {
    const detail = run(["shapes", "flowchart:decision"]);
    expect(detail.stdout).toContain("Creates: shape.geo");
    expect(detail.stdout).toContain('"geo":"diamond"');
    expect(detail.stdout).toContain(
      "nodetto-cli draw <doc> flowchart:decision",
    );
    const unknown = run(["shapes", "--category", "paint"]);
    expect(unknown.exitCode).toBe(2);
    expect(unknown.stderr).toContain("Unknown shape category");
    expect(run(["shapes", "zzz-none"]).stdout).toContain("No shapes match");
  });
});

describe("nodetto-cli draw", () => {
  test("draws a shape by ID with its label, position and size", () => {
    const io = memoryIo(singlePage());
    const result = run(
      [
        "draw",
        "doc.jsonl",
        "flowchart:decision",
        "--label",
        "In stock?",
        "--at",
        "40,60",
        "--size",
        "200x120",
      ],
      io,
    );
    expect(result.exitCode).toBe(0);
    const [element] = parseDocument(io.saved()).elements;
    expect(element).toMatchObject({
      type: "shape.geo",
      semantic: { geo: "diamond", label: "In stock?" },
      visual: { x: 40, y: 60, width: 200, height: 120 },
    });
  });

  test("joins two elements with a connector shape", () => {
    const editor = new Editor();
    const api = editor.createElement("uml.component", {
      semantic: { name: "Checkout" },
    });
    const store = editor.createElement("uml.component", {
      semantic: { name: "Inventory" },
    });
    const io = memoryIo(serializeDocument(editor.getSnapshot()));
    const drawn = run(
      [
        "draw",
        "doc.jsonl",
        "uml.component:dependency",
        "--from",
        api,
        "--to",
        store,
        "--label",
        "uses",
      ],
      io,
    );
    expect(drawn.exitCode).toBe(0);
    const edge = parseDocument(io.saved()).elements.find(
      (element) => element.type === "uml.component-relationship",
    );
    expect(edge?.semantic).toMatchObject({
      from: api,
      to: store,
      kind: "dependency",
      label: "uses",
    });
    const wrong = run(
      ["draw", "doc.jsonl", "uml.association", "--from", api, "--to", store],
      io,
    );
    expect(wrong.exitCode).toBe(2);
    expect(wrong.stderr).toContain("cannot connect");
  });

  test("places sequence participants on the next lifeline and checks usage", () => {
    const io = memoryIo(singlePage());
    expect(
      run(["draw", "doc.jsonl", "sequence.actor", "--label", "Buyer"], io)
        .exitCode,
    ).toBe(0);
    expect(run(["draw", "doc.jsonl", "sequence.service"], io).exitCode).toBe(0);
    // Elements are stored in ID order; lifelines read in participant order.
    const participants = parseDocument(io.saved())
      .elements.map(
        (element) =>
          element.semantic as { kind: string; name: string; order: string },
      )
      .sort((left, right) =>
        left.order < right.order ? -1 : left.order > right.order ? 1 : 0,
      );
    expect(participants).toMatchObject([
      { kind: "actor", name: "Buyer" },
      { kind: "service" },
    ]);
    expect(run(["draw", "doc.jsonl", "nope:shape"], io).stderr).toContain(
      "Unknown shape",
    );
    expect(
      run(["draw", "doc.jsonl", "edge", "--from", "x"], io).stderr,
    ).toContain("both --from and --to");
  });
});

test("draws a UML use-case diagram by shape ID", () => {
  const io = memoryIo(singlePage());
  const drawn = (args: readonly string[]) => {
    const result = run(["draw", "doc.jsonl", ...args, "--format", "json"], io);
    expect(result.exitCode).toBe(0);
    return (JSON.parse(result.stdout) as { created: { id: string }[] })
      .created[0]?.id as string;
  };
  const actor = drawn(["usecase:actor", "--label", "Shopper"]);
  const useCase = drawn(["usecase:usecase", "--label", "Check out"]);
  drawn(["usecase:association", "--from", actor, "--to", useCase]);
  const elements = parseDocument(io.saved()).elements;
  expect(elements.map((element) => [element.type, element.semantic])).toEqual(
    expect.arrayContaining([
      ["usecase.node", { name: "Shopper", kind: "actor" }],
      ["usecase.node", { name: "Check out", kind: "usecase" }],
      [
        "usecase.relationship",
        expect.objectContaining({
          from: actor,
          to: useCase,
          kind: "association",
        }),
      ],
    ]),
  );
});

describe("page modes in the CLI", () => {
  test("edit sets page modes and pages reports them", () => {
    const editor = new Editor();
    const first = editor.currentPageId;
    const io = memoryIo(
      serializeDocument(editor.getSnapshot()),
      JSON.stringify([
        { op: "set-page-mode", id: first, mode: "class" },
        { op: "add-page", name: "Actors", kind: "uml", mode: "usecase" },
        { op: "add-page", name: "Schema", kind: "erd" },
      ]),
    );
    expect(run(["edit", "doc.jsonl", "--ops", "-"], io).exitCode).toBe(0);
    const pages = JSON.parse(
      run(["pages", "doc.jsonl", "--format", "json"], io).stdout,
    ) as { name: string; mode: string | null }[];
    expect(pages.map((page) => [page.name, page.mode])).toEqual([
      ["Page 1", "class"],
      ["Actors", "usecase"],
      ["Schema", "erd"],
    ]);
    expect(run(["pages", "doc.jsonl"], io).stdout).toContain(
      "PAGE\tSHORT ID\tKIND\tMODE\tNAME\tFULL ID",
    );
    const bad = memoryIo(
      io.saved(),
      JSON.stringify([{ op: "set-page-mode", id: first, mode: "paint" }]),
    );
    const rejected = run(["edit", "doc.jsonl", "--ops", "-"], bad);
    expect(rejected.exitCode).toBe(2);
    expect(rejected.stderr).toContain('Unknown page mode "paint"');
  });
});
