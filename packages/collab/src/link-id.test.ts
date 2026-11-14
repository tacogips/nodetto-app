import { expect, test } from "bun:test";
import type { Element } from "@nodetto/ir";
import * as Y from "yjs";
import { elementFromY, elementToY } from "./ydoc.ts";

const element: Element = {
  id: "e",
  page: "p",
  type: "rect",
  index: "a0",
  semantic: {},
  visual: {},
};

test("Yjs preserves present and absent linkId across updates", () => {
  for (const visual of [{ linkId: "linked" }, {}]) {
    const source = new Y.Doc();
    source
      .getMap("elements")
      .set(element.id, elementToY({ ...element, visual }));
    const target = new Y.Doc();
    Y.applyUpdate(target, Y.encodeStateAsUpdate(source));
    const result = elementFromY(
      element.id,
      target.getMap("elements").get(element.id),
    );
    expect(result.visual).toEqual(visual);
    expect("linkId" in result.visual).toBe("linkId" in visual);
  }
});
