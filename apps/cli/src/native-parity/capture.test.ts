import { expect } from "bun:test";
import { createHash } from "node:crypto";
import {
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  realpathSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { basename, dirname, isAbsolute, join } from "node:path";
import { inflateSync } from "node:zlib";
import { Editor } from "@nodetto/core";
import { serializeDocument } from "@nodetto/io";
import { stlToInlineMesh } from "@nodetto/io/cad-mesh";
import { writeBinaryStl } from "@nodetto/io/stl";
import { canonicalize, encodeNmesh, toInline } from "@nodetto/io/nmesh";
import {
  CAD_TEST_PAGE,
  cadElement,
  extrude,
  rectangle,
  sketch,
} from "../../../../packages/core/src/cad/testing/documents.ts";
import {
  PCB_TEST_PAGE,
  boardReference,
  edge,
  testBoard,
} from "../../../../packages/core/src/cad/testing/pcb.ts";
import { document } from "../../../../packages/core/src/test-helpers.ts";
import { captureSelectedLoopsDocument } from "../../../../packages/core/src/capture/testing/selected-loops.ts";
import { binary, cliEntry, nativeTest } from "./harness.ts";

nativeTest(
  "Bun and native capture agree on 2D metadata and native PNG bytes repeat",
  () => {
    const cwd = mkdtempSync(join(tmpdir(), "nodetto-capture-parity-"));
    try {
      const run = (executable: string[], args: string[]) =>
        Bun.spawnSync(
          [...executable, "capture", "panel.jsonl", "--padding", "0", ...args],
          {
            cwd,
            env: { ...process.env, TMPDIR: cwd, TMP: cwd, TEMP: cwd },
          },
        );
      const rustCli = [binary as string];
      const bunCli = [process.execPath, cliEntry];
      const info = (stdout: Uint8Array) =>
        stdout
          .toString()
          .split("\n")
          .filter((line) => /^(path|format|size|page): /.test(line));
      for (const { width, height, args } of [
        { width: 100, height: 100, args: ["--scale", "1.1"] },
        { width: 3000, height: 3296, args: [] },
        { width: 12247, height: 5468, args: [] },
        { width: 19780, height: 14187, args: [] },
      ]) {
        const editor = new Editor();
        editor.createElement("shape.geo", {
          semantic: { geo: "rect", label: "" },
          visual: { x: 0, y: 0, width, height },
        });
        writeFileSync(
          join(cwd, "panel.jsonl"),
          serializeDocument(editor.getSnapshot()),
        );
        const explicit = [...args, "--output", "panel.png", "--force"];
        const bun = run(bunCli, explicit);
        expect(bun.stderr.toString()).toBe("");
        expect(bun.exitCode).toBe(0);
        const native = run(rustCli, explicit);
        expect(native.stderr.toString()).toBe("");
        expect(native.exitCode).toBe(bun.exitCode);
        expect(info(native.stdout)).toEqual(info(bun.stdout));
        const bytes = readFileSync(join(cwd, "panel.png"));
        expect([...bytes.subarray(0, 8)]).toEqual([
          137, 80, 78, 71, 13, 10, 26, 10,
        ]);
        expect(native.stdout.toString()).toContain(
          `size: ${bytes.readUInt32BE(16)}x${bytes.readUInt32BE(20)}\n`,
        );
      }
      const first = run(rustCli, []);
      expect(first.exitCode).toBe(0);
      const path =
        first.stdout.toString().split("\n")[0]?.slice("path: ".length) ?? "";
      expect(isAbsolute(path)).toBe(true);
      expect(basename(dirname(path))).toStartWith("nodetto-capture");
      const bytes = readFileSync(path);
      const repeated = run(rustCli, []);
      expect(repeated.exitCode).toBe(0);
      expect(repeated.stdout.toString()).toBe(first.stdout.toString());
      expect(readFileSync(path)).toEqual(bytes);
      // Render afresh as well, so reuse of a digest file cannot mask a byte change.
      const fresh = run(rustCli, ["--output", "fresh.png"]);
      expect(fresh.exitCode).toBe(0);
      expect(readFileSync(join(cwd, "fresh.png"))).toEqual(bytes);
    } finally {
      rmSync(cwd, { recursive: true, force: true });
    }
  },
  10_000,
);

nativeTest(
  "native captures deterministic JPG files while Bun explains the native requirement",
  () => {
    const cwd = mkdtempSync(join(tmpdir(), "nodetto-capture-jpg-"));
    try {
      const editor = new Editor();
      editor.createElement("shape.geo", {
        semantic: { geo: "rect", label: "" },
        visual: { x: 0, y: 0, width: 120, height: 75 },
      });
      writeFileSync(
        join(cwd, "panel.jsonl"),
        serializeDocument(editor.getSnapshot()),
      );
      const run = (executable: string[], output: string) =>
        Bun.spawnSync(
          [
            ...executable,
            "capture",
            "panel.jsonl",
            "--output",
            output,
            "--padding",
            "0",
            "--quality",
            "85",
            "--json",
          ],
          { cwd },
        );
      for (const output of ["first.jpg", "second.jpeg"]) {
        const native = run([binary as string], output);
        expect(native.stderr.toString()).toBe("");
        expect(native.exitCode).toBe(0);
        const path = join(cwd, output);
        const bytes = readFileSync(path);
        expect([...bytes.subarray(0, 2)]).toEqual([0xff, 0xd8]);
        expect([...bytes.subarray(-2)]).toEqual([0xff, 0xd9]);
        const metadata = JSON.parse(native.stdout.toString()) as {
          path: string;
        };
        expect(metadata).toMatchObject({
          format: "jpg",
          width: 120,
          height: 75,
          bytes: bytes.length,
        });
        expect(isAbsolute(metadata.path)).toBe(true);
        expect(realpathSync(metadata.path)).toBe(realpathSync(path));
      }
      expect(readFileSync(join(cwd, "first.jpg"))).toEqual(
        readFileSync(join(cwd, "second.jpeg")),
      );
      const bun = run([process.execPath, cliEntry], "bun.jpg");
      expect(bun.exitCode).toBe(2);
      expect(bun.stderr.toString()).toContain(
        "JPG capture needs the native nodetto-cli.",
      );
      expect(existsSync(join(cwd, "bun.jpg"))).toBe(false);
    } finally {
      rmSync(cwd, { recursive: true, force: true });
    }
  },
  10_000,
);

const plateFixture = join(
  import.meta.dir,
  "../__fixtures__/capture-plate.jsonl",
);
const m09Evidence = join(import.meta.dir, "../../../../tmp/capture/m09");

interface CadPictureMetadata {
  camera: {
    right: readonly number[];
    up: readonly number[];
    centre: readonly number[];
    mmPerPixel: number;
  };
  width: number;
  height: number;
}

function runCad(
  cwd: string,
  document: string,
  args: string[] = [],
  output = "cad.png",
) {
  const result = Bun.spawnSync(
    [
      binary as string,
      "capture",
      document,
      "--output",
      output,
      "--force",
      ...args,
    ],
    { cwd },
  );
  expect(result.stderr.toString()).toBe("");
  expect(result.exitCode).toBe(0);
  return {
    bytes: readFileSync(join(cwd, output)),
    stdout: result.stdout.toString(),
  };
}

function decodeCadPng(image: Buffer) {
  expect(image.subarray(0, 8)).toEqual(
    Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]),
  );
  expect(image.toString("ascii", 12, 16)).toBe("IHDR");
  expect([...image.subarray(24, 29)]).toEqual([8, 2, 0, 0, 0]);
  const width = image.readUInt32BE(16);
  const height = image.readUInt32BE(20);
  const compressed: Buffer[] = [];
  for (let offset = 8; offset + 12 <= image.length; ) {
    const length = image.readUInt32BE(offset);
    if (image.toString("ascii", offset + 4, offset + 8) === "IDAT")
      compressed.push(image.subarray(offset + 8, offset + 8 + length));
    offset += length + 12;
  }
  const scanlines = inflateSync(Buffer.concat(compressed));
  const stride = width * 3;
  const pixels = new Uint8Array(height * stride);
  expect(scanlines.length).toBe((stride + 1) * height);
  for (let y = 0; y < height; y++) {
    const row = y * stride;
    const input = y * (stride + 1);
    const filter = scanlines.readUInt8(input);
    if (filter > 4) throw new Error(`Unknown PNG filter ${filter}`);
    for (let x = 0; x < stride; x++) {
      const index = row + x;
      const left = x < 3 ? 0 : (pixels[index - 3] ?? 0);
      const up = pixels[index - stride] ?? 0;
      const diagonal = x < 3 ? 0 : (pixels[index - stride - 3] ?? 0);
      const pl = Math.abs(up - diagonal);
      const pu = Math.abs(left - diagonal);
      const pd = Math.abs(left + up - 2 * diagonal);
      const paeth = pl <= pu && pl <= pd ? left : pu <= pd ? up : diagonal;
      const prediction = [0, left, up, (left + up) >> 1, paeth][filter] ?? 0;
      pixels[index] = scanlines.readUInt8(input + 1 + x) + prediction;
    }
  }
  return {
    width,
    height,
    at(x: number, y: number) {
      expect(x).toBeGreaterThanOrEqual(0);
      expect(x).toBeLessThan(width);
      expect(y).toBeGreaterThanOrEqual(0);
      expect(y).toBeLessThan(height);
      const i = (y * width + x) * 3;
      return [...pixels.subarray(i, i + 3)];
    },
  };
}

function cadPixels(result: ReturnType<typeof runCad>) {
  const { camera, width, height } = JSON.parse(
    result.stdout,
  ) as CadPictureMetadata;
  const picture = decodeCadPng(result.bytes);
  expect([picture.width, picture.height]).toEqual([width, height]);
  return {
    ...picture,
    world(point: readonly [number, number, number]) {
      const dot = (axis: readonly number[]) =>
        point.reduce(
          (sum, value, i) =>
            sum + (value - (camera.centre[i] ?? 0)) * (axis[i] ?? 0),
          0,
        );
      return picture.at(
        Math.floor(width / 2 + dot(camera.right) / camera.mmPerPixel),
        Math.floor(height / 2 - dot(camera.up) / camera.mmPerPixel),
      );
    },
  };
}

nativeTest(
  "CAD capture is deterministic, discoverable, and within the native budget",
  () => {
    const cwd = mkdtempSync(join(tmpdir(), "nodetto-cad-capture-"));
    try {
      const timings: number[] = [];
      let previous: Buffer | undefined;
      for (let i = 0; i < 3; i++) {
        const start = performance.now();
        const result = runCad(cwd, plateFixture, [], `plate-${i}.png`);
        timings.push(Math.round(performance.now() - start));
        if (previous) expect(result.bytes).toEqual(previous);
        expect(isAbsolute(result.stdout.split("\n")[0]?.slice(6) ?? "")).toBe(
          true,
        );
        expect(result.stdout).toContain("\nsize: 1024x768\n");
        expect(result.stdout).toContain(
          "\nframe: complete\nbodies: 3 (Plate, Block, Puck)\nerrors: 0\n",
        );
        expect(result.stdout).toMatch(
          /\ncamera: view=iso direction=-0\.57735,-0\.57735,-0\.57735 up=.+ centre=.+ scale=.+ mm\/px\n/,
        );
        previous = result.bytes;
      }
      mkdirSync(m09Evidence, { recursive: true });
      writeFileSync(
        join(m09Evidence, "timing.json"),
        `${JSON.stringify({ milliseconds: timings })}\n`,
      );
      for (const elapsed of timings) expect(elapsed).toBeLessThan(5000);
      const defaultOutput = Bun.spawnSync(
        [binary as string, "capture", plateFixture],
        { cwd, env: { ...process.env, TMPDIR: cwd, TEMP: cwd, TMP: cwd } },
      );
      expect(defaultOutput.exitCode).toBe(0);
      expect(defaultOutput.stderr.toString()).toBe("");
      const defaultPath =
        defaultOutput.stdout
          .toString()
          .split("\n")[0]
          ?.slice("path: ".length) ?? "";
      expect(isAbsolute(defaultPath)).toBe(true);
      expect(basename(dirname(defaultPath))).toStartWith("nodetto-capture");
      if (!previous) throw new Error("Missing reference capture");

      expect(readFileSync(defaultPath)).toEqual(previous);

      const bun = Bun.spawnSync(
        [
          process.execPath,
          cliEntry,
          "capture",
          plateFixture,
          "--output",
          "bun.png",
        ],
        { cwd },
      );
      expect(bun.exitCode).toBe(2);
      expect(bun.stderr.toString()).toContain(
        "3D CAD capture needs the native nodetto-cli.",
      );
      expect(existsSync(join(cwd, "bun.png"))).toBe(false);
    } finally {
      rmSync(cwd, { recursive: true, force: true });
    }
  },
  30_000,
);

nativeTest(
  "named, directional, and eye-based cameras agree for equivalent requests",
  () => {
    const cwd = mkdtempSync(join(tmpdir(), "nodetto-cad-camera-"));
    try {
      const render = (...args: string[]) =>
        runCad(cwd, plateFixture, ["--size", "240x180", ...args]).bytes;
      const iso = render();
      const top = render("--view", "top");
      const front = render("--view", "front");
      expect(iso.equals(top)).toBe(false);
      expect(iso.equals(front)).toBe(false);
      expect(top.equals(front)).toBe(false);
      expect(iso.equals(render("--direction", "-1,-1,-1"))).toBe(true);
      expect(render("--direction", "0,0,1")).toEqual(
        render("--view", "bottom"),
      );
      expect(render("--eye", "1,1,1", "--target", "0,0,0")).toEqual(
        render("--direction", "-1,-1,-1", "--target", "0,0,0"),
      );
    } finally {
      rmSync(cwd, { recursive: true, force: true });
    }
  },
  30_000,
);

nativeTest(
  "CAD captures show through holes, grazing faces, and normalized selected loops",
  () => {
    const cwd = mkdtempSync(join(tmpdir(), "nodetto-cad-pixels-"));
    try {
      const background = [0xf6, 0xf4, 0xee];
      const top = cadPixels(
        runCad(cwd, plateFixture, ["--view", "top", "--json"]),
      );
      expect(top.world([5, 5, 5])).toEqual(background);
      expect(top.world([10, 10, 5])).not.toEqual(background);

      const grazing = cadPixels(
        runCad(cwd, plateFixture, ["--direction", "0,1,-0.15", "--json"]),
      );
      const face = grazing.world([35, 30, 5]);
      expect(face).not.toEqual(background);
      const samples = Array.from({ length: 120 }, (_, i) =>
        grazing.world([32 + (i % 20) * 0.5, 28 + Math.floor(i / 20) * 0.5, 5]),
      );
      expect(
        samples.filter((sample) => sample.join() === face.join()).length,
      ).toBeGreaterThan(108);

      const loopsPath = join(cwd, "loops.jsonl");
      writeFileSync(
        loopsPath,
        serializeDocument(captureSelectedLoopsDocument()),
      );
      const loops = cadPixels(
        runCad(cwd, loopsPath, ["--view", "top", "--json"]),
      );
      expect(loops.world([30, 20, 4])).not.toEqual(background);
      expect(loops.world([42, 20, 4])).toEqual(background);
      expect(loops.world([110, 20, 4])).not.toEqual(background);
      expect(loops.world([117, 20, 4])).not.toEqual(background);

      const dark = cadPixels(
        runCad(cwd, plateFixture, ["--theme", "dark", "--json"]),
      );
      expect(dark.at(0, 0)).toEqual([0x15, 0x19, 0x1b]);
      const jpg = runCad(cwd, plateFixture, ["--format", "jpg"], "cad.jpg");
      expect([...jpg.bytes.subarray(0, 2)]).toEqual([255, 216]);
      expect([...jpg.bytes.subarray(-2)]).toEqual([255, 217]);
    } finally {
      rmSync(cwd, { recursive: true, force: true });
    }
  },
  30_000,
);

nativeTest(
  "CAD interference is reported consistently across views and capture options",
  () => {
    const cwd = mkdtempSync(join(tmpdir(), "nodetto-cad-interference-"));
    try {
      let expectedLines: string[] | undefined;
      for (const view of ["top", "front", "iso"]) {
        const result = runCad(cwd, plateFixture, [
          "--view",
          view,
          "--size",
          "320x240",
        ]);
        const lines = result.stdout
          .split("\n")
          .filter(
            (line) =>
              line.startsWith("interference:") ||
              line.startsWith("  Plate x Block:"),
          );
        expect(lines[0]).toBe(
          "interference: 1 (1 candidate pair checked, cell 0.25 mm)",
        );
        const volume = Number(/volume ([0-9.]+) mm3/.exec(lines[1] ?? "")?.[1]);
        expect(Math.abs(volume - 590.721) / 590.721).toBeLessThan(0.01);
        if (expectedLines) expect(lines).toEqual(expectedLines);
        expectedLines = lines;
      }
      const enabled = runCad(cwd, plateFixture, [
        "--view",
        "top",
        "--size",
        "320x240",
      ]);
      const repeated = runCad(cwd, plateFixture, [
        "--view",
        "top",
        "--size",
        "320x240",
      ]);
      expect(repeated.bytes).toEqual(enabled.bytes);
      const disabled = runCad(cwd, plateFixture, [
        "--view",
        "top",
        "--size",
        "320x240",
        "--no-interference",
      ]);
      expect(disabled.stdout).toContain("interference: not checked");
      expect(disabled.bytes.equals(enabled.bytes)).toBe(false);
      expect(
        runCad(cwd, plateFixture, [
          "--interference-cell",
          "1",
          "--size",
          "320x240",
        ]).stdout,
      ).toContain("cell 0.938 mm");
      expect(
        runCad(cwd, plateFixture, [
          "--interference-bodies",
          "Plate,Puck",
          "--size",
          "320x240",
        ]).stdout,
      ).toContain("interference: 0");
      const failure = Bun.spawnSync(
        [
          binary as string,
          "capture",
          plateFixture,
          "--size",
          "320x240",
          "--output",
          "fail.png",
          "--fail-on-interference",
        ],
        { cwd },
      );
      expect(failure.exitCode).toBe(1);
      expect(existsSync(join(cwd, "fail.png"))).toBe(true);
    } finally {
      rmSync(cwd, { recursive: true, force: true });
    }
  },
  30_000,
);

nativeTest(
  "native interference hatch uses both theme colours deterministically",
  () => {
    const cwd = mkdtempSync(join(tmpdir(), "nodetto-hatch-"));
    try {
      for (const [theme, colours] of [
        [
          "light",
          [
            [0x33, 0x5c, 0x67],
            [0xff, 0xfd, 0xf8],
          ],
        ],
        [
          "dark",
          [
            [0x5f, 0xb4, 0xc7],
            [0x1f, 0x24, 0x27],
          ],
        ],
      ] as const) {
        const args = ["--view", "top", "--size", "320x240", "--theme", theme];
        const first = runCad(cwd, plateFixture, args, "first.png");
        expect(runCad(cwd, plateFixture, args, "second.png").bytes).toEqual(
          first.bytes,
        );
        const picture = decodeCadPng(first.bytes);
        const found = new Set<string>();
        for (let y = 0; y < picture.height; y++)
          for (let x = 0; x < picture.width; x++)
            found.add(picture.at(x, y).join(","));
        for (const colour of colours)
          expect(found.has(colour.join(","))).toBe(true);
      }
    } finally {
      rmSync(cwd, { recursive: true, force: true });
    }
  },
  30_000,
);

nativeTest(
  "native capture reports a shared cut that empties a hidden target",
  () => {
    const cwd = mkdtempSync(join(tmpdir(), "nodetto-hidden-cut-"));
    try {
      for (const [shared, visible] of [
        [true, false],
        [false, false],
        [true, true],
      ] as const) {
        const elements = [
          sketch("wide-sketch", "a1"),
          ...rectangle("wide-sketch", 0, 0, 20, 10),
          extrude("wide", "a2", {
            sketch: "wide-sketch",
            distance: 4,
            op: "new",
          }),
          sketch("hidden-sketch", "a3"),
          ...rectangle("hidden-sketch", 1, 1, 2, 2),
          {
            ...extrude("hidden", "a4", {
              sketch: "hidden-sketch",
              distance: 4,
              op: "new",
            }),
            visual: { hidden: !visible },
          },
          sketch("trim-sketch", "a5"),
          ...rectangle("trim-sketch", 0, 0, 5, 10),
          extrude("trim", "a6", {
            sketch: "trim-sketch",
            distance: 4,
            op: "cut",
            bodies: shared ? ["wide", "hidden"] : ["wide"],
          }),
        ];
        const path = join(cwd, "scene.jsonl");
        writeFileSync(
          path,
          serializeDocument(document(elements, [CAD_TEST_PAGE])),
        );
        const { stdout } = runCad(cwd, path, [
          "--view",
          "top",
          "--no-interference",
        ]);
        expect(stdout).toContain(`errors: ${visible ? 2 : shared ? 1 : 0}`);
        const bodies = stdout
          .split("\n")
          .find((line) => line.startsWith("bodies:"));
        expect(bodies).toContain(`bodies: ${visible ? 2 : 1} (wide`);
        if (visible) {
          expect(bodies).toContain("wide [differs from the app, see errors]");
          const error = stdout
            .split("\n")
            .find((line) => line.includes('keeps "wide"'));
          expect(error).toContain("trim");
          expect(error).toContain('"hidden"');
          const json = JSON.parse(
            runCad(cwd, path, ["--view", "top", "--no-interference", "--json"])
              .stdout,
          );
          expect(json.errors).toContainEqual(
            expect.objectContaining({
              id: "trim",
              code: "cad.result.empty",
              sampled: true,
              text: expect.stringContaining('keeps "wide"'),
            }),
          );
        } else {
          expect(bodies).not.toContain("hidden");
          if (!shared) expect(bodies).not.toContain("differs from the app");
        }
        if (shared && !visible) {
          const error = stdout
            .split("\n")
            .find((line) => line.includes("cad.result.empty"));
          expect(error).toContain("trim");
          expect(error).toContain("leaves no material in a hidden target body");
          expect(error).toContain('"wide"');
        }
      }
    } finally {
      rmSync(cwd, { recursive: true, force: true });
    }
  },
  30_000,
);

nativeTest(
  "native capture reports emptied bodies and accepts mesh and PCB bodies",
  () => {
    const cwd = mkdtempSync(join(tmpdir(), "nodetto-cad-cases-"));
    try {
      const save = (
        name: string,
        elements: Parameters<typeof document>[0],
        pages: Parameters<typeof document>[1] = [CAD_TEST_PAGE],
      ) => {
        const path = join(cwd, name);
        writeFileSync(path, serializeDocument(document(elements, pages)));
        return path;
      };
      const empty = save("empty.jsonl", [
        sketch("base", "a1"),
        ...rectangle("base", 0, 0, 10, 10),
        cadElement("plate", "cad.extrude", "a2", {
          name: "Plate",
          sketch: "base",
          distance: 5,
          op: "new",
        }),
        sketch("trim-profile", "a3"),
        ...rectangle("trim-profile", -1, -1, 12, 12),
        cadElement("trim", "cad.extrude", "a4", {
          name: "Trim",
          sketch: "trim-profile",
          distance: 5,
          op: "cut",
          bodies: ["plate"],
        }),
        sketch("boss-profile", "a5"),
        ...rectangle("boss-profile", 1, 1, 3, 3),
        cadElement("boss", "cad.extrude", "a6", {
          name: "Boss",
          sketch: "boss-profile",
          distance: 5,
          op: "add",
          bodies: ["plate"],
        }),
      ]);
      const emptyResult = runCad(cwd, empty, ["--size", "320x240"]);
      expect(emptyResult.stdout).toContain("errors: 1");
      expect(emptyResult.stdout).toContain("cad.result.empty (sampled)");
      const mesh = toInline(
        encodeNmesh(
          canonicalize({
            positions: new Float64Array([
              0, 0, 0, 10, 0, 0, 10, 10, 0, 0, 10, 0, 0, 0, 10, 10, 0, 10, 10,
              10, 10, 0, 10, 10,
            ]),
            triangles: new Uint32Array([
              0, 2, 1, 0, 3, 2, 4, 5, 6, 4, 6, 7, 0, 1, 5, 0, 5, 4, 1, 2, 6, 1,
              6, 5, 2, 3, 7, 2, 7, 6, 3, 0, 4, 3, 4, 7,
            ]),
          }),
        ),
      );
      const meshPath = save("mesh.jsonl", [
        cadElement("mesh", "cad.mesh", "a0", { name: "Cube", data: mesh }),
        sketch("cut-profile", "a1"),
        ...rectangle("cut-profile", 0, 0, 2, 2),
        extrude("cut", "a2", {
          sketch: "cut-profile",
          distance: 10,
          op: "cut",
          bodies: ["mesh"],
        }),
      ]);
      expect(runCad(cwd, meshPath, ["--size", "320x240"]).stdout).toContain(
        "Cube",
      );
      const pcbPath = save(
        "pcb.jsonl",
        [
          boardReference(),
          testBoard(1.2),
          edge("rim", { kind: "rect", start: [0, 0], end: [30, 40] }),
        ],
        [CAD_TEST_PAGE, PCB_TEST_PAGE],
      );
      expect(runCad(cwd, pcbPath, ["--size", "320x240"]).stdout).toContain(
        "Controller board",
      );
    } finally {
      rmSync(cwd, { recursive: true, force: true });
    }
  },
  30_000,
);

nativeTest(
  "native capture ignores touching bodies and fails 0.01 mm overlaps",
  () => {
    const cwd = mkdtempSync(join(tmpdir(), "nodetto-touching-"));
    try {
      for (const { name, view, offset, distance, side, status } of [
        {
          name: "caps",
          view: "front",
          offset: 0.9375,
          distance: 1.0625,
          side: false,
          status: 0,
        },
        {
          name: "caps-overlap",
          view: "front",
          offset: 0.9275,
          distance: 1.0725,
          side: false,
          status: 1,
        },
        {
          name: "side",
          view: "top",
          offset: 8,
          distance: 8,
          side: true,
          status: 0,
        },
        {
          name: "side-overlap",
          view: "top",
          offset: 7.99,
          distance: 8.01,
          side: true,
          status: 1,
        },
      ]) {
        const elements = side
          ? [
              sketch("lower", "a1"),
              ...rectangle("lower", 0, 0, 8, 8),
              extrude("lower-x", "a2", {
                sketch: "lower",
                distance: 2,
                op: "new",
              }),
              sketch("upper", "a3"),
              ...rectangle("upper", offset, 0, distance, 8),
              extrude("upper-x", "a4", {
                sketch: "upper",
                distance: 2,
                op: "new",
              }),
            ]
          : [
              sketch("lower", "a1"),
              ...rectangle("lower", 0, 0, 16, 8),
              extrude("lower-x", "a2", {
                sketch: "lower",
                distance: 0.9375,
                op: "new",
              }),
              sketch("upper", "a3", { base: "xy", offset }),
              ...rectangle("upper", 0, 0, 16, 8),
              extrude("upper-x", "a4", {
                sketch: "upper",
                distance,
                op: "new",
              }),
            ];
        const path = join(cwd, `${name}.jsonl`);
        writeFileSync(
          path,
          serializeDocument(document(elements, [CAD_TEST_PAGE])),
        );
        const result = Bun.spawnSync(
          [
            binary as string,
            "capture",
            path,
            "--view",
            view,
            "--size",
            "64x64",
            "--zoom",
            "1.08",
            "--fail-on-interference",
            "--output",
            `${name}.png`,
            "--force",
          ],
          { cwd },
        );
        expect(result.exitCode).toBe(status);
        expect(result.stdout.toString()).toContain(`interference: ${status}`);
      }
    } finally {
      rmSync(cwd, { recursive: true, force: true });
    }
  },
  30_000,
);

nativeTest(
  "native capture keeps a PCB board visible through an imported sheet",
  () => {
    const cwd = mkdtempSync(join(tmpdir(), "nodetto-sheet-"));
    try {
      const data = stlToInlineMesh(
        writeBinaryStl([
          {
            positions: new Float64Array([
              -5, -5, 5, 35, -5, 5, 35, 45, 5, -5, 45, 5,
            ]),
            triangles: new Uint32Array([0, 1, 2, 0, 2, 3]),
          },
        ]),
      );
      const path = join(cwd, "board-sheet.jsonl");
      writeFileSync(
        path,
        serializeDocument(
          document(
            [
              boardReference(),
              testBoard(1.2),
              edge("rim", { kind: "rect", start: [0, 0], end: [30, 40] }),
              cadElement("sheet", "cad.mesh", "a5", {
                name: "Cover sheet",
                data,
              }),
            ],
            [CAD_TEST_PAGE, PCB_TEST_PAGE],
          ),
        ),
      );
      const result = runCad(cwd, path, [
        "--view",
        "top",
        "--size",
        "64x64",
        "--zoom",
        "1.08",
      ]);
      expect(result.stdout).toContain("Controller board");
      expect(result.stdout).toContain("Cover sheet");
      const boardLine = result.stdout
        .split("\n")
        .find((line) => line.includes("Controller board"));
      const sheetLine = result.stdout
        .split("\n")
        .find((line) => line.includes("Cover sheet"));
      expect(boardLine).toBeDefined();
      expect(boardLine).not.toContain("hidden behind other bodies");
      expect(sheetLine).not.toContain("hidden behind other bodies");
    } finally {
      rmSync(cwd, { recursive: true, force: true });
    }
  },
  30_000,
);

nativeTest(
  "native interference finds a narrow pin and ignores a moved block",
  () => {
    const cwd = mkdtempSync(join(tmpdir(), "nodetto-cad-pairs-"));
    try {
      const path = join(cwd, "pairs.jsonl");
      const make = (x: number, pin: boolean) =>
        document(
          [
            sketch("base", "a1"),
            ...rectangle("base", 0, 0, 20, 20),
            cadElement("plate", "cad.extrude", "a2", {
              name: "Plate",
              sketch: "base",
              distance: 5,
              op: "new",
            }),
            sketch("other", "a3"),
            ...(pin
              ? [
                  cadElement("pin-circle", "cad.circle", "a1", {
                    sketch: "other",
                    c: [10, 10],
                    r: 0.75,
                  }),
                ]
              : rectangle("other", x, 0, 5, 5)),
            cadElement("other-body", "cad.extrude", "a4", {
              name: pin ? "Pin" : "Block",
              sketch: "other",
              distance: 5,
              op: "new",
            }),
          ],
          [CAD_TEST_PAGE],
        );
      writeFileSync(path, serializeDocument(make(30, false)));
      expect(runCad(cwd, path, ["--size", "320x240"]).stdout).toContain(
        "interference: 0",
      );
      writeFileSync(path, serializeDocument(make(0, true)));
      expect(runCad(cwd, path, ["--size", "320x240"]).stdout).toContain(
        "interference: 1",
      );
    } finally {
      rmSync(cwd, { recursive: true, force: true });
    }
  },
  30_000,
);

nativeTest(
  "native capture meets the 1000-element budget and checks stacked candidates",
  () => {
    const cwd = mkdtempSync(join(tmpdir(), "nodetto-cad-scale-"));
    try {
      const path = join(cwd, "scale.jsonl");
      const elements = Array.from({ length: 50 }, (_, i) => {
        const id = `profile-${i}`;
        return [
          sketch(id, "a1"),
          ...rectangle(id, i * 12, 0, 10, 10),
          ...Array.from({ length: 14 }, (_, j) =>
            cadElement(`${id}-circle-${j}`, "cad.circle", "a1", {
              sketch: id,
              c: [i * 12 + 1 + (j % 7), 2 + Math.floor(j / 7) * 4],
              r: 0.2,
            }),
          ),
          cadElement(`body-${i}`, "cad.extrude", "a2", {
            name: `Body ${i}`,
            sketch: id,
            distance: 2,
            op: "new",
          }),
        ];
      }).flat();
      expect(elements).toHaveLength(1000);
      writeFileSync(
        path,
        serializeDocument(document(elements, [CAD_TEST_PAGE])),
      );
      const start = performance.now();
      runCad(cwd, path, ["--size", "320x240", "--no-interference"]);
      const elapsed = performance.now() - start;
      mkdirSync(join(import.meta.dir, "../../../../tmp/capture/m23"), {
        recursive: true,
      });
      writeFileSync(
        join(import.meta.dir, "../../../../tmp/capture/m23/timing.json"),
        `${JSON.stringify({ milliseconds: elapsed })}\n`,
      );
      expect(elapsed).toBeLessThan(10_000);
      const stacked = Array.from({ length: 50 }, (_, i) => {
        const id = `stack-${i}`;
        return [
          sketch(id, "a1"),
          ...rectangle(id, 0, 0, 1, 1),
          cadElement(`solid-${i}`, "cad.extrude", "a2", {
            name: `Solid ${i}`,
            sketch: id,
            distance: 1,
            op: "new",
          }),
        ];
      }).flat();
      writeFileSync(
        path,
        serializeDocument(document(stacked, [CAD_TEST_PAGE])),
      );
      expect(runCad(cwd, path, ["--size", "320x240"]).stdout).toContain(
        "1225 candidate pairs checked",
      );
    } finally {
      rmSync(cwd, { recursive: true, force: true });
    }
  },
  60_000,
);

nativeTest(
  "native capture rejects shared cuts targeting an open mesh",
  () => {
    const cwd = mkdtempSync(join(tmpdir(), "nodetto-open-mesh-"));
    try {
      for (const fixture of ["triangle", "tetrahedron"] as const) {
        const data = readFileSync(
          new URL(
            `../../../../crates/capture/tests/fixtures/${fixture}.nmesh.txt`,
            import.meta.url,
          ),
          "utf8",
        ).trim();
        const cut = extrude("cut", "a5", {
          sketch: "opening",
          distance: 5,
          op: "cut",
          bodies: ["block", "mesh"],
        });
        const elements = [
          sketch("base", "a1"),
          ...rectangle("base", 0, 0, 10, 10),
          extrude("block", "a2", { sketch: "base", distance: 5, op: "new" }),
          cadElement("mesh", "cad.mesh", "a3", { name: fixture, data }),
          sketch("opening", "a4"),
          ...rectangle("opening", 2, 2, 2, 3),
          cut,
          sketch("face", "a6", { face: { feature: "cut", role: "end" } }),
        ];
        const twin = elements.map((element) =>
          element.id === "cut"
            ? { ...cut, semantic: { ...cut.semantic, suppressed: true } }
            : element,
        );
        const path = join(cwd, `${fixture}.jsonl`);
        const twinPath = join(cwd, `${fixture}-suppressed.jsonl`);
        writeFileSync(
          path,
          serializeDocument(document(elements, [CAD_TEST_PAGE])),
        );
        writeFileSync(
          twinPath,
          serializeDocument(document(twin, [CAD_TEST_PAGE])),
        );
        const actual = runCad(cwd, path, ["--size", "320x240"]);
        const suppressed = runCad(cwd, twinPath, ["--size", "320x240"]);
        if (fixture === "triangle") {
          expect(actual.stdout).toContain("cad.body.missing");
          expect(actual.stdout).toContain("cad.reference.failed");
          expect(actual.bytes).toEqual(suppressed.bytes);
        } else {
          expect(actual.bytes.equals(suppressed.bytes)).toBe(false);
        }
      }
    } finally {
      rmSync(cwd, { recursive: true, force: true });
    }
  },
  30_000,
);

nativeTest(
  "native capture admits the point boundary and rejects the first excess",
  () => {
    const cwd = mkdtempSync(join(tmpdir(), "nodetto-point-boundary-"));
    try {
      const positions = new Int32Array(20_000 * 3);
      for (let i = 0; i < 20_000; i++) {
        positions[i * 3] = i;
        positions[i * 3 + 1] = i % 2;
      }
      const triangles = new Uint32Array(20_001);
      for (let i = 0; i < 19_998; i++) triangles[i] = i;
      triangles.set([19_997, 19_998, 19_999], 19_998);
      const data = toInline(
        encodeNmesh({
          positions,
          triangles,
          groups: [{ faceId: 0, count: 6_667 }],
        }),
      );
      const meshes = Array.from({ length: 201 }, (_, i) => {
        const id = `mesh-${String(i).padStart(3, "0")}`;
        const mesh = cadElement(id, "cad.mesh", "a1", { name: id, data });
        return { ...mesh, visual: i === 0 ? {} : { hidden: true } };
      });
      const save = (name: string, count: number) => {
        const path = join(cwd, name);
        writeFileSync(
          path,
          serializeDocument(
            document(meshes.slice(0, count), [
              { id: "cad", name: "Mesh", kind: "cad3d" },
            ]),
          ),
        );
        return path;
      };
      const admitted = save("admitted.jsonl", 200);
      const overflow = save("overflow.jsonl", 201);
      const run = (path: string, output: string) => {
        const start = performance.now();
        const result = Bun.spawnSync(
          [
            binary as string,
            "capture",
            path,
            "--output",
            output,
            "--size",
            "64x64",
            "--no-interference",
          ],
          { cwd },
        );
        console.log(
          `point-boundary ${output}: ${Math.round(performance.now() - start)} ms`,
        );
        return result;
      };
      const accepted = run(admitted, "admitted.png");
      expect(accepted.exitCode).toBe(0);
      expect(accepted.stderr.toString()).toBe("");
      expect(accepted.stdout.toString()).toContain("bodies: 1 (mesh-000 ");
      const image = readFileSync(join(cwd, "admitted.png"));
      let fnv = 0xcbf29ce484222325n;
      for (const byte of image)
        fnv = BigInt.asUintN(64, (fnv ^ BigInt(byte)) * 0x100000001b3n);
      expect(fnv.toString(16).padStart(16, "0")).toBe("783ff56857da9294");
      expect(createHash("sha256").update(image).digest("hex")).toBe(
        "6dbaebe1560218804831f5a48b387414ae40a5bce4b4cc491b9081dc10ef4d99",
      );
      expect(image.subarray(0, 8)).toEqual(
        Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]),
      );
      const rejected = run(overflow, "overflow.png");
      expect(rejected.exitCode).toBe(2);
      expect(rejected.stderr.toString()).toContain(
        "Capture scene total point count must be an integer in 0..4000000.",
      );
      expect(existsSync(join(cwd, "overflow.png"))).toBe(false);
    } finally {
      rmSync(cwd, { recursive: true, force: true });
    }
  },
  600_000,
);

nativeTest(
  "native capture keeps the analysis hit of a cropped dense pair",
  () => {
    const cwd = mkdtempSync(join(tmpdir(), "nodetto-dense-pair-"));
    try {
      const positions: number[] = [];
      const triangles: number[] = [];
      const vertices = [
        0, 0, 0, 1, 0, 0, 1, 10, 0, 0, 10, 0, 0, 0, 10, 1, 0, 10, 1, 10, 10, 0,
        10, 10,
      ];
      const faces = [
        0, 2, 1, 0, 3, 2, 4, 5, 6, 4, 6, 7, 0, 1, 5, 0, 5, 4, 1, 2, 6, 1, 6, 5,
        2, 3, 7, 2, 7, 6, 3, 0, 4, 3, 4, 7,
      ];
      for (let i = 0; i < 512; i++) {
        for (let j = 0; j < vertices.length; j += 3) {
          positions.push(
            (vertices[j] ?? 0) + i * 2,
            vertices[j + 1] ?? 0,
            vertices[j + 2] ?? 0,
          );
        }
        triangles.push(...faces.map((index) => index + i * 8));
      }
      const data = toInline(
        encodeNmesh(
          canonicalize({
            positions: new Float64Array(positions),
            triangles: new Uint32Array(triangles),
          }),
        ),
      );
      const path = join(cwd, "dense.jsonl");
      writeFileSync(
        path,
        serializeDocument(
          document(
            [
              cadElement("first", "cad.mesh", "a0", { name: "First", data }),
              cadElement("second", "cad.mesh", "a1", { name: "Second", data }),
            ],
            [CAD_TEST_PAGE],
          ),
        ),
      );
      for (const json of [false, true]) {
        const result = Bun.spawnSync(
          [
            binary as string,
            "capture",
            path,
            "--view",
            "top",
            "--size",
            "64x64",
            "--target",
            "2000,2000,0",
            "--zoom",
            "10",
            "--fail-on-interference",
            "--output",
            "dense.png",
            "--force",
            ...(json ? ["--json"] : []),
          ],
          { cwd },
        );
        expect(result.exitCode).toBe(1);
        const output = result.stdout.toString();
        if (json) {
          const report = JSON.parse(output);
          expect(report.interference.pairs).toHaveLength(1);
          expect(report.interference.pairs[0]).toMatchObject({
            a: "first",
            b: "second",
            approximate: true,
            source: "analysis",
          });
          expect(report.interference.incomplete).toBeUndefined();
        } else {
          expect(output).toMatch(/First.*Second.*, approximate/m);
          expect(output).not.toContain("incomplete:");
          expect(output).not.toContain("(found in the picture only)");
        }
      }
    } finally {
      rmSync(cwd, { recursive: true, force: true });
    }
  },
  30_000,
);

function parityBox(
  x0: number,
  x1: number,
  y0: number,
  y1: number,
  z0: number,
  z1: number,
  crossed = false,
) {
  return {
    positions: Float64Array.from([
      x0,
      y0,
      z0,
      x1,
      y0,
      z0,
      x1,
      y1,
      z0,
      x0,
      y1,
      z0,
      x0,
      y0,
      z1,
      x1,
      y0,
      z1,
      x1,
      y1,
      z1,
      x0,
      y1,
      z1,
    ]),
    triangles: Uint32Array.from([
      0,
      2,
      1,
      0,
      3,
      2,
      4,
      5,
      6,
      4,
      6,
      7,
      0,
      1,
      5,
      0,
      5,
      4,
      1,
      2,
      6,
      1,
      6,
      5,
      2,
      3,
      7,
      2,
      7,
      6,
      ...(crossed ? [3, 0, 7, 0, 4, 7] : [3, 0, 4, 3, 4, 7]),
    ]),
  };
}

for (const kind of ["boss", "tall", "short"] as const) {
  nativeTest(
    `native imported STL ${kind} contact and penetration parity`,
    () => {
      const cwd = mkdtempSync(join(tmpdir(), "nodetto-native-contact-"));
      try {
        const short = kind === "short";
        const mesh = short
          ? parityBox(-32, 32, 0, 8, -4, 0)
          : parityBox(-1, 1, 0, 8, -35.25, 0);
        const data = stlToInlineMesh(writeBinaryStl([mesh]));
        for (const overlap of [false, true]) {
          const elements = [
            cadElement("mesh", "cad.mesh", "a0", { name: "Mesh", data }),
            sketch("upper-sketch", "a1", {
              base: "xy",
              offset: overlap ? -0.01 : 0,
            }),
            ...rectangle(
              "upper-sketch",
              short ? -32 : -1,
              0,
              short ? 64 : 2,
              kind === "boss" ? 10 : 8,
            ),
            extrude("upper", "a2", {
              sketch: "upper-sketch",
              distance: (short ? 4 : 156.75) + (overlap ? 0.01 : 0),
              op: "new",
            }),
            ...(kind === "boss"
              ? [
                  sketch("boss-sketch", "a3", { base: "xy", offset: -1 }),
                  ...rectangle("boss-sketch", -0.5, 8.5, 1, 1),
                  extrude("boss", "a4", {
                    sketch: "boss-sketch",
                    distance: 2,
                    op: "add",
                    bodies: ["upper"],
                  }),
                ]
              : []),
          ];
          const path = join(cwd, `${kind}-${overlap}.jsonl`);
          writeFileSync(
            path,
            serializeDocument(document(elements, [CAD_TEST_PAGE])),
          );
          for (const view of ["front", "back"]) {
            const args = [
              "capture",
              path,
              "--view",
              view,
              "--size",
              "64x64",
              ...(short ? ["--zoom", "1.08", "--target", "0,0,0.25"] : []),
              "--json",
              "--output",
              "result.png",
              "--force",
            ];
            const result = Bun.spawnSync(
              [binary as string, ...args, "--fail-on-interference"],
              { cwd },
            );
            expect(
              result.exitCode,
              `${kind} ${overlap} ${view}: ${result.stderr}`,
            ).toBe(overlap ? 1 : 0);
            const report = JSON.parse(result.stdout.toString()) as {
              interference: {
                pairs: { a: string; b: string }[];
                candidates: number;
              };
            };
            if (short) {
              const textArgs = args.filter((arg) => arg !== "--json");
              const textResult = Bun.spawnSync(
                [binary as string, ...textArgs, "--fail-on-interference"],
                { cwd },
              );
              expect(textResult.exitCode).toBe(overlap ? 1 : 0);
              expect(textResult.stdout.toString()).toContain(
                `interference: ${overlap ? 1 : 0}`,
              );
            }
            expect(report.interference.pairs).toHaveLength(overlap ? 1 : 0);
            if (overlap)
              expect(report.interference.pairs[0]).toMatchObject({
                a: "mesh",
                b: "upper",
              });
            if (!overlap) {
              if (kind === "tall")
                expect(report.interference.candidates).toBe(0);
              const image = readFileSync(join(cwd, "result.png"));
              const plain = Bun.spawnSync(
                [binary as string, ...args, "--no-interference"],
                { cwd },
              );
              expect(plain.exitCode).toBe(0);
              expect(readFileSync(join(cwd, "result.png"))).toEqual(image);
            }
          }
        }
      } finally {
        rmSync(cwd, { recursive: true, force: true });
      }
    },
    120_000,
  );
}

for (const kind of ["edge", "face", "crossed"] as const) {
  nativeTest(
    `native welded ${kind} shell cuts preserve through holes`,
    () => {
      const cwd = mkdtempSync(join(tmpdir(), "nodetto-native-welded-"));
      try {
        const data = stlToInlineMesh(
          writeBinaryStl([
            parityBox(0, 10, 0, 10, 0, 5),
            parityBox(
              10,
              20,
              kind === "edge" ? 10 : 0,
              kind === "edge" ? 20 : 10,
              0,
              5,
              kind === "face",
            ),
          ]),
        );
        const base = [
          cadElement("mesh", "cad.mesh", "a0", { name: "Mesh", data }),
          sketch("base", "a1", { base: "xy", offset: 5 }),
          ...rectangle("base", 0, 0, 10, 10),
          extrude("plate", "a2", { sketch: "base", distance: 5, op: "new" }),
          sketch("opening", "a3"),
          ...rectangle("opening", 1, 1, 2, 2),
        ];
        const captures = [false, true].map((cut) => {
          const elements = cut
            ? [
                ...base,
                extrude("cut", "a4", {
                  sketch: "opening",
                  distance: 10,
                  op: "cut",
                  bodies: ["mesh", "plate"],
                }),
              ]
            : base;
          const path = join(cwd, `${kind}-${cut}.jsonl`);
          writeFileSync(
            path,
            serializeDocument(document(elements, [CAD_TEST_PAGE])),
          );
          return runCad(
            cwd,
            path,
            ["--view", "top", "--size", "160x160", "--json"],
            `${kind}-${cut}.png`,
          );
        });
        const uncut = captures[0];
        const cut = captures[1];
        if (!uncut || !cut) throw new Error("Missing captures");
        const report = JSON.parse(cut.stdout) as {
          camera: { mmPerPixel: number };
          bodies: { id: string; open: boolean }[];
          errors: { code: string }[];
        };
        expect(
          report.errors.some((error) => error.code === "cad.body.missing"),
        ).toBe(false);
        expect(report.bodies.find((body) => body.id === "mesh")?.open).toBe(
          false,
        );
        expect(report.camera.mmPerPixel).toBeLessThanOrEqual(0.25);
        expect(cut.bytes).not.toEqual(uncut.bytes);
        const a = cadPixels(uncut);
        const b = cadPixels(cut);
        const background = [0xf6, 0xf4, 0xee];
        expect(b.world([2, 2, 10])).toEqual(background);
        expect(a.world([2, 2, 10])).not.toEqual(background);
        for (const point of [
          [6, 6, 10],
          kind === "edge" ? ([15, 15, 5] as const) : ([15, 5, 5] as const),
        ] as const) {
          expect(a.world(point)).not.toEqual(background);
          expect(b.world(point)).not.toEqual(background);
        }
      } finally {
        rmSync(cwd, { recursive: true, force: true });
      }
    },
    120_000,
  );
}
