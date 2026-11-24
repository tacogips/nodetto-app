import { expect, test } from "bun:test";
import { readFileSync, writeFileSync } from "node:fs";
import { capturePlateDocument } from "../../../packages/core/src/capture/testing/plate.ts";
import {
  CAD_TEST_PAGE,
  extrude,
  sketch,
} from "../../../packages/core/src/cad/testing/documents.ts";
import { serializeDocument } from "@nodetto/io";
import { decodeCaptureMesh } from "@nodetto/io/nmesh";
import { DEFAULT_CAD_INTERFERENCE, prepareCadCapture } from "@nodetto/core";
import { captureCommand, type CaptureBackend } from "./capture-command.ts";
import { cadCommand } from "./cad-command.ts";
import type { CommandIo } from "./commands.ts";

const location = (name: string) =>
  new URL(`./__fixtures__/capture-plate${name}`, import.meta.url);
const image = Uint8Array.of(1, 2, 3);
const plate = capturePlateDocument();

function harness(doc = plate) {
  const files = new Map<string, Uint8Array>();
  const scenes: Uint8Array[] = [];
  const io: CommandIo = {
    readText: () => serializeDocument(doc),
    writeText: () => {
      throw new Error("unexpected text write");
    },
    capture: {
      absolute: (path) => `/workspace/${path}`,
      digest: () => "fedcba9876543210",
      dir: () => "private",
      write(path, bytes) {
        files.set(path, bytes);
        return "written";
      },
    },
  };
  const backend: CaptureBackend = {
    async rasterize() {
      throw new Error("CAD capture called the SVG renderer");
    },
    renderSolid(scene, format, quality) {
      scenes.push(scene);
      expect(format).toBe("png");
      expect(quality).toBe(90);
      const view = new DataView(scene.buffer);
      return {
        image,
        report: JSON.stringify({
          width: view.getUint32(8, true),
          height: view.getUint32(12, true),
          bodies: ["drawn", "hidden", "outside"].map((state) => ({
            state,
            open: false,
            emptiedByStep: -1,
          })),
          analysis: null,
          pairs: [],
        }),
      };
    },
  };
  return {
    files,
    scenes,
    backend,
    io,
    run: (...args: string[]) =>
      captureCommand(io, ["capture-plate.jsonl", ...args], backend),
  };
}

test.each([
  [["--interference-cell", "0"], "--interference-cell must be"],
  [
    ["--no-interference", "--fail-on-interference"],
    "--no-interference cannot be",
  ],
  [["--view", "top", "--direction", "0,0,1"], "--view cannot be combined"],
  [["--view", "top", "--eye", "0,0,1"], "--view cannot be combined"],
  [["--direction", "0,0,1", "--eye", "0,0,1"], "--direction and --eye"],
  [["--direction", "0,,1"], "three comma-separated finite numbers"],
  [["--eye", "1,2,3,4"], "three comma-separated finite numbers"],
  [["--target", "1,Infinity,2"], "three comma-separated finite numbers"],
  [["--up", "a,b,c"], "three comma-separated finite numbers"],
  [["--view", "above"], "--view must be"],
  [["--zoom", "1000.1"], "--zoom must be between"],
  [["--zoom", "0.009"], "--zoom must be between"],
  [["--size", "63x2048"], "64 to 2048"],
  [["--size", "2048x2049"], "64 to 2048"],
  ...["--padding", "--background", "--scale", "--font-dir"].map(
    (option) =>
      [[option, "bad"], `${option} cannot be used on a cad3d page`] as const,
  ),
  [["--element", "no-such-id"], "--element cannot be used on a cad3d page"],
  [
    ["--page", "Plate", "--element", "no-such-id"],
    "--element cannot be used on a cad3d page",
  ],
] as const)("rejects invalid CAD options %j", async (args, message) => {
  const { run, scenes, files } = harness();
  const result = await run(...args);
  expect(result.exitCode).toBe(2);
  expect(result.stderr).toContain(message);
  expect(result.stderr).toContain("Usage: nodetto-cli capture");
  expect(scenes).toHaveLength(0);
  expect(files.size).toBe(0);
});

test("reports cropped frame, body states and cad check errors in text and JSON", async () => {
  const failed = extrude("bad-feature", "aZ", {
    sketch: "empty-profile",
    distance: 3,
    op: "new",
  });
  const { run, files, io } = harness({
    ...plate,
    elements: [...plate.elements, sketch("empty-profile", "aY"), failed],
  });
  const { stdout, stderr, exitCode } = await run(
    "--zoom",
    "3",
    "--view",
    "top",
    "--size",
    "320x240",
    "--output",
    "zoom.png",
  );
  expect(exitCode).toBe(0);
  expect(stderr).toBe("");
  expect(stdout).toMatch(
    /camera: view=top direction=0,0,-1 up=0,1,0 centre=85,35,0 scale=[0-9.]+ mm\/px/,
  );
  expect(stdout).toContain(
    "frame: cropped\nbodies: 3 (Plate, Block [hidden behind other bodies], Puck [outside the picture])\nerrors: 1\n",
  );
  const check = cadCommand(io, ["check", "capture-plate.jsonl"]);
  const issue = check.stdout.trim().split("\n").at(-1);
  expect(issue).toContain("cad.");
  expect(stdout).toContain(`  ${issue}\ninterference: not checked\n`);
  expect(files.get("zoom.png")).toBe(image);
  const result = await run(
    "--zoom",
    "3",
    "--view",
    "top",
    "--size",
    "320x240",
    "--output",
    "zoom.png",
    "--json",
  );
  expect(result.exitCode).toBe(0);
  expect(JSON.parse(result.stdout)).toMatchObject({
    path: "/workspace/zoom.png",
    format: "png",
    width: 320,
    height: 240,
    camera: {
      view: "top",
      direction: [0, 0, -1],
      right: [1, 0, 0],
      centre: [85, 35, 0],
    },
    frame: "cropped",
    bodies: [
      { id: "plate", name: "Plate", state: "drawn" },
      { id: "block", name: "Block", state: "hidden" },
      { id: "puck", name: "Puck", state: "outside" },
    ],
    errors: [{ id: failed.id, code: issue?.split(" ").at(-1) }],
  });
});

test("explains a sketch-only page and a host without CAD rendering", async () => {
  const { run } = harness({
    ...plate,
    pages: [{ ...CAD_TEST_PAGE, name: "Draft" }],
    elements: [sketch("base", "a1")],
  });
  const result = await run();
  expect(result.exitCode).toBe(2);
  expect(result.stderr).toStartWith(
    'Page "Draft" has no solid body yet (1 sketches, 0 features failed).',
  );
  const { run: bun, backend } = harness();
  backend.renderSolid = undefined;
  for (const format of ["png", "jpg"]) {
    const unavailable = await bun("--format", format);
    expect(unavailable.exitCode).toBe(2);
    expect(unavailable.stderr).toContain(
      "3D CAD capture needs the native nodetto-cli.",
    );
  }
});

test("the default CLI request matches the committed Plate document and NCS1 bytes", async () => {
  const { run, scenes } = harness();
  const result = await run();
  expect(result.exitCode).toBe(0);
  expect(result.stdout).toContain("size: 1024x768");
  const [scene] = scenes;
  if (!scene) throw new Error("Missing capture scene");
  const jsonl = serializeDocument(plate);
  if (process.env.UPDATE_CAPTURE_FIXTURES === "1") {
    writeFileSync(location(".jsonl"), jsonl);
    writeFileSync(location("-default.ncs1"), scene);
  }
  expect(readFileSync(location(".jsonl"), "utf8")).toBe(jsonl);
  expect(scene).toEqual(
    prepareCadCapture(plate.elements, plate.pages[0]!.id, {
      camera: {},
      width: 1024,
      height: 768,
      theme: "light",
      interference: DEFAULT_CAD_INTERFERENCE,
      decodeMesh: decodeCaptureMesh,
    }).scene,
  );
  expect(scene).toEqual(
    new Uint8Array(readFileSync(location("-default.ncs1"))),
  );
  expect((await run("--no-interference")).exitCode).toBe(0);
  expect(scenes[1]).toEqual(
    new Uint8Array(readFileSync(location("-no-interference.ncs1"))),
  );
});

test("interference reports and failure exit retain the written image", async () => {
  const { io, backend, files } = harness();
  backend.renderSolid = (scene) => {
    const view = new DataView(scene.buffer, scene.byteOffset, scene.byteLength);
    return {
      image,
      report: JSON.stringify({
        width: view.getUint32(8, true),
        height: view.getUint32(12, true),
        bodies: ["drawn", "hidden", "outside"].map((state) => ({
          state,
          open: false,
          emptiedByStep: -1,
        })),
        analysis: {
          cell: 0.25,
          candidates: 1,
          checked: 1,
          unchecked: [],
          uncheckedCount: 0,
          cappedCount: 1,
          cappedWithoutHit: [],
          budget: 24,
        },
        pairs: [
          {
            a: 0,
            b: 1,
            volume: 590.721,
            min: [0, 0, 0],
            max: [1, 1, 1],
            source: "analysis",
            capped: true,
          },
          {
            a: 0,
            b: 2,
            volume: 2,
            min: [0, 0, 0],
            max: [1, 1, 1],
            source: "analysis",
            capped: false,
          },
        ],
      }),
    };
  };
  const text = await captureCommand(
    io,
    ["capture-plate.jsonl", "--output", "report.png", "--fail-on-interference"],
    backend,
  );
  expect(text.exitCode).toBe(1);
  expect(text.stdout).toContain("Plate x Block: volume 590.7 mm3");
  expect(text.stdout).toContain("approximate");
  expect(text.stdout).toContain(
    "Plate x Block: volume 590.7 mm3, box 0,0,0 .. 1,1,1 mm, approximate",
  );
  expect(text.stdout).toContain(
    "Plate x Puck: volume 2 mm3, box 0,0,0 .. 1,1,1 mm\n",
  );
  expect(files.get("report.png")).toBe(image);
  const json = await captureCommand(
    io,
    ["capture-plate.jsonl", "--json"],
    backend,
  );
  expect(json.exitCode).toBe(0);
  expect(JSON.parse(json.stdout).interference.pairs[0]).toMatchObject({
    aName: "Plate",
    bName: "Block",
    approximate: true,
  });
  expect(JSON.parse(json.stdout).interference.pairs[1]).toMatchObject({
    aName: "Plate",
    bName: "Puck",
    approximate: false,
  });
});

test("unchecked and capped analysis control exit codes and list limits", async () => {
  const { io, backend } = harness();
  const analysis = {
    cell: 0.25,
    candidates: 25,
    checked: 0,
    unchecked: Array.from({ length: 25 }, () => [0, 1]),
    uncheckedCount: 25,
    cappedCount: 0,
    cappedWithoutHit: [],
    budget: 24,
  };
  backend.renderSolid = () => ({
    image,
    report: JSON.stringify({
      width: 1024,
      height: 768,
      bodies: Array.from({ length: 3 }, () => ({
        state: "drawn",
        open: false,
        emptiedByStep: -1,
      })),
      analysis,
      pairs: [],
    }),
  });
  const unchecked = await captureCommand(
    io,
    ["capture-plate.jsonl", "--fail-on-interference"],
    backend,
  );
  expect(unchecked.exitCode).toBe(1);
  expect(unchecked.stdout.match(/ {2}not checked:/g)).toHaveLength(20);
  expect(unchecked.stdout).toContain("... and 5 more");
  const json = await captureCommand(
    io,
    ["capture-plate.jsonl", "--json"],
    backend,
  );
  expect(json.exitCode).toBe(0);
  expect(JSON.parse(json.stdout).interference).toMatchObject({
    uncheckedCount: 25,
    unchecked: Array.from({ length: 25 }, () => ["plate", "block"]),
  });
  analysis.unchecked = [];
  analysis.uncheckedCount = 0;
  analysis.cappedCount = 1;
  expect(
    (
      await captureCommand(
        io,
        ["capture-plate.jsonl", "--fail-on-interference"],
        backend,
      )
    ).exitCode,
  ).toBe(0);
});

test("body notes identify empty, refilled, hidden and outside bodies", async () => {
  const { io, backend } = harness();
  backend.renderSolid = () => ({
    image,
    report: JSON.stringify({
      width: 1024,
      height: 768,
      bodies: [
        { state: "empty", open: false, emptiedByStep: 0 },
        { state: "hidden", open: false, emptiedByStep: 0 },
        { state: "outside", open: false, emptiedByStep: -1 },
      ],
      analysis: null,
      pairs: [],
    }),
  });
  const result = await captureCommand(io, ["capture-plate.jsonl"], backend);
  expect(result.exitCode).toBe(0);
  expect(result.stdout).toContain("Plate [no material]");
  expect(result.stdout).toContain(
    "Block [hidden behind other bodies] [differs from the app, see errors]",
  );
  expect(result.stdout).toContain("Puck [outside the picture]");
  expect(result.stdout).toContain('leaves no material in "Block"');
});

test.each(["width", "height", "bodies"] as const)(
  "rejects a mismatched renderer %s",
  async (field) => {
    const { io, backend, files } = harness();
    backend.renderSolid = () => ({
      image,
      report: JSON.stringify({
        width: field === "width" ? 1025 : 1024,
        height: field === "height" ? 769 : 768,
        bodies: Array.from({ length: field === "bodies" ? 2 : 3 }, () => ({
          state: "drawn",
          open: false,
          emptiedByStep: -1,
        })),
        analysis: null,
        pairs: [],
      }),
    });
    const result = await captureCommand(io, ["capture-plate.jsonl"], backend);
    expect(result.exitCode).toBe(2);
    expect(result.stderr).toContain(
      "The solid capture report does not match the requested scene.",
    );
    expect(files.size).toBe(0);
  },
);
