import { describe, expect, test } from "bun:test";
import type { PathContour } from "@nodetto/ir";
import { booleanSourcePolygon } from "./boolean-operations.ts";
import { exportPcbPage } from "./pcb-export.ts";
import { composeCompoundPath } from "./mobile-code/compose-modifiers.ts";
import { swiftCompoundPath } from "./mobile-code/swift-modifiers.ts";
import {
  compoundPathGeometry,
  compoundPathMaskCss,
} from "./shapes/compound-path.ts";
import { element, makeEditor } from "./test-helpers.ts";

const line: PathContour = {
  closed: false,
  points: [
    { x: 0, y: 0 },
    { x: 100, y: 0 },
  ],
};
const triangle: PathContour = {
  points: [
    { x: 0, y: 0 },
    { x: 100, y: 0 },
    { x: 50, y: 100 },
  ],
};
function path(contours: PathContour[]) {
  return element({
    id: "path",
    type: "draw.path",
    semantic: { contours, fillRule: "evenodd" },
    visual: {},
  });
}

describe("open compound paths", () => {
  test("geometry separates open and closed contours and checks minima", () => {
    const open = compoundPathGeometry(path([line]));
    expect(open?.closed).toEqual([false]);
    expect(open?.path).toBe("");
    expect(open?.openPath).toStartWith("M");
    expect(open?.box.height).toBe(1);
    const mixed = compoundPathGeometry(path([triangle, line]));
    expect(mixed?.closed).toEqual([true, false]);
    expect(mixed?.path).toBe(compoundPathGeometry(path([triangle]))?.path);
    expect(mixed?.openPath).toStartWith("M");
    expect(
      compoundPathGeometry(path([{ closed: false, points: [{ x: 0, y: 0 }] }])),
    ).toBeNull();
    expect(compoundPathGeometry(path([{ points: line.points }]))).toBeNull();
    expect(compoundPathMaskCss(path([line]))).toBeUndefined();
  });
  test("picks only strokes and exports an unfilled path", () => {
    const editor = makeEditor();
    const id = editor.createElement("draw.path", {
      semantic: {
        contours: [
          {
            closed: false,
            points: [
              { x: 0, y: 0 },
              { x: 50, y: 100 },
              { x: 100, y: 0 },
            ],
          },
        ],
        fillRule: "evenodd",
      },
      visual: {
        x: 0,
        y: 0,
        width: 100,
        height: 100,
        style: { fill: "#abcdef", stroke: "#123456" },
      },
    });
    expect(editor.hitTest({ x: 25, y: 50 })).toBe(id);
    expect(editor.hitTest({ x: 50, y: 0 })).toBeNull();
    expect(editor.hitTest({ x: 50, y: 30 })).toBeNull();
    const svg = editor.exportPageSvg({ padding: 0 });
    expect(svg).toContain('fill="none"');
    expect(svg).toContain('stroke="#123456"');
    expect(svg).not.toContain('fill="#abcdef"');
  });
  test("region consumers omit open contours", () => {
    const open = path([line]);
    expect(booleanSourcePolygon(open, {} as never)).toBeNull();
    expect(swiftCompoundPath(open, {})).toBe("EmptyView()");
    expect(composeCompoundPath(open, {})).toBe("Spacer(modifier = Modifier)");
  });
});

test("PCB export skips open contours", () => {
  const group = element({
    id: "layer",
    type: "group",
    semantic: {
      memberIds: ["path"],
      fabricationLayer: {
        kind: "copper",
        side: "top",
        unitsPerMm: 10,
        originX: 0,
        originY: 0,
      },
    },
  });
  const report = (contours: PathContour[]) =>
    exportPcbPage({ elements: [group, path(contours)] }, "page-1");
  expect(report([line]).layers[0]?.objects).toBe(0);
  expect(report([line]).warnings.join(" ")).toContain("no filled outline");
  expect(report([triangle, line]).layers[0]?.objects).toBe(
    report([triangle]).layers[0]?.objects,
  );
  expect(report([triangle, line]).layers[0]?.objects).toBe(1);
});
