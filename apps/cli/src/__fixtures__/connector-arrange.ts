import { Editor } from "@nodetto/core";
import { serializeDocument } from "@nodetto/io";

export const CONNECTOR_ARRANGE_STATE_PAGE = "States";
export const CONNECTOR_ARRANGE_ARCHITECTURE_PAGE = "Architecture";

export function connectorArrangeDocument(): string {
  let nextId = 0;
  const editor = new Editor({
    idSource: () => `fixture-${nextId++}`,
    rng: () => 0.5,
  });
  editor.renamePage(editor.currentPageId, CONNECTOR_ARRANGE_STATE_PAGE);
  editor.setPageKind(editor.currentPageId, "state");
  const elements = [];
  for (let i = 0; i < 4; i++) {
    elements.push(
      editor.buildElement("frame", {
        id: `frame-${i}`,
        semantic: { name: `Stage${i}` },
        visual: { x: i * 520, y: 0, width: 420, height: 1100 },
      }),
    );
  }
  const names = ["Idle", "Running", "Paused", "Done"];
  for (let i = 0; i < 17; i++) {
    elements.push(
      editor.buildElement("state.node", {
        id: `state-${String(i).padStart(2, "0")}`,
        semantic: {
          kind: i === 0 ? "initial" : "state",
          name: names[i] ?? `State${i}`,
        },
        visual: {
          x: (i % 4) * 520 + 60,
          y: Math.floor(i / 4) * 130 + 70,
          width: 150,
          height: 60,
        },
      }),
    );
  }
  for (let i = 0; i < 43; i++) {
    const from = i % 17;
    let to = (i * 7 + 3) % 17;
    if (from === to) to = (to + 1) % 17;
    elements.push(
      editor.buildElement("state.transition", {
        id: `edge-${String(i).padStart(2, "0")}`,
        semantic: {
          from: `state-${String(from).padStart(2, "0")}`,
          to: `state-${String(to).padStart(2, "0")}`,
          trigger: `event${String(i).padStart(2, "0")}`,
          routing: "orthogonal",
          routingAvoidObstacles: true,
        },
      }),
    );
  }
  for (const [i, state] of [2, 5, 9, 13].entries()) {
    const id = `state-${String(state).padStart(2, "0")}`;
    elements.push(
      editor.buildElement("state.transition", {
        id: `loop-${i}`,
        semantic: {
          from: id,
          to: id,
          trigger: `loop${i}`,
          routing: "orthogonal",
          routingAvoidObstacles: true,
        },
      }),
    );
  }
  editor.apply(
    elements.map((element) => ({ type: "createElement" as const, element })),
  );
  const page = editor.createPage({
    id: "architecture",
    name: CONNECTOR_ARRANGE_ARCHITECTURE_PAGE,
  });
  editor.setPageKind(page, "architecture");
  const boxes = [
    ["a", 0, 0],
    ["c", 300, 0],
    ["b", 600, 0],
    ["d", 300, 200],
  ] as const;
  editor.apply(
    boxes.map(([id, x, y]) => ({
      type: "createElement" as const,
      element: editor.buildElement("node.generic", {
        id: `box-${id}`,
        semantic: { label: id.toUpperCase() },
        visual: { x, y, width: 120, height: 60 },
      }),
    })),
  );
  return serializeDocument(editor.getSnapshot());
}

if (import.meta.main) process.stdout.write(connectorArrangeDocument());
