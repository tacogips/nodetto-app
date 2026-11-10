import { expect, test } from "bun:test";
import { existsSync } from "node:fs";
import { Editor } from "./editor.ts";
import { exportPrototypeHtml } from "./prototype-html.ts";

test("prototype export is deterministic and exports reachable screens and fixed layers", () => {
  const editor = new Editor();
  const a = editor.createElement("frame", {
    semantic: {
      name: "A",
      screenKind: "screen",
      prototypeStart: true,
      prototypeFlowName: "Main",
    },
    visual: { x: 0, y: 0, width: 200, height: 400 },
  });
  const fixedA = editor.createElement("shape.geo", {
    visual: {
      x: 10,
      y: 350,
      width: 180,
      height: 40,
      prototypeFixed: true,
      layerName: "Tabs",
    },
  });
  const b = editor.createElement("frame", {
    semantic: { name: "B", screenKind: "screen" },
    visual: { x: 500, y: 0, width: 200, height: 400 },
  });
  const fixedB = editor.createElement("shape.geo", {
    visual: {
      x: 510,
      y: 350,
      width: 180,
      height: 40,
      prototypeFixed: true,
      layerName: "Tabs",
    },
  });
  const c = editor.createElement("frame", {
    semantic: { name: "C", screenKind: "screen" },
    visual: { x: 1000, y: 0, width: 200, height: 400 },
  });
  editor.createElement("edge.generic", {
    semantic: { from: a, to: b, prototype: true, label: "<&>" },
  });
  editor.createElement("edge.generic", {
    semantic: { from: b, to: c, prototype: true },
  });
  const options = { device: "none" as const };
  const html = exportPrototypeHtml(editor, options);
  expect(exportPrototypeHtml(editor, options)).toBe(html);
  expect(html.match(/<section class="screen"/g)?.length).toBe(3);
  expect(html.match(/<button type="button"/g)?.length).toBe(2);
  expect(html).toContain("&lt;&amp;&gt;");
  expect(html).toContain(`"start":"${a}"`);
  expect(html).not.toContain('class="viewport bezel"');
  expect(html.match(/class="fixed"/g)?.length).toBe(2);
  for (const id of [fixedA, fixedB])
    expect(html.split(`data-id="${id}"`).length - 1).toBe(1);
  expect(() =>
    exportPrototypeHtml(editor, { ...options, flow: "missing" }),
  ).toThrow('unknown flow "missing"; flows: Main');
});

test("standalone prototype navigation and overlay history run in a browser", async () => {
  const macChrome =
    "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome";
  const chrome =
    process.env.CHROME_PATH ??
    Bun.which("chromium") ??
    Bun.which("google-chrome") ??
    (existsSync(macChrome) ? macChrome : undefined);
  if (!chrome)
    throw new Error("Chrome or Chromium is required; set CHROME_PATH");
  const editor = new Editor();
  const frame = (name: string, x: number, start = false) =>
    editor.createElement("frame", {
      semantic: {
        name,
        screenKind: "screen",
        ...(start ? { prototypeStart: true } : {}),
      },
      visual: { x, y: 0, width: 200, height: 400 },
    });
  const a = frame("A", 0, true);
  const b = frame("B", 500);
  const c = frame("C", 1000);
  const d = frame("D", 1500);
  const link = (
    from: string,
    to: string,
    label: string,
    action: "navigate" | "back" | "open-overlay" | "swap-overlay",
  ) =>
    editor.createElement("edge.generic", {
      semantic: { from, to, label, prototype: true, prototypeAction: action },
    });
  link(a, b, "next", "navigate");
  link(b, c, "open", "open-overlay");
  link(c, d, "swap", "swap-overlay");
  link(d, d, "back", "back");
  const html = exportPrototypeHtml(editor, { device: "none" }).replace(
    "</body>",
    `<output id="result">pending</output><script>
  const visible = () => [...document.querySelectorAll('.screen')].map(e => !e.hidden);
  const click = name => document.querySelector('button[aria-label="'+name+'"]').click();
  click('next'); const nav = visible().join(',') === 'false,true,false,false';
  click('open'); const opened = visible().join(',') === 'false,true,true,false';
  click('swap'); const swapped = visible().join(',') === 'false,true,false,true';
  click('back'); const closed = visible().join(',') === 'false,true,false,false';
  document.dispatchEvent(new KeyboardEvent('keydown',{key:'ArrowLeft'})); const back = visible().join(',') === 'true,false,false,false';
  document.querySelector('#result').textContent = [nav,opened,swapped,closed,back].join(',');</script></body>`,
  );
  const path = `${process.cwd()}/tmp/ipd-s772/ipd-21-html-prototype/browser-regression.html`;
  await Bun.write(path, html);
  const result = Bun.spawnSync(
    [
      chrome,
      "--headless",
      "--disable-gpu",
      "--no-first-run",
      `--user-data-dir=${process.cwd()}/tmp/ipd-s772/ipd-21-html-prototype/chrome-test`,
      "--dump-dom",
      `file://${path}`,
    ],
    { stdout: "pipe", stderr: "pipe" },
  );
  expect(result.exitCode).toBe(0);
  expect(result.stdout.toString()).toContain(
    '<output id="result">true,true,true,true,true</output>',
  );
}, 40000);

test("inline SVG definitions are unique and references resolve within each screen", () => {
  const editor = new Editor();
  const frame = (name: string, x: number, start: boolean) => {
    const child = editor.createElement("shape.geo", {
      visual: {
        x: x + 150,
        y: 10,
        width: 100,
        height: 80,
        style: {
          fill: "#ff0000",
          effects: [
            {
              type: "drop-shadow",
              x: 0,
              y: 2,
              blur: 4,
              color: "#000000",
              opacity: 0.3,
            },
          ],
        },
      },
    });
    const fixed = editor.createElement("shape.geo", {
      visual: {
        x: x + 10,
        y: 350,
        width: 180,
        height: 30,
        prototypeFixed: true,
        layerName: "Tabs",
        style: {
          effects: [
            {
              type: "drop-shadow",
              x: 0,
              y: 2,
              blur: 4,
              color: "#000000",
              opacity: 0.3,
            },
          ],
        },
      },
    });
    return editor.createElement("frame", {
      semantic: {
        name,
        screenKind: "screen",
        clipContent: true,
        memberIds: [child, fixed],
        ...(start ? { prototypeStart: true } : {}),
      },
      visual: { x, y: 0, width: 200, height: 400 },
    });
  };
  const a = frame("A", 0, true);
  const b = frame("B", 500, false);
  editor.createElement("edge.generic", {
    semantic: { from: a, to: b, prototype: true },
  });
  const html = exportPrototypeHtml(editor, { device: "none" });
  expect(exportPrototypeHtml(editor, { device: "none" })).toBe(html);
  const ids = [...html.matchAll(/\sid="([^"]+)"/g)].map((match) => match[1]);
  expect(new Set(ids).size).toBe(ids.length);
  const sections = [...html.matchAll(/<section\b[\s\S]*?<\/section>/g)].map(
    (match) => match[0],
  );
  expect(sections).toHaveLength(2);
  expect(html.match(/class="fixed"/g)).toHaveLength(2);
  for (const section of sections) {
    const localIds = new Set(
      [...section.matchAll(/\sid="([^"]+)"/g)].map((match) => match[1]),
    );
    const refs = [...section.matchAll(/url\(#([^)]*)\)/g)].map(
      (match) => match[1],
    );
    expect(refs.some((ref) => ref?.includes("nodetto-clip-"))).toBe(true);
    expect(refs.some((ref) => ref?.includes("nodetto-shadow-"))).toBe(true);
    for (const ref of refs) expect(localIds.has(ref)).toBe(true);
  }
});
