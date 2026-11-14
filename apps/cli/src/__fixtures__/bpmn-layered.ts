import { Editor } from "@nodetto/core";
import { serializeDocument } from "@nodetto/io";

export function bpmnLayeredDocument(units = 60): string {
  let nextId = 0;
  const editor = new Editor({
    idSource: () => `fixture-${nextId++}`,
    rng: () => 0.5,
  });
  editor.setPageKind(editor.currentPageId, "bpmn");
  editor.renamePage(editor.currentPageId, "Flow");
  const elements = [];
  for (let pool = 0; pool < 3; pool++) {
    const y = pool * 600;
    elements.push(
      editor.buildElement("bpmn.participant", {
        id: `pool-${pool}`,
        semantic: { name: `Pool ${pool}`, collapsed: false },
        visual: { x: 0, y, width: 2400, height: 500 },
      }),
    );
    for (let lane = 0; lane < 2; lane++) {
      elements.push(
        editor.buildElement("bpmn.lane", {
          id: `lane-${pool * 2 + lane}`,
          semantic: { name: `Lane ${pool * 2 + lane}`, parent: `pool-${pool}` },
          visual: { x: 30, y: y + lane * 250, width: 2370, height: 250 },
        }),
      );
    }
  }
  for (let i = 0; i < units; i++) {
    const lane = i % 6;
    elements.push(
      editor.buildElement("bpmn.task", {
        id: `task-${i}`,
        semantic: {
          name: `Order step ${i}`,
          taskType: "user",
          loop: "none",
          parent: `lane-${lane}`,
        },
        visual: {
          x: 60 + Math.floor(i / 6) * 180,
          y: Math.floor(lane / 2) * 600 + (lane % 2) * 250 + 60,
          width: 100,
          height: 60,
        },
      }),
    );
    if (i >= 6)
      elements.push(
        editor.buildElement("bpmn.sequenceFlow", {
          id: `flow-${i}`,
          semantic: { from: `task-${i - 6}`, to: `task-${i}` },
        }),
      );
  }
  editor.apply(
    elements.map((element) => ({ type: "createElement" as const, element })),
  );
  return serializeDocument(editor.getSnapshot());
}
