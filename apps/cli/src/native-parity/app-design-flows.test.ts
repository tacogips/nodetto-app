import { expect, test } from "bun:test";
import {
  mkdtempSync,
  mkdirSync,
  readFileSync,
  readdirSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { Editor } from "@nodetto/core";
import { serializeDocument } from "@nodetto/io";
import {
  binary,
  cliEntry,
  compare,
  compareFile,
  decodeRgbaPng,
  nativeTest,
} from "./harness.ts";

const idPattern = /\b01[0-9A-HJKMNP-TV-Z]{24}\b/g;

function canonical(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(canonical).join(",")}]`;
  if (value && typeof value === "object") {
    const record = value as Record<string, unknown>;
    return `{${Object.keys(record)
      .sort()
      .map((key) => `${JSON.stringify(key)}:${canonical(record[key])}`)
      .join(",")}}`;
  }
  return JSON.stringify(
    typeof value === "string" ? value.replace(idPattern, "<ID>") : value,
  );
}

function stable(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(stable).join(",")}]`;
  if (value && typeof value === "object") {
    const obj = value as Record<string, unknown>;
    return `{${Object.keys(obj)
      .sort()
      .map((key) => `${JSON.stringify(key)}:${stable(obj[key])}`)
      .join(",")}}`;
  }
  return JSON.stringify(value);
}

function documentSignature(source: string, input = "") {
  const parse = (text: string) =>
    text
      .trim()
      .split("\n")
      .filter(Boolean)
      .map((line) => JSON.parse(line) as Record<string, unknown>);
  const records = parse(source);
  const existingIds = new Set(input.match(idPattern) ?? []);
  const generated = new Set(
    (source.match(idPattern) ?? []).filter((id) => !existingIds.has(id)),
  );
  const ids = new Map<string, string>();
  const assign = (id: unknown) => {
    if (typeof id === "string" && generated.has(id) && !ids.has(id))
      ids.set(id, `<ID${ids.size + 1}>`);
  };
  const compareKey = (a: unknown, b: unknown) => {
    const left = String(a ?? "");
    const right = String(b ?? "");
    return left < right ? -1 : left > right ? 1 : 0;
  };
  const pages = records
    .filter((r) => r.kind === "page")
    .sort((a, b) => compareKey(a.order, b.order));
  for (const page of pages) assign(page.id);
  const elements = records.filter((r) => r.kind === "element");
  for (const page of pages) {
    for (const element of elements
      .filter((r) => r.page === page.id)
      .sort((a, b) => compareKey(a.index, b.index)))
      assign(element.id);
  }
  // Records outside ordered collections get a stable first appearance independent of JSONL id sorting.
  for (const record of [...records].sort((a, b) =>
    canonical(a).localeCompare(canonical(b)),
  ))
    assign(record.id);
  for (const record of [...records].sort((a, b) =>
    canonical(a).localeCompare(canonical(b)),
  )) {
    for (const id of stable(record).match(idPattern) ?? []) assign(id);
  }
  const replace = (value: unknown): unknown => {
    if (typeof value === "string")
      return value.replace(idPattern, (id) => ids.get(id) ?? id);
    if (Array.isArray(value)) return value.map(replace);
    if (value && typeof value === "object")
      return Object.fromEntries(
        Object.entries(value).map(([k, v]) => [k, replace(v)]),
      );
    return value;
  };
  const inputIds = new Set(parse(input).map((r) => r.id));
  const normalized = records.map((record) => {
    const created = typeof record.id === "string" && !inputIds.has(record.id);
    const key =
      created && record.kind === "element"
        ? "index"
        : created && record.kind === "page"
          ? "order"
          : "";
    return replace(
      Object.fromEntries(
        Object.entries(record).filter(([field]) => field !== key),
      ),
    );
  });
  return {
    records: normalized.map((r) => stable(r)).sort(),
    pages: pages.map((r) => replace(r.id)),
    elements: pages.map((page) => ({
      page: replace(page.id),
      ids: elements
        .filter((r) => r.page === page.id)
        .sort((a, b) => compareKey(a.index, b.index))
        .map((r) => replace(r.id)),
    })),
  };
}

function normalizeOutput(
  stdout: string,
  stderr: string,
  document: string,
  input: string,
) {
  const existing = new Set(input.match(idPattern) ?? []);
  const known = [
    ...new Set(`${document}\n${stdout}\n${stderr}`.match(idPattern) ?? []),
  ];
  const ordinals = new Map<string, string>();
  const replace = (text: string) =>
    text.replace(/\b01[0-9A-HJKMNP-TV-Z]{4,24}\b/g, (token) => {
      const matches = known.filter((id) => id.startsWith(token));
      if (matches.length !== 1 || existing.has(matches[0] as string))
        return token;
      const id = matches[0] as string;
      if (!ordinals.has(id)) ordinals.set(id, `<ID${ordinals.size + 1}>`);
      return ordinals.get(id) as string;
    });
  return [replace(stdout), replace(stderr)];
}

function compareGenerated(args: string[], path: string, source: string) {
  writeFileSync(path, source);
  const expected = Bun.spawnSync([process.execPath, cliEntry, ...args]);
  const expectedDoc = readFileSync(path, "utf8");
  writeFileSync(path, source);
  const actual = Bun.spawnSync([binary as string, ...args]);
  const actualDoc = readFileSync(path, "utf8");
  expect(actual.exitCode).toBe(expected.exitCode);
  expect(
    normalizeOutput(
      actual.stdout.toString(),
      actual.stderr.toString(),
      actualDoc,
      source,
    ),
  ).toEqual(
    normalizeOutput(
      expected.stdout.toString(),
      expected.stderr.toString(),
      expectedDoc,
      source,
    ),
  );
  expect(documentSignature(actualDoc, source)).toEqual(
    documentSignature(expectedDoc, source),
  );
  return actual;
}

test("generated id signatures preserve values and references independent of line order", () => {
  const ids = [
    "01AAAAAAAAAAAAAAAAAAAAAAAA",
    "01BBBBBBBBBBBBBBBBBBBBBBBB",
    "01CCCCCCCCCCCCCCCCCCCCCCCC",
    "01DDDDDDDDDDDDDDDDDDDDDDDD",
    "01EEEEEEEEEEEEEEEEEEEEEEEE",
  ];
  const make = (a: string, b: string, c: string, d: string, e: string) => [
    { id: a, semantic: { name: "one", memberIds: [c, d, e] } },
    { id: b, semantic: { name: "two", memberIds: [] } },
    { id: c, visual: { x: 1 }, props: { label: "a" } },
    { id: d, visual: { x: 2 } },
    { id: e, visual: { x: 3 } },
  ];
  const encode = (records: unknown[]) =>
    records.map((r) => JSON.stringify(r)).join("\n");
  const left = make(...(ids as [string, string, string, string, string]));
  const right = make(ids[4]!, ids[3]!, ids[2]!, ids[1]!, ids[0]!).reverse();
  expect(documentSignature(encode(left))).toEqual(
    documentSignature(encode(right)),
  );
  const changed = structuredClone(right);
  (changed[2] as { visual: { x: number } }).visual.x = 9;
  expect(documentSignature(encode(left))).not.toEqual(
    documentSignature(encode(changed)),
  );
  const prop = structuredClone(right);
  (prop[2] as { props: { label: string } }).props.label = "b";
  expect(documentSignature(encode(left))).not.toEqual(
    documentSignature(encode(prop)),
  );
  const swapped = structuredClone(right);
  (swapped[4] as { semantic: { memberIds: string[] } }).semantic.memberIds = [];
  (swapped[3] as { semantic: { memberIds: string[] } }).semantic.memberIds = [
    ids[2]!,
    ids[1]!,
    ids[0]!,
  ];
  expect(documentSignature(encode(left))).not.toEqual(
    documentSignature(encode(swapped)),
  );
});

test("generated values preserve ordering and existing values", () => {
  const a = "01AAAAAAAAAAAAAAAAAAAAAAAA";
  const b = "01BBBBBBBBBBBBBBBBBBBBBBBB";
  const old = "01CCCCCCCCCCCCCCCCCCCCCCCC";
  const input = JSON.stringify({ kind: "page", id: old, order: "V" });
  const doc = (
    pageOrder: string,
    leftIndex: string,
    rightIndex: string,
    existingOrder = "V",
  ) =>
    [
      { kind: "page", id: old, order: existingOrder },
      { kind: "page", id: a, order: pageOrder },
      { kind: "element", id: b, page: old, index: leftIndex, visual: { x: 1 } },
      {
        kind: "element",
        id: "fixed",
        page: old,
        index: rightIndex,
        visual: { x: 2 },
      },
    ]
      .map((record) => JSON.stringify(record))
      .join("\n");
  expect(documentSignature(doc("z", "a", "b"), input)).toEqual(
    documentSignature(doc("y", "c", "d"), input),
  );
  expect(documentSignature(doc("z", "a", "b"), input)).not.toEqual(
    documentSignature(doc("A", "a", "b"), input),
  );
  expect(documentSignature(doc("z", "a", "b"), input)).not.toEqual(
    documentSignature(doc("z", "c", "b"), input),
  );
  expect(documentSignature(doc("z", "a", "b"), input)).not.toEqual(
    documentSignature(doc("z", "a", "b", "U"), input),
  );
  expect(normalizeOutput(`${a} ${b} ${a}`, "", `${a} ${b}`, input)[0]).toBe(
    "<ID1> <ID2> <ID1>",
  );
  expect(normalizeOutput(`${old} ${a}`, "", `${a} ${old}`, input)[0]).toBe(
    `${old} <ID1>`,
  );
  expect(normalizeOutput(`${a} ${a.slice(0, 12)}`, "", a, input)[0]).toBe(
    "<ID1> <ID1>",
  );
  const refOnly = (id: string) =>
    JSON.stringify({ kind: "document", id: "doc", custom: id });
  expect(documentSignature(refOnly(a))).toEqual(documentSignature(refOnly(b)));
});

nativeTest(
  "app flow exports and comparison match the native CLI",
  () => {
    const cwd = mkdtempSync(join(tmpdir(), "nodetto-flow-parity-"));
    try {
      const doc = join(cwd, "design.jsonl");
      const ops = join(cwd, "ops.json");
      writeFileSync(doc, serializeDocument(new Editor().getSnapshot()));
      writeFileSync(
        ops,
        JSON.stringify([
          {
            op: "add",
            shape: "frame:iphone",
            id: "first",
            semantic: {
              name: "First",
              prototypeStart: true,
              prototypeFlowName: "Main",
            },
          },
          {
            op: "add",
            shape: "frame:iphone",
            id: "second",
            visual: { x: 500, y: 0 },
            semantic: { name: "Second" },
          },
          {
            op: "add",
            type: "shape.geo",
            id: "hotspot",
            parent: "first",
            semantic: { geo: "rect" },
            visual: { x: 20, y: 100, width: 48, height: 48 },
          },
          {
            op: "connect",
            shape: "prototype:transition",
            from: "hotspot",
            to: "second",
            semantic: { prototypeTrigger: "tap" },
          },
          { op: "connect", shape: "prototype:back", from: "hotspot" },
        ]),
      );
      const setup = compareGenerated(
        ["edit", doc, "--ops", ops],
        doc,
        readFileSync(doc, "utf8"),
      );
      expect(setup.exitCode).toBe(0);
      for (const args of [
        ["inspect", doc, "--flows"],
        ["inspect", doc, "--flows", "--format", "json"],
        ["export", doc, "--prototype", "--format", "svg"],
      ])
        expect(compare(args).exitCode).toBe(0);
      expect(
        compare([
          "export",
          doc,
          "--prototype",
          "--element",
          "first",
          "--format",
          "svg",
        ]).exitCode,
      ).toBe(1);
      const html = join(cwd, "app.html");
      writeFileSync(html, "");
      expect(
        compareFile(
          ["export", doc, "--format", "prototype", "--output", html],
          html,
          "",
        ).exitCode,
      ).toBe(0);
      expect(readFileSync(html, "utf8")).toContain("<!doctype html>");
      for (const dir of ["bun", "native"]) mkdirSync(join(cwd, dir));
      const frameOutputs: string[][] = [];
      for (const [index, dir] of ["bun", "native"].entries()) {
        const cmd =
          index === 0 ? [process.execPath, cliEntry] : [binary as string];
        const result = Bun.spawnSync([
          ...cmd,
          "export",
          doc,
          "--frames",
          "--format",
          "png",
          "--output-dir",
          join(cwd, dir),
        ]);
        expect(result.exitCode).toBe(0);
        frameOutputs.push([
          result.stdout.toString().replaceAll(join(cwd, dir), "<OUTPUT>"),
          result.stderr.toString().replaceAll(join(cwd, dir), "<OUTPUT>"),
        ]);
      }
      expect(frameOutputs[1]).toEqual(frameOutputs[0]);
      const names = readdirSync(join(cwd, "bun")).sort();
      expect(names.length).toBe(2);
      expect(readdirSync(join(cwd, "native")).sort()).toEqual(names);
      for (const name of names)
        expect(decodeRgbaPng(readFileSync(join(cwd, "bun", name)))).toEqual(
          decodeRgbaPng(readFileSync(join(cwd, "native", name))),
        );
      const image = join(cwd, "bun", names[0]!);
      const comparison = join(cwd, "comparison.png");
      const outputArgs = ["compare", image, image, "--output", comparison];
      const bunComparison = Bun.spawnSync([
        process.execPath,
        cliEntry,
        ...outputArgs,
      ]);
      const bunPixels = decodeRgbaPng(readFileSync(comparison));
      const nativeComparison = Bun.spawnSync([binary as string, ...outputArgs]);
      expect(nativeComparison.exitCode).toBe(bunComparison.exitCode);
      expect(nativeComparison.exitCode).toBe(0);
      expect(nativeComparison.stdout.toString()).toBe(
        bunComparison.stdout.toString(),
      );
      expect(nativeComparison.stderr.toString()).toBe(
        bunComparison.stderr.toString(),
      );
      expect(decodeRgbaPng(readFileSync(comparison))).toEqual(bunPixels);
      for (const dir of ["comparison-bun", "comparison-native"])
        mkdirSync(join(cwd, dir));
      const comparisonOutputs: string[][] = [];
      for (const [index, dir] of [
        "comparison-bun",
        "comparison-native",
      ].entries()) {
        const cmd =
          index === 0 ? [process.execPath, cliEntry] : [binary as string];
        const result = Bun.spawnSync([
          ...cmd,
          "compare",
          join(cwd, "bun"),
          join(cwd, "bun"),
          "--output",
          join(cwd, dir),
        ]);
        expect(result.exitCode).toBe(0);
        comparisonOutputs.push([
          result.stdout.toString().replaceAll(join(cwd, dir), "<OUTPUT>"),
          result.stderr.toString().replaceAll(join(cwd, dir), "<OUTPUT>"),
        ]);
      }
      expect(comparisonOutputs[1]).toEqual(comparisonOutputs[0]);
      const compared = readdirSync(join(cwd, "comparison-bun")).sort();
      expect(compared.length).toBe(2);
      expect(readdirSync(join(cwd, "comparison-native")).sort()).toEqual(
        compared,
      );
      for (const name of compared)
        expect(
          decodeRgbaPng(readFileSync(join(cwd, "comparison-bun", name))),
        ).toEqual(
          decodeRgbaPng(readFileSync(join(cwd, "comparison-native", name))),
        );
      expect(
        compare([
          "compare",
          join(cwd, "bun", names[0]!),
          join(cwd, "native", names[0]!),
          "--output",
          join(cwd, "bad.png"),
          "--band",
          "x",
        ]).exitCode,
      ).toBe(1);
    } finally {
      rmSync(cwd, { recursive: true, force: true });
    }
  },
  120000,
);

nativeTest("iOS kit discovery agrees across CLI hosts", () => {
  const listing = compare(["shapes"]);
  expect(listing.exitCode).toBe(0);
  expect(listing.stdout.toString()).toContain("ios:tab-bar");
  expect(
    listing.stdout
      .toString()
      .split("\n")
      .filter((line) => line.includes("ios:")).length,
  ).toBe(16);
  expect(compare(["shapes", "ios:tab-bar"]).exitCode).toBe(0);
});

nativeTest(
  "kit insertion and property edits agree across hosts",
  () => {
    const cwd = mkdtempSync(join(tmpdir(), "nodetto-kit-parity-"));
    try {
      const doc = join(cwd, "design.jsonl");
      const ops = join(cwd, "ops.json");
      const source = serializeDocument(new Editor().getSnapshot());
      const shapes = [
        "status-bar",
        "home-indicator",
        "nav-bar",
        "tab-bar",
        "top-tabs",
        "segmented",
        "search-field",
        "list-row",
        "section-header",
        "chip",
        "fab",
        "icon-button",
        "text-field",
        "composer",
        "card",
        "badge",
      ];
      for (const shape of shapes) {
        writeFileSync(
          ops,
          JSON.stringify([
            { op: "add", shape: "frame:iphone", ref: "phone" },
            { op: "add", shape: `ios:${shape}`, parent: "@phone", ref: "kit" },
          ]),
        );
        expect(
          compareGenerated(["edit", doc, "--ops", ops], doc, source).exitCode,
        ).toBe(0);
      }
      writeFileSync(
        ops,
        JSON.stringify([
          { op: "add", shape: "frame:iphone", ref: "phone" },
          { op: "add", shape: "ios:nav-bar", parent: "@phone", ref: "nav" },
          { op: "update", id: "@nav", props: { title: "Inbox" } },
        ]),
      );
      expect(
        compareGenerated(["edit", doc, "--ops", ops], doc, source).exitCode,
      ).toBe(0);
      expect(readFileSync(doc, "utf8")).toContain("Inbox");
      const fixedSource = readFileSync(doc, "utf8");
      const instance = fixedSource
        .trim()
        .split("\n")
        .map(
          (line) =>
            JSON.parse(line) as {
              id?: string;
              semantic?: { kit?: string; instanceOf?: string };
            },
        )
        .find(
          (record) =>
            record.semantic?.kit === "ios:nav-bar@1" &&
            record.semantic.instanceOf,
        );
      expect(instance?.id).toBeDefined();
      writeFileSync(
        ops,
        JSON.stringify([
          { op: "update", id: instance?.id, props: { title: "Updated" } },
        ]),
      );
      expect(
        compareFile(["edit", doc, "--ops", ops], doc, fixedSource).exitCode,
      ).toBe(0);
      expect(readFileSync(doc, "utf8")).toContain("Updated");
      writeFileSync(doc, source);
      writeFileSync(
        ops,
        JSON.stringify([
          { op: "add", shape: "flowchart:process", ref: "rect" },
          { op: "update", id: "@rect", props: { title: "Inbox" } },
        ]),
      );
      expect(compare(["edit", doc, "--ops", ops]).exitCode).toBe(2);
    } finally {
      rmSync(cwd, { recursive: true, force: true });
    }
  },
  120000,
);

nativeTest(
  "app lint reports instance overflow and hotspot context, and a clean kit",
  () => {
    const cwd = mkdtempSync(join(tmpdir(), "nodetto-lint-parity-"));
    try {
      const doc = join(cwd, "design.jsonl");
      const ops = join(cwd, "ops.json");
      const source = serializeDocument(new Editor().getSnapshot());
      const edit = (operations: unknown[]) => {
        writeFileSync(ops, JSON.stringify(operations));
        const result = Bun.spawnSync([
          process.execPath,
          cliEntry,
          "edit",
          doc,
          "--ops",
          ops,
        ]);
        expect(result.exitCode).toBe(0);
      };
      writeFileSync(doc, source);
      edit([
        { op: "add", shape: "frame:iphone", id: "screen" },
        {
          op: "add",
          shape: "frame:iphone",
          id: "destination",
          visual: { x: 500, y: 0 },
        },
        {
          op: "add",
          shape: "ios:text-field",
          parent: "screen",
          visual: { x: 16, y: 16, width: 80 },
          props: { placeholder: "W".repeat(100) },
        },
      ]);
      const records = readFileSync(doc, "utf8")
        .trim()
        .split("\n")
        .map(
          (line) =>
            JSON.parse(line) as {
              id: string;
              page?: string;
              semantic?: { instanceOf?: string };
              visual?: { componentKey?: string };
            },
        );
      const instance = records.find((record) => record.semantic?.instanceOf);
      expect(instance).toBeDefined();
      const child = records.find(
        (record) =>
          record.page === instance?.page &&
          record.visual?.componentKey === "input",
      );
      expect(child).toBeDefined();
      edit([
        {
          op: "update",
          id: child?.id,
          semantic: { control: "button", label: "W".repeat(100) },
          visual: { width: 80, height: 44 },
        },
        {
          op: "add",
          page: instance?.page,
          type: "shape.geo",
          id: "lint-hotspot",
          parent: instance?.id,
          semantic: { geo: "rect" },
          visual: { x: 8, y: 8, width: 24, height: 24 },
        },
        {
          op: "connect",
          page: instance?.page,
          shape: "prototype:transition",
          from: "lint-hotspot",
          to: "destination",
        },
      ]);
      const text = compare(["lint", doc]);
      expect(text.exitCode).toBe(0);
      expect(text.stdout.toString()).toContain("app-text-overflow");
      expect(text.stdout.toString()).toContain("app-touch-target");
      const json = compare(["lint", doc, "--format", "json"]);
      expect(json.exitCode).toBe(0);
      const pages = JSON.parse(json.stdout.toString()).pages as {
        findings: { ruleId: string; elementId: string; context?: unknown }[];
      }[];
      const findings = pages.flatMap((page) => page.findings);
      expect(findings).toContainEqual(
        expect.objectContaining({
          ruleId: "app-text-overflow",
          elementId: child?.id,
          context: { screenId: "screen", instanceId: instance?.id },
        }),
      );
      expect(findings).toContainEqual(
        expect.objectContaining({
          ruleId: "app-touch-target",
          elementId: "lint-hotspot",
          context: { screenId: "screen", instanceId: instance?.id },
        }),
      );
      writeFileSync(doc, source);
      edit([
        {
          op: "add",
          shape: "frame:iphone",
          id: "screen",
          visual: { x: 0, y: 0 },
        },
        {
          op: "add",
          shape: "ios:status-bar",
          parent: "screen",
          visual: { x: 0, y: 0 },
        },
      ]);
      const clean = compare(["lint", doc]);
      expect(clean.exitCode).toBe(0);
      expect(clean.stdout.toString()).not.toContain("app-");
      const cleanJson = compare(["lint", doc, "--format", "json"]);
      expect(cleanJson.exitCode).toBe(0);
      expect(
        JSON.parse(cleanJson.stdout.toString()).pages.flatMap(
          (page: { findings: unknown[] }) => page.findings,
        ),
      ).toEqual([]);
    } finally {
      rmSync(cwd, { recursive: true, force: true });
    }
  },
  120000,
);
