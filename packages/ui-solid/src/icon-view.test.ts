import { expect, test } from "bun:test";
import { iconViewMarkup } from "./shapes/IconView.tsx";
const element = (icon: string) => ({
  id: "icon",
  page: "page",
  index: "a1",
  type: "ui.icon" as const,
  semantic: { icon },
  visual: { width: 24, height: 24 },
});
test("named icons render vector geometry", () => {
  expect(iconViewMarkup(element("bell"))).toMatch(/<(path|circle)/);
});
test("unknown icon renders dashed placeholder", () => {
  expect(iconViewMarkup(element("unknown-icon-name"))).toContain(
    "stroke-dasharray",
  );
});

test("IconView renders its geometry in SVG", async () => {
  const { createRequire } = await import("node:module");
  const root = process.cwd();
  const require = createRequire(`${root}/apps/desktop/package.json`);
  const { createServer } = require("vite");
  const solid = require("vite-plugin-solid");
  const server = await createServer({
    configFile: false,
    root: `${root}/apps/desktop`,
    cacheDir: `${root}/tmp/ipd-s772/ipd-10-icon-desktop/vite-cache`,
    optimizeDeps: { noDiscovery: true, include: [] },
    plugins: [solid({ ssr: true })],
    server: { middlewareMode: true, watch: null },
    appType: "custom",
  });
  try {
    const { IconView } = await server.ssrLoadModule(
      `${root}/packages/ui-solid/src/shapes/IconView.tsx`,
    );
    const { renderToString } = await server.ssrLoadModule("solid-js/web");
    expect(
      renderToString(() => IconView({ element: element("bell") })),
    ).toMatch(/<(path|circle)/);
    expect(
      renderToString(() => IconView({ element: element("unknown-icon-name") })),
    ).toContain("stroke-dasharray");
  } finally {
    await server.close();
  }
});
