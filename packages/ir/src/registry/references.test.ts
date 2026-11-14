// Outgoing element references reported by each registered type.

import { describe, expect, test } from "bun:test";
import { getElementTypeDefinition } from "../registry.ts";

describe("references", () => {
  function refs(type: string, semantic: unknown): unknown {
    return getElementTypeDefinition(type)?.references(semantic);
  }

  test("edges report both endpoints", () => {
    expect(refs("edge.generic", { from: "a", to: "b" })).toEqual([
      { field: "from", id: "a" },
      { field: "to", id: "b" },
    ]);
  });

  test("erd relations report the table, not the column", () => {
    expect(
      refs("erd.relation", {
        from: { table: "t1", column: "c1" },
        to: { table: "t2", column: "c2" },
      }),
    ).toEqual([
      { field: "from.table", id: "t1" },
      { field: "to.table", id: "t2" },
    ]);
  });

  test("groups report each member with its index", () => {
    expect(refs("group", { memberIds: ["a", "b"] })).toEqual([
      { field: "memberIds[0]", id: "a" },
      { field: "memberIds[1]", id: "b" },
    ]);
  });

  test("groups report the mask role as a detachable reference", () => {
    expect(
      refs("group", { memberIds: ["mask", "content"], maskId: "mask" }),
    ).toEqual([
      { field: "maskId", id: "mask" },
      { field: "memberIds[0]", id: "mask" },
      { field: "memberIds[1]", id: "content" },
    ]);
  });

  test("responsive frames report their source and refresh bindings", () => {
    expect(
      refs("frame", {
        name: "Mobile",
        responsiveSource: "desktop",
        instanceBindings: [
          { source: "desktop-label", target: "mobile-label", baseline: "{}" },
        ],
        memberIds: ["mobile-label"],
      }),
    ).toEqual([
      { field: "instanceBindings[0].source", id: "desktop-label" },
      { field: "instanceBindings[0].target", id: "mobile-label" },
      { field: "responsiveSource", id: "desktop" },
      { field: "memberIds[0]", id: "mobile-label" },
    ]);
  });

  test("sequence activations point at their participant", () => {
    expect(refs("sequence.activation", { participant: "p1" })).toEqual([
      { field: "participant", id: "p1" },
    ]);
  });

  test("nodes have no outgoing references", () => {
    expect(refs("erd.table", { tableName: "t", columns: [] })).toEqual([]);
    expect(refs("shape.geo", { geo: "rect" })).toEqual([]);
  });

  test("tokens report default and per-mode aliases", () => {
    expect(
      refs("design.token", {
        name: "Action",
        kind: "color",
        value: "#2563eb",
        alias: "base",
        modes: [
          { name: "Dark", alias: "dark" },
          { name: "Light", value: "#ffffff" },
        ],
      }),
    ).toEqual([
      { field: "alias", id: "base" },
      { field: "modes[0].alias", id: "dark" },
    ]);
  });

  test("review comments report their contextual target", () => {
    expect(
      getElementTypeDefinition("review.comment")?.references({
        target: "button",
        messages: [],
      }),
    ).toEqual([{ field: "target", id: "button" }]);
  });

  test("survives malformed payloads without throwing", () => {
    expect(refs("edge.generic", null)).toEqual([]);
    expect(refs("edge.generic", { from: 42 })).toEqual([]);
    expect(refs("group", { memberIds: "not-an-array" })).toEqual([]);
    expect(refs("erd.relation", { from: "not-an-object" })).toEqual([]);
  });
});
