import { expect, test } from "bun:test";
import type { ElementAnimation, Visual } from "@nodetto/ir";
import { applyCommands, CommandError, type Command } from "./commands.ts";
import { Store } from "./store.ts";
import { document, element, makeEditor } from "./test-helpers.ts";

const shape = element({
  id: "shape",
  type: "shape.geo",
  semantic: { geo: "rect" },
  visual: { x: 3 },
});
const carrier = element({
  id: "carrier",
  type: "presentation.slide",
  semantic: {},
});
const cases = ["create-shape", "create-carrier", "update", "replace"] as const;
function command(
  kind: (typeof cases)[number],
  animation: ElementAnimation,
): Command {
  const visual: Visual = { animation };
  if (kind === "create-shape" || kind === "create-carrier")
    return {
      type: "createElement",
      element: { ...(kind === "create-shape" ? shape : carrier), visual },
    };
  return {
    type: kind === "update" ? "updateVisual" : "replaceVisual",
    id: shape.id,
    visual,
  };
}
for (const kind of cases) {
  test(`${kind} validates atomically and preserves unknown settings`, () => {
    const initial = kind.startsWith("create") ? [] : [shape];
    for (const animation of [
      { enter: "invalid-effect" },
      { slide: { mode: "invalid-mode" } },
      { durationMs: -1 },
    ]) {
      const store = new Store(document(initial));
      const before = structuredClone(store.getSnapshot());
      try {
        applyCommands(store, [command(kind, animation as ElementAnimation)]);
        throw new Error("expected CommandError");
      } catch (error) {
        expect(error).toBeInstanceOf(CommandError);
        if (!(error instanceof CommandError)) throw error;
        expect(
          error.issues.some((issue) =>
            issue.path.startsWith("visual.animation"),
          ),
        ).toBe(true);
      }
      expect(store.getSnapshot()).toEqual(before);
    }
    for (const animation of [{ slide: { mode: "fade" } }, { future: 1 }]) {
      const store = new Store(document(initial));
      applyCommands(store, [command(kind, animation as ElementAnimation)]);
      expect(
        store.get(kind === "create-carrier" ? "carrier" : "shape")?.visual
          .animation as unknown,
      ).toEqual(animation);
    }
  });
}
test("undo restores the complete prior visual", () => {
  const editor = makeEditor({ document: document([shape]) });
  const before = structuredClone(editor.store.get("shape")?.visual);
  editor.apply([
    {
      type: "updateVisual",
      id: "shape",
      visual: { animation: { enter: "fade-in" } },
    },
  ]);
  editor.undo();
  expect(editor.store.get("shape")?.visual).toEqual(before);
});
