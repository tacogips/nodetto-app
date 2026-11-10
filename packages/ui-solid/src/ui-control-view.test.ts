import { expect, test } from "bun:test";
import { createRequire } from "node:module";

test("canvas control renders alignment, tab paint, icons and badges", async () => {
  const root = process.cwd();
  const require = createRequire(`${root}/apps/desktop/package.json`);
  const { createServer } = require("vite");
  const solid = require("vite-plugin-solid");
  const server = await createServer({
    configFile: false,
    root: `${root}/apps/desktop`,
    cacheDir: `${root}/tmp/ipd-s772/ipd-12-controls/vite-cache`,
    optimizeDeps: { noDiscovery: true, include: [] },
    plugins: [solid({ ssr: true })],
    server: { middlewareMode: true, watch: null },
    appType: "custom",
  });
  try {
    const { UiControlView } = await server.ssrLoadModule(
      `${root}/packages/ui-solid/src/shapes/UiControlView.tsx`,
    );
    const { renderToString } = await server.ssrLoadModule("solid-js/web");
    const render = (semantic: object, style: object) =>
      renderToString(() =>
        UiControlView({
          element: {
            id: "control",
            type: "ui.control",
            semantic,
            visual: { x: 0, y: 0, width: 200, height: 40, style },
          },
        }),
      );
    const button: string = render(
      { control: "button", label: "Read", leadingIcon: "bell", badge: "3" },
      { textAlign: "start" },
    );
    expect(button).toContain("text-align:start");
    expect(button).toContain("nodetto-control-icon-leading");
    expect(button).toContain("left:12px");
    expect(button).toContain("nodetto-control-badge");
    const tabs: string = render(
      {
        control: "tabs",
        label: "Tabs",
        options: ["A", "B"],
        indicator: "underline",
      },
      { accentColor: "#e0531f" },
    );
    expect(tabs).toContain("--nd-control-accent:#e0531f");
    expect(tabs).toContain('data-indicator="underline"');
    const progress: string = render(
      { control: "progress", label: "Progress", progress: 50 },
      { fill: "#ffffff" },
    );
    expect(progress).toContain("--nd-control-progress-fill:#ffffff");
    const bordered: string = render(
      { control: "button", label: "Border" },
      { stroke: "red", strokeSides: { left: 4 }, cornerRadius: 8 },
    );
    expect(bordered).toContain('id="nd-strokes-control"');
    expect(bordered).toContain('width="4"');
    expect(bordered).toContain('fill="red"');
  } finally {
    await server.close();
  }
});
