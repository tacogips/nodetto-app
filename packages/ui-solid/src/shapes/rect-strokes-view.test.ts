import { expect, test } from "bun:test";
import { createRequire } from "node:module";
import { rectStrokeParts } from "@nodetto/core";
import { geoLabelAlignStyle } from "./label-align-style.ts";

test("canvas stroke parts and label padding match shared geometry", () => {
  const parts = rectStrokeParts(
    { x: 0, y: 0, width: 100, height: 40 },
    { strokeSides: { left: 4 }, cornerRadius: 12 },
  );
  expect(parts?.strips).toEqual([{ x: 0, y: 0, width: 4, height: 40 }]);
  expect(parts?.clipBox).toEqual({ x: 0, y: 0, width: 100, height: 40 });
  expect(geoLabelAlignStyle({ textPadding: 0 }, 40, 1, 12)).toEqual({
    padding: "0 0px",
  });
});

test("RectStrokes renders a rounded clip and painted side strip", async () => {
  const root = process.cwd();
  const require = createRequire(`${root}/apps/desktop/package.json`);
  const { createServer } = require("vite");
  const solid = require("vite-plugin-solid");
  const server = await createServer({
    configFile: false,
    root: `${root}/apps/desktop`,
    cacheDir: `${root}/tmp/ipd-s772/ipd-06-geo-strokes/vite-cache`,
    optimizeDeps: { noDiscovery: true, include: [] },
    plugins: [solid({ ssr: true })],
    server: { middlewareMode: true, watch: null },
    appType: "custom",
  });
  try {
    const { RectStrokes } = await server.ssrLoadModule(
      `${root}/packages/ui-solid/src/shapes/RectStrokes.tsx`,
    );
    const { renderToString } = await server.ssrLoadModule("solid-js/web");
    const output: string = renderToString(() =>
      RectStrokes({
        box: { x: 0, y: 0, width: 100, height: 40 },
        style: { strokeSides: { left: 4 }, cornerRadius: 12 },
        clipId: "clip-a",
        fill: "white",
        stroke: "black",
      }),
    );
    expect(output).toContain("<clipPath");
    expect(output).toContain('id="clip-a"');
    expect(output).toContain('clip-path="url(#clip-a)"');
    expect(output).toContain("Q 0 0 12 0");
    expect(output.match(/<rect\b/g)).toHaveLength(1);
    expect(output).toMatch(
      /<rect[^>]*width="4"[^>]*height="40"[^>]*fill="black"[^>]*stroke="none"/,
    );
    expect(output).not.toContain("stroke-width=");
  } finally {
    await server.close();
  }
});
