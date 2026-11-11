import { expect } from "bun:test";
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import {
  obstacleRoutingBatch,
  obstacleRoutingMixedMultiPage,
  obstacleRoutingMultiPage,
} from "../__fixtures__/obstacle-routing-batch.ts";
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

nativeTest(
  "native obstacle routing batch matches Bun and expected output",
  () => {
    const dir = mkdtempSync(join(tmpdir(), "nodetto-routing-"));
    try {
      const fixture = obstacleRoutingBatch();
      const doc = join(dir, "doc.jsonl");
      const ops = join(dir, "ops.json");
      writeFileSync(doc, fixture.document);
      writeFileSync(ops, fixture.operations);
      const args = ["edit", doc, "--ops", ops];
      const bun = Bun.spawnSync([process.execPath, cliEntry, ...args], {
        timeout: 60000,
      });
      const expected = readFileSync(doc, "utf8");
      writeFileSync(doc, fixture.document);
      const start = performance.now();
      const native = Bun.spawnSync([binary as string, ...args], {
        timeout: 60000,
      });
      const elapsed = performance.now() - start;
      expect(native.exitCode).toBe(0);
      expect(bun.exitCode).toBe(0);
      expect(native.stdout.toString()).toBe(bun.stdout.toString());
      expect(native.stderr.toString()).toBe(bun.stderr.toString());
      expect(readFileSync(doc, "utf8")).toBe(expected);
      expect(expected).toBe(
        readFileSync(
          new URL(
            "../__fixtures__/obstacle-routing-batch.expected.jsonl",
            import.meta.url,
          ),
          "utf8",
        ),
      );
      expect(elapsed).toBeLessThan(10000);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  },
  120000,
);

for (const [name, build] of [
  ["multi-page", obstacleRoutingMultiPage],
  ["mixed-multi-page", obstacleRoutingMixedMultiPage],
] as const) {
  nativeTest(
    `native ${name} obstacle routing matches Bun and expected output`,
    () => {
      const dir = mkdtempSync(join(tmpdir(), "nodetto-routing-"));
      try {
        const fixture = build();
        const doc = join(dir, "doc.jsonl");
        const ops = join(dir, "ops.json");
        writeFileSync(doc, fixture.document);
        writeFileSync(ops, fixture.operations);
        const args = ["edit", doc, "--ops", ops];
        const bun = Bun.spawnSync([process.execPath, cliEntry, ...args], {
          timeout: 60000,
        });
        const expected = readFileSync(doc, "utf8");
        writeFileSync(doc, fixture.document);
        const start = performance.now();
        const native = Bun.spawnSync([binary as string, ...args], {
          timeout: 60000,
        });
        const elapsed = performance.now() - start;
        expect(native.exitCode).toBe(0);
        expect(bun.exitCode).toBe(0);
        expect(native.stdout.toString()).toBe(bun.stdout.toString());
        expect(native.stderr.toString()).toBe(bun.stderr.toString());
        expect(readFileSync(doc, "utf8")).toBe(expected);
        expect(expected).toBe(
          readFileSync(
            new URL(
              `../__fixtures__/obstacle-routing-batch.${name}.expected.jsonl`,
              import.meta.url,
            ),
            "utf8",
          ),
        );
        expect(elapsed).toBeLessThan(10000);
      } finally {
        rmSync(dir, { recursive: true, force: true });
      }
    },
    120000,
  );
}

nativeTest(
  "native edit normalizes noncanonical JSONL like Bun",
  () => {
    const dir = mkdtempSync(join(tmpdir(), "nodetto-routing-normalize-"));
    try {
      const fixture = obstacleRoutingBatch();
      const input = `\ufeff${fixture.document.replaceAll("\n", "\r\n").replace('"x":60', '"x":60.001')}`;
      const doc = join(dir, "doc.jsonl");
      const ops = join(dir, "ops.json");
      writeFileSync(doc, input);
      writeFileSync(ops, fixture.operations);
      const args = ["edit", doc, "--ops", ops];
      const bun = Bun.spawnSync([process.execPath, cliEntry, ...args], {
        timeout: 60000,
      });
      const expected = readFileSync(doc, "utf8");
      writeFileSync(doc, input);
      const native = Bun.spawnSync([binary as string, ...args], {
        timeout: 60000,
      });
      expect(bun.exitCode).toBe(0);
      expect(native.exitCode).toBe(0);
      expect(readFileSync(doc, "utf8")).toBe(expected);
      expect(native.stdout.toString()).toBe(bun.stdout.toString());
      expect(native.stderr.toString()).toBe(bun.stderr.toString());
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  },
  120000,
);

nativeTest(
  "native generic iPhone edit batches scale and match Bun",
  () => {
    const dir = mkdtempSync(join(tmpdir(), "nodetto-edit-perf-"));
    try {
      const doc = join(dir, "doc.jsonl");
      const opsFile = join(dir, "ops.json");
      let source =
        '{"kind":"document","schemaVersion":1,"id":"doc","title":"Generic"}\n{"kind":"page","id":"p1","name":"Main","pageKind":"freeform"}\n';
      const times: number[] = [];
      for (let batch = 0; batch < 4; batch++) {
        const ops: Record<string, unknown>[] = [
          {
            op: "add",
            page: "p1",
            shape: "frame:iphone",
            ref: "phone",
            visual: { x: batch * 450, y: 0 },
          },
          { op: "select", id: "@phone", ref: "selected" },
        ];
        if (batch === 0) {
          for (const shape of ["ios:tab-bar", "ios:nav-bar", "ios:list-row"])
            ops.push({ op: "add", page: "p1", shape, parent: "@selected" });
        }
        for (let i = 0; i < 48; i++)
          ops.push({
            op: "add",
            page: "p1",
            shape: "flowchart:process",
            parent: "@selected",
            visual: {
              x: (i % 5) * 60,
              y: 100 + Math.floor(i / 5) * 55,
              width: 40,
              height: 40,
            },
          });
        writeFileSync(opsFile, JSON.stringify(ops));
        const args = ["edit", doc, "--ops", opsFile];
        writeFileSync(doc, source);
        const bun = Bun.spawnSync([process.execPath, cliEntry, ...args], {
          timeout: 60000,
        });
        const bunDoc = readFileSync(doc, "utf8");
        writeFileSync(doc, source);
        const native = Bun.spawnSync([binary as string, ...args], {
          timeout: 60000,
        });
        // CPU time, not wall time: a loaded machine or CI runner stretches
        // wall time without the CLI doing more work. Per-core speed still
        // varies between machines, so the absolute limit only catches a hang
        // and the ratio between the first and last batch checks the scaling.
        times.push(Number(native.resourceUsage.cpuTime.total) / 1000);
        const nativeDoc = readFileSync(doc, "utf8");
        expect(bun.exitCode).toBe(0);
        expect(native.exitCode).toBe(bun.exitCode);
        expect(
          normalizeOutput(
            native.stdout.toString(),
            native.stderr.toString(),
            nativeDoc,
            source,
          ),
        ).toEqual(
          normalizeOutput(
            bun.stdout.toString(),
            bun.stderr.toString(),
            bunDoc,
            source,
          ),
        );
        expect(documentSignature(nativeDoc, source)).toEqual(
          documentSignature(bunDoc, source),
        );
        source = nativeDoc;
      }
      for (const time of times) expect(time).toBeLessThan(30000);
      expect(times[3] as number).toBeLessThan((times[0] as number) * 4);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  },
  300000,
);
