import { expect, test } from "bun:test";
import { Editor } from "@nodetto/core";
import {
  initialScreen,
  presentationFlows,
  presentationKeyAction,
} from "./prototype-presentation.ts";

test("presentation flows follow alphabetical flow order", () => {
  const editor = new Editor();
  const z = editor.createElement("frame", {
    semantic: { name: "Z", prototypeStart: true },
  });
  const a = editor.createElement("frame", {
    semantic: { name: "A", prototypeStart: true },
  });
  expect(presentationFlows(editor.store, editor.createShapeContext())).toEqual([
    { name: "A", startId: a },
    { name: "Z", startId: z },
  ]);
});

test("initial screen chooses requested flow, first flow, selection, then first frame", () => {
  const flows = [
    { name: "A", startId: "a" },
    { name: "B", startId: "b" },
  ];
  expect(initialScreen(flows, "B", "selected", ["fallback"])).toBe("b");
  expect(initialScreen(flows, "missing", "selected", ["fallback"])).toBe("a");
  expect(initialScreen([], undefined, "selected", ["fallback"])).toBe(
    "selected",
  );
  expect(initialScreen([], undefined, undefined, ["fallback"])).toBe(
    "fallback",
  );
  expect(initialScreen([], undefined, undefined, [])).toBeUndefined();
});

test("presentation keys prioritize overlay close and available history", () => {
  expect(presentationKeyAction("Escape", { overlays: 1, history: 1 })).toBe(
    "close-overlay",
  );
  expect(presentationKeyAction("Escape", { overlays: 0, history: 1 })).toBe(
    "exit",
  );
  expect(
    presentationKeyAction("Backspace", { overlays: 0, history: 0 }),
  ).toBeUndefined();
  expect(presentationKeyAction("Backspace", { overlays: 0, history: 1 })).toBe(
    "back",
  );
  expect(presentationKeyAction("ArrowLeft", { overlays: 0, history: 1 })).toBe(
    "back",
  );
  expect(presentationKeyAction("r", { overlays: 0, history: 0 })).toBe(
    "restart",
  );
  expect(presentationKeyAction("R", { overlays: 0, history: 0 })).toBe(
    "restart",
  );
});
