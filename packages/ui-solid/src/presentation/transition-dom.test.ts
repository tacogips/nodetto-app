import { expect, test } from "bun:test";
import type { SlideTransitionPlan, SlideTransitionStep } from "@nodetto/core";
import { Window } from "happy-dom";
import {
  document,
  element,
  makeEditor,
} from "../../../core/src/test-helpers.ts";
import { prepareTransition } from "./transition-dom.ts";

const origins = { from: { x: 0, y: 0 }, to: { x: 0, y: 0 } };
const step = (
  kind: SlideTransitionStep["kind"],
  ids: { from?: string; to?: string },
): SlideTransitionStep => ({
  kind,
  ...ids,
  start: 120,
  duration: 700,
  easing: "ease-in-out",
});
const plan = (...steps: SlideTransitionStep[]): SlideTransitionPlan => ({
  kind: "animate",
  duration: 820,
  steps,
});
function svg(markup: string): Element {
  const window = new Window();
  const container = window.document.createElement("div");
  container.innerHTML = markup;
  return container.firstElementChild as unknown as Element;
}
function exportedRect(): string {
  const shape = element({
    id: "rect",
    type: "shape.geo",
    semantic: { geo: "rect", label: "" },
    visual: {
      x: 0,
      y: 0,
      width: 100,
      height: 80,
      style: {
        fill: "#f00",
        stroke: "#000",
        strokeWidth: 4,
        strokeAlign: "inside",
      },
    },
  });
  return (
    makeEditor({ document: document([shape]) }).exportPageSvgOf("page-1", {
      padding: 0,
    }) ?? ""
  );
}

test("aligned stroke draw-on animates painted paths and excludes definitions", () => {
  const incoming = svg(exportedRect());
  const node = incoming.querySelector('g[data-id="rect"]');
  expect(node).not.toBeNull();
  node
    ?.querySelector('path[stroke="none"]')
    ?.setAttribute("fill-opacity", "0.4");
  for (const path of incoming.querySelectorAll("path"))
    Object.defineProperty(path, "getTotalLength", { value: () => 400 });
  const jobs = prepareTransition(
    svg("<svg></svg>"),
    incoming,
    plan(step("draw-on", { to: "rect" })),
    origins,
  );
  expect(jobs.length).toBeGreaterThanOrEqual(2);
  expect(
    jobs.every(
      (job) => job.options.delay === 120 && job.options.fill === "both",
    ),
  ).toBe(true);
  expect(
    jobs.every(
      (job) => !(job.target as Element).closest("defs,clipPath,marker"),
    ),
  ).toBe(true);
  const fill = jobs.find((job) =>
    job.keyframes.some((frame) => frame.fillOpacity !== undefined),
  );
  expect(fill).toBeDefined();
  expect(
    fill?.keyframes.some(
      (frame) => frame.offset === 0.5 && frame.fillOpacity === 0,
    ),
  ).toBe(true);
  expect(fill?.keyframes.at(-1)?.fillOpacity).toBe(0.4);
  expect(
    jobs.some((job) =>
      job.keyframes.some((frame) => frame.strokeDasharray !== undefined),
    ),
  ).toBe(true);
});

test("unmeasurable geometry falls back to a whole-node fade", () => {
  const incoming = svg(exportedRect());
  const jobs = prepareTransition(
    svg("<svg></svg>"),
    incoming,
    plan(step("draw-on", { to: "rect" })),
    origins,
  );
  expect(jobs).toHaveLength(1);
  expect(jobs[0]?.keyframes).toEqual([{ opacity: 0 }, { opacity: 1 }]);
  expect(
    (jobs[0]?.target as Element).querySelector('g[data-id="rect"]'),
  ).not.toBeNull();
});

test("group stays visible while only unchanged linked child is hidden", () => {
  const out = svg(
    '<svg><g data-id="group" data-type="group"><g data-id="removed" transform="rotate(5)"></g><g data-id="changed"></g><g data-id="same"></g></g></svg>',
  );
  const incoming = svg(
    '<svg><g data-id="new-changed"></g><g data-id="new-same"></g></svg>',
  );
  const box = { x: 0, y: 0, width: 10, height: 10, rotation: 0 };
  const jobs = prepareTransition(
    out,
    incoming,
    plan(
      step("fade-out", { from: "removed" }),
      {
        ...step("transform", { from: "changed", to: "new-changed" }),
        fromBox: box,
        toBox: box,
        appearanceChanged: true,
      },
      {
        ...step("transform", { from: "same", to: "new-same" }),
        fromBox: box,
        toBox: box,
        appearanceChanged: false,
      },
    ),
    origins,
  );
  expect(
    out.querySelector('[data-id="group"]')?.getAttribute("visibility"),
  ).toBeNull();
  expect(
    out.querySelector('[data-id="removed"]')?.getAttribute("visibility"),
  ).toBeNull();
  expect(
    out.querySelector('[data-id="changed"]')?.getAttribute("visibility"),
  ).toBeNull();
  expect(
    out.querySelector('[data-id="same"]')?.getAttribute("visibility"),
  ).toBe("hidden");
  expect(
    out.querySelector('[data-id="removed"]')?.getAttribute("transform"),
  ).toBe("rotate(5)");
  expect(jobs).toHaveLength(4);
});

test("grow restores markers and does not modify definitions", () => {
  const incoming = svg(
    '<svg><g data-id="edge"><defs><marker id="m"><path marker-end="inside" /></marker></defs><path stroke="black" fill="none" marker-end="url(#m)" /></g></svg>',
  );
  const path = incoming.querySelector('g[data-id="edge"] > path');
  expect(path).not.toBeNull();
  Object.defineProperty(path, "getTotalLength", { value: () => 100 });
  const jobs = prepareTransition(
    svg("<svg></svg>"),
    incoming,
    plan(step("grow", { to: "edge" })),
    origins,
  );
  expect(path?.getAttribute("marker-end")).toBeNull();
  expect(
    incoming.querySelector("marker path")?.getAttribute("marker-end"),
  ).toBe("inside");
  jobs[0]?.onFinish?.();
  expect(path?.getAttribute("marker-end")).toBe("url(#m)");
});

test("undraw reverses an outgoing connector and restores its markers", () => {
  const outgoing = svg(
    '<svg><g data-id="edge"><defs><marker id="m"><path marker-end="inside" /></marker></defs><path stroke="black" fill="none" marker-end="url(#m)" /></g></svg>',
  );
  const path = outgoing.querySelector('g[data-id="edge"] > path');
  expect(path).not.toBeNull();
  if (!path) throw new Error("Missing connector path");
  Object.defineProperty(path, "getTotalLength", { value: () => 100 });
  const jobs = prepareTransition(
    outgoing,
    svg("<svg></svg>"),
    plan(step("undraw", { from: "edge" })),
    origins,
  );
  expect(jobs).toHaveLength(1);
  expect(jobs[0]?.target).toBe(path);
  expect(jobs[0]?.keyframes).toEqual([
    { offset: 0, strokeDasharray: "100", strokeDashoffset: "0" },
    { offset: 1, strokeDasharray: "100", strokeDashoffset: "100" },
  ]);
  expect(path?.getAttribute("marker-end")).toBeNull();
  expect(
    outgoing.querySelector("marker path")?.getAttribute("marker-end"),
  ).toBe("inside");
  jobs[0]?.onFinish?.();
  expect(path?.getAttribute("marker-end")).toBe("url(#m)");
});

test("undraw falls back to outgoing wrapper fade for unmeasurable geometry", () => {
  const outgoing = svg(exportedRect());
  const jobs = prepareTransition(
    outgoing,
    svg("<svg></svg>"),
    plan(step("undraw", { from: "rect" })),
    origins,
  );
  expect(jobs).toHaveLength(1);
  expect(jobs[0]?.keyframes).toEqual([{ opacity: 1 }, { opacity: 0 }]);
  expect(
    (jobs[0]?.target as Element).querySelector('g[data-id="rect"]'),
  ).not.toBeNull();
});

test("slide-fade targets the two SVG roots", () => {
  const outgoing = svg("<svg></svg>");
  const incoming = svg("<svg></svg>");
  const jobs = prepareTransition(
    outgoing,
    incoming,
    plan(step("slide-fade", {})),
    origins,
  );
  expect(jobs).toHaveLength(2);
  expect(jobs.find((job) => job.target === outgoing)?.keyframes).toEqual([
    { opacity: 1 },
    { opacity: 0 },
  ]);
  expect(jobs.find((job) => job.target === incoming)?.keyframes).toEqual([
    { opacity: 0 },
    { opacity: 1 },
  ]);
});

test("swap animates both wrappers at the scheduled instant", () => {
  const outgoing = svg('<svg><g data-id="old"><rect /></g></svg>');
  const incoming = svg('<svg><g data-id="new"><rect /></g></svg>');
  const jobs = prepareTransition(
    outgoing,
    incoming,
    plan({ ...step("swap", { from: "old", to: "new" }), duration: 0 }),
    origins,
  );
  expect(jobs).toHaveLength(2);
  expect(jobs.map((job) => job.keyframes)).toEqual([
    [{ opacity: 1 }, { opacity: 0 }],
    [{ opacity: 0 }, { opacity: 1 }],
  ]);
  expect(
    jobs.every(
      (job) =>
        job.options.duration === 0 &&
        job.options.delay === 120 &&
        job.options.fill === "both",
    ),
  ).toBe(true);
  expect(
    (jobs[0]?.target as Element).querySelector('[data-id="old"]'),
  ).not.toBeNull();
  expect(
    (jobs[1]?.target as Element).querySelector('[data-id="new"]'),
  ).not.toBeNull();
});

test("scale, slide and instant effects target their corresponding wrappers", () => {
  const box = { x: 0, y: 0, width: 10, height: 10, rotation: 0 };
  for (const kind of [
    "scale-in",
    "scale-out",
    "slide-in",
    "slide-out",
    "appear",
    "disappear",
  ] as const) {
    const entrance = kind.endsWith("-in") || kind === "appear";
    const outgoing = svg('<svg><g data-id="old"><rect /></g></svg>');
    const incoming = svg('<svg><g data-id="new"><rect /></g></svg>');
    const effect = {
      ...step(kind, entrance ? { to: "new" } : { from: "old" }),
      fromBox: box,
      toBox: box,
      offset: { x: -120, y: 0 },
      duration: kind === "appear" || kind === "disappear" ? 0 : 700,
    };
    const jobs = prepareTransition(outgoing, incoming, plan(effect), origins);
    expect(jobs).toHaveLength(1);
    expect(
      (jobs[0]?.target as Element).querySelector(
        entrance ? '[data-id="new"]' : '[data-id="old"]',
      ),
    ).not.toBeNull();
  }
});
