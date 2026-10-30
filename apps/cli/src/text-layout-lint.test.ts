import { expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { Editor, lintTextLayoutPage } from "@nodetto/core";
import { parseDocument, serializeDocument } from "@nodetto/io";
import { EXIT_ERROR, EXIT_OK, runCli } from "./commands.ts";
import {
  TEXT_LAYOUT_EXPECTED,
  TEXT_LAYOUT_PAGE_ID,
  TEXT_LAYOUT_WIDE_EXPECTED,
  textLayoutCleanDocument,
  textLayoutProblemDocument,
  textLayoutWideDocument,
} from "./__fixtures__/text-layout.ts";

function lint(source: string, ...options: string[]) {
  return runCli(
    ["lint", "doc.jsonl", ...options],
    { readText: () => source, writeText: () => {} },
    "test",
  );
}

test("clean architecture page produces empty text and a clean JSON report", () => {
  const source = textLayoutCleanDocument();
  expect(lint(source, "--page", "Architecture")).toEqual({
    exitCode: EXIT_OK,
    stdout: "",
    stderr: "",
  });
  const result = lint(
    source,
    "--page",
    TEXT_LAYOUT_PAGE_ID,
    "--format",
    "json",
  );
  expect(result.exitCode).toBe(EXIT_OK);
  expect(JSON.parse(result.stdout)).toEqual({
    input: "doc.jsonl",
    pages: [
      { pageId: TEXT_LAYOUT_PAGE_ID, pageName: "Architecture", findings: [] },
    ],
    summary: { problems: 0, errors: 0, warnings: 0 },
  });
});

test("problem page reports eight warnings in text and JSON", () => {
  const source = textLayoutProblemDocument();
  const result = lint(source);
  expect(result.exitCode).toBe(EXIT_OK);
  const lines = result.stdout.trimEnd().split("\n");
  expect(lines[0]).toBe("doc.jsonl");
  expect(lines.length).toBe(11);
  expect(lines[9]).toBe("");
  for (const [index, finding] of TEXT_LAYOUT_EXPECTED.entries()) {
    expect(lines[index + 1]).toContain(finding.elementId);
    expect(lines[index + 1]).toContain("warning");
    expect(lines[index + 1]).toContain(finding.ruleId);
  }
  expect(lines.at(-1)).toBe("8 problems (0 errors, 8 warnings)");
  expect(result.stdout).toContain(
    "Label needs 3 lines (46.8 high) but the box is 30 high at 13px; export clips 2 lines.",
  );
  const json = lint(source, "--format", "json");
  expect(json.exitCode).toBe(EXIT_OK);
  const findings = JSON.parse(json.stdout).pages[0].findings;
  expect(
    findings.map(
      ({ ruleId, elementId }: { ruleId: string; elementId: string }) => ({
        ruleId,
        elementId,
      }),
    ),
  ).toEqual([...TEXT_LAYOUT_EXPECTED]);
  expect(findings).toEqual(
    lintTextLayoutPage(parseDocument(source), TEXT_LAYOUT_PAGE_ID),
  );
  for (const finding of findings) {
    expect(Object.keys(finding)).toEqual([
      "elementId",
      "severity",
      "message",
      "ruleId",
    ]);
    expect(finding.severity).toBe("warning");
  }
});

test("freeform and flowchart pages are lintable and selectable", () => {
  for (const kind of ["freeform", "flowchart"]) {
    const source = textLayoutProblemDocument(kind);
    const result = lint(source, "--format", "json");
    expect(result.exitCode).toBe(EXIT_OK);
    expect(
      JSON.parse(result.stdout).pages[0].findings.map(
        ({ ruleId, elementId }: { ruleId: string; elementId: string }) => ({
          ruleId,
          elementId,
        }),
      ),
    ).toEqual([...TEXT_LAYOUT_EXPECTED]);
    expect(lint(source, "--page", "Architecture").stdout).toBe(
      lint(textLayoutProblemDocument(), "--page", "Architecture").stdout,
    );
  }
  const editor = new Editor();
  editor.createPage({ name: "Notes", kind: "freeform" });
  const result = lint(
    serializeDocument(editor.getSnapshot()),
    "--page",
    "Notes",
  );
  expect(result.exitCode).toBe(EXIT_OK);
  expect(result.stdout).toBe("");
});

test("other page kinds are not lintable or selectable", () => {
  const result = lint(textLayoutProblemDocument("uml"));
  expect(result.exitCode).toBe(EXIT_ERROR);
  expect(result.stderr).toContain(
    "The document contains no BPMN, breadboard, architecture, freeform or flowchart pages.",
  );
  const editor = new Editor({
    document: parseDocument(textLayoutProblemDocument()),
  });
  editor.createPage({ name: "Classes", kind: "uml" });
  const selected = lint(
    serializeDocument(editor.getSnapshot()),
    "--page",
    "Classes",
  );
  expect(selected.exitCode).toBe(EXIT_ERROR);
  expect(selected.stdout).toBe("");
});

test("wide characters are reported with measured and available widths", () => {
  const source = textLayoutWideDocument();
  const result = lint(source, "--format", "json");
  expect(result.exitCode).toBe(EXIT_OK);
  const findings = JSON.parse(result.stdout).pages[0].findings;
  expect(
    findings.map(
      ({ ruleId, elementId }: { ruleId: string; elementId: string }) => ({
        ruleId,
        elementId,
      }),
    ),
  ).toEqual([...TEXT_LAYOUT_WIDE_EXPECTED]);
  expect(
    findings.find((f: { elementId: string }) => f.elementId === "node-wide")
      .message,
  ).toBe(
    "Label line 1 of 1 is 195 wide but the text area is 120 wide at 13px; export clips it.",
  );
  expect(
    findings.some((f: { elementId: string }) => f.elementId === "node-ascii"),
  ).toBe(false);
  const text = lint(source).stdout;
  expect(text).toContain("label-overflow");
  expect(text).toContain("note-overflow");
});

test("mixed BPMN and architecture retains BPMN findings and exit code", () => {
  const source = readFileSync(
    "packages/io/src/__fixtures__/bpmn/purchase-request.jsonl",
    "utf8",
  );
  const original = lint(source, "--format", "json");
  const editor = new Editor({
    document: parseDocument(source),
    rng: () => 0.5,
  });
  editor.createPage({
    id: TEXT_LAYOUT_PAGE_ID,
    name: "Architecture",
    kind: "architecture",
  });
  editor.createElement("node.generic", {
    id: "node-clipped",
    visual: { x: 0, y: 0, width: 140, height: 30 },
    semantic: { label: "Payment gateway authorisation service" },
  });
  const mixed = lint(
    serializeDocument(editor.getSnapshot()),
    "--format",
    "json",
  );
  expect(mixed.exitCode).toBe(original.exitCode);
  const pages = JSON.parse(mixed.stdout).pages;
  expect(pages[0].findings).toEqual(
    JSON.parse(original.stdout).pages[0].findings,
  );
  expect(pages[1].findings).toHaveLength(1);
  expect(pages[1].findings[0].ruleId).toBe("label-overflow");
});

test("text and JSON output are deterministic", () => {
  const source = textLayoutProblemDocument();
  for (const options of [[], ["--format", "json"]]) {
    expect(lint(source, ...options).stdout).toBe(
      lint(source, ...options).stdout,
    );
  }
});
