import { expect, test } from "bun:test";
import { type Document, validateDocument } from "./index.ts";

const doc: Document = {
  schemaVersion: 1,
  id: "doc",
  title: "Test",
  pages: [{ id: "p", name: "Page", kind: "freeform" }],
  elements: [],
};
function issues(type: string, semantic: Record<string, unknown>) {
  return validateDocument({
    ...doc,
    elements: [{ id: "e", page: "p", type, index: "a0", semantic, visual: {} }],
  });
}
test("connector lane and offsets validate", () => {
  for (const lane of [0, 8])
    expect(
      issues("edge.generic", { routingLane: lane }).some(
        (i) => i.path.endsWith(".routingLane") && i.severity === "error",
      ),
    ).toBe(false);
  for (const lane of [-1, 9, 1.5, "1"])
    expect(
      issues("edge.generic", { routingLane: lane }).some(
        (i) => i.path.endsWith(".routingLane") && i.severity === "error",
      ),
    ).toBe(true);
  expect(
    issues("edge.generic", { labelOffsetX: "NaN" }).some(
      (i) => i.path.endsWith(".labelOffsetX") && i.severity === "error",
    ),
  ).toBe(true);
  expect(
    issues("edge.generic", { labelOffsetX: 12.5 }).some(
      (i) => i.path.endsWith(".labelOffsetX") && i.severity === "error",
    ),
  ).toBe(false);
});
test("lane is registered on routing connector types only", () => {
  for (const type of [
    "edge.generic",
    "uml.association",
    "uml.component-relationship",
    "state.transition",
    "usecase.relationship",
    "erd.relation",
    "bpmn.sequenceFlow",
    "bpmn.messageFlow",
    "bpmn.association",
    "bpmn.dataAssociation",
  ]) {
    expect(
      issues(type, { routingLane: 1 }).some(
        (i) =>
          i.code === "semantic.unknownField" && i.path.endsWith(".routingLane"),
      ),
    ).toBe(false);
  }
  expect(
    issues("sequence.message", { routingLane: 1 }).some(
      (i) =>
        i.code === "semantic.unknownField" && i.path.endsWith(".routingLane"),
    ),
  ).toBe(true);
  expect(
    issues("bpmn.sequenceFlow", { labelOffsetX: 1 }).some(
      (i) =>
        i.code === "semantic.unknownField" && i.path.endsWith(".labelOffsetX"),
    ),
  ).toBe(true);
});
test("page routing rejects manual and accepts orthogonal", () => {
  const check = (routing: unknown) =>
    validateDocument({
      ...doc,
      pages: [{ ...doc.pages[0], connectorRouting: routing }],
    } as unknown as Document);
  expect(
    check({ routing: "manual" }).some((i) =>
      i.path.endsWith(".connectorRouting.routing"),
    ),
  ).toBe(true);
  expect(
    check({ routing: "orthogonal", routingAvoidObstacles: true }).some((i) =>
      i.path.includes("connectorRouting"),
    ),
  ).toBe(false);
});
