import { expect, test } from "bun:test";
import { searchIcons } from "@nodetto/core";
import { pickerKey } from "./IconPicker.tsx";
test("search and keyboard select bell and close", () => {
  const names = searchIcons("bell", 120);
  expect(names[0]).toBe("bell");
  let selected = "";
  let closed = false;
  const pick = (name: string) => {
    selected = name;
  };
  const close = () => {
    closed = true;
  };
  pickerKey("Enter", 0, names, pick, close);
  expect(selected).toBe("bell");
  pickerKey("Escape", 0, names, pick, close);
  expect(closed).toBe(true);
  expect(pickerKey("ArrowRight", 0, names, pick, close)).toBe(1);
});

test("picker responds to typing and keyboard events in the browser", async () => {
  const { createRequire } = await import("node:module");
  const { execFile } = await import("node:child_process");
  const { promisify } = await import("node:util");
  const { existsSync } = await import("node:fs");
  const macChrome =
    "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome";
  const chrome =
    process.env.CHROME_PATH ??
    Bun.which("chromium") ??
    Bun.which("google-chrome") ??
    (existsSync(macChrome) ? macChrome : undefined);
  if (!chrome)
    throw new Error(
      "Chrome or Chromium is required for the picker browser test; set CHROME_PATH",
    );
  const root = process.cwd();
  const require = createRequire(`${root}/apps/desktop/package.json`);
  const { createServer } = require("vite");
  const solid = require("vite-plugin-solid");
  const html = `<!doctype html><html><body><main id="app"></main><output id="result">pending</output><script type="module">
    import { render } from "solid-js/web";
    import { IconPicker } from "/@fs/${root}/packages/ui-solid/src/IconPicker.tsx";
    let picked = "", closed = false;
    render(() => IconPicker({onPick: name => picked = name, onClose: () => closed = true}), document.querySelector("#app"));
    const input = document.querySelector('input[aria-label="Search icons"]');
    input.value = "bell"; input.dispatchEvent(new Event("input", {bubbles:true}));
    const first = document.querySelector(".nodetto-icon-grid button")?.getAttribute("aria-label");
    input.dispatchEvent(new KeyboardEvent("keydown", {key:"Enter", bubbles:true}));
    input.dispatchEvent(new KeyboardEvent("keydown", {key:"Escape", bubbles:true}));
    document.querySelector("#result").textContent = JSON.stringify({first, picked, closed});
  </script></body></html>`;
  const server = await createServer({
    configFile: false,
    root: `${root}/apps/desktop`,
    cacheDir: `${root}/tmp/ipd-s772/ipd-10-icon-desktop/vite-browser-cache`,
    optimizeDeps: { noDiscovery: true, include: [] },
    plugins: [
      solid(),
      {
        name: "picker-test-page",
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
            if (req.url !== "/picker-test") return next();
            res.setHeader("Content-Type", "text/html");
            void vite
              .transformIndexHtml("/picker-test", html)
              .then((body) => res.end(body));
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
        `--user-data-dir=${root}/tmp/ipd-s772/ipd-10-icon-desktop/chrome-profile`,
        "--virtual-time-budget=10000",
        "--dump-dom",
        `http://127.0.0.1:${port}/picker-test`,
      ],
      { timeout: 30000, maxBuffer: 4 * 1024 * 1024 },
    );
    expect(stdout).toContain('{"first":"bell","picked":"bell","closed":true}');
  } finally {
    await server.close();
  }
}, 40000);
