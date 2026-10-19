import { Editor } from "@nodetto/core";
import { serializeDocument } from "@nodetto/io";

export function denseRelationsDocument(
  count: number,
  pages = 1,
  avoidance?: boolean,
  hidden = false,
): string {
  const editor = new Editor();
  const ids = [editor.currentPageId];
  for (let i = 1; i < pages; i++)
    ids.push(editor.createPage({ id: `page-${i}`, name: `Page ${i}` }));
  const elements = [];
  for (const [pageIndex, page] of ids.entries()) {
    editor.setCurrentPage(page);
    elements.push(
      editor.buildElement("frame", {
        id: `frame-${pageIndex}`,
        semantic: { name: `Database ${pageIndex}` },
        visual: { x: -20, y: -40, width: 1500, height: 800 },
      }),
    );
    for (let i = 0; i < 12; i++)
      elements.push(
        editor.buildElement("erd.table", {
          id: `table-${pageIndex}-${i}`,
          visual: {
            x: (i % 4) * 320,
            y: Math.floor(i / 4) * 200,
            width: 220,
            ...(hidden && i === 11 ? { hidden: true } : {}),
          },
          semantic: {
            tableName: `table_${pageIndex}_${i}`,
            columns: [
              {
                id: `column-${pageIndex}-${i}`,
                name: "id",
                dataType: "int",
                pk: true,
              },
            ],
          },
        }),
      );
  }
  // Keep the final page relation-free to detect work leaking between pages.
  for (let i = 0; i < count; i++) {
    const p = pages === 1 ? 0 : i % (pages - 1);
    editor.setCurrentPage(ids[p] ?? editor.currentPageId);
    const from = i % 12;
    const to = (i + 5) % 12;
    elements.push(
      editor.buildElement("erd.relation", {
        id: `relation-${i}`,
        semantic: {
          from: { table: `table-${p}-${from}`, column: `column-${p}-${from}` },
          to: { table: `table-${p}-${to}`, column: `column-${p}-${to}` },
          cardinality: "*:1",
          routing: "orthogonal",
          ...(avoidance === undefined
            ? {}
            : { routingAvoidObstacles: avoidance }),
        },
      }),
    );
  }
  editor.apply(
    elements.map((element) => ({ type: "createElement" as const, element })),
  );
  return serializeDocument(editor.getSnapshot());
}
