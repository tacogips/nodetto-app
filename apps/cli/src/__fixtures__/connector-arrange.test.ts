import { expect, test } from "bun:test";
import { createDefaultRegistry, pageMetrics, Store } from "@nodetto/core";
import { validateDocument } from "@nodetto/ir";
import { parseDocument } from "@nodetto/io";
import {
  connectorArrangeDocument,
  CONNECTOR_ARRANGE_STATE_PAGE,
  CONNECTOR_ARRANGE_ARCHITECTURE_PAGE,
} from "./connector-arrange.ts";

test("fixture is deterministic, valid, and contains the prescribed pages", () => {
  const text = connectorArrangeDocument();
  expect(connectorArrangeDocument()).toBe(text);
  const doc = parseDocument(text);
  expect(
    validateDocument(doc).filter((issue) => issue.severity === "error"),
  ).toEqual([]);
  const page = doc.pages.find(
    (item) => item.name === CONNECTOR_ARRANGE_STATE_PAGE,
  );
  const architecture = doc.pages.find(
    (item) => item.name === CONNECTOR_ARRANGE_ARCHITECTURE_PAGE,
  );
  if (!page || !architecture) throw new Error("Missing fixture pages");
  const items = doc.elements.filter((item) => item.page === page.id);
  const frames = items.filter((item) => item.type === "frame");
  const states = items.filter((item) => item.type === "state.node");
  const transitions = items.filter((item) => item.type === "state.transition");
  expect([frames.length, states.length, transitions.length]).toEqual([
    4, 17, 47,
  ]);
  expect(
    transitions.filter((item) => {
      const s = item.semantic as { from: string; to: string };
      return s.from === s.to;
    }),
  ).toHaveLength(4);
  for (const state of states) {
    const { x, y, width, height } = state.visual;
    if (
      x === undefined ||
      y === undefined ||
      width === undefined ||
      height === undefined
    )
      throw new Error("Missing state dimensions");
    expect(
      frames.some((frame) => {
        const f = frame.visual;
        return (
          f.x !== undefined &&
          f.y !== undefined &&
          f.width !== undefined &&
          f.height !== undefined &&
          x >= f.x &&
          y >= f.y &&
          x + width <= f.x + f.width &&
          y + height <= f.y + f.height
        );
      }),
    ).toBe(true);
  }
  expect(
    doc.elements
      .filter((item) => item.page === architecture.id)
      .map((item) => item.id)
      .sort(),
  ).toEqual(["box-a", "box-b", "box-c", "box-d"]);
  expect(pageMetrics(new Store(doc), page.id, createDefaultRegistry())).toEqual(
    { edgeCrossings: 604, labelOverlaps: 104, segmentOverlaps: 332 },
  );
});
