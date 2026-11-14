import { expect, test } from "bun:test";
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { serializeDocument } from "@nodetto/io";
import { Resvg } from "@resvg/resvg-js";
import { document, element } from "../../../packages/core/src/test-helpers.ts";
import { renderSequenceParticipant } from "../../../packages/core/src/svg-export/basic-shapes.ts";
import { DEFAULT_SVG_THEME } from "../../../packages/core/src/svg-export/theme.ts";

const box = { x: 10, y: 20, width: 120, height: 200 };
const participant = (kind?: string, name = "Widget") =>
  element({
    id: "p",
    type: "sequence.participant",
    semantic: { name, order: "a1", ...(kind ? { kind } : {}) },
    visual: { ...box },
  });
const render = (kind?: string) =>
  renderSequenceParticipant(participant(kind), box, DEFAULT_SVG_THEME);
const baseline =
  '<line x1="70" y1="76" x2="70" y2="220" stroke="#596366" stroke-width="1" stroke-dasharray="5 4" /><rect x="10" y="20" width="120" height="56" rx="8" fill="#fffdf8" stroke="#1d2a2e" stroke-width="1.5" /><text x="70" y="48" text-anchor="middle" dominant-baseline="central" fill="#1d2a2e" font-size="13">Widget</text>';

test("service markup is unchanged and actor and database have distinct heads", () => {
  expect(render()).toBe(baseline);
  expect(render("service")).toBe(baseline);
  const actor = render("actor");
  const db = render("db");
  expect(actor).toContain('<circle cx="70" cy="25" r="5"');
  expect(actor).toContain('fill="none"');
  expect(db).toContain('<path d="M10 28 A60 8');
  const longName = participant(
    "actor",
    "Widget orders and deliveries with a long participant name",
  );
  const longMarkup = renderSequenceParticipant(
    longName,
    box,
    DEFAULT_SVG_THEME,
  );
  expect(
    longMarkup.startsWith(baseline.slice(0, baseline.indexOf("<rect"))),
  ).toBe(true);
  expect(longName.visual).toEqual(box);
  expect((longMarkup.match(/<text /g) ?? []).length).toBeGreaterThan(1);
  expect(actor).not.toContain("<rect");
  expect(db).not.toContain("<rect");
  for (const kind of ["actor", "db", "service"])
    expect(
      render(kind).startsWith(baseline.slice(0, baseline.indexOf("<rect"))),
    ).toBe(true);
  const styled = {
    ...participant("actor"),
    visual: { ...box, style: { fill: "red", stroke: "blue" } },
  };
  expect(renderSequenceParticipant(styled, box, DEFAULT_SVG_THEME)).toContain(
    'stroke="blue" stroke-width="1.5"',
  );
  expect(renderSequenceParticipant(styled, box, DEFAULT_SVG_THEME)).toContain(
    'fill="none"',
  );
});

test("participant raster exports and types describe the kinds", () => {
  const root = mkdtempSync(join(tmpdir(), "nodetto-participant-"));
  try {
    const pngs: Buffer[] = [];
    for (const kind of ["actor", "db", "service"]) {
      const input = join(root, `${kind}.jsonl`);
      writeFileSync(
        input,
        serializeDocument(document([participant(kind, " ")])),
      );
      for (const format of ["png", "pdf"]) {
        const output = join(root, `${kind}.${format}`);
        const result = Bun.spawnSync([
          process.execPath,
          join(import.meta.dir, "main.ts"),
          "export",
          input,
          "--format",
          format,
          "--output",
          output,
        ]);
        expect(result.exitCode).toBe(0);
        const bytes = readFileSync(output);
        if (format === "png") {
          expect(bytes.subarray(0, 8).toString("hex")).toBe("89504e470d0a1a0a");
          pngs.push(bytes);
        } else expect(bytes.subarray(0, 5).toString()).toBe("%PDF-");
      }
    }
    expect(pngs).toHaveLength(3);
    expect(pngs[0]?.equals(pngs[1] as Buffer)).toBe(false);
    expect(pngs[0]?.equals(pngs[2] as Buffer)).toBe(false);
    expect(pngs[1]?.equals(pngs[2] as Buffer)).toBe(false);
    const cli = (...args: string[]) =>
      Bun.spawnSync([
        process.execPath,
        join(import.meta.dir, "main.ts"),
        ...args,
      ]);
    expect(cli("types", "sequence.participant").stdout.toString()).toContain(
      "Rendering: kind actor",
    );
    expect(
      JSON.parse(
        cli(
          "types",
          "sequence.participant",
          "--format",
          "json",
        ).stdout.toString(),
      ).rendering,
    ).toContain("cylinder");
    expect(
      JSON.parse(
        cli("types", "state.node", "--format", "json").stdout.toString(),
      ).rendering,
    ).toBeUndefined();
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test("message geometry stays fixed and palette edits export the selected heads", () => {
  const root = mkdtempSync(join(tmpdir(), "nodetto-participant-palette-"));
  try {
    const input = join(root, "doc.jsonl");
    const output = join(root, "out.svg");
    const cli = (...args: string[]) =>
      Bun.spawnSync([
        process.execPath,
        join(import.meta.dir, "main.ts"),
        ...args,
      ]);
    const messages: string[] = [];
    for (const kind of ["actor", "db", "service"]) {
      const second = element({
        id: "q",
        index: "a2",
        type: "sequence.participant",
        semantic: { name: "Orders", kind: "service", order: "a2" },
        visual: { x: 280, y: 20, width: 120, height: 200 },
      });
      const message = element({
        id: "m",
        index: "a3",
        type: "sequence.message",
        semantic: {
          from: "p",
          to: "q",
          order: "b1",
          kind: "sync",
          label: "Request",
        },
        visual: { y: 130 },
      });
      writeFileSync(
        input,
        serializeDocument(document([participant(kind), second, message])),
      );
      expect(
        cli("export", input, "--format", "svg", "--output", output).exitCode,
      ).toBe(0);
      const svg = readFileSync(output, "utf8");
      const geometry = svg.match(
        /<g data-id="m" data-type="sequence.message">([^<]*<[^>]+>)/,
      )?.[1];
      expect(geometry).toBeDefined();
      messages.push(geometry ?? "");
    }
    expect(messages[0]).toBe(messages[1]);
    expect(messages[1]).toBe(messages[2]);
    for (const [shape, expected] of [
      ["sequence.actor", "<circle"],
      ["sequence.database", "<path"],
    ]) {
      writeFileSync(input, serializeDocument(document()));
      const ops = join(root, "ops.json");
      writeFileSync(
        ops,
        JSON.stringify([{ op: "add", page: "page-1", shape, label: "Widget" }]),
      );
      expect(cli("edit", input, "--ops", ops).exitCode).toBe(0);
      expect(
        cli("export", input, "--format", "svg", "--output", output).exitCode,
      ).toBe(0);
      expect(readFileSync(output, "utf8")).toContain(expected);
    }
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test("database cylinder fills its top rim", () => {
  const db = {
    ...participant("db", " "),
    visual: { ...box, style: { fill: "#ff0000" } },
  };
  const markup = renderSequenceParticipant(db, box, DEFAULT_SVG_THEME);
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 140 240" width="140" height="240"><rect width="140" height="240" fill="#0000ff" />${markup}</svg>`;
  const pixels = new Resvg(svg).render().pixels;
  const pixel = (x: number, y: number) =>
    Array.from(pixels.subarray((y * 140 + x) * 4, (y * 140 + x) * 4 + 4));
  expect(pixel(70, 24)).toEqual([255, 0, 0, 255]);
  expect(pixel(70, 32)).toEqual([255, 0, 0, 255]);
  expect(pixel(70, 44)).toEqual([255, 0, 0, 255]);
  expect(pixel(5, 100)).toEqual([0, 0, 255, 255]);
});
