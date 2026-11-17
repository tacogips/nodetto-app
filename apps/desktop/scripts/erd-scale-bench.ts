// Headless core benchmark for one very large ERD page.
//
//   bun apps/desktop/scripts/erd-scale-bench.ts [--tables 2000] [--routing orthogonal] [--json]
//
// Measures the editor-core cost of the operations a user performs on the
// page (load, pick, drag, marquee, edit, undo, lint). Each "render pass" does
// what the canvas does after a commit: one shape context, every table's
// bounds and every relation's resolved route.
import {
  connectorPath,
  Editor,
  endpointReaderFor,
  lintNodeOverlaps,
  resolveConnector,
  shapeAuthoringWarnings,
} from "@nodetto/core";
import type { ErdTableSemantic } from "@nodetto/ir";
import {
  ERD_SCALE_PAGE,
  erdScaleDocument,
} from "./fixtures/erd-scale-document.ts";

const arg = (name: string): string | undefined => {
  const at = process.argv.indexOf(`--${name}`);
  return at >= 0 ? process.argv[at + 1] : undefined;
};
const tables = Number(arg("tables") ?? 2000);
const routing = arg("routing") as "straight" | "orthogonal" | undefined;
const fixture = erdScaleDocument({ tables, ...(routing ? { routing } : {}) });

interface Row {
  readonly name: string;
  readonly medianMs: number;
  readonly maxMs: number;
  readonly runs: number;
}
const rows: Row[] = [];
function measure(
  name: string,
  runs: number,
  body: (run: number) => void,
): void {
  const samples: number[] = [];
  for (let run = 0; run < runs; run += 1) {
    const start = performance.now();
    body(run);
    samples.push(performance.now() - start);
  }
  samples.sort((a, b) => a - b);
  rows.push({
    name,
    medianMs: samples[Math.floor(samples.length / 2)] ?? 0,
    maxMs: samples[samples.length - 1] ?? 0,
    runs,
  });
}

let editor!: Editor;
measure("load document", 3, () => {
  editor = new Editor({ document: fixture.document });
});
const first = fixture.tableIds[
  Math.floor(fixture.tableIds.length / 2)
] as string;
const origin = editor.store.get(first)?.visual as { x: number; y: number };

/** What the canvas recomputes after every commit. */
function renderPass(): void {
  const context = editor.createShapeContext();
  for (const element of editor.store.getPageElements(ERD_SCALE_PAGE)) {
    if (element.type === "erd.table") {
      context.boundsOf(element.id);
      shapeAuthoringWarnings(element, context);
    } else {
      const resolved = resolveConnector(
        element,
        context,
        endpointReaderFor(element.type),
      );
      if (resolved) connectorPath(element, resolved.points, context);
      shapeAuthoringWarnings(element, context);
    }
  }
}

measure("render pass (cold context)", 5, (run) => {
  // A no-op-sized commit invalidates the context like any edit does.
  editor.moveElements([{ id: first, x: origin.x + run + 1, y: origin.y }], {
    history: "ignore",
  });
  const start = performance.now();
  renderPass();
  void start;
});
measure("hit test (pointer over a table)", 20, (run) => {
  editor.moveElements([{ id: first, x: origin.x + run, y: origin.y }], {
    history: "ignore",
  });
  editor.hitTest({ x: origin.x + run + 30, y: origin.y + 20 });
});
measure("hit test (empty canvas)", 20, (run) => {
  editor.moveElements([{ id: first, x: origin.x + run, y: origin.y }], {
    history: "ignore",
  });
  editor.hitTest({ x: -500, y: -500 });
});
editor.selection.set([first]);
editor.beginBatch();
measure("drag one table: commit", 30, (run) => {
  editor.moveElements([{ id: first, x: origin.x + run, y: origin.y + run }]);
});
measure("drag one table: commit + render pass", 30, (run) => {
  editor.moveElements([
    { id: first, x: origin.x + 40 + run, y: origin.y + 40 + run },
  ]);
  renderPass();
});
editor.endBatch();
measure("undo drag + render pass", 1, () => {
  editor.undo();
  renderPass();
});
const hub = fixture.tableIds[0] as string;
const hubOrigin = editor.store.get(hub)?.visual as { x: number; y: number };
editor.selection.set([hub]);
editor.beginBatch();
measure("drag hub table (200 relations): commit + render pass", 20, (run) => {
  editor.moveElements([
    { id: hub, x: hubOrigin.x - run, y: hubOrigin.y - run },
  ]);
  renderPass();
});
editor.endBatch();
editor.selectAll();
measure("movable selection (all)", 3, () => {
  editor.movableSelection();
});
const everything = editor.movableSelection();
editor.beginBatch();
measure("drag everything: commit + render pass", 5, (run) => {
  editor.moveElements(
    everything.map((entry) => ({
      id: entry.id,
      x: entry.x + run + 1,
      y: entry.y + run + 1,
    })),
  );
  renderPass();
});
editor.endBatch();
editor.undo();
editor.selection.set([first]);
measure("rename table: commit + render pass", 10, (run) => {
  const semantic = editor.store.get(first)?.semantic as ErdTableSemantic;
  editor.apply([
    {
      type: "updateSemantic",
      id: first,
      semantic: { ...semantic, tableName: `renamed_${run}` },
    },
  ]);
  renderPass();
});
measure("add column: commit + render pass", 10, (run) => {
  const semantic = editor.store.get(first)?.semantic as ErdTableSemantic;
  editor.apply([
    {
      type: "updateSemantic",
      id: first,
      semantic: {
        ...semantic,
        columns: [
          ...semantic.columns,
          { id: `extra-${run}`, name: `extra_${run}`, dataType: "text" },
        ],
      },
    },
  ]);
  renderPass();
});
const created: string[] = [];
measure("create table: commit + render pass", 10, (run) => {
  created.push(
    editor.createElement("erd.table", {
      visual: { x: -400, y: run * 200, width: 240 },
    }),
  );
  renderPass();
});
measure("delete table: commit + render pass", 10, (run) => {
  editor.deleteElements([created[run] as string]);
  renderPass();
});
measure("create relation: commit + render pass", 10, (run) => {
  editor.createElement("erd.relation", {
    semantic: {
      from: { table: fixture.tableIds[run] as string, column: "c0" },
      to: { table: fixture.tableIds[run + 500] as string, column: "c1" },
      cardinality: "1:*",
    },
  });
  renderPass();
});
measure("snapshot", 5, () => {
  editor.getSnapshot();
});
measure("node overlap lint", 5, () => {
  lintNodeOverlaps(editor.getSnapshot(), ERD_SCALE_PAGE);
});

if (process.argv.includes("--json")) {
  console.log(
    JSON.stringify({ tables, relations: fixture.relationIds.length, rows }),
  );
} else {
  console.log(
    `${tables} tables, ${fixture.relationIds.length} relations${routing ? `, ${routing} routing` : ""}`,
  );
  for (const row of rows)
    console.log(
      `${row.name.padEnd(56)} median ${row.medianMs.toFixed(2).padStart(9)} ms   max ${row.maxMs.toFixed(2).padStart(9)} ms   (${row.runs} runs)`,
    );
}
