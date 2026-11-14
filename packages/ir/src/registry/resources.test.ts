// Semantic validation of page guides, raster images and design tokens.

import { describe, expect, test } from "bun:test";
import { validate, expectValid } from "./test-helpers.ts";

describe("semantic validation", () => {
  test("validates persistent page guide coordinates and colors", () => {
    expect(
      validate("design.guide", {
        axis: "diagonal",
        position: Number.NaN,
        color: "red",
        hidden: "yes",
      }).map(({ code, path }) => ({ code, path })),
    ).toEqual([
      { code: "value.enum", path: "semantic.axis" },
      { code: "type.number", path: "semantic.position" },
      { code: "guide.color", path: "semantic.color" },
      { code: "type.boolean", path: "semantic.hidden" },
    ]);
  });

  test("validates normalized image crop rectangles", () => {
    const src =
      "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=";
    expectValid("image.raster", {
      src,
      alt: "Portrait",
      crop: { x: 0.1, y: 0.2, width: 0.7, height: 0.6 },
    });
    expect(
      validate("image.raster", {
        src,
        alt: "Portrait",
        crop: { x: 0.6, y: 0, width: 0.5, height: 1 },
      }).map(({ code, path }) => ({ code, path })),
    ).toEqual([{ code: "image.crop.bounds", path: "semantic.crop" }]);
    expect(
      validate("image.raster", {
        src,
        alt: "Portrait",
        crop: { x: 0, y: 0, width: 0, height: 1 },
      }).map(({ code, path }) => ({ code, path })),
    ).toEqual([{ code: "value.min", path: "semantic.crop.width" }]);
  });

  test("validates token mode literals, aliases and unique names", () => {
    expectValid("design.token", {
      name: "Action",
      kind: "color",
      value: "#2563eb",
      alias: "primitive",
      modes: [
        { name: "Dark", value: "#60a5fa" },
        { name: "Android", alias: "android-primary" },
      ],
    });
    expect(
      validate("design.token", {
        name: "Space",
        kind: "number",
        value: 8,
        modes: [
          { name: "Compact", value: -1, alias: "other" },
          { name: "Compact", value: "wide" },
        ],
      }).map(({ code, path }) => ({ code, path })),
    ).toEqual([
      { code: "token.modeChoice", path: "semantic.modes[0]" },
      { code: "token.number", path: "semantic.modes[0].value" },
      {
        code: "token.modeDuplicate",
        path: "semantic.modes[1].name",
      },
      { code: "token.number", path: "semantic.modes[1].value" },
    ]);
    expect(
      validate("design.token", {
        name: "Brand",
        kind: "color",
        value: "#123456",
        modes: [{ name: "Default", value: "#abcdef" }],
      }).map(({ code }) => code),
    ).toEqual(["token.modeReserved"]);
  });
});
