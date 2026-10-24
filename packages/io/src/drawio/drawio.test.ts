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
