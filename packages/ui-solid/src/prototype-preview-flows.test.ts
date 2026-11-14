import { expect, test } from "bun:test";
import { existsSync } from "node:fs";
import { createRequire } from "node:module";
import { execFile } from "node:child_process";
import { promisify } from "node:util";

test("presentation flows, hints, back, overlays and persistent layers in browser", async () => {
  const chrome =
    process.env.CHROME_PATH ??
    Bun.which("chromium") ??
    Bun.which("google-chrome") ??
    (existsSync("/Applications/Google Chrome.app/Contents/MacOS/Google Chrome")
      ? "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome"
      : undefined);
  if (!chrome)
    throw new Error("Chrome or Chromium is required; set CHROME_PATH");
  const root = process.cwd();
  const require = createRequire(`${root}/apps/desktop/package.json`);
  const { createServer } = require("vite");
  const solid = require("vite-plugin-solid");
  const html = `<!doctype html><html><body><main id="app"></main><output id="result">pending</output><script type="module">
    import { render } from "solid-js/web";
    import { Editor, connectPrototypeBack, prototypeScreen } from "@nodetto/core";
    import { PrototypePreview } from "/@fs/${root}/packages/ui-solid/src/PrototypePreview.tsx";
    try {
      const editor = new Editor();
      const frame = (name, x, start) => editor.createElement("frame", {
        semantic: { name, screenKind: "screen", ...(start ? {prototypeStart: true, prototypeFlowName: name} : {}) },
        visual: { x, y: 0, width: 200, height: 400 }
      });
      const a = frame("A", 0, true), b = frame("B", 500, true);
      const overlay1 = frame("Overlay1", 1500, false), overlay2 = frame("Overlay2", 2000, false);
      const fixed = x => editor.createElement("shape.geo", {visual: {x, y: 350, width: 180, height: 30, prototypeFixed: true, layerName: "tabs"}});
      fixed(10); fixed(510);
      const hotspot = (x, y, label) => editor.createElement("shape.geo", {visual: {x, y, width: 40, height: 40}, ...(label ? {accessibility: {label}} : {})});
      const forward = hotspot(20, 20), back = hotspot(520, 20, "back link"), open = hotspot(520, 80), swap = hotspot(1520, 20);
      const link = (from, to, label, action, transition = "instant") => editor.createElement("edge.generic", {
        semantic: {from, to, label, prototype: true, prototypeAction: action, prototypeTransition: transition, prototypeDuration: 4000}
      });
      link(forward, b, "forward", "navigate", "slide-left");
      const backLink = connectPrototypeBack(editor, back);
      link(open, overlay1, "open", "open-overlay");
      const swapLink = link(swap, overlay2, "swap", "swap-overlay");
      const invalidSwap = link(open, overlay2, "invalid swap", "swap-overlay");
      const invalidElement = editor.store.get(invalidSwap);
      editor.store.commit({update: [{...invalidElement, semantic: {...invalidElement.semantic, to: forward}}]});
      const backExposed = prototypeScreen(editor, b).links.some(item => item.id === backLink && item.action === "back");
      const swapExposed = prototypeScreen(editor, overlay1).links.some(item => item.id === swapLink && item.action === "swap-overlay");
      const invalidExcluded = !prototypeScreen(editor, b).links.some(item => item.id === invalidSwap);
      render(() => PrototypePreview({editor, onClose: () => {}}), document.querySelector("#app"));
      const click = label => document.querySelector('button[aria-label="' + label + '"]')?.click();
      const current = () => document.querySelector('select[aria-label="Preview screen"]').value;
      const flow = document.querySelector('select[aria-label="Preview flow"]');
      flow.value = "B"; flow.dispatchEvent(new Event("change", {bubbles: true}));
      const selectedFlow = current() === b;
      flow.value = "A"; flow.dispatchEvent(new Event("change", {bubbles: true}));
      document.querySelector('[data-prototype-active-surface="true"]').dispatchEvent(new PointerEvent("pointerdown", {bubbles:true, button:0, isPrimary:true}));
      const hints = document.querySelector("dialog").classList.contains("nodetto-prototype-show-hotspots");
      click("forward");
      const persistent = !!document.querySelector('[data-prototype-persistent="true"]') && !!document.querySelector('.nodetto-prototype-persistent-hidden');
      const navigated = current() === b;
      const backExists = !!document.querySelector('button[aria-label="back link"]');
      click("back link");
      const backWorks = current() === a;
      const historyEmpty = [...document.querySelectorAll("button")].find(button => button.textContent.trim() === "Back")?.disabled === true;
      flow.value = "B"; flow.dispatchEvent(new Event("change", {bubbles: true}));
      click("open");
      const opened = document.querySelectorAll('[data-prototype-overlay]').length === 1;
      const invalidHotspotAbsent = !document.querySelector('button[aria-label="invalid swap"]');
      const swapExists = !!document.querySelector('button[aria-label="swap"]');
      click("swap");
      const swapped = document.querySelectorAll('[data-prototype-overlay]').length === 1 && !!document.querySelector('[aria-label="Overlay2"]') && !document.querySelector('[aria-label="Overlay1"]');
      document.querySelector("#result").textContent = JSON.stringify({selectedFlow,hints,persistent,navigated,backExists,backWorks,historyEmpty,backExposed,swapExposed,invalidExcluded,invalidHotspotAbsent,opened,swapExists,swapped});
    } catch (error) { document.querySelector("#result").textContent = "error: " + (error.stack || error); }
  </script></body></html>`;
  const server = await createServer({
    configFile: false,
    root: `${root}/apps/desktop`,
    cacheDir: `${root}/tmp/ipd-s772/ipd-19-desktop-presentation/browser-test/vite-cache`,
    optimizeDeps: { noDiscovery: true, include: [] },
    plugins: [
      solid(),
      {
        name: "presentation-test-page",
        configureServer(vite: {
          transformIndexHtml: (url: string, html: string) => Promise<string>;
          middlewares: {
            use: (
              fn: (
                req: { url?: string },
                res: {
                  setHeader: (name: string, value: string) => void;
                  end: (body: string) => void;
                },
                next: () => void,
              ) => void,
            ) => void;
          };
        }) {
          vite.middlewares.use((req, res, next) => {
            if (req.url !== "/presentation-test") return next();
            res.setHeader("Content-Type", "text/html");
            void vite
              .transformIndexHtml("/presentation-test", html)
              .then((body: string) => res.end(body));
          });
        },
      },
    ],
    server: { host: "127.0.0.1", port: 0, watch: null },
    appType: "custom",
  });
  try {
    await server.listen();
    const port = server.httpServer.address().port;
    const { stdout } = await promisify(execFile)(
      chrome,
      [
        "--headless",
        "--disable-gpu",
        "--no-first-run",
        `--user-data-dir=${root}/tmp/ipd-s772/ipd-19-desktop-presentation/browser-test/chrome-profile`,
        "--virtual-time-budget=1000",
        "--dump-dom",
        `http://127.0.0.1:${port}/presentation-test`,
      ],
      { timeout: 30000, maxBuffer: 4 * 1024 * 1024 },
    );
    const result = stdout.match(/<output id="result">([^<]*)<\/output>/)?.[1];
    expect(result).toBe(
      '{"selectedFlow":true,"hints":true,"persistent":true,"navigated":true,"backExists":true,"backWorks":true,"historyEmpty":true,"backExposed":true,"swapExposed":true,"invalidExcluded":true,"invalidHotspotAbsent":true,"opened":true,"swapExists":true,"swapped":true}',
    );
  } finally {
    await server.close();
  }
}, 40000);
