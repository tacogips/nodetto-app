// Semantic validation of frames and groups.

import { describe, expect, test } from "bun:test";
import { codes, validate, expectValid } from "./test-helpers.ts";

describe("semantic validation", () => {
  test("requires group isolation to be boolean", () => {
    expect(
      codes(validate("group", { memberIds: ["a"], isolate: "yes" })),
    ).toContain("type.boolean");
  });

  test("requires a group mask to be one of its members", () => {
    expect(
      codes(validate("group", { memberIds: ["content"], maskId: "mask" })),
    ).toEqual(["group.maskMember"]);
  });

  test("validates raster mask mode only with a mask member", () => {
    expect(
      codes(validate("group", { memberIds: ["a"], maskMode: "alpha" })),
    ).toEqual(["group.maskMode"]);
    expect(
      codes(
        validate("group", {
          memberIds: ["a"],
          maskId: "a",
          maskMode: "opaque",
        }),
      ),
    ).toEqual(["value.enum"]);
  });

  test("validates Boolean group operation, arity and mask exclusivity", () => {
    expect(
      codes(
        validate("group", {
          memberIds: ["only"],
          booleanOperation: "divide",
        }),
      ),
    ).toEqual(["value.enum", "group.booleanMembers"]);
    expect(
      codes(
        validate("group", {
          memberIds: ["a", "b"],
          maskId: "a",
          booleanOperation: "union",
        }),
      ),
    ).toEqual(["group.clipConflict"]);
  });

  test("validates frame layout grids and their bounded dimensions", () => {
    expectValid("frame", {
      name: "Web",
      layoutGrids: [
        {
          id: "minor",
          kind: "grid",
          size: 8,
          color: "#3b82f6",
          opacity: 0.2,
        },
        {
          id: "desktop-columns",
          kind: "columns",
          count: 12,
          gutter: 20,
          margin: 80,
          color: "#ef4444",
          opacity: 0.12,
          visible: false,
        },
      ],
    });
    expect(
      validate("frame", {
        name: "Bad",
        layoutGrids: [
          { id: "bad-grid", kind: "grid", size: 0, color: "red", opacity: 2 },
          {
            id: "bad-rows",
            kind: "rows",
            count: 25,
            gutter: -1,
            margin: -2,
            color: "#123456",
            opacity: 0.5,
          },
        ],
      }).map(({ code }) => code),
    ).toEqual([
      "frame.layoutGridColor",
      "frame.layoutGridOpacity",
      "value.min",
      "frame.layoutGridCount",
      "value.min",
      "value.min",
    ]);
    expect(
      validate("frame", {
        name: "Duplicate",
        layoutGrids: [
          {
            id: "same",
            kind: "grid",
            size: 8,
            color: "#123456",
            opacity: 0.2,
          },
          {
            id: "same",
            kind: "grid",
            size: 16,
            color: "#abcdef",
            opacity: 0.1,
          },
        ],
      }).map(({ code }) => code),
    ).toEqual(["frame.layoutGridDuplicate"]);
  });

  test("validates target platforms and complete non-negative safe areas", () => {
    expectValid("frame", {
      name: "iPhone",
      platform: "ios",
      safeArea: { top: 47, right: 0, bottom: 34, left: 0 },
    });
    expect(
      validate("frame", {
        name: "Bad device",
        platform: "watch",
        safeArea: { top: -1, right: 0, bottom: 0 },
      }).map(({ code, path }) => ({ code, path })),
    ).toEqual([
      { code: "value.enum", path: "semantic.platform" },
      { code: "value.min", path: "semantic.safeArea.top" },
      { code: "field.missing", path: "semantic.safeArea.left" },
    ]);
  });

  test("validates prototype viewport overflow modes", () => {
    for (const prototypeOverflow of ["none", "vertical", "horizontal", "both"])
      expectValid("frame", { name: "Scrollable", prototypeOverflow });
    expect(
      validate("frame", {
        name: "Bad scroll",
        prototypeOverflow: "diagonal",
      }).map(({ code, path }) => ({ code, path })),
    ).toEqual([{ code: "value.enum", path: "semantic.prototypeOverflow" }]);
  });

  test("rejects frames with conflicting refresh source modes", () => {
    expect(
      validate("frame", {
        name: "Ambiguous",
        instanceOf: "component",
        responsiveSource: "desktop",
      }).map(({ code, path }) => ({ code, path })),
    ).toEqual([
      { code: "frame.sourceMode", path: "semantic.responsiveSource" },
    ]);
  });

  test("validates stable and uniquely named component variant properties", () => {
    expectValid("frame", {
      name: "Button",
      component: true,
      variantSet: "Button",
      variantProperties: [
        { id: "state", name: "State", value: "Hover" },
        { id: "size", name: "Size", value: "Large" },
      ],
    });
    expect(
      validate("frame", {
        name: "Bad button",
        component: true,
        variantProperties: [
          { id: "same", name: "State", value: " " },
          { id: "same", name: " state ", value: "Hover" },
        ],
      }).map(({ code }) => code),
    ).toEqual([
      "frame.variantPropertyValue",
      "frame.variantPropertyDuplicateId",
      "frame.variantPropertyDuplicateName",
    ]);
  });
});
