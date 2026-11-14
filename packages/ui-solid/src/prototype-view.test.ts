import { expect, test } from "bun:test";
import { Editor } from "@nodetto/core";
import type { InteractionContext } from "./interaction/context.ts";

test("prototype overlay draws compact geometry, back tags and flow flags", async () => {
  const { createRequire } = await import("node:module");
  const root = process.cwd();
  const require = createRequire(`${root}/apps/desktop/package.json`);
  const { createServer } = require("vite");
  const solid = require("vite-plugin-solid");
  const server = await createServer({
    configFile: false,
    root: `${root}/apps/desktop`,
    cacheDir: `${root}/tmp/ipd-s772/ipd-18-desktop-prototype-view/vite-cache`,
    optimizeDeps: { noDiscovery: true, include: [] },
    plugins: [solid({ ssr: true })],
    server: { middlewareMode: true, watch: null },
    appType: "custom",
  });
  try {
    const { PrototypeViewLayer } = await server.ssrLoadModule(
      `${root}/packages/ui-solid/src/PrototypeViewLayer.tsx`,
    );
    const { renderToString } = await server.ssrLoadModule("solid-js/web");
    const editor = new Editor();
    const start = editor.createElement("frame", {
      semantic: {
        name: "Start",
        screenKind: "screen",
        prototypeStart: true,
        prototypeFlowName: "Main flow",
      },
      visual: { x: 0, y: 0, width: 200, height: 400 },
    });
    const target = editor.createElement("frame", {
      semantic: { name: "Target", screenKind: "screen" },
      visual: { x: 500, y: 0, width: 200, height: 400 },
    });
    const hotspot = editor.createElement("shape.geo", {
      visual: { x: 20, y: 40, width: 80, height: 40 },
    });
    const link = editor.createElement("edge.generic", {
      semantic: {
        from: hotspot,
        to: target,
        prototype: true,
        prototypeTransition: "fade",
      },
    });
    const back = editor.createElement("edge.generic", {
      semantic: {
        from: hotspot,
        to: start,
        prototype: true,
        prototypeAction: "back",
      },
    });
    const { NodettoCanvas } = await server.ssrLoadModule(
      `${root}/packages/ui-solid/src/Canvas.tsx`,
    );
    const design: string = renderToString(() =>
      NodettoCanvas({
        editor,
        tool: "select",
        snap: { grid: false, objects: false },
        showGrid: false,
      }),
    );
    expect(design).not.toContain('class="nodetto-connector"');
    const html: string = renderToString(() =>
      PrototypeViewLayer({ editor, revision: () => 0, onSelect: () => {} }),
    );
    expect(html).toContain(`data-prototype-link="${link}"`);
    expect(html).toContain('d="M 100 60 C');
    expect(html).toMatch(/<rect[^>]*fill="white"/);
    expect(html).toContain(">fade</text>");
    expect(html).toContain(`data-prototype-link="${back}"`);
    expect(html).toContain(">back</text>");
    expect(html).toContain('data-prototype-flow="Main flow"');
    expect(html).toContain(">Main flow</text>");
  } finally {
    await server.close();
  }
});

test("design hit testing ignores prototype links and preserves underlying shapes", async () => {
  const { createHitTesting } = await import("./interaction/hit-testing.ts");
  const { isPrototypeEdge, prototypeViewState } = await import(
    "./shortcuts.ts"
  );
  const editor = new Editor();
  const shape = editor.createElement("shape.geo", {
    visual: { x: 0, y: 0, width: 100, height: 100 },
  });
  const other = editor.createElement("frame", {
    visual: { x: 300, y: 0, width: 100, height: 100 },
  });
  const link = editor.createElement("edge.generic", {
    semantic: { from: shape, to: other, prototype: true },
  });
  const element = editor.store.get(link);
  expect(element && isPrototypeEdge(element)).toBe(true);
  expect(prototypeViewState(editor).view()).toBe(false);
  const ctx = {
    editor,
    isPcbPage: () => false,
  } as unknown as InteractionContext;
  const hit = createHitTesting(ctx);
  expect(hit.canvasHitTest({ x: 50, y: 50 })).toBe(shape);
  expect(
    hit.elementsIn({ x: -10, y: -10, width: 500, height: 200 }),
  ).not.toContain(link);
  expect(hit.edgeLabelAt({ x: 200, y: 50 }, link)).toBeNull();
});
