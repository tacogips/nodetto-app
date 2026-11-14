// draw.io (diagrams.net) export: an uncompressed `.drawio` file.
//
// Every page becomes a `<diagram>`. Geometric shapes use draw.io's own
// shapes with matching proportions and carry a `nodettoGeo` style key so a
// round trip restores the exact kind; text notes, frames, generic nodes and
// state nodes use their natural draw.io counterparts; ERD tables and UML
// classes become draw.io's stacked list containers with one row per column
// or member. Connectors keep endpoints, ports, manual waypoints, routing
// style, arrowheads, rounded bends and line jumps. Connectors are written
// before shapes, matching nodetto's painting order. Types without a draw.io
// counterpart are written as labelled rectangles and reported.

import {
  comparePageOrder,
  type Document,
  type Element,
  getElementTypeDefinition,
} from "@nodetto/ir";
import { serializeXml } from "../bpmn/xml.ts";
import {
  type DrawioExportOptions,
  type DrawioExportReport,
  type DrawioExportWarning,
  xml,
} from "./export-common.ts";
import { PageWriter } from "./export-page.ts";

export type {
  DrawioExportOptions,
  DrawioExportReport,
  DrawioExportWarning,
} from "./export-common.ts";

/** Types that carry no artwork of their own. */
const SILENT_TYPES = new Set([
  "design.token",
  "design.guide",
  "design.text-style",
  "review.comment",
  "group",
]);

/** Serialize a nodetto document as an uncompressed draw.io file. */
export function exportDrawio(
  document: Document,
  options: DrawioExportOptions = {},
): DrawioExportReport {
  const warnings: DrawioExportWarning[] = [];
  const wanted = options.pageIds ? new Set(options.pageIds) : null;
  const pages = [...document.pages]
    .sort(comparePageOrder)
    .filter((page) => !wanted || wanted.has(page.id));
  const diagrams = pages.map((page) => {
    const fallbacks = new Map<string, number>();
    const writer = new PageWriter(warnings, fallbacks);
    const elements = document.elements
      .filter((element) => element.page === page.id)
      .sort((left, right) =>
        left.index < right.index
          ? -1
          : left.index > right.index
            ? 1
            : left.id < right.id
              ? -1
              : 1,
      );
    const edges: Element[] = [];
    for (const element of elements) {
      const category = getElementTypeDefinition(element.type)?.category;
      if (SILENT_TYPES.has(element.type) || category === "resource") continue;
      if (category === "edge") {
        if (element.type === "sequence.message")
          writer.fallback(element, "has no fixed geometry and was skipped");
        else edges.push(element);
        continue;
      }
      writer.node(element);
    }
    const vertexCells = [...writer.cells];
    writer.cells.length = 0;
    for (const edge of edges) writer.edge(edge);
    for (const [key, count] of fallbacks)
      if (count > 1) {
        const [type, message] = key.split("\u0000");
        warnings.push({
          message: `${count - 1} more ${type} element(s) ${message}.`,
        });
      }
    return xml("diagram", { id: page.id, name: page.name }, [
      xml(
        "mxGraphModel",
        {
          grid: 1,
          gridSize: 10,
          guides: 1,
          tooltips: 1,
          connect: 1,
          arrows: 1,
          fold: 1,
          page: 0,
          pageScale: 1,
          math: 0,
          shadow: 0,
        },
        [
          xml("root", {}, [
            xml("mxCell", { id: "0" }),
            xml("mxCell", { id: "1", parent: "0" }),
            // Connectors paint beneath shapes in nodetto.
            ...writer.cells,
            ...vertexCells,
          ]),
        ],
      ),
    ]);
  });
  return {
    xml: serializeXml(
      xml("mxfile", { host: "nodetto", agent: "nodetto" }, diagrams),
    ),
    warnings,
  };
}
