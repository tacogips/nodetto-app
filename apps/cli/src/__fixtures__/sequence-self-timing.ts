import { writeFileSync } from "node:fs";
import { Editor, keyAfter } from "@nodetto/core";
import { serializeDocument } from "@nodetto/io";

export function sequenceSelfTimingDocument(): string {
  let nextId = 0;
  const editor = new Editor({
    idSource: () => `fixture-${nextId++}`,
    rng: () => 0.5,
  });
  editor.setPageKind(editor.currentPageId, "sequence");
  const participants: string[] = [];
  let participantOrder = "a";
  for (let i = 0; i < 5; i++) {
    participantOrder = keyAfter(participantOrder, () => 0.5);
    participants.push(
      editor.createElement("sequence.participant", {
        id: `participant-${i}`,
        semantic: {
          name: `Widget ${i}`,
          kind: "service",
          order: participantOrder,
        },
        visual: { x: i * 240, y: 0 },
      }),
    );
  }
  let order = "a";
  for (let i = 0; i < 200; i++) {
    order = keyAfter(order, () => 0.5);
    const from = participants[i % 5];
    const to = participants[i % 10 === 0 ? i % 5 : (i + 1) % 5];
    if (from === undefined || to === undefined)
      throw new Error("Missing participant");
    editor.createElement("sequence.message", {
      id: `message-${i}`,
      semantic: { from, to, order, kind: "sync", label: `Check ${i}` },
    });
  }
  return serializeDocument(editor.getSnapshot());
}

if (import.meta.main) {
  const output = process.argv[2];
  if (output === undefined) throw new Error("Output path required");
  writeFileSync(output, sequenceSelfTimingDocument());
}
