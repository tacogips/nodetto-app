import {
  CAD_TEST_PAGE,
  cadElement,
} from "../../../packages/core/src/cad/testing/documents.ts";
import { capturePlateDocument } from "../../../packages/core/src/capture/testing/plate.ts";
import {
  boardReference,
  edge,
  PCB_TEST_PAGE,
  testBoard,
} from "../../../packages/core/src/cad/testing/pcb.ts";
import { expect, test } from "bun:test";
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { CAPTURE_THEMES, Editor, svgRasterDimensions } from "@nodetto/core";
import { serializeDocument } from "@nodetto/io";
import { PAGE_KINDS, shortPageId } from "@nodetto/ir";
import { type CaptureBackend, captureCommand } from "./capture-command.ts";
import { captureBackend, captureRenderInput } from "./capture-backend.ts";
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
  const interference = await run("--interference-cell", "0.25");
  expect(interference.exitCode).toBe(2);
  expect(interference.stderr).toContain(
    "--interference-cell cannot be used on a freeform page.",
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
  expect(OVERVIEW.split("\n")).toHaveLength(38);
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
      // The old size reflected the R2-10 rounding mismatch; 0.341 now fits the pixel cap.
      { width: 3000, height: 3296, args: [], expected: [1023, 1124] },
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

test("CAD capture excludes a board on a converted page and restores it on undo", async () => {
  const base = capturePlateDocument();
  const editor = new Editor({
    document: {
      ...base,
      pages: [...base.pages, PCB_TEST_PAGE],
      elements: [
        ...base.elements,
        boardReference(),
        testBoard(1.6),
        edge("rim", { kind: "rect", start: [0, 0], end: [20, 10] }),
      ],
    },
  });
  const state = harness(editor);
  let bodyCount = 3;
  state.backend.renderSolid = () => ({
    image: png,
    report: JSON.stringify({
      width: 1024,
      height: 768,
      bodies: Array.from({ length: bodyCount }, () => ({
        state: "drawn",
        emptiedByStep: -1,
        open: false,
      })),
      analysis: null,
      pairs: [],
    }),
  });
  editor.setPageKind(PCB_TEST_PAGE.id, "freeform");
  const missing = await state.run("--page", "Plate", "--json");
  expect(missing.exitCode).toBe(0);
  const absent = JSON.parse(missing.stdout);
  expect(absent.errors).toContainEqual(
    expect.objectContaining({
      id: "board-reference",
      code: "cad.reference.missing",
    }),
  );
  expect(
    absent.bodies.some((body: { id: string }) => body.id === "board-reference"),
  ).toBe(false);
  editor.undo();
  bodyCount = 4;
  const restored = await state.run("--page", "Plate", "--json");
  expect(restored.exitCode).toBe(0);
  expect(
    JSON.parse(restored.stdout).bodies.some(
      (body: { id: string }) => body.id === "board-reference",
    ),
  ).toBe(true);
});

test("capture scale and size agree at a decimal rounding boundary", async () => {
  const cwd = mkdtempSync(join(tmpdir(), "nodetto-capture-rounding-"));
  try {
    const editor = new Editor();
    addRect(editor, 9968, 68);
    const document = join(cwd, "art.jsonl");
    writeFileSync(document, serializeDocument(editor.getSnapshot()));
    const captures: Uint8Array[] = [];
    for (const [name, option, value] of [
      ["scale.png", "--scale", "0.07"],
      ["size.png", "--size", "700x7"],
    ]) {
      if (!name || !option || !value) throw new Error("missing capture option");
      const output = join(cwd, name);
      const result = await runCliAsync(
        ["capture", document, "--output", output, option, value],
        localIo(),
        "test",
      );
      expect(result.stderr).toBe("");
      expect(result.exitCode).toBe(0);
      const bytes = readFileSync(output);
      expect([bytes.readUInt32BE(16), bytes.readUInt32BE(20)]).toEqual([
        700, 7,
      ]);
      captures.push(bytes);
    }
    expect(captures[0]).toEqual(captures[1]);
  } finally {
    rmSync(cwd, { recursive: true, force: true });
  }
});

test("CAD capture routes mesh decoding through the capture decoder", async () => {
  const base = capturePlateDocument();
  const mesh = cadElement("mesh", "cad.mesh", "a0", {
    name: "Mesh",
    data: readFileSync(
      new URL(
        "../../../crates/capture/tests/fixtures/tetrahedron.nmesh.txt",
        import.meta.url,
      ),
      "utf8",
    ).trim(),
  });
  const state = harness(
    new Editor({
      document: { ...base, pages: [CAD_TEST_PAGE], elements: [mesh] },
    }),
  );
  let captureCalls = 0;
  let legacyCalls = 0;
  state.io.decodeCaptureMesh = () => {
    captureCalls += 1;
    return {
      vertexCount: 3,
      triangleCount: 1,
      bounds: { min: [0, 0, 0], max: [1, 1, 0] },
      positions: new Float64Array([0, 0, 0, 1, 0, 0, 0, 1, 0]),
      triangles: new Uint32Array([0, 1, 2]),
    };
  };
  state.io.decodeMesh = () => {
    legacyCalls += 1;
    throw new Error("legacy decoder called");
  };
  state.backend.renderSolid = () => ({
    image: png,
    report: JSON.stringify({
      width: 1024,
      height: 768,
      bodies: [{ state: "drawn", emptiedByStep: -1, open: true }],
      analysis: null,
      pairs: [],
    }),
  });
  const result = await state.run("--page", CAD_TEST_PAGE.id);
  expect(result.exitCode).toBe(0);
  expect(captureCalls).toBe(1);
  expect(legacyCalls).toBe(0);
});

test("capture caches native attachment data URLs and retains the legacy fallback", async () => {
  const editor = new Editor();
  for (const x of [0, 20])
    editor.createElement("image.raster", {
      semantic: { src: "artifacts/logo.png", alt: "Logo" },
      visual: { x, y: 0, width: 10, height: 10 },
    });
  const dataUrl = `data:image/png;base64,${btoa(String.fromCharCode(...png))}`;
  const fast = harness(editor);
  let fastCalls = 0;
  fast.io.readAttachmentDataUrl = () => {
    fastCalls += 1;
    return dataUrl;
  };
  fast.io.readAttachment = () => {
    throw new Error("legacy path called");
  };
  expect((await fast.run()).exitCode).toBe(0);
  expect(fastCalls).toBe(1);
  const legacy = harness(editor);
  let legacyCalls = 0;
  legacy.io.readAttachment = () => {
    legacyCalls += 1;
    return png;
  };
  expect((await legacy.run()).exitCode).toBe(0);
  expect(legacyCalls).toBe(1);
  expect(fast.calls[0]?.[0]).toBe(legacy.calls[0]?.[0]);
});

test("capture reuses attachment carriers with bounded renderer input", async () => {
  const sizes: number[] = [];
  const decodedSizes: number[] = [];
  for (const count of [1, 2, 8, 32]) {
    const editor = new Editor();
    for (let i = 0; i < count; i++)
      editor.createElement("image.raster", {
        semantic: { src: "artifacts/logo.png", alt: "Logo" },
        visual: { x: i * 20, y: 0, width: 10, height: 10 },
      });
    const state = harness(editor);
    let reads = 0;
    state.io.readAttachment = () => {
      reads++;
      return readFileSync("apps/desktop/src-tauri/icons/32x32.png");
    };
    expect((await state.run()).exitCode).toBe(0);
    expect(reads).toBe(1);
    const svg = state.calls[0]?.[0] ?? "";
    expect(svg.match(/base64,/g)).toHaveLength(1);
    expect(
      svg.match(/https:\/\/nodetto\.invalid\/capture-asset\/0/g),
    ).toHaveLength(count);
    const result = captureRenderInput(svg);
    expect(result.svg).toBe(svg);
    expect(result.resources.size).toBe(1);
    sizes.push(svg.length);
    decodedSizes.push(
      svg.length +
        [...result.resources.values()].reduce((sum, b) => sum + b.length, 0),
    );
  }
  for (const lengths of [sizes, decodedSizes])
    expect((lengths[3] ?? 0) - (lengths[0] ?? 0)).toBeLessThanOrEqual(
      31 * ((lengths[1] ?? 0) - (lengths[0] ?? 0) + 16),
    );
});

test("Bun carrier rendering matches independent embedded images", async () => {
  const fixtures = [
    [
      "png",
      readFileSync("apps/desktop/src-tauri/icons/32x32.png").toString("base64"),
    ],
    [
      "jpeg",
      "/9j/4AAQSkZJRgABAQAASABIAAD/4QBMRXhpZgAATU0AKgAAAAgAAYdpAAQAAAABAAAAGgAAAAAAA6ABAAMAAAABAAEAAKACAAQAAAABAAAAIKADAAQAAAABAAAAIAAAAAD/7QA4UGhvdG9zaG9wIDMuMAA4QklNBAQAAAAAAAA4QklNBCUAAAAAABDUHYzZjwCyBOmACZjs+EJ+/8AAEQgAIAAgAwEiAAIRAQMRAf/EAB8AAAEFAQEBAQEBAAAAAAAAAAABAgMEBQYHCAkKC//EALUQAAIBAwMCBAMFBQQEAAABfQECAwAEEQUSITFBBhNRYQcicRQygZGhCCNCscEVUtHwJDNicoIJChYXGBkaJSYnKCkqNDU2Nzg5OkNERUZHSElKU1RVVldYWVpjZGVmZ2hpanN0dXZ3eHl6g4SFhoeIiYqSk5SVlpeYmZqio6Slpqeoqaqys7S1tre4ubrCw8TFxsfIycrS09TV1tfY2drh4uPk5ebn6Onq8fLz9PX29/j5+v/EAB8BAAMBAQEBAQEBAQEAAAAAAAABAgMEBQYHCAkKC//EALURAAIBAgQEAwQHBQQEAAECdwABAgMRBAUhMQYSQVEHYXETIjKBCBRCkaGxwQkjM1LwFWJy0QoWJDThJfEXGBkaJicoKSo1Njc4OTpDREVGR0hJSlNUVVZXWFlaY2RlZmdoaWpzdHV2d3h5eoKDhIWGh4iJipKTlJWWl5iZmqKjpKWmp6ipqrKztLW2t7i5usLDxMXGx8jJytLT1NXW19jZ2uLj5OXm5+jp6vLz9PX29/j5+v/bAEMAAgICAgICAwICAwUDAwMFBgUFBQUGCAYGBgYGCAoICAgICAgKCgoKCgoKCgwMDAwMDA4ODg4ODw8PDw8PDw8PD//bAEMBAgICBAQEBwQEBxALCQsQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEP/dAAQAAv/aAAwDAQACEQMRAD8A/Tz9qr9quy/Z5tNP0rS9PTVvEmrI00UMrMsMMCtt8yTbhm3MCFUEZwSSMc/nxP8A8FNvjdHnboPh38be7/8Akuov+CnFz5Pxx0FM/wDMuWx/8m7uvQPHfwA+FfxT+DPwx8LeEPsPh34pXPhOw1axXYtumsIbdGuYpHGA0u8lwzZYZJ+5vK9F4RS5lufC4zEYyriasaVSyjsu/wDwTy6T/gqD8eRuMPh7w4wQbm/0W9OAOMnF5wOetfoF+x/+2FY/tL2up6HrGmx6N4q0WNZ5oYWZoLi3Ztvmxbssu1iFZWJxlSCc4H5Lfs76B4j0/wAPfHbQ9T3aRf8Ahzw9d3V1bTwsXM1lDcoYXXegx87blcOhIU7SVUjvf+CUs2/9onxCP+pWu/8A0usqzTblNONkrWd99O3Q68uxVZSpc1RvmvdNban/0NH/AIKmXHk/Hvw+uevhm1P/AJO3lec/tZeJ7jRPDHwA13wvrKRapoPhu1t45rSUGSOayhtWW4jZTny2ZiqMcZZHGODX6k/tl/scxftMWmma94d1OLR/FejRNbxSXAZre4t2Yv5UhXLLtYsysAepBHOR+Z0n/BKr9pFs41fw1/4GXX/yJXTFxdrvY+OxuX1lVqOEbqVtT0fwt+0t8K/il8GPif4p8YGx8O/FK48J3+k3rb1gXWUa3dbaWNDgNLvIQquWGQPubQvm3/BJuXf+0f4hX/qVrz/0tsqoyf8ABKP9pZumr+Gv/A26/wDkSv0w/Yn/AGKof2XbfVfEniTVIta8Xa5EtvLJbKy21tbKwcxRFwGcu4VmYqv3VAAwSVaMU+V7nRg8JXlVhKpG1j//2Q==",
    ],
    ["gif", "R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7"],
    [
      "webp",
      "UklGRtYEAABXRUJQVlA4TMkEAAAvH8AHEE2oaduA6ThT/ozLIaL/WXDe3kIgkORPO8EcCtq2YbyLYPxRDoDSNpKcudB/jYfzo8f9D4976ZCk1zz6fN75FvlkgIeO+3+KZOe/9MjMzEyRI4aY7dwOmRkiZjgAXcEHYGZmZmaG0U5XBb1mH+DfcjbzS82tf+yWVaHhl271ShXPu8E7gEeqfCQ4tq0de+59f9tJOlutnQmkNqdgO+NIm86lVTq1bft7H6i2bStb1jrfjzukf5BJ/Ikv8qg8Ddkdold3uxtqtm3LlvP5seTW3TONDlOQXTLdZQGmcB3BkrtEZ4GPZwIEhP5AXg/KN9tqlW+Hp0JXeVjK1zzPVrOS+vKb1rBP5QvuRYIrcoK17VP5tHfFemeL+XnVX247tFUI+P9KF25etVy/dLlyiXd02vmvPif401EeTUF5okD520GOIToKhCMcMKbCsS4nyc4yvwtrAn6+7D2D1s8xGP7EoO8zKTAPZHpGgHlEZm4z8xghprqcjzYq4GKmFU2+CCu67CjB3GaGXx0C9mtDNsiYgFcrKIcE/JYEfIyb62RCQhCq4VfzQGhHzG1rHDFzBKEmmHkBC6XzrmpuoYl7z6J/9S2EXw201tBMo1kvo7x313z0IDoF/jqm6vrajLsBAamq98p+1bRBV9M0lhc6Y924CK1ZZdm60GF9547oO3Tk6I6FoS+5tSA6fTdMUqaqKhjqSjC3I57SHeee/Tuw9V8VsoVgHWD9tAdXTIx8/K5tiu6FAAbBttJqzsd0EqPGzDaIDdGxW1Gzf3XTBua2mmR55HDefm0HCvuPB9ZXWUV46Kmf2SjpyGzUVF4Q4+6V/3YsguUQrP/04oZHFnofbW36+HEaCDolQa/08uOrLtF4hrU2y8gjG37tXNCYZebVQjqgcMXeudOYQE+1r/8TpU54mKIba5ocYrx1u/PJB+KR9X92yQ+YhRgjQLCvZcGVAhhZbozxuTOdlDPuk6+IR9b92jVPoTIyJiKB72qitPbdVLZsWkOMfPlMx+dM+uQT8ajqslUyDIwRJAgtP+1dU0BWWTYvIu3lG502FaKBU62d9U3FUyCAVCF9DKK03tlZFizZQrDBgBYfOykXzolLAeckawOT4AF6JQKsBSg/Glj3Y2BuK/7ThsoJrtvXhRpYWppzErEBgFnUZJ0/JVHa0LOXwsZyMBsMnCibJwbXG3GRBpeS2F435JAgoeV7T3oFFcyqUBjqaq0VEpnAa0UXqAFiFp4Ca8QvQJQ2dZMFiiMCbLccvfOE23exXbIIcCiC64ArVSE5JMg5nRE0C7VqjUQ41Rn+c6nqXKUKHmQBEpg6IEpSitYcZfnqfdxxpJWiOxdMwwMghxj+c4l5zMFXk86wjhvSE4TOJ1naFRSF8m6urUjUvZpIFMSAXpB6FEokhBCRU3laKoaykoAUqZMlFYiEfgJr9lLkoM/e4t44IVJbOuM7Ua6OMfdzRAJSnzWpkQP2kjB6SwpTPXUtHMwk4H3a6uQkuf+fNVH3kBCVMcX+QMcpR58mwYZ+qYCTj4M1Mq7a5iTy4GCnpbqfKnKWDiVSRIt/csKRONnRryjg+fo0xj5wjg1OBah234Y6EKoehKoTQlW+1QF+WWAnx79Sr19dQCHgT7+3AA==",
    ],
  ];
  for (const [mime, payload] of fixtures) {
    const data = `data:image/${mime};base64,${payload}`;
    const url = "https://nodetto.invalid/capture-asset/0";
    const carrier = `<defs><image id="nodetto-capture-asset-0" href="${data}"/></defs>`;
    const placements = `<image x="0" y="0" width="30" height="20" preserveAspectRatio="xMidYMid meet" href="${url}"/><image x="32" y="0" width="20" height="30" preserveAspectRatio="xMidYMid slice" href="${url}"/><image x="54" y="0" width="20" height="20" preserveAspectRatio="none" href="${url}"/><svg x="76" y="0" width="20" height="20" overflow="hidden"><image x="-8" y="-5" width="40" height="30" preserveAspectRatio="none" href="${url}"/></svg>`;
    const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="100" height="40">${carrier}${placements}</svg>`;
    const inline = svg.replace(carrier, "").replaceAll(url, data);
    const input = captureRenderInput(svg);
    expect(input.mimes.get(0)).toBe(`image/${mime}`);
    expect(input.resources.size).toBe(mime === "webp" ? 0 : 1);
    for (const scale of [1, 2.37])
      expect(await captureBackend.rasterize(svg, scale, undefined)).toEqual(
        await captureBackend.rasterize(inline, scale, undefined),
      );
  }
});

test("capture keeps embedded raster sources inline", async () => {
  const bytes = readFileSync("apps/desktop/src-tauri/icons/32x32.png");
  const src = `data:image/png;base64,${bytes.toString("base64")}`;
  const editor = new Editor();
  editor.createElement("image.raster", {
    semantic: { src, alt: "embedded" },
    visual: { x: 0, y: 0, width: 10, height: 10 },
  });
  const state = harness(editor);
  let reads = 0;
  state.io.readAttachment = () => {
    reads++;
    return bytes;
  };
  expect((await state.run()).exitCode).toBe(0);
  expect(reads).toBe(0);
  const svg = state.calls[0]?.[0] ?? "";
  expect(svg).toContain(`href="${src}"`);
  expect(svg).not.toContain('<defs><image id="nodetto-capture-asset-');
});

test("capture keeps embedded sources inline alongside attachment carriers", async () => {
  const bytes = readFileSync("apps/desktop/src-tauri/icons/32x32.png");
  const src = `data:image/png;base64,${bytes.toString("base64")}`;
  const editor = new Editor();
  for (const [index, imageSrc] of [src, src, "artifacts/logo.png"].entries())
    editor.createElement("image.raster", {
      semantic: { src: imageSrc, alt: "image" },
      visual: { x: index * 20, y: 0, width: 10, height: 10 },
    });
  const state = harness(editor);
  let reads = 0;
  state.io.readAttachment = () => {
    reads++;
    return bytes;
  };
  expect((await state.run()).exitCode).toBe(0);
  expect(reads).toBe(1);
  const svg = state.calls[0]?.[0] ?? "";
  expect(svg.split(`href="${src}"`).length - 1).toBe(3);
  expect(svg.match(/<image id="nodetto-capture-asset-0"/g)).toHaveLength(1);
  expect(svg).not.toContain("nodetto-capture-asset-1");
  expect(
    svg.match(/href="https:\/\/nodetto\.invalid\/capture-asset\/0"/g),
  ).toHaveLength(1);
});

test("capture attributes missing glyphs to container members", async () => {
  for (const kind of ["group", "frame"] as const) {
    const { editor, io, run } = harness();
    const frame =
      kind === "frame"
        ? editor.createElement("frame", {
            semantic: { name: "Frame" },
            visual: { x: 0, y: 0, width: 100, height: 100 },
          })
        : undefined;
    const inside = editor.createElement("shape.geo", {
      semantic: { geo: "rect", label: "λ" },
      visual: { x: 10, y: 10, width: 20, height: 20 },
    });
    const outside = editor.createElement("shape.geo", {
      semantic: { geo: "rect", label: "λ" },
      visual: { x: 300, y: 10, width: 20, height: 20 },
    });
    const target =
      frame ??
      editor.createElement("group", {
        semantic: { memberIds: [inside] },
        visual: {},
      });
    io.fontCoverage = () => ({ needsFallback: true, missing: [0x03bb] });
    const selected = await run("--element", target);
    expect(selected.exitCode).toBe(0);
    expect(selected.stderr).toContain(`glyph-missing ${inside}:`);
    expect(selected.stderr).not.toContain(`glyph-missing ${outside}:`);
    const page = await run();
    expect(page.exitCode).toBe(0);
    expect(page.stderr).toContain(`glyph-missing ${inside}:`);
    expect(page.stderr).toContain(`glyph-missing ${outside}:`);
  }
});
