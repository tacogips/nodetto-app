import { describe, expect, test } from "bun:test";
import { deflateRawSync } from "node:zlib";
import {
  connectorWaypointToPage,
  type Element,
  GEO_KINDS,
  validateDocument,
} from "@nodetto/ir";
import { parseDocument } from "../jsonl/parse.ts";
import { parseXml } from "../bpmn/xml.ts";
import { exportDrawio } from "./export.ts";
import { DrawioParseError, importDrawio } from "./import.ts";

const FLOW_MODEL = `<mxGraphModel dx="800" dy="600" grid="1">
  <root>
    <mxCell id="0"/>
    <mxCell id="1" parent="0"/>
    <mxCell id="start" value="Begin" style="rounded=1;whiteSpace=wrap;html=1;fillColor=#dae8fc;strokeColor=#6c8ebf;gradientColor=#7ea6e0;fontStyle=3;fontSize=14;" vertex="1" parent="1">
      <mxGeometry x="40" y="40" width="120" height="60" as="geometry"/>
    </mxCell>
    <mxCell id="check" value="&lt;b&gt;Ready?&lt;/b&gt;&lt;br&gt;yes &amp;amp; no" style="rhombus;whiteSpace=wrap;html=1;dashed=1;" vertex="1" parent="1">
      <mxGeometry x="240" y="30" width="100" height="80" as="geometry"/>
    </mxCell>
    <mxCell id="sky" value="Cloud" style="ellipse;shape=cloud;whiteSpace=wrap;html=1;opacity=50;" vertex="1" parent="1">
      <mxGeometry x="420" y="40" width="120" height="80" as="geometry"/>
    </mxCell>
    <mxCell id="tri" value="" style="triangle;whiteSpace=wrap;html=1;" vertex="1" parent="1">
      <mxGeometry x="40" y="160" width="60" height="80" as="geometry"/>
    </mxCell>
    <mxCell id="back" value="Back" style="shape=singleArrow;direction=west;whiteSpace=wrap;html=1;" vertex="1" parent="1">
      <mxGeometry x="140" y="160" width="100" height="60" as="geometry"/>
    </mxCell>
    <mxCell id="memo" value="Plain text" style="text;html=1;align=left;" vertex="1" parent="1">
      <mxGeometry x="280" y="170" width="100" height="30" as="geometry"/>
    </mxCell>
    <mxCell id="lane" value="Lane A" style="swimlane;whiteSpace=wrap;html=1;" vertex="1" parent="1">
      <mxGeometry x="40" y="300" width="300" height="160" as="geometry"/>
    </mxCell>
    <mxCell id="inner" value="Inside" style="shape=document;whiteSpace=wrap;html=1;" vertex="1" parent="lane">
      <mxGeometry x="20" y="40" width="100" height="60" as="geometry"/>
    </mxCell>
    <mxCell id="grp" value="" style="group" vertex="1" connectable="0" parent="1">
      <mxGeometry x="400" y="300" width="120" height="80" as="geometry"/>
    </mxCell>
    <mxCell id="grouped" value="Grouped" style="shape=note;whiteSpace=wrap;html=1;" vertex="1" parent="grp">
      <mxGeometry x="10" y="10" width="100" height="60" as="geometry"/>
    </mxCell>
    <UserObject label="Wrapped" link="https://example.invalid" id="wrapped">
      <mxCell style="shape=mxgraph.aws4.resourceIcon;whiteSpace=wrap;html=1;" vertex="1" parent="1">
        <mxGeometry x="600" y="300" width="80" height="80" as="geometry"/>
      </mxCell>
    </UserObject>
    <mxCell id="pic" value="" style="shape=image;image=data:image/png,AAAA;" vertex="1" parent="1">
      <mxGeometry x="600" y="40" width="40" height="40" as="geometry"/>
    </mxCell>
    <mxCell id="go" value="next" style="edgeStyle=orthogonalEdgeStyle;rounded=1;html=1;endArrow=block;endFill=0;startArrow=diamondThin;startFill=1;strokeColor=#ff0000;" edge="1" parent="1" source="start" target="check">
      <mxGeometry relative="1" as="geometry"/>
    </mxCell>
    <mxCell id="go-label" value="always" style="edgeLabel;html=1;" vertex="1" connectable="0" parent="go">
      <mxGeometry x="-0.2" relative="1" as="geometry"/>
    </mxCell>
    <mxCell id="free" value="" style="html=1;endArrow=open;jumpStyle=arc;" edge="1" parent="1">
      <mxGeometry relative="1" as="geometry">
        <mxPoint x="100" y="520" as="sourcePoint"/>
        <mxPoint x="400" y="520" as="targetPoint"/>
        <Array as="points">
          <mxPoint x="250" y="600"/>
        </Array>
      </mxGeometry>
    </mxCell>
    <mxCell id="dangling" style="html=1;" edge="1" parent="1">
      <mxGeometry relative="1" as="geometry"/>
    </mxCell>
    <mxCell id="hiddenLayer" value="Notes" parent="0" visible="0"/>
    <mxCell id="secret" value="Hidden" style="whiteSpace=wrap;html=1;" vertex="1" parent="hiddenLayer">
      <mxGeometry x="700" y="500" width="80" height="40" as="geometry"/>
    </mxCell>
  </root>
</mxGraphModel>`;

const SECOND_MODEL = `<mxGraphModel><root><mxCell id="0"/><mxCell id="1" parent="0"/><mxCell id="only" value="Ünïcode →" style="shape=hexagon;whiteSpace=wrap;html=1;" vertex="1" parent="1"><mxGeometry x="0" y="0" width="120" height="80" as="geometry"/></mxCell></root></mxGraphModel>`;

function compressed(xml: string): string {
  return Buffer.from(deflateRawSync(encodeURIComponent(xml))).toString(
    "base64",
  );
}

const FILE = `<?xml version="1.0" encoding="UTF-8"?>
<mxfile host="app.diagrams.net">
  <diagram id="d1" name="Flow">${FLOW_MODEL}</diagram>
  <diagram id="d2" name="Second">${compressed(SECOND_MODEL)}</diagram>
</mxfile>`;

function byId(elements: readonly Element[], id: string): Element {
  const element = elements.find((candidate) => candidate.id === id);
  if (!element) throw new Error(`missing ${id}`);
  return element;
}

describe("importDrawio", () => {
  const report = importDrawio(FILE, { title: "Imported" });
  const { document } = report;
  const elements = document.elements;

  test("one valid freeform page per diagram, compressed pages included", () => {
    expect(validateDocument(document)).toEqual([]);
    expect(document.title).toBe("Imported");
    expect(document.pages).toEqual([
      { id: "drawio-page-1", name: "Flow", kind: "freeform" },
      { id: "drawio-page-2", name: "Second", kind: "freeform" },
    ]);
    expect(byId(elements, "drawio-only")).toMatchObject({
      page: "drawio-page-2",
      type: "shape.geo",
      semantic: { geo: "hexagon", label: "Ünïcode →" },
    });
  });

  test("shapes, paint and HTML labels map onto geometric shapes", () => {
    expect(byId(elements, "drawio-start")).toMatchObject({
      type: "shape.geo",
      semantic: { geo: "rect", label: "Begin" },
      visual: {
        x: 40,
        y: 40,
        width: 120,
        height: 60,
        style: {
          fill: "#dae8fc",
          stroke: "#6c8ebf",
          cornerRadius: 9,
          fontWeight: 700,
          fontStyle: "italic",
          fontSize: 14,
          fillGradient: {
            type: "linear",
            angle: 180,
            stops: [
              { offset: 0, color: "#dae8fc" },
              { offset: 1, color: "#7ea6e0" },
            ],
          },
        },
      },
    });
    expect(byId(elements, "drawio-check")).toMatchObject({
      semantic: { geo: "diamond", label: "Ready?\nyes & no" },
      visual: { style: { dash: "dashed" } },
    });
    expect(byId(elements, "drawio-sky")).toMatchObject({
      semantic: { geo: "cloud" },
      visual: { style: { opacity: 0.5 } },
    });
    expect(byId(elements, "drawio-memo")).toMatchObject({
      type: "text.note",
      semantic: { text: "Plain text" },
      visual: { style: { textAlign: "start" } },
    });
  });

  test("directional shapes turn or mirror to draw.io's direction", () => {
    // draw.io's triangle points east: a quarter turn of nodetto's upward one.
    expect(byId(elements, "drawio-tri").visual).toMatchObject({
      x: 30,
      y: 170,
      width: 80,
      height: 60,
      rotation: 90,
    });
    expect(byId(elements, "drawio-back").visual).toMatchObject({
      flipX: true,
    });
  });

  test("containers become frames and children keep page positions", () => {
    expect(byId(elements, "drawio-lane")).toMatchObject({
      type: "frame",
      semantic: { name: "Lane A" },
    });
    expect(byId(elements, "drawio-inner")).toMatchObject({
      semantic: { geo: "document" },
      visual: { x: 60, y: 340 },
    });
    expect(elements.some((element) => element.id === "drawio-grp")).toBe(false);
    expect(byId(elements, "drawio-grouped")).toMatchObject({
      semantic: { geo: "note" },
      visual: { x: 410, y: 310 },
    });
    expect(byId(elements, "drawio-secret").visual.hidden).toBe(true);
  });

  test("connectors keep endpoints, labels, arrows, routing and jumps", () => {
    expect(byId(elements, "drawio-go")).toMatchObject({
      type: "edge.generic",
      semantic: {
        from: "drawio-start",
        to: "drawio-check",
        label: "next always",
        arrowheads: { start: "diamond", end: "triangle" },
        routing: "orthogonal",
      },
      visual: { style: { stroke: "#ff0000", cornerRadius: 10 } },
    });
    const free = byId(elements, "drawio-free");
    expect(free).toMatchObject({
      semantic: {
        fromPoint: { x: 100, y: 520 },
        toPoint: { x: 400, y: 520 },
        arrowheads: { end: "open" },
        routing: "manual",
      },
      visual: { style: { lineJumps: "arc" } },
    });
    const [waypoint] = (
      free.semantic as { routingWaypoints: { u: number; v: number }[] }
    ).routingWaypoints;
    expect(
      connectorWaypointToPage(
        waypoint as { u: number; v: number },
        { x: 100, y: 520 },
        { x: 400, y: 520 },
      ),
    ).toEqual({ x: 250, y: 600 });
  });

  test("unsupported content is reported, not silently dropped", () => {
    expect(byId(elements, "drawio-wrapped")).toMatchObject({
      semantic: { geo: "rect", label: "Wrapped" },
    });
    expect(elements.some((element) => element.id === "drawio-pic")).toBe(false);
    expect(elements.some((element) => element.id === "drawio-dangling")).toBe(
      false,
    );
    expect(report.warnings.map((warning) => warning.message)).toEqual([
      'Shape "mxgraph.aws4.resourceIcon" has no nodetto equivalent and was imported as a rectangle.',
      "Images were skipped.",
      "A connector without endpoints was skipped.",
    ]);
  });

  test("a bare mxGraphModel imports as one page", () => {
    const single = importDrawio(SECOND_MODEL);
    expect(single.document.pages).toHaveLength(1);
    expect(single.document.title).toBe("Page 1");
  });

  test("malformed input fails with a draw.io parse error", () => {
    expect(() => importDrawio("<svg/>")).toThrow(DrawioParseError);
    expect(() =>
      importDrawio("<mxfile><diagram>%%%</diagram></mxfile>"),
    ).toThrow("not base64");
    expect(() => importDrawio("<mxfile>")).toThrow(DrawioParseError);
    expect(() =>
      importDrawio(
        '<!DOCTYPE x [<!ENTITY a "b">]><mxfile><diagram>x</diagram></mxfile>',
      ),
    ).toThrow(DrawioParseError);
  });
});

/** Geo kinds on one page, in cell order, with any flip or turn noted. */
function pageShapes(
  document: { pages: readonly { id: string; name: string }[] } & {
    elements: readonly Element[];
  },
  name: string,
): string[] {
  const page = document.pages.find((candidate) => candidate.name === name);
  return document.elements
    .filter((element) => element.page === page?.id)
    .filter((element) => element.type === "shape.geo")
    .map((element) => {
      const { geo } = element.semantic as { geo: string };
      const visual = element.visual;
      return `${geo}${visual.flipX ? "+flipX" : ""}${visual.flipY ? "+flipY" : ""}${visual.rotation ? `@${visual.rotation}` : ""}`;
    });
}

// Built in app.diagrams.net through its UI: page 1 holds the General
// palette, page 2 the Flowchart palette, page 3 Advanced, page 4 Basic, and
// page 5 a flowchart connected with Alt+click, labelled and recoloured.
describe("a compressed file saved by app.diagrams.net", async () => {
  const text = await Bun.file(
    new URL(
      "../__fixtures__/drawio/diagrams-net-palettes.drawio",
      import.meta.url,
    ),
  ).text();
  const { document, warnings } = importDrawio(text);

  test("every page imports as a valid document", () => {
    expect(validateDocument(document)).toEqual([]);
    expect(document.pages.map((page) => page.name)).toEqual([
      "Page-1",
      "Page-2",
      "Page-3",
      "Page-4",
      "Page-5",
    ]);
  });

  test("the Flowchart palette maps symbol by symbol", () => {
    expect(pageShapes(document, "Page-2")).toEqual([
      "rect", // Annotation: no nodetto bracket
      "card",
      "collate",
      "parallelogram", // Data
      "cylinder", // Database
      "diamond", // Decision
      "delay",
      "direct-data",
      "display",
      "document",
      "triangle", // Extract or measurement
      "internal-storage",
      "loop-limit",
      "manual-input",
      "trapezoid+flipY", // Manual operation
      "triangle+flipY", // Merge or storage
      "multi-document",
      "off-page",
      "ellipse", // On-page reference
      "or",
      "tape",
      "rect", // Parallel mode
      "predefined-process",
      "hexagon", // Preparation
      "rect", // Process
      "sequential-data",
      "sort",
      "ellipse", // Start
      "stored-data",
      "summing-junction",
      "rect", // Terminator, drawn as a stadium
      "arrow", // Transfer
    ]);
    const page = document.pages.find(
      (candidate) => candidate.name === "Page-2",
    );
    expect(
      warnings
        .filter((warning) => warning.page === page?.name)
        .map((warning) => warning.message),
    ).toEqual([
      'Shape "mxgraph.flowchart.annotation_1" has no nodetto equivalent and was imported as a rectangle.',
      'Shape "mxgraph.flowchart.parallel_mode" has no nodetto equivalent and was imported as a rectangle.',
    ]);
  });

  test("General and Advanced shapes keep their kind and direction", () => {
    expect(pageShapes(document, "Page-1")).toEqual([
      "rect",
      "rect", // Rounded rectangle
      "ellipse",
      "rect", // Square
      "ellipse", // Circle
      "predefined-process", // Process
      "diamond",
      "parallelogram",
      "hexagon",
      "triangle@90", // draw.io's triangle points east
      "cylinder",
      "cloud",
      "document",
      "internal-storage",
      "cube",
      "chevron", // Step
      "trapezoid",
      "tape",
      "note",
      "card",
      "callout",
      "callout", // Wedge callout
      "person", // UML actor, approximated
      "rect", // Or gate
      "delay", // And gate
      "stored-data", // Data storage
    ]);
    expect(pageShapes(document, "Page-3")).toEqual([
      "rect", // Double rectangle, approximated
      "ellipse",
      "ellipse",
      "sequential-data", // Tape data
      "manual-input",
      "loop-limit",
      "off-page",
      "delay",
      "display",
      "arrow+flipX",
      "arrow",
      "arrow@-90",
      "arrow@90",
      "double-arrow",
      "double-arrow@90",
      "person", // User
      "cross",
      "cylinder", // Data store
      "or",
      "summing-junction", // Sum
      "sort",
      "collate",
      "rect", // Switch
      "rect", // Corner
    ]);
    expect(warnings.map((warning) => warning.message)).toContain(
      'Shape "umlActor" was approximated as a person shape.',
    );
  });

  test("an Alt+click flowchart keeps labels, paint and bound connectors", () => {
    const page = document.pages.find(
      (candidate) => candidate.name === "Page-5",
    );
    const onPage = document.elements.filter(
      (element) => element.page === page?.id,
    );
    const shapes = onPage.filter((element) => element.type === "shape.geo");
    expect(
      shapes.map((shape) => (shape.semantic as { label: string }).label),
    ).toEqual([
      "Begin",
      "Load order",
      "In stock?",
      "Invoice",
      "Orders DB",
      "Done",
    ]);
    const [begin, load, , , orders, done] = shapes;
    expect(begin?.visual.style).toMatchObject({
      fill: "#d5e8d4",
      stroke: "#82b366",
    });
    expect(load?.visual.style).toMatchObject({
      fill: "#dae8fc",
      color: "#1a3d6d",
      fontWeight: 700,
    });
    expect(orders?.visual.style?.fillGradient?.stops).toEqual([
      { offset: 0, color: "#f8cecc" },
      { offset: 1, color: "#ea6b66" },
    ]);
    expect(done?.visual.style).toMatchObject({
      dash: "dashed",
      cornerRadius: 30,
    });
    const edges = onPage.filter((element) => element.type === "edge.generic");
    expect(
      edges.map((edge) => {
        const semantic = edge.semantic as { from: string; to: string };
        return [semantic.from, semantic.to];
      }),
    ).toEqual(
      shapes
        .slice(0, -1)
        .map((shape, index) => [shape.id, shapes[index + 1]?.id]),
    );
  });
});

describe("draw.io directions", () => {
  test("direction turns the drawn stencil rather than naming where it points", () => {
    const model = `<mxGraphModel><root><mxCell id="0"/><mxCell id="1" parent="0"/>
      <mxCell id="down" style="shape=offPageConnector;" vertex="1" parent="1"><mxGeometry x="0" y="0" width="60" height="60" as="geometry"/></mxCell>
      <mxCell id="west" style="shape=offPageConnector;direction=south;" vertex="1" parent="1"><mxGeometry x="100" y="0" width="60" height="60" as="geometry"/></mxCell>
      <mxCell id="manual" style="shape=mxgraph.flowchart.manual_operation;" vertex="1" parent="1"><mxGeometry x="200" y="0" width="100" height="60" as="geometry"/></mxCell>
    </root></mxGraphModel>`;
    const { document } = importDrawio(model);
    expect(
      byId(document.elements, "drawio-down").visual.rotation,
    ).toBeUndefined();
    expect(byId(document.elements, "drawio-west").visual.rotation).toBe(90);
    expect(byId(document.elements, "drawio-manual")).toMatchObject({
      semantic: { geo: "trapezoid" },
      visual: { flipY: true },
    });
  });
});

describe("exportDrawio", () => {
  test("every geo kind, flip and arrowhead survives a round trip", () => {
    const kinds = GEO_KINDS.map(
      (geo, index): Element => ({
        id: `shape-${geo}`,
        page: "p",
        type: "shape.geo",
        index: `a${String(index).padStart(3, "0")}`,
        semantic: { geo, label: `${geo} label` },
        visual: {
          x: index * 200,
          y: 0,
          width: 160,
          height: 100,
          ...(index % 3 === 1 ? { flipX: true } : {}),
          ...(index % 4 === 2 ? { flipY: true } : {}),
          style: { fill: "#fef3c7", stroke: "#92400e", strokeWidth: 2 },
        },
      }),
    );
    const heads = [
      "arrow",
      "triangle",
      "dot",
      "open",
      "diamond",
      "diamond-open",
      "circle",
      "bar",
      "crow-foot",
    ];
    const edges = heads.map(
      (head, index): Element => ({
        id: `edge-${head}`,
        page: "p",
        type: "edge.generic",
        index: `b${String(index).padStart(3, "0")}`,
        semantic: {
          from: "shape-rect",
          to: "shape-ellipse",
          arrowheads: { start: head, end: head },
          label: head,
          ...(index === 0
            ? { routing: "manual", routingWaypoints: [{ u: 0.5, v: 60 }] }
            : index === 1
              ? { routing: "orthogonal", fromPort: "bottom", toPort: "top" }
              : {}),
        },
        visual:
          index === 2 ? { style: { lineJumps: "gap", cornerRadius: 8 } } : {},
      }),
    );
    const source = {
      schemaVersion: 1,
      id: "doc",
      title: "Round trip",
      pages: [{ id: "p", name: "Shapes", kind: "freeform" as const }],
      elements: [...kinds, ...edges],
    };
    const exported = exportDrawio(source);
    expect(exported.warnings).toEqual([]);
    expect(exported.xml).not.toContain("auto-start-reverse");
    expect(parseXml(exported.xml).local).toBe("mxfile");
    const back = importDrawio(exported.xml).document;
    expect(validateDocument(back)).toEqual([]);
    expect(back.pages[0]?.name).toBe("Shapes");
    for (const shape of kinds) {
      const imported = byId(back.elements, `drawio-${shape.id}`);
      expect(imported.semantic).toEqual(shape.semantic);
      expect(imported.visual).toMatchObject({
        x: shape.visual.x,
        y: shape.visual.y,
        width: 160,
        height: 100,
        style: { fill: "#fef3c7", stroke: "#92400e", strokeWidth: 2 },
      });
      // Cylinders are never mirrored, so their flips are not exported.
      if ((shape.semantic as { geo: string }).geo === "cylinder") continue;
      expect(imported.visual.flipX === true).toBe(shape.visual.flipX === true);
      expect(imported.visual.flipY === true).toBe(shape.visual.flipY === true);
      expect(imported.visual.rotation).toBeUndefined();
    }
    for (const edge of edges) {
      const imported = byId(back.elements, `drawio-${edge.id}`);
      const head = (edge.semantic as { label: string }).label;
      expect(imported.semantic).toMatchObject({
        from: "drawio-shape-rect",
        to: "drawio-shape-ellipse",
        label: head,
        arrowheads: { start: head, end: head },
      });
    }
    expect(byId(back.elements, "drawio-edge-arrow").semantic).toMatchObject({
      routing: "manual",
      routingWaypoints: [{ u: 0.5, v: 60 }],
    });
    expect(byId(back.elements, "drawio-edge-triangle").semantic).toMatchObject({
      routing: "orthogonal",
    });
    expect(exported.xml).toContain("exitX=0.5;exitY=1;");
    expect(byId(back.elements, "drawio-edge-dot").visual.style).toMatchObject({
      lineJumps: "gap",
      cornerRadius: 10,
    });
  });

  test("draw.io's own shape names bring the flowchart kinds back", () => {
    // Without the nodetto key, only draw.io's native shape names remain.
    const native = [
      "tape",
      "stored-data",
      "display",
      "loop-limit",
      "collate",
      "sort",
      "summing-junction",
      "or",
      "multi-document",
      "direct-data",
      "sequential-data",
      "double-arrow",
      "right-triangle",
      "person",
      "package",
      "document",
      "delay",
      "card",
      "off-page",
    ] as const;
    const shapes = native.map(
      (geo, index): Element => ({
        id: `native-${geo}`,
        page: "p",
        type: "shape.geo",
        index: `a${String(index).padStart(3, "0")}`,
        semantic: { geo, label: geo },
        visual: {
          x: index * 200,
          y: 0,
          width: 160,
          height: 100,
          ...(index % 2 === 1 ? { flipX: true } : {}),
        },
      }),
    );
    const { xml } = exportDrawio({
      schemaVersion: 1,
      id: "doc",
      title: "Native",
      pages: [{ id: "p", name: "Native", kind: "freeform" as const }],
      elements: shapes,
    });
    const report = importDrawio(xml.replace(/nodettoGeo=[^;"]*;/g, ""));
    expect(report.warnings).toEqual([]);
    for (const shape of shapes) {
      const imported = byId(report.document.elements, `drawio-${shape.id}`);
      expect(imported.semantic).toEqual(shape.semantic);
      expect(imported.visual.flipX === true).toBe(shape.visual.flipX === true);
      expect(imported.visual.rotation).toBeUndefined();
    }
  });

  test("ERD tables and UML classes become stacked lists; the rest is reported", async () => {
    const fixtures = new URL("../__fixtures__/", import.meta.url);
    const erd = parseDocument(
      await Bun.file(new URL("erd.jsonl", fixtures)).text(),
    );
    const erdXml = exportDrawio(erd);
    expect(erdXml.xml).toContain("childLayout=stackLayout");
    expect(erdXml.xml).toMatch(/value="id: [^"]+ PK"/);
    expect(erdXml.xml).toContain("startArrow=ERmany");
    const reimported = importDrawio(erdXml.xml).document;
    expect(validateDocument(reimported)).toEqual([]);

    const uml = parseDocument(
      await Bun.file(new URL("uml-class.jsonl", fixtures)).text(),
    );
    const umlXml = exportDrawio(uml);
    expect(umlXml.xml).toContain('style="line;');
    expect(umlXml.xml).toContain("endArrow=block;endFill=0");

    const sequence = parseDocument(
      await Bun.file(new URL("sequence.jsonl", fixtures)).text(),
    );
    expect(
      exportDrawio(sequence).warnings.some((warning) =>
        warning.message.includes("has no fixed geometry"),
      ),
    ).toBe(true);
  });
});

test("use-case diagrams export as draw.io UML actors, ellipses and folders", async () => {
  const document = parseDocument(
    await Bun.file(
      new URL("../__fixtures__/usecase.jsonl", import.meta.url),
    ).text(),
  );
  const { xml, warnings } = exportDrawio(document);
  expect(warnings).toEqual([]);
  expect(xml).toContain("shape=umlActor");
  expect(xml).toMatch(/value="Borrow item" style="ellipse;/);
  expect(xml).toContain("shape=folder");
  expect(xml).toContain("«include»");
  expect(xml).toContain("endArrow=block;endFill=0");
  const reimported = importDrawio(xml).document;
  expect(validateDocument(reimported)).toEqual([]);
  expect(
    reimported.elements.find((element) => element.id === "drawio-records")
      ?.semantic,
  ).toEqual({ geo: "package", label: "Records" });
});
