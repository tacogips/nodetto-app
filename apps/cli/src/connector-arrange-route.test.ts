import { expect, test } from "bun:test";
import { parseDocument, serializeDocument } from "@nodetto/io";
import { Editor } from "../../../packages/core/src/editor.ts";
import { planRoute } from "../../../packages/core/src/arrange-route.ts";
import { pageMetrics } from "../../../packages/core/src/diagram-lint/metrics.ts";
import {
  connectorArrangeDocument,
  CONNECTOR_ARRANGE_STATE_PAGE,
} from "./__fixtures__/connector-arrange.ts";

test("route improves fixture overlap metrics and is idempotent", () => {
  const doc = parseDocument(connectorArrangeDocument());
  const page = doc.pages.find((p) => p.name === CONNECTOR_ARRANGE_STATE_PAGE);
  if (!page) throw new Error("Missing page");
  const editor = new Editor({ document: doc });
  const before = pageMetrics(editor.store, page.id, editor.registry);
  editor.apply(
    planRoute(editor.store, page.id, editor.registry, { resetManual: false }),
  );
  const after = pageMetrics(editor.store, page.id, editor.registry);
  console.log("route-only metrics", JSON.stringify({ before, after }));
  expect(after.segmentOverlaps).toBeLessThan(before.segmentOverlaps);
  expect(after.labelOverlaps).toBeLessThan(before.labelOverlaps);
  const elements = editor.store.getPageElements(page.id);
  for (const loop of elements.filter((element) => {
    const semantic = element.semantic as Record<string, unknown>;
    return (
      element.type === "state.transition" && semantic["from"] === semantic["to"]
    );
  })) {
    const semantic = loop.semantic as Record<string, unknown>;
    const others = elements.filter(
      (element) =>
        element.id !== loop.id && element.type === "state.transition",
    );
    for (const other of others) {
      const value = other.semantic as Record<string, unknown>;
      if (value["from"] === semantic["from"])
        expect(value["fromPort"]).not.toBe(semantic["fromPort"]);
      if (value["to"] === semantic["from"])
        expect(value["toPort"]).not.toBe(semantic["fromPort"]);
    }
  }
  const text = serializeDocument(editor.getSnapshot());
  editor.apply(
    planRoute(editor.store, page.id, editor.registry, { resetManual: false }),
  );
  expect(serializeDocument(editor.getSnapshot())).toBe(text);
});
