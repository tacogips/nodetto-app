import { expect, test } from "bun:test";
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { binary, cliEntry, nativeTest } from "./harness.ts";

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

test("two generator runs agree after generated-value normalization", () => {
  const cwd = mkdtempSync(
    join(process.cwd(), "tmp/ipd-s772/ipd-26-example-sample/generator-"),
  );
  try {
    const signatures = [];
    for (const output of ["first", "second"]) {
      const directory = join(cwd, output);
      const result = Bun.spawnSync(
        [
          process.execPath,
          join(import.meta.dir, "../../scripts/generate-iphone-kit-example.ts"),
        ],
        {
          env: { ...process.env, NODETTO_EXAMPLE_OUTPUT_DIR: directory },
        },
      );
      expect(result.exitCode).toBe(0);
      signatures.push(
        documentSignature(
          readFileSync(join(directory, "design.jsonl"), "utf8"),
          '{"kind":"document","schemaVersion":1,"id":"garden","title":"Garden journal"}\n{"kind":"page","id":"app","name":"App","pageKind":"freeform"}\n',
        ),
      );
    }
    expect(signatures[0]).toEqual(signatures[1]);
  } finally {
    rmSync(cwd, { recursive: true, force: true });
  }
}, 600000);

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
  "the iPhone kit example operations agree across runtimes and repeated runs",
  () => {
    const cwd = mkdtempSync(
      join(process.cwd(), "tmp/ipd-s772/ipd-26-example-sample/native-parity-"),
    );
    try {
      const doc = join(cwd, "design.jsonl");
      const ops = join(
        import.meta.dir,
        "../../../../examples/design/iphone-kit/build.ops.json",
      );
      const source =
        '{"kind":"document","schemaVersion":1,"id":"garden","title":"Garden journal"}\n{"kind":"page","id":"app","name":"App","pageKind":"freeform"}\n';
      const signatures = [];
      for (let run = 0; run < 2; run++) {
        const result = compareGenerated(
          ["edit", doc, "--ops", ops],
          doc,
          source,
        );
        expect(result.exitCode).toBe(0);
        signatures.push(documentSignature(readFileSync(doc, "utf8"), source));
      }
      expect(signatures[1]).toEqual(signatures[0]);
    } finally {
      rmSync(cwd, { recursive: true, force: true });
    }
  },
  600000,
);
