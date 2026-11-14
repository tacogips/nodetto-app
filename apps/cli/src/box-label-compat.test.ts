import { expect, test } from "bun:test";
import { Editor, bindSelectionTextStyle, createTextStyle } from "@nodetto/core";
import type { Document, Visual } from "@nodetto/ir";
import { importDrawio, parseDocument, serializeDocument } from "@nodetto/io";

function svg(document: Document): string {
  return new Editor({ document }).exportPageSvg() ?? "";
}
function stripVertical(document: Document): Document {
  return {
    ...document,
    elements: document.elements.map((element) => {
      const { verticalAlign: _verticalAlign, ...style } =
        element.visual.style ?? {};
      return { ...element, visual: { ...element.visual, style } };
    }),
  };
}
function boxDocument(
  type: "node.generic" | "shape.geo",
  style: Visual["style"],
): Document {
  const editor = new Editor();
  const element = editor.buildElement(type, {
    id: "widget",
    semantic: {
      label: "Widget",
      ...(type === "shape.geo" ? { geo: "rect" } : {}),
    },
    visual: { x: 0, y: 0, width: 100, height: 100, style },
  });
  editor.apply([{ type: "createElement", element }]);
  return editor.getSnapshot();
}

test("legacy box values preserve SVG bytes", () => {
  for (const type of ["node.generic", "shape.geo"] as const) {
    for (const verticalAlign of ["top", "middle", "bottom"] as const) {
      const doc = boxDocument(type, { verticalAlign });
      expect(svg(doc)).toBe(svg(stripVertical(doc)));
    }
  }
});

test("bound and detached box styles preserve legacy SVG bytes", () => {
  for (const type of ["node.generic", "shape.geo"] as const) {
    for (const verticalAlign of ["top", "bottom"] as const) {
      const editor = new Editor({ document: boxDocument(type, {}) });
      const style = createTextStyle(editor, "Widget", {
        fontFamily: "sans-serif",
        fontSize: 13,
        fontWeight: 400,
        fontStyle: "normal",
        lineHeight: 1.2,
        letterSpacing: 0,
        textAlign: "middle",
        textDecoration: "none",
        verticalAlign,
      });
      editor.selection.set(["widget"]);
      bindSelectionTextStyle(editor, style as string);
      const bound = editor.getSnapshot();
      expect(svg(bound)).toBe(svg(stripVertical(bound)));
      const detached = {
        ...bound,
        elements: bound.elements.map((element) => {
          if (element.id !== "widget") return element;
          const { textStyle: _textStyle, ...visual } = element.visual;
          return { ...element, visual };
        }),
      };
      expect(svg(detached)).toBe(svg(stripVertical(detached)));
    }
  }
});

test("draw.io alignment stays centered without the marker", () => {
  for (const align of ["top", "bottom"]) {
    const xml = `<mxGraphModel><root><mxCell id="0"/><mxCell id="1" parent="0"/><mxCell id="box" value="Widget" style="verticalAlign=${align};" vertex="1" parent="1"><mxGeometry x="0" y="0" width="100" height="100" as="geometry"/></mxCell></root></mxGraphModel>`;
    const doc = importDrawio(xml).document;
    expect(
      doc.elements.some(
        (element) => element.visual.style?.verticalAlign === align,
      ),
    ).toBe(true);
    expect(svg(doc)).toBe(svg(stripVertical(doc)));
  }
});

test("marker positions box labels and survives JSONL", () => {
  for (const type of ["node.generic", "shape.geo"] as const) {
    const top = boxDocument(type, {
      verticalAlign: "top",
      boxLabelAlign: true,
    });
    const bottom = boxDocument(type, {
      verticalAlign: "bottom",
      boxLabelAlign: true,
    });
    const topY = Number(
      svg(top).match(/<text[^>]*\sy="([\d.]+)"[^>]*>Widget<\/text>/)?.[1],
    );
    const bottomY = Number(
      svg(bottom).match(/<text[^>]*\sy="([\d.]+)"[^>]*>Widget<\/text>/)?.[1],
    );
    expect(topY).toBeCloseTo((type === "node.generic" ? 10 : 8) + 7.8);
    expect(bottomY).toBeCloseTo(100 - (type === "node.generic" ? 10 : 8) - 7.8);
    expect(
      parseDocument(serializeDocument(top)).elements.find(
        (element) => element.id === "widget",
      )?.visual.style?.boxLabelAlign,
    ).toBe(true);
  }
});

test("sequence participants ignore box alignment marker", () => {
  const editor = new Editor();
  const element = editor.buildElement("sequence.participant", {
    id: "participant",
    semantic: { name: "Widget", kind: "service", order: "a1" },
    visual: {
      x: 0,
      y: 0,
      width: 100,
      height: 100,
      style: { verticalAlign: "top", boxLabelAlign: true },
    },
  });
  editor.apply([{ type: "createElement", element }]);
  const doc = editor.getSnapshot();
  const plain = {
    ...doc,
    elements: doc.elements.map((item) => ({
      ...item,
      visual: { ...item.visual, style: {} },
    })),
  };
  expect(svg(doc)).toBe(svg(plain));
});
