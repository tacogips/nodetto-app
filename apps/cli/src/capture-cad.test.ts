import { expect, test } from "bun:test";
import { readFileSync, writeFileSync } from "node:fs";
import { capturePlateDocument } from "../../../packages/core/src/capture/testing/plate.ts";
import {
  CAD_TEST_PAGE,
  extrude,
  sketch,
} from "../../../packages/core/src/cad/testing/documents.ts";
import { serializeDocument } from "@nodetto/io";
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
          bodies: ["drawn", "hidden", "absent"].map((state) => ({
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
    "frame: cropped\nbodies: 3 (Plate, Block [hidden behind other bodies], Puck [not in the picture])\nerrors: 1\n",
  );
  const check = cadCommand(io, ["check", "capture-plate.jsonl"]);
  const issue = check.stdout.trim().split("\n").at(-1);
  expect(issue).toContain("cad.");
  expect(stdout).toEndWith(`  ${issue}\n`);
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
      { id: "puck", name: "Puck", state: "absent" },
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
    new Uint8Array(readFileSync(location("-default.ncs1"))),
  );
});
