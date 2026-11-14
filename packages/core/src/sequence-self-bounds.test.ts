import { expect, test } from "bun:test";
import { document, element, makeEditor } from "./test-helpers.ts";

function bounds(
  self: boolean,
  participantHeight?: number,
  activationHeight?: number,
) {
  const editor = makeEditor({
    document: document([
      element({
        id: "participant",
        type: "sequence.participant",
        semantic: { name: "Widget", kind: "service", order: "a1" },
        visual: {
          x: 0,
          y: 0,
          ...(participantHeight === undefined
            ? {}
            : { height: participantHeight }),
        },
      }),
      element({
        id: "other",
        type: "sequence.participant",
        semantic: { name: "Order", kind: "service", order: "a2" },
        visual: { x: 240, y: 0 },
      }),
      element({
        id: "first",
        type: "sequence.message",
        semantic: {
          from: "participant",
          to: "other",
          order: "a1",
          kind: "sync",
        },
      }),
      element({
        id: "last",
        type: "sequence.message",
        semantic: {
          from: "participant",
          to: self ? "participant" : "other",
          order: "a2",
          kind: "sync",
        },
      }),
      element({
        id: "activation",
        type: "sequence.activation",
        semantic: {
          participant: "participant",
          fromOrder: "a1",
          toOrder: "a2",
        },
        visual:
          activationHeight === undefined ? {} : { height: activationHeight },
      }),
    ]),
  });
  return {
    participant: editor.getBounds("participant"),
    activation: editor.getBounds("activation"),
  };
}

test("implicit participant and activation heights cover a trailing self-message", () => {
  const result = bounds(true);
  expect(result.participant?.height).toBe(216 + 32 + 60);
  expect(result.activation?.y).toBe(164);
  expect(result.activation?.height).toBe(216 + 32 - 164);
});

test("normal trailing messages retain implicit bounds", () => {
  const result = bounds(false);
  expect(result.participant?.height).toBe(216 + 60);
  expect(result.activation?.height).toBe(216 - 164);
});

test("saved participant and activation heights remain authoritative", () => {
  const result = bounds(true, 230, 27);
  expect(result.participant?.height).toBe(230);
  expect(result.activation?.height).toBe(27);
});
