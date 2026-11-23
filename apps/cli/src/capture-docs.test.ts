import { expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { Editor } from "@nodetto/core";
import { capturePlateDocument } from "../../../packages/core/src/capture/testing/plate.ts";
import { serializeDocument } from "@nodetto/io";
import { captureCommand, type CaptureBackend } from "./capture-command.ts";
import { CAPTURE_HELP } from "./capture-help.ts";
import type { CommandIo } from "./commands.ts";

const guide = readFileSync(
  new URL("../../../docs/capture.md", import.meta.url),
  "utf8",
);
const cli = readFileSync(
  new URL("../../../docs/cli.md", import.meta.url),
  "utf8",
);
const ijg =
  "This software is based in part on the work of the Independent JPEG Group.";

test("capture guide and help cover the contract", () => {
  const usage = CAPTURE_HELP.split("\n\n")[0] ?? "";
  for (const option of new Set(usage.match(/--[a-z-]+/g)))
    expect(guide).toContain(option);
  for (const term of [
    "orthographic",
    "--view",
    "--eye",
    "interference",
    "cell",
    "approximate",
    "hatch",
    "--fail-on-interference",
    "## Exit codes",
    "nodetto_capture",
    "--inline",
    "3D view image",
    "Current view",
    "## Measured budgets",
    ijg,
  ])
    expect(guide).toContain(term);
  const exit = CAPTURE_HELP.match(/Exit codes:[\s\S]*?errors\./)?.[0] ?? "";
  for (const term of ["0", "1", "2", "--fail-on-interference"])
    expect(exit).toContain(term);
  expect(CAPTURE_HELP).toContain("docs/capture.md");
  expect(cli).toContain("(capture.md)");
  expect(cli.indexOf("nodetto-cli capture flow.jsonl")).toBeGreaterThan(-1);
  expect(cli.indexOf("nodetto-cli capture flow.jsonl")).toBeLessThan(
    cli.indexOf("nodetto-cli export flow.jsonl --page Flow"),
  );
});

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

test("fenced capture examples execute", async () => {
  const section = cli.split("## Capturing page images")[1] ?? "";
  const lines = [guide, section].flatMap((text) =>
    [...text.matchAll(/```[^\n]*\n([\s\S]*?)```/g)].flatMap((match) =>
      (match[1] ?? "")
        .split("\n")
        .filter((line) => line.startsWith("nodetto-cli capture ")),
    ),
  );
  expect(lines.length).toBeGreaterThanOrEqual(4);
  for (const line of lines) {
    const command = line.replace(/\s+#.*$/, "");
    expect(command).not.toMatch(/["']/);
    const args = command.split(/\s+/).slice(2);
    const editor = new Editor();
    editor.createElement("shape.geo", {
      semantic: { geo: "rect", label: "" },
      visual: { x: 0, y: 0, width: 100, height: 100 },
    });
    const doc =
      args[0] === "plate.jsonl" ? capturePlateDocument() : editor.getSnapshot();
    const io: CommandIo = {
      readText: () => serializeDocument(doc),
      writeText: () => {
        throw new Error("unexpected text write");
      },
      capture: {
        absolute: (path) => `/workspace/${path}`,
        digest: () => "fedcba9876543210",
        dir: () => "private",
        write: () => "written",
      },
    };
    const backend: CaptureBackend = {
      async rasterize() {
        return png;
      },
      transcode() {
        return png;
      },
      renderSolid(scene) {
        const view = new DataView(
          scene.buffer,
          scene.byteOffset,
          scene.byteLength,
        );
        return {
          image: png,
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
    const result = await captureCommand(io, args, backend);
    expect(result.exitCode).toBe(0);
    expect(result.stderr).not.toContain("Usage: nodetto-cli capture");
  }
});
