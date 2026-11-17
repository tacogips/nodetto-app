// Large-ERD responsiveness benchmark over the real application shell.
//
//   bun --cwd=apps/desktop run dev                       # in another shell
//   bun apps/desktop/scripts/erd-scale-check.mjs [origin] [--tables 2000]
//        [--routing orthogonal] [--json out.json] [--budget]
//        [--profile "drag one table" --profile-out prefix] [--trace "pan"]
//
// Drives an isolated headless Chrome with real mouse and wheel input over a
// page of `--tables` ERD tables and their relations, and reports the
// main-thread frame time of every gesture at 100% zoom and at the overview
// zoom, plus the main-thread split (script / style / layout). `--budget`
// exits non-zero when a single-element gesture's median frame exceeds 50 ms.
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

const args = process.argv.slice(2);
const flag = (name) => {
  const at = args.indexOf(`--${name}`);
  return at >= 0 ? args[at + 1] : undefined;
};
const origin = args[0]?.startsWith("http") ? args[0] : "http://localhost:1420";
const tables = Number(flag("tables") ?? 2000);
const routing = flag("routing");
// --profile "<scenario substring>" [--profile-out prefix] saves a CPU profile.
const profileScenario = flag("profile");
const profileOut = flag("profile-out") ?? "erd-scale";
// --trace "<scenario substring>" prints the browser's own time per event.
const traceScenario = flag("trace");
const port = Number(process.env.CDP_PORT ?? 9341);
const binary =
  process.env.CHROME_BIN ??
  "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome";
try {
  await fetch(`http://localhost:${port}/json/version`);
  throw new Error(
    `CDP port ${port} is already in use; choose another CDP_PORT`,
  );
} catch (error) {
  if (String(error).includes("already in use")) throw error;
}
const profile = await mkdtemp(join(tmpdir(), "nodetto-erd-scale-"));
const chrome = Bun.spawn(
  [
    binary,
    "--headless=new",
    `--remote-debugging-port=${port}`,
    `--user-data-dir=${profile}`,
    "--no-first-run",
    "--no-default-browser-check",
    "--window-size=1600,1000",
    "about:blank",
  ],
  { stdout: "ignore", stderr: "ignore" },
);
let ws;
try {
  let pages;
  for (let attempt = 0; attempt < 100; attempt++) {
    try {
      pages = await (await fetch(`http://localhost:${port}/json/list`)).json();
      if (pages.some((page) => page.type === "page")) break;
    } catch {
      /* Chrome is still starting. */
    }
    await Bun.sleep(100);
  }
  const page = pages?.find((entry) => entry.type === "page");
  if (!page) throw new Error("Chrome did not expose a page");
  ws = new WebSocket(page.webSocketDebuggerUrl);
  await new Promise((resolve, reject) => {
    ws.onopen = resolve;
    ws.onerror = reject;
  });
  const pending = new Map();
  const traceEvents = [];
  let traceDone;
  let nextId = 1;
  const errors = [];
  ws.onmessage = (event) => {
    const message = JSON.parse(event.data);
    if (message.method === "Runtime.exceptionThrown")
      errors.push(
        message.params.exceptionDetails.exception?.description ??
          message.params.exceptionDetails.text,
      );
    if (message.method === "Tracing.dataCollected")
      traceEvents.push(...message.params.value);
    if (message.method === "Tracing.tracingComplete") traceDone?.();
    const entry = pending.get(message.id);
    if (entry) {
      pending.delete(message.id);
      message.error
        ? entry.reject(new Error(JSON.stringify(message.error)))
        : entry.resolve(message.result);
    }
  };
  const send = (method, params = {}) =>
    new Promise((resolve, reject) => {
      const id = nextId++;
      pending.set(id, { resolve, reject });
      ws.send(JSON.stringify({ id, method, params }));
    });
  const evaluate = async (expression) => {
    const result = await send("Runtime.evaluate", {
      expression,
      returnByValue: true,
      awaitPromise: true,
    });
    if (result.exceptionDetails)
      throw new Error(
        result.exceptionDetails.exception?.description ??
          "browser evaluation failed",
      );
    return result.result.value;
  };
  await send("Runtime.enable");
  await send("Page.enable");
  await send("Performance.enable");
  const url = new URL("/scripts/fixtures/erd-scale.html", origin);
  url.searchParams.set("tables", String(tables));
  if (routing) url.searchParams.set("routing", routing);
  // "mount" as a profile scenario covers page load up to the first paint.
  const profileMount = profileScenario === "mount";
  if (profileMount) {
    await send("Profiler.enable");
    await send("Profiler.setSamplingInterval", { interval: 200 });
    await send("Profiler.start");
  }
  await send("Page.navigate", { url: url.href });
  let ready = false;
  for (let attempt = 0; attempt < 1200; attempt++) {
    try {
      if (await evaluate("Boolean(window.erdScale?.ready)")) {
        ready = true;
        break;
      }
    } catch {
      /* The page is navigating or busy mounting. */
    }
    await Bun.sleep(100);
  }
  if (!ready) throw new Error(`fixture did not load: ${errors.join("; ")}`);
  if (profileMount) {
    const { profile: cpu } = await send("Profiler.stop");
    await Bun.write(`${profileOut}-mount.cpuprofile`, JSON.stringify(cpu));
    console.error(`wrote ${profileOut}-mount.cpuprofile`);
  }

  const metrics = async () => {
    const { metrics: list } = await send("Performance.getMetrics");
    const read = (name) =>
      (list.find((entry) => entry.name === name)?.value ?? 0) * 1000;
    return {
      script: read("ScriptDuration"),
      style: read("RecalcStyleDuration"),
      layout: read("LayoutDuration"),
      task: read("TaskDuration"),
    };
  };
  const round = (value) => Math.round(value * 10) / 10;
  const summarize = (samples) => {
    const sorted = [...samples].sort((a, b) => a - b);
    return {
      frames: sorted.length,
      medianMs: round(sorted[Math.floor(sorted.length / 2)] ?? 0),
      maxMs: round(sorted.at(-1) ?? 0),
    };
  };
  const rows = [];
  /** Run one scenario and attribute the main-thread time it spent. */
  const scenario = async (name, steps, body) => {
    await evaluate("window.erdScale.settled()");
    await evaluate("window.erdScale.takeFrames()");
    const profiled = profileScenario && name.includes(profileScenario);
    if (profiled) {
      await send("Profiler.enable");
      await send("Profiler.setSamplingInterval", { interval: 200 });
      await send("Profiler.start");
    }
    const traced = traceScenario && name.includes(traceScenario);
    if (traced) {
      traceEvents.length = 0;
      await send("Tracing.start", {
        traceConfig: {
          includedCategories: ["devtools.timeline", "blink", "cc", "viz"],
        },
        transferMode: "ReportEvents",
      });
    }
    const before = await metrics();
    const revision = await evaluate("window.erdScale.editor.revision");
    const direct = await body();
    await evaluate("window.erdScale.settled()");
    const after = await metrics();
    if (traced) {
      const done = new Promise((resolve) => {
        traceDone = resolve;
      });
      await send("Tracing.end");
      await done;
      // Renderer main-thread time by event, largest first.
      const main = traceEvents.find(
        (event) => event.name === "RunTask" || event.name === "FunctionCall",
      );
      const totals = new Map();
      for (const event of traceEvents) {
        if (event.ph !== "X" || !event.dur) continue;
        if (main && (event.pid !== main.pid || event.tid !== main.tid))
          continue;
        totals.set(
          event.name,
          (totals.get(event.name) ?? 0) + event.dur / 1000,
        );
      }
      console.error(`trace of "${name}" (ms on the renderer main thread):`);
      for (const [event, total] of [...totals]
        .sort((a, b) => b[1] - a[1])
        .slice(0, 28))
        console.error(`  ${total.toFixed(1).padStart(9)}  ${event}`);
    }
    if (profiled) {
      const { profile: cpu } = await send("Profiler.stop");
      const file = `${profileOut}-${name.replace(/[^a-z0-9]+/gi, "-")}.cpuprofile`;
      await Bun.write(file, JSON.stringify(cpu));
      console.error(`wrote ${file}`);
    }
    // One busy frame per input step: keep the slowest `steps` frames.
    const samples =
      direct ??
      (await evaluate("window.erdScale.takeFrames()"))
        .sort((a, b) => b - a)
        .slice(0, steps);
    const per = (key) => round((after[key] - before[key]) / steps);
    const row = {
      name,
      ...summarize(samples),
      revisions: (await evaluate("window.erdScale.editor.revision")) - revision,
      top: [...samples]
        .sort((a, b) => b - a)
        .slice(0, 8)
        .map(round),
      scriptMs: per("script"),
      styleMs: per("style"),
      layoutMs: per("layout"),
      taskMs: per("task"),
    };
    rows.push(row);
    return row;
  };
  const mouse = async (type, point, buttons = 0, extra = {}) => {
    await send("Input.dispatchMouseEvent", {
      type,
      x: point.x,
      y: point.y,
      button: type === "mouseMoved" && buttons === 0 ? "none" : "left",
      buttons,
      clickCount: type === "mouseMoved" ? 0 : 1,
      pointerType: "mouse",
      ...extra,
    });
  };
  /** One input per painted frame, as a display-paced pointer delivers them. */
  const moves = async (from, dx, dy, count, buttons) => {
    for (let step = 1; step <= count; step++) {
      await mouse(
        "mouseMoved",
        { x: from.x + dx * step, y: from.y + dy * step },
        buttons,
      );
      await evaluate("window.erdScale.settled()");
    }
  };
  const api = (expression) =>
    evaluate(`window.erdScale.${expression}.then(r=>[r.paintedMs])`);

  const info = await evaluate(
    "({mountScriptMs:window.erdScale.mountScriptMs,mountPaintedMs:window.erdScale.mountPaintedMs,relations:window.erdScale.relations,domNodes:window.erdScale.domNodes(),rect:window.erdScale.canvasRect()})",
  );
  const ids = await evaluate("window.erdScale.tableIds");
  const perRow = 50;
  // A table well inside the grid, so every gesture has neighbours around it,
  // and one a press picks at both zooms (a relation crossing it would win).
  const ZOOMS = [1, 0.1];
  const target = await evaluate(
    `window.erdScale.pickableTable(${Math.min(ids.length - 1, perRow * Math.min(10, Math.floor(ids.length / perRow / 2)) + 12)}, ${JSON.stringify(ZOOMS)})`,
  );
  const expect = (condition, message) => {
    if (!condition) throw new Error(`benchmark gesture failed: ${message}`);
  };
  const hub = ids[0];
  const STEPS = 30;
  // One grid cell per step, so every sample commits a move under grid snap.
  const DRAG_STEPS = 24;

  for (const zoom of ZOOMS) {
    const label = zoom === 1 ? "100%" : "overview 10%";
    // Bring the target table to the upper-left third of the canvas.
    await evaluate(`(()=>{const v=window.erdScale.editor.store.get(${JSON.stringify(target)}).visual;
      const r=window.erdScale.canvasRect();
      window.erdScale.setCamera(-v.x+r.width/(3*${zoom}), -v.y+r.height/(3*${zoom}), ${zoom});})()`);
    await evaluate("window.erdScale.settled()");
    await evaluate("window.erdScale.select([])");
    const at = await evaluate(
      `window.erdScale.tablePoint(${JSON.stringify(target)})`,
    );
    const gutter = await evaluate(
      `window.erdScale.gutterPoint(${JSON.stringify(target)})`,
    );
    await mouse("mouseMoved", gutter);
    await scenario(`${label}: hover across tables`, STEPS, () =>
      moves(gutter, 6, 4, STEPS, 0),
    );
    await scenario(`${label}: wheel pan`, STEPS, async () => {
      for (let step = 0; step < STEPS; step++) {
        await mouse("mouseWheel", gutter, 0, { deltaX: 12, deltaY: 18 });
        await evaluate("window.erdScale.settled()");
      }
    });
    await scenario(`${label}: wheel pan back`, STEPS, async () => {
      for (let step = 0; step < STEPS; step++) {
        await mouse("mouseWheel", gutter, 0, { deltaX: -12, deltaY: -18 });
        await evaluate("window.erdScale.settled()");
      }
    });
    await scenario(`${label}: click-select a table`, 2, async () => {
      await mouse("mouseMoved", at);
      await mouse("mousePressed", at, 1);
      await evaluate("window.erdScale.settled()");
      await mouse("mouseReleased", at, 0);
    });
    await scenario(`${label}: drag one table`, DRAG_STEPS, async () => {
      await mouse("mousePressed", at, 1);
      await evaluate("window.erdScale.settled()");
      await evaluate("window.erdScale.takeFrames()");
      const start = await evaluate("window.erdScale.editor.revision");
      await moves(at, 24, 12, DRAG_STEPS, 1);
      await evaluate("window.erdScale.settled()");
      const samples = (await evaluate("window.erdScale.takeFrames()"))
        .sort((a, b) => b - a)
        .slice(0, DRAG_STEPS);
      const commits =
        (await evaluate("window.erdScale.editor.revision")) - start;
      expect(
        commits >= DRAG_STEPS,
        `drag committed ${commits} revisions, selection ${await evaluate("JSON.stringify(window.erdScale.selectedTypes())")}`,
      );
      await mouse("mouseReleased", {
        x: at.x + 24 * DRAG_STEPS,
        y: at.y + 12 * DRAG_STEPS,
      });
      return samples;
    });
    await scenario(`${label}: drag release (commit)`, 1, async () => {
      // The release above is measured on its own through an undo/redo pair.
      return api("undo()");
    });
    await scenario(`${label}: marquee select`, STEPS, async () => {
      await mouse("mouseMoved", gutter);
      await mouse("mousePressed", gutter, 1);
      await evaluate("window.erdScale.settled()");
      await evaluate("window.erdScale.takeFrames()");
      // Sweep back over the target, so the brush always has tables to pick.
      await moves(gutter, -14, 9, STEPS, 1);
      await evaluate("window.erdScale.settled()");
      const samples = (await evaluate("window.erdScale.takeFrames()"))
        .sort((a, b) => b - a)
        .slice(0, STEPS);
      await mouse("mouseReleased", {
        x: gutter.x - 14 * STEPS,
        y: gutter.y + 9 * STEPS,
      });
      const picked = await evaluate("window.erdScale.editor.selection.size");
      expect(picked > 1, `marquee selected ${picked} elements`);
      return samples;
    });
    await evaluate("window.erdScale.select([])");
  }

  // Edits through the editor API, measured to the painted frame, at 100%.
  await evaluate(`(()=>{const v=window.erdScale.editor.store.get(${JSON.stringify(target)}).visual;
    const r=window.erdScale.canvasRect();
    window.erdScale.setCamera(-v.x+r.width/3, -v.y+r.height/3, 1);})()`);
  const quoted = JSON.stringify(target);
  await scenario("select one table", 1, () => api(`select([${quoted}])`));
  await scenario("rename table", 5, async () => {
    const out = [];
    for (let i = 0; i < 5; i++)
      out.push(...(await api(`rename(${quoted}, "renamed_${i}")`)));
    return out;
  });
  await scenario("add column", 5, async () => {
    const out = [];
    for (let i = 0; i < 5; i++)
      out.push(...(await api(`addColumn(${quoted}, "extra_${i}")`)));
    return out;
  });
  let createdId = "";
  await scenario("create table", 1, async () => {
    const result = await evaluate("window.erdScale.createTable(-600, 0)");
    createdId = result.id;
    return [result.paintedMs];
  });
  await scenario("delete table", 1, () =>
    api(`deleteElements([${JSON.stringify(createdId)}])`),
  );
  await scenario("undo", 1, () => api("undo()"));
  await scenario("redo", 1, () => api("redo()"));
  await scenario("select hub table (200 relations)", 1, () =>
    api(`select([${JSON.stringify(hub)}])`),
  );
  await scenario("select all", 1, () => api("selectAll()"));
  {
    const at = await evaluate(`window.erdScale.tablePoint(${quoted})`);
    await scenario("drag everything", 5, async () => {
      await mouse("mouseMoved", at);
      await mouse("mousePressed", at, 1);
      await evaluate("window.erdScale.settled()");
      await evaluate("window.erdScale.takeFrames()");
      await moves(at, 24, 12, 5, 1);
      await evaluate("window.erdScale.settled()");
      const samples = (await evaluate("window.erdScale.takeFrames()"))
        .sort((a, b) => b - a)
        .slice(0, 5);
      await mouse("mouseReleased", { x: at.x + 120, y: at.y + 60 });
      return samples;
    });
  }
  await evaluate("window.erdScale.select([])");
  if (errors.length) throw new Error(errors.join(", "));

  const report = {
    tables,
    relations: info.relations,
    routing: routing ?? "default",
    mountScriptMs: round(info.mountScriptMs),
    mountPaintedMs: round(info.mountPaintedMs),
    domNodes: info.domNodes,
    rows,
  };
  const out = flag("json");
  if (out) await Bun.write(out, JSON.stringify(report, null, 2));
  console.log(
    `${tables} tables, ${info.relations} relations, routing ${report.routing}`,
  );
  console.log(
    `mount: script ${report.mountScriptMs} ms, first paint ${report.mountPaintedMs} ms, ${info.domNodes} DOM nodes`,
  );
  console.log(
    `${"scenario".padEnd(40)}${"median".padStart(9)}${"max".padStart(9)}  per step: ${"script".padStart(8)}${"style".padStart(8)}${"layout".padStart(8)}${"task".padStart(8)}`,
  );
  for (const row of rows)
    console.log(
      `${row.name.padEnd(40)}${String(row.medianMs).padStart(9)}${String(row.maxMs).padStart(9)}            ${String(row.scriptMs).padStart(8)}${String(row.styleMs).padStart(8)}${String(row.layoutMs).padStart(8)}${String(row.taskMs).padStart(8)}`,
    );
  if (args.includes("--budget")) {
    // Whole-page selections scale with the page by nature; the budget is for
    // working on one element among thousands.
    const BUDGET_MS = 50;
    const slow = rows.filter(
      (row) =>
        !row.name.includes("everything") &&
        row.name !== "select all" &&
        row.medianMs > BUDGET_MS,
    );
    if (slow.length) {
      console.error(
        `over the ${BUDGET_MS} ms budget: ${slow.map((row) => `${row.name} (${row.medianMs} ms)`).join(", ")}`,
      );
      process.exitCode = 1;
    } else
      console.log(`every single-element gesture is within ${BUDGET_MS} ms`);
  }
} finally {
  ws?.close();
  chrome.kill();
  await chrome.exited;
  await rm(profile, { recursive: true, force: true });
}
