import { Editor } from "@nodetto/core";
import { serializeDocument } from "@nodetto/io";

export function obstacleRoutingBatch(): {
  document: string;
  operations: string;
} {
  let nextId = 0;
  const editor = new Editor({
    idSource: () => `fixture-${nextId++}`,
    rng: () => 0.5,
  });
  editor.setPageKind(editor.currentPageId, "state");
  const elements = [];
  for (let i = 0; i < 3; i++) {
    elements.push(
      editor.buildElement("frame", {
        id: `frame-${i}`,
        semantic: { name: `Stage${i}` },
        visual: { x: i * 500, y: 0, width: 460, height: 900 },
      }),
    );
  }
  const names = ["Idle", "Running", "Paused", "Done"];
  for (let i = 0; i < 20; i++) {
    elements.push(
      editor.buildElement("state.node", {
        id: `state-${i}`,
        semantic: {
          kind: i === 0 ? "initial" : "state",
          name: names[i] ?? `State${i}`,
        },
        visual: {
          x: (i % 3) * 500 + 60,
          y: Math.floor(i / 3) * 110 + 60,
          width: 150,
          height: 60,
        },
      }),
    );
  }
  for (let i = 0; i < 50; i++) {
    const from = i % 20;
    let to = (i * 7 + 3) % 20;
    if (from === to) to = (to + 1) % 20;
    elements.push(
      editor.buildElement("state.transition", {
        id: `edge-${i}`,
        semantic: {
          from: `state-${from}`,
          to: `state-${to}`,
          trigger: `event${i}`,
          routing: "orthogonal",
          routingAvoidObstacles: false,
        },
      }),
    );
  }
  editor.apply(
    elements.map((element) => ({ type: "createElement" as const, element })),
  );
  return {
    document: serializeDocument(editor.getSnapshot()),
    operations: JSON.stringify(
      Array.from({ length: 50 }, (_, i) => ({
        op: "update",
        id: `edge-${i}`,
        semantic: { routingAvoidObstacles: true },
      })),
    ),
  };
}
