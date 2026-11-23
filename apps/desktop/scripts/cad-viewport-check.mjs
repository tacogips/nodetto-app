// Runs the real CAD worker and viewport against the desktop production CSP.
import { mkdir, mkdtemp, rm } from "node:fs/promises";
import { basename, extname, resolve, sep } from "node:path";
import { build } from "vite";

const desktop = resolve(import.meta.dir, "..");
const repository = resolve(desktop, "../..");
const args = process.argv.slice(2);
const labelIndex = args.indexOf("--label");
const label = labelIndex < 0 ? "m19" : args[labelIndex + 1];
if (!label || !/^[a-z0-9][a-z0-9_-]*$/i.test(label))
  throw new Error("--label must be a directory name");
const output = resolve(repository, "tmp/cad3d", label);
const dist = resolve(output, "viewport-dist");
const serveOnly = args.includes("--serve-only");
const wkwebview = args.includes("--wkwebview");
const entry = "scripts/fixtures/cad-viewport.html";
const chromeBinary =
  process.env.CHROME_BIN ??
  "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome";
const customPort = Number(process.env.CDP_PORT ?? 0);
if (!Number.isInteger(customPort) || customPort < 0 || customPort > 65535)
  throw new Error("CDP_PORT must be a valid port number");
const contentTypes = {
  ".html": "text/html; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".wasm": "application/wasm",
};
const errors = [];
const policyViolations = [];
const report = { assertions: {}, errors, policyViolations };
await mkdir(output, { recursive: true });

function assert(name, condition, detail) {
  report.assertions[name] = Boolean(condition);
  if (!condition) console.error(`${name}: ${detail ?? "failed"}`);
}

async function retry(check, message, attempts = 150) {
  for (let i = 0; i < attempts; i++) {
    const value = await check();
    if (value) return value;
    await Bun.sleep(100);
  }
  throw new Error(message);
}

let server;
let profile;
let chrome;
let chromeLog;
let ws;
try {
  const config = await Bun.file(
    resolve(desktop, "src-tauri/tauri.conf.json"),
  ).json();
  const csp = config.app.security.csp;
  if (typeof csp !== "string" || csp.length === 0)
    throw new Error("The desktop production CSP is missing");
  report.csp = csp;

  await build({
    root: desktop,
    configFile: resolve(desktop, "vite.config.ts"),
    build: {
      outDir: dist,
      emptyOutDir: true,
      rollupOptions: { input: resolve(desktop, entry) },
    },
  });

  server = Bun.serve({
    hostname: "127.0.0.1",
    port: 0,
    async fetch(request) {
      const pathname = new URL(request.url).pathname;
      const filePath = resolve(dist, `.${pathname}`);
      if (!filePath.startsWith(dist + sep))
        return new Response("Not found", { status: 404 });
      const file = Bun.file(filePath);
      if (!(await file.exists()))
        return new Response("Not found", { status: 404 });
      return new Response(file, {
        headers: {
          "Content-Security-Policy": csp,
          "Content-Type":
            contentTypes[extname(filePath)] ?? "application/octet-stream",
        },
      });
    },
  });

  const fixtureUrl = new URL(entry, server.url).href;
  if (serveOnly) {
    console.log(fixtureUrl);
    for await (const _ of Bun.stdin.stream()) {
      // EOF ends the server lifetime.
    }
  } else if (wkwebview) {
    const child = Bun.spawn(
      [
        "swift",
        "-module-cache-path",
        resolve(output, "swift-modules"),
        resolve(import.meta.dir, "cad-wkwebview-check.swift"),
        fixtureUrl,
        resolve(output, "wkwebview.json"),
      ],
      { stdout: "inherit", stderr: "inherit" },
    );
    process.exitCode = await child.exited;
  } else {
    await checkChrome(fixtureUrl);
  }
} catch (error) {
  report.failure = String(error);
  console.error(error);
  process.exitCode = 1;
} finally {
  ws?.close();
  if (chrome) {
    chrome.kill();
    report.chromeExitCode = await chrome.exited;
    await Bun.write(resolve(output, "chrome.log"), await chromeLog);
  }
  server?.stop(true);
  if (profile) await rm(profile, { recursive: true, force: true });
  if (!serveOnly && !wkwebview) {
    const result = resolve(output, "viewport-check.json");
    await Bun.write(result, `${JSON.stringify(report, null, 2)}\n`);
    console.log(`CAD viewport report: ${result}`);
  }
}

async function checkChrome(fixtureUrl) {
  if (customPort !== 0) {
    const url = `http://127.0.0.1:${customPort}/json/version`;
    const existing = await fetch(url, {
      signal: AbortSignal.timeout(1000),
    }).catch(() => undefined);
    if (existing) throw new Error(`CDP port ${customPort} is already in use`);
  }
  profile = await mkdtemp(resolve(output, "chrome-"));
  const headless =
    basename(chromeBinary).includes("headless_shell") ||
    basename(chromeBinary).includes("headless-shell");
  chrome = Bun.spawn(
    [
      chromeBinary,
      ...(headless ? [] : ["--headless=new"]),
      `--remote-debugging-port=${customPort}`,
      `--user-data-dir=${profile}`,
      "--no-first-run",
      "--no-default-browser-check",
      // An external worktree sandbox on macOS can prevent Chrome from
      // installing a nested sandbox. Only opt out when the caller requests it.
      ...(process.env.CAD_CHROME_OUTER_SANDBOX === "1" ? ["--no-sandbox"] : []),
      "--disable-breakpad",
      "--disable-crash-reporter",
      "--enable-unsafe-swiftshader",
      "--window-size=1000,800",
      "about:blank",
    ],
    { stdout: "ignore", stderr: "pipe" },
  );
  chromeLog = new Response(chrome.stderr).text();

  const debuggerPort =
    customPort ||
    (await retry(async () => {
      if (chrome.exitCode !== null)
        throw new Error(`Chrome exited ${chrome.exitCode}`);
      const portFile = Bun.file(resolve(profile, "DevToolsActivePort"));
      return (
        (await portFile.exists()) &&
        Number((await portFile.text()).split("\n")[0])
      );
    }, "Chrome did not announce its CDP port"));

  const tab = await retry(async () => {
    try {
      const pages = await (
        await fetch(`http://127.0.0.1:${debuggerPort}/json/list`)
      ).json();
      return pages.find(({ type }) => type === "page");
    } catch {
      if (chrome.exitCode !== null)
        throw new Error(`Chrome exited ${chrome.exitCode}`);
      return undefined;
    }
  }, "Chrome did not expose a tab");
  ws = new WebSocket(tab.webSocketDebuggerUrl);
  await new Promise((done, reject) => {
    ws.onopen = done;
    ws.onerror = reject;
  });
  const pending = new Map();
  let id = 0;
  ws.onclose = () => {
    for (const callback of pending.values())
      callback({ error: "Chrome disconnected" });
    pending.clear();
  };
  ws.onmessage = ({ data }) => {
    const message = JSON.parse(data);
    if (message.method === "Runtime.exceptionThrown") {
      const details = message.params.exceptionDetails;
      errors.push(details.exception?.description ?? details.text);
    }
    if (
      message.method === "Log.entryAdded" &&
      message.params.entry.source === "security"
    )
      policyViolations.push(message.params.entry.text);
    if (message.id !== undefined) {
      pending.get(message.id)?.(message);
      pending.delete(message.id);
    }
  };
  const send = (method, params = {}) =>
    new Promise((done, reject) => {
      const request = ++id;
      const timeout = setTimeout(() => {
        pending.delete(request);
        reject(new Error(`CDP timed out waiting for ${method}`));
      }, 10_000);
      pending.set(request, ({ error, result }) => {
        clearTimeout(timeout);
        if (error) reject(new Error(`${method}: ${JSON.stringify(error)}`));
        else done(result);
      });
      ws.send(JSON.stringify({ id: request, method, params }));
    });
  const evaluate = async (expression) => {
    const response = await send("Runtime.evaluate", {
      expression,
      returnByValue: true,
      awaitPromise: true,
    });
    if (response.exceptionDetails)
      throw new Error(
        response.exceptionDetails.exception?.description ??
          response.exceptionDetails.text,
      );
    return response.result.value;
  };

  await send("Page.enable");
  await send("Runtime.enable");
  await send("Log.enable");
  await send("Page.addScriptToEvaluateOnNewDocument", {
    source: `window.cadPolicyViolations = [];
      window.addEventListener("securitypolicyviolation", event => {
        window.cadPolicyViolations.push(event.violatedDirective + ": " + event.blockedURI);
      });`,
  });
  const navigation = await send("Page.navigate", {
    url: fixtureUrl,
  });
  if (navigation.errorText) throw new Error(navigation.errorText);
  await retry(async () => {
    const state = await evaluate(`({ready: window.__cadCheck?.ready,
      failure: window.__cadCheck?.engineResult?.failure,
      status: document.querySelector(".nodetto-cad-status")?.textContent})`);
    if (
      state.failure ||
      state.status ||
      errors.length ||
      policyViolations.length
    )
      throw new Error(
        state.failure ??
          state.status ??
          [...errors, ...policyViolations].join("\n"),
      );
    return state.ready;
  }, "The CAD worker or viewport did not become ready");

  const { engineResult, diagnostics, size } = await evaluate(
    "(({engineResult, diagnostics, size}) => ({engineResult, diagnostics, size}))(window.__cadCheck)",
  );
  Object.assign(report, { engineResult, diagnostics, size });
  assert(
    "workerReturnedPlate",
    engineResult.bodyCount === 1 && engineResult.triangles > 0,
  );
  assert("programsLinked", diagnostics.programsLinked === true);
  const centre = [Math.floor(size.width / 2), Math.floor(size.height / 2)];
  const sample = (point) =>
    evaluate(`window.__cadCheck.readPixels(...${JSON.stringify(point)})`);
  const different = (a, b) =>
    a.slice(0, 3).some((channel, index) => channel !== b[index]);
  const light = await sample(centre);
  const lightBackground = await evaluate("window.__cadCheck.background");
  const lightCorner = await sample([0, 0]);
  await evaluate('window.__cadCheck.setCanvasMode("dark")');
  const dark = await sample(centre);
  const darkBackground = await evaluate("window.__cadCheck.background");
  const darkCorner = await sample([0, 0]);
  assert("lightCentreShowsBody", different(light, lightBackground));
  assert("darkCentreShowsBody", different(dark, darkBackground));
  assert("canvasModeChangesCentre", different(light, dark));
  assert(
    "backgroundTokensReachFramebuffer",
    !different(lightCorner, lightBackground) &&
      !different(darkCorner, darkBackground),
  );
  const holePixel = await evaluate("window.__cadCheck.firstHolePixel()");
  const before = await sample(holePixel);
  const editToDisplayMs = await evaluate("window.__cadCheck.editRadius(1.25)");
  const after = await sample(holePixel);
  assert(
    "radiusEditChangesHolePixel",
    different(before, after),
    `pixel remained ${before}`,
  );
  assert(
    "editDisplayedWithin2000Ms",
    editToDisplayMs < 2000,
    `${editToDisplayMs} ms`,
  );
  Object.assign(report, {
    pixels: {
      light,
      lightBackground,
      dark,
      darkBackground,
      holePixel,
      before,
      after,
    },
    timings: await evaluate("window.__cadCheck.timings"),
    budgetsMs: { editToDisplay: 250, cameraFrame: 16 },
  });

  if (args.includes("--budget")) {
    assert("editMeetsBudget", editToDisplayMs < 250, `${editToDisplayMs} ms`);
    if (
      /swiftshader|software|llvmpipe|softpipe|lavapipe/i.test(
        diagnostics.renderer,
      )
    ) {
      report.cameraBudgetSkipped = "Software renderer";
    } else {
      const frames = await evaluate("window.__cadCheck.cameraFrames()");
      report.timings.cameraFramesMs = frames;
      assert(
        "cameraFramesMeetBudget",
        frames.length === 30 &&
          Math.max(...frames) > 0 &&
          Math.max(...frames) < 16,
        `slowest frame ${Math.max(...frames)} ms`,
      );
    }
  }
  const picker = await evaluate("window.__cadCheck.checkBoardPicker()");
  for (const [name, passed] of Object.entries(picker)) assert(name, passed);
  policyViolations.push(...(await evaluate("window.cadPolicyViolations")));
  assert(
    "noCspViolations",
    policyViolations.length === 0,
    policyViolations.join("\n"),
  );
  assert("noPageErrors", errors.length === 0, errors.join("\n"));
  if (!Object.values(report.assertions).every(Boolean)) process.exitCode = 1;
}
