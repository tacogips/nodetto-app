import { expect, test } from "bun:test";
import { Editor } from "@nodetto/core";
import { Resvg } from "@resvg/resvg-js";

test("one-unit divider survives PNG rasterization", () => {
  const editor = new Editor();
  editor.createElement("shape.geo", {
    semantic: { geo: "rect" },
    visual: {
      x: 0,
      y: 10,
      width: 200,
      height: 1,
      style: { fill: "#000000", stroke: "none", cornerRadius: 0 },
    },
  });
  const svg = editor.exportPageSvg({
    padding: 10,
    background: "#ffffff",
  }) as string;
  const image = new Resvg(svg, { fitTo: { mode: "zoom", value: 2 } }).render();
  const x = Math.floor(image.width / 2);
  const pixel = (y: number) => image.pixels[(y * image.width + x) * 4];
  expect(pixel(19)).toBeGreaterThan(240);
  expect(pixel(20)).toBeLessThan(15);
  expect(pixel(21)).toBeLessThan(15);
  expect(pixel(22)).toBeGreaterThan(240);
});
