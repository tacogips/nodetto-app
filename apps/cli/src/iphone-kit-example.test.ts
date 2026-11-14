import { expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { parseDocument } from "@nodetto/io";
import { runCliAsync } from "./cli.ts";
import type { CommandIo } from "./commands.ts";

const samplePath = join(
  import.meta.dir,
  "../../../examples/design/iphone-kit/design.jsonl",
);

function fixture() {
  const source = readFileSync(samplePath, "utf8");
  const files = new Map<string, Uint8Array>();
  const io: CommandIo = {
    readText: () => source,
    writeText: () => {},
    writeBytes: (path, bytes) => files.set(path, bytes),
    exists: (path) => path === "out",
  };
  return { source, files, io };
}

test("committed iPhone sample validates and has no lint findings", async () => {
  const { io } = fixture();
  const validation = await runCliAsync(
    ["validate", "sample.jsonl"],
    io,
    "test",
  );
  expect(validation.exitCode).toBe(0);
  const lint = await runCliAsync(
    ["lint", "sample.jsonl", "--format", "json"],
    io,
    "test",
  );
  expect(lint.exitCode).toBe(0);
  const report = JSON.parse(lint.stdout) as {
    pages: { findings: unknown[] }[];
    summary: { problems: number };
  };
  expect(report.pages.length).toBeGreaterThan(0);
  expect(report.pages.flatMap((page) => page.findings)).toEqual([]);
  expect(report.summary.problems).toBe(0);
});

test("committed sample has one Main flow with four screens", async () => {
  const { source, io } = fixture();
  const doc = parseDocument(source);
  const result = await runCliAsync(
    ["inspect", "sample.jsonl", "--flows", "--format", "json"],
    io,
    "test",
  );
  expect(result.exitCode).toBe(0);
  const resultFlows = JSON.parse(result.stdout) as {
    flows: { name: string; screens: string[] }[];
  };
  expect(resultFlows.flows).toHaveLength(1);
  expect(resultFlows.flows[0]?.name).toBe("Main");
  const ids = resultFlows.flows[0]?.screens ?? [];
  expect(ids).toHaveLength(4);
  const names = ids.map((id) => {
    const element = doc.elements.find((item) => item.id === id);
    return (element?.semantic as { name?: string } | undefined)?.name;
  });
  expect(names.sort()).toEqual(
    ["Add entry", "Plant detail", "Plants", "Settings"].sort(),
  );
});

test("prototype links use the intended kit child controls", () => {
  const doc = parseDocument(readFileSync(samplePath, "utf8"));
  const sources = doc.elements
    .filter((element) => element.type === "edge.generic")
    .map((edge) => {
      const from = (edge.semantic as { from?: string }).from;
      return doc.elements.find((element) => element.id === from)?.visual
        .componentKey;
    });
  expect(sources.filter((key) => key === "backButton")).toHaveLength(1);
  expect(sources.filter((key) => key === "sendButton")).toHaveLength(1);
  expect(sources.filter((key) => key === "item1")).toHaveLength(2);
  expect(sources.filter((key) => key === "item3")).toHaveLength(1);
});

test("committed sample renders its four screens as PNG", async () => {
  const { source, io, files } = fixture();
  const page = parseDocument(source).pages.find((item) => item.name === "App");
  expect(page).toBeDefined();
  const result = await runCliAsync(
    [
      "export",
      "sample.jsonl",
      "--page",
      page!.id,
      "--frames",
      "--format",
      "png",
      "--scale",
      "2",
      "--output-dir",
      "out",
    ],
    io,
    "test",
  );
  expect(result.exitCode).toBe(0);
  expect(files.size).toBe(4);
  for (const bytes of files.values()) {
    expect([...bytes.slice(0, 8)]).toEqual([137, 80, 78, 71, 13, 10, 26, 10]);
  }
});
