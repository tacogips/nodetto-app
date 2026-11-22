import { expect, test } from "bun:test";
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { CAPTURE_THEMES, Editor, svgRasterDimensions } from "@nodetto/core";
import { serializeDocument } from "@nodetto/io";
import { PAGE_KINDS, shortPageId } from "@nodetto/ir";
import { type CaptureBackend, captureCommand } from "./capture-command.ts";
import { CAPTURE_HELP } from "./capture-help.ts";
import { runCliAsync } from "./cli.ts";
import type { CommandIo } from "./commands.ts";
import { OVERVIEW } from "./help.ts";
import { localIo } from "./local-io.ts";

const digest = "fedcba9876543210";
const defaultDir = "/scratch/nodetto-capture-501";
const png = Uint8Array.of(
  137,
  80,
  78,
  71,
  13,
  10,
  26,
  10,
  0,
  0,
  0,
  13,
  73,
  72,
  68,
  82,
  0,
  0,
  0,
  11,
  0,
  0,
  0,
  13,
  8,
  6,
  0,
  0,
  0,
  0,
  0,
  0,
  0,
);
const input = "Project drawings.jsonl";

function addRect(editor: Editor, width = 100, height = 100) {
  return editor.createElement("shape.geo", {
    semantic: { geo: "rect", label: "" },
    visual: { x: 0, y: 0, width, height },
  });
}

function harness(editor = new Editor(), documentPath = input) {
  const files = new Map<string, Uint8Array>();
  const calls: Parameters<CaptureBackend["rasterize"]>[] = [];
  const io: CommandIo = {
    readText: () => serializeDocument(editor.getSnapshot()),
    writeText: () => {
      throw new Error("unexpected text write");
    },
    capture: {
      dir: () => defaultDir,
      absolute: (path) => (path.startsWith("/") ? path : `/workspace/${path}`),
      digest: () => digest,
      write(path, bytes, replace) {
        const existing = files.get(path);
        if (
          existing?.length === bytes.length &&
          existing.every((byte, i) => byte === bytes[i])
        )
          return "identical";
        if (existing && !replace) return "exists";
        files.set(path, bytes);
        return "written";
      },
    },
  };
  const backend: CaptureBackend = {
    async rasterize(...args) {
      calls.push(args);
      return png;
    },
  };
  return {
    editor,
    files,
    calls,
    io,
    backend,
    run: (...args: string[]) =>
      captureCommand(io, [documentPath, ...args], backend),
  };
}

test("capture defaults to display order and supports page selectors and element ownership", async () => {
  const editor = new Editor();
  addRect(editor);
  const first = editor.getSnapshot().pages[0];
  const second = editor.createPage({ name: "Second", kind: "freeform" });
  const element = addRect(editor);
  // Physical record order and display order differ.
  const snapshot = editor.getSnapshot();
  const state = harness(new Editor({ document: snapshot }));
  state.io.readText = () => {
    const [header, a, b, ...contents] = serializeDocument(snapshot)
      .trimEnd()
      .split("\n");
    return [header, b, a, ...contents, ""].join("\n");
  };
  expect((await state.run()).stdout).toContain(
    `page: 1/2 ${JSON.stringify(first?.name)} (freeform, id ${first?.id})`,
  );
  for (const args of [
    ["--page", "Second"],
    ["--page", shortPageId(second)],
    ["--page-number", "2"],
    ["--element", element],
  ]) {
    const result = await state.run(...args);
    expect(result.exitCode).toBe(0);
    expect(result.stdout).toContain(
      `page: 2/2 "Second" (freeform, id ${second})`,
    );
  }
  expect(
    (await state.run("--page-number", "1", "--element", element)).stderr,
  ).toContain("--element does not belong to the selected page.");
  expect((await state.run("--page-number", "3")).stderr).toContain(
    "Page number 3 is out of range",
  );
});

for (const kind of PAGE_KINDS) {
  if (kind === "cad3d") continue;
  test(`capture rasterizes a shape on a ${kind} page`, async () => {
    const { editor, run, calls } = harness();
    editor.createPage({ name: "Panel", kind });
    addRect(editor);
    const result = await run("--page", "Panel");
    expect(result.exitCode).toBe(0);
    expect(calls).toHaveLength(1);
    expect(calls[0]?.[0]).toContain("<svg");
  });
}

test("capture reports absolute paths, PNG dimensions, and matching text and JSON metadata", async () => {
  const { editor, run } = harness();
  addRect(editor);
  const page = editor.getSnapshot().pages[0];
  const args = ["--output", "art.png", "--inline"];
  const result = await run(...args);
  expect(result).toEqual({
    exitCode: 0,
    stdout: `path: /workspace/art.png\nformat: png\nsize: 11x13\nbytes: 33\npage: 1/1 ${JSON.stringify(page?.name)} (freeform, id ${page?.id})\n`,
    stderr: "",
  });
  const json = await run(...args, "--json");
  expect(JSON.parse(json.stdout)).toEqual({
    path: "/workspace/art.png",
    format: "png",
    width: 11,
    height: 13,
    bytes: 33,
    page: {
      number: 1,
      count: 1,
      id: page?.id,
      name: page?.name,
      kind: "freeform",
    },
  });
});

test("capture reuses a digest name and tries deterministic suffixes without replacing files", async () => {
  const { editor, files, run } = harness();
  addRect(editor);
  const id = shortPageId(editor.getSnapshot().pages[0]?.id ?? "");
  const stem = `${defaultDir}/Project_drawings-${id}-${digest.slice(0, 12)}`;
  expect((await run()).stdout).toStartWith(`path: ${stem}.png\n`);
  expect((await run()).stdout).toStartWith(`path: ${stem}.png\n`);
  expect(files.size).toBe(1);
  const other = Uint8Array.of(1);
  files.set(`${stem}.png`, other);
  expect((await run("--force")).stdout).toStartWith(`path: ${stem}-2.png\n`);
  expect(files.get(`${stem}.png`)).toBe(other);
  for (let n = 2; n <= 99; n++) files.set(`${stem}-${n}.png`, other);
  const exhausted = await run();
  expect(exhausted.exitCode).toBe(2);
  expect(exhausted.stderr).toContain("Pass --output <file>");
  expect(files.size).toBe(99);
});

test("capture truncates the default filename stem to 40 characters", async () => {
  const { editor, files, run } = harness(
    new Editor(),
    "1234567890123456789012345678901234567890extra.jsonl",
  );
  addRect(editor);
  expect((await run()).exitCode).toBe(0);
  const id = shortPageId(editor.getSnapshot().pages[0]?.id ?? "");
  expect([...files.keys()]).toEqual([
    `${defaultDir}/1234567890123456789012345678901234567890-${id}-${digest.slice(0, 12)}.png`,
  ]);
});

test("capture replaces a differing explicit output only with --force", async () => {
  const { editor, files, run } = harness();
  addRect(editor);
  const original = Uint8Array.of(1);
  files.set("art.png", original);
  const refused = await run("--output", "art.png");
  expect(refused.exitCode).toBe(2);
  expect(refused.stderr).toContain("pass --force");
  expect(refused.stderr).toContain("For a regular file, pass --force");
  expect(refused.stderr).toContain("choose another --output or omit it.");
  expect(files.get("art.png")).toBe(original);
  expect((await run("--output", "art.png", "--force")).exitCode).toBe(0);
  expect(files.get("art.png")).toEqual(png);
});

test.each([
  [["--page", "Main", "--page-number", "1"], "cannot be used together"],
  [["--page-number", "1.5"], "positive whole number"],
  [["--output", ""], "--output requires a value"],
  [["--output", "art.gif"], "--output must end in .png"],
  [["--output", "art.JPEG"], "JPG capture needs the native nodetto-cli."],
  [["--format", "jpg"], "JPG capture needs the native nodetto-cli."],
  [["--format", "svg"], "--format must be png or jpg."],
  [
    ["--format", "png", "--output", "art.jpg"],
    "--format must match the --output extension.",
  ],
  [
    ["--format", "jpg", "--output", "art.png"],
    "--format must match the --output extension.",
  ],
  [["--quality", "90"], "--quality requires JPG capture."],
  ...["0", "101", "1.5", "NaN", "1e2"].map(
    (quality) =>
      [
        ["--format", "jpg", "--quality", quality],
        "--quality must be an integer from 1 to 100.",
      ] as const,
  ),
  [["--size", "400"], "--size must be"],
] as const)(
  "capture rejects %j with help before rendering",
  async (args, message) => {
    const { editor, run, calls } = harness();
    addRect(editor);
    const result = await run(...args);
    expect(result.exitCode).toBe(2);
    expect(result.stderr).toContain(message);
    expect(result.stderr).toContain(CAPTURE_HELP);
    expect(calls).toEqual([]);
  },
);

test("capture encodes JPG by explicit format or output extension and reports the written bytes", async () => {
  const { editor, files, io, backend, run } = harness();
  addRect(editor);
  const jpg = Uint8Array.of(0xff, 0xd8, 0, 0xff, 0xd9);
  const calls: Parameters<NonNullable<CaptureBackend["transcode"]>>[] = [];
  const digested: Uint8Array[] = [];
  if (!io.capture) throw new Error("capture IO missing");
  io.capture.digest = (bytes) => {
    digested.push(bytes);
    return digest;
  };
  backend.transcode = (...args) => {
    calls.push(args);
    return jpg;
  };
  const inferred = await run("--output", "art.JPEG", "--theme", "dark");
  expect(inferred.exitCode).toBe(0);
  expect(inferred.stdout).toStartWith(
    "path: /workspace/art.JPEG\nformat: jpg\nsize: 11x13\nbytes: 5\n",
  );
  expect(files.get("art.JPEG")).toBe(jpg);
  const named = await run(
    "--format",
    "jpg",
    "--quality",
    "37",
    "--background",
    "#a1b2c3",
    "--json",
  );
  expect(named.exitCode).toBe(0);
  const id = shortPageId(editor.getSnapshot().pages[0]?.id ?? "");
  const path = `${defaultDir}/Project_drawings-${id}-${digest.slice(0, 12)}.jpg`;
  expect(JSON.parse(named.stdout)).toMatchObject({
    path,
    format: "jpg",
    width: 11,
    height: 13,
    bytes: jpg.length,
  });
  expect(files.get(path)).toBe(jpg);
  expect(digested).toEqual([jpg]);
  expect((await run("--output", "art.png")).exitCode).toBe(0);
  expect(files.get("art.png")).toBe(png);
  expect(calls).toEqual([
    [png, "jpg", 90, CAPTURE_THEMES.dark.background],
    [png, "jpg", 37, "#a1b2c3"],
  ]);
});

test("capture distinguishes an empty page, an unsupported CAD page, and a host without capture IO", async () => {
  const { editor, io, run, calls, backend } = harness();
  const empty = await run();
  expect(empty.exitCode).toBe(2);
  expect(empty.stderr).toContain("has no visible content to capture.");
  const cad = editor.createPage({ name: "Bracket", kind: "cad3d" });
  const unsupported = await run("--page", cad);
  expect(unsupported.exitCode).toBe(2);
  expect(unsupported.stderr).toContain(
    "3D CAD capture needs the native nodetto-cli.",
  );
  const unavailable = await captureCommand(
    { ...io, capture: undefined },
    [input],
    backend,
  );
  expect(unavailable.exitCode).toBe(2);
  expect(unavailable.stderr).toContain("This host cannot write captures.");
  expect(calls).toEqual([]);
});

test("capture rejects CAD options on 2D pages and never rasterizes CAD pages", async () => {
  const { editor, run, calls, backend } = harness();
  addRect(editor);
  const misuse = await run("--direction", "0,0,-1");
  expect(misuse.stderr).toContain(
    "--direction cannot be used on a freeform page.",
  );
  const cad = editor.createPage({ name: "Sketch", kind: "cad3d" });
  backend.renderSolid = () => {
    throw new Error("No body should reach the renderer");
  };
  const sketch = await run("--page", cad);
  expect(sketch.exitCode).toBe(2);
  expect(sketch.stderr).toContain('Page "Sketch" has no solid body yet');
  expect(calls).toEqual([]);
});

test("capture gives explicit output advice for both directory lookup and write failures", async () => {
  const { editor, io, backend } = harness();
  addRect(editor);
  if (!io.capture) throw new Error("capture IO missing");
  for (const operation of ["dir", "write"] as const) {
    const result = await captureCommand(
      {
        ...io,
        capture: {
          ...io.capture,
          [operation]() {
            throw new Error("Temporary directory permission denied.");
          },
        },
      },
      [input],
      backend,
    );
    expect(result.exitCode).toBe(2);
    expect(result.stderr).toContain("Temporary directory permission denied.");
    expect(result.stderr).toContain(
      "Pass --output <file> (Mac App Store build: inside the authorized folder).",
    );
  }
});

test("capture paints the canvas theme or explicit background and passes glyph fallback to the renderer", async () => {
  const { editor, io, run, calls } = harness();
  addRect(editor);
  io.fontCoverage = () => ({ needsFallback: true, missing: [0x03bb] });
  const result = await run(
    "--theme",
    "dark",
    "--font-dir",
    "fonts",
    "--scale",
    "0.981",
  );
  expect(result.exitCode).toBe(0);
  expect(result.stderr).toContain("warning: glyph-missing page ");
  expect(calls[0]?.[0]).toContain(`fill="${CAPTURE_THEMES.dark.background}"`);
  expect(calls[0]?.[0]).toMatch(/^<svg\s[^>]*width="130" height="130"/);
  expect(calls[0]?.[0]).toContain(
    `viewBox="-16 -16 ${130 / 0.981} ${130 / 0.981}"`,
  );
  expect(calls[0]?.slice(1)).toEqual([1, "fonts", true]);
  expect(
    (await run("--theme", "dark", "--background", "#a1b2c3")).exitCode,
  ).toBe(0);
  expect(calls[1]?.[0]).toContain('fill="#a1b2c3"');
});

test("capture --size limits the pixel frame while keeping the artwork viewport", async () => {
  const { editor, run, calls } = harness();
  addRect(editor, 3000, 2000);
  const result = await run("--size", "600x600", "--padding", "0");
  expect(result.exitCode).toBe(0);
  expect(calls[0]?.[0]).toMatch(/^<svg\s[^>]*width="600" height="400"/);
  expect(calls[0]?.[0]).toContain('viewBox="0 0 3000 2000"');
});

test("capture gives exit 2 and fit guidance when the minimum scale cannot fit a page", async () => {
  const { editor, run, calls } = harness();
  addRect(editor, 160_000, 100);
  const result = await run("--padding", "0");
  expect(result.exitCode).toBe(2);
  expect(result.stderr).toContain(
    "Capture cannot fit at the minimum scale of 0.01.",
  );
  for (const option of ["--size", "--scale", "--element"])
    expect(result.stderr).toContain(option);
  expect(calls).toEqual([]);
});

test("capture refuses a height beyond the raster side limit before rendering", async () => {
  const { editor, run, calls } = harness();
  addRect(editor, 100, 8193);
  const result = await run("--padding", "0", "--scale", "1");
  expect(result.exitCode).toBe(2);
  expect(result.stderr).toContain("8192 pixels per side");
  expect(calls).toEqual([]);
});

test("capture uses an artboard viewport for a frame and the padded bounds for another element", async () => {
  const { editor, run, calls } = harness();
  const frame = editor.createElement("frame", {
    semantic: { name: "Artboard", platform: "web" },
    visual: { x: 0, y: 0, width: 200, height: 120 },
  });
  const element = addRect(editor, 40, 20);
  for (const id of [frame, element]) {
    expect((await run("--element", id, "--padding", "5")).exitCode).toBe(0);
  }
  expect(calls.map(([svg]) => svgRasterDimensions(svg))).toEqual([
    { width: 200, height: 120 },
    { width: 50, height: 30 },
  ]);
});

test("capture is discoverable in the overview and explains every option", () => {
  expect(OVERVIEW.split("\n")).toHaveLength(37);
  for (const command of ["capture", "export", "compare"])
    expect(OVERVIEW).toContain(`nodetto-cli ${command}`);
  const [usage = "", ...body] = CAPTURE_HELP.split("\n\n");
  for (const option of usage.matchAll(/--[a-z-]+/g))
    expect(body.join("\n")).toMatch(new RegExp(`^  ${option[0]}\\s`, "m"));
  expect(CAPTURE_HELP).toContain("--quality");
  expect(CAPTURE_HELP).toContain(
    "This software is based in part on the work of the Independent JPEG Group.",
  );
});

test("Bun capture writes deterministic PNGs and reports the encoded size at fractional scales", async () => {
  const cwd = mkdtempSync(join(tmpdir(), "nodetto-capture-bun-"));
  try {
    const io = localIo();
    for (const { width, height, args, expected } of [
      {
        width: 100,
        height: 100,
        args: ["--scale", "1.1"],
        expected: [110, 110],
      },
      { width: 3000, height: 3296, args: [], expected: [1020, 1121] },
      { width: 12247, height: 5468, args: [], expected: [1568, 700] },
      { width: 19780, height: 14187, args: [], expected: [1266, 908] },
    ]) {
      const editor = new Editor();
      addRect(editor, width, height);
      const document = join(cwd, "art.jsonl");
      writeFileSync(document, serializeDocument(editor.getSnapshot()));
      const captures: Uint8Array[] = [];
      for (const name of ["one.png", "two.png"]) {
        const output = join(cwd, `${width}-${name}`);
        const result = await runCliAsync(
          ["capture", document, "--padding", "0", "--output", output, ...args],
          io,
          "test",
        );
        expect(result.stderr).toBe("");
        expect(result.exitCode).toBe(0);
        const bytes = readFileSync(output);
        captures.push(bytes);
        expect([...bytes.subarray(0, 8)]).toEqual([
          137, 80, 78, 71, 13, 10, 26, 10,
        ]);
        const size = [bytes.readUInt32BE(16), bytes.readUInt32BE(20)];
        expect(size).toEqual(expected);
        expect(result.stdout).toContain(`size: ${size.join("x")}\n`);
      }
      expect(captures[0]).toEqual(captures[1]);
    }
  } finally {
    rmSync(cwd, { recursive: true, force: true });
  }
});
