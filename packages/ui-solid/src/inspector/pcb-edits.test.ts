import { expect, test } from "bun:test";
import { pcbNetMembers } from "@nodetto/core";
import type { Document, Element, Page } from "@nodetto/ir";
import { pcbNetMemberIds, pcbSemanticCommand } from "./pcb-edits.ts";

const PAGE: Page = { id: "pcb-page", name: "PCB", kind: "pcb" };
const footprint: Element = {
  id: "fp",
  page: PAGE.id,
  type: "pcb.footprint",
  index: "a1",
  semantic: {
    reference: "R1",
    value: "10k",
    library: "",
    at: [1, 2],
    rotation: 0,
    side: "top",
    pads: [
      {
        number: "1",
        type: "smd",
        shape: "rect",
        at: [0, 0],
        rotation: 0,
        size: [1, 1],
        layers: ["F.Cu"],
        net: "GND",
      },
    ],
    graphics: [],
  },
  visual: {},
};
const track: Element = {
  id: "track",
  page: PAGE.id,
  type: "pcb.track",
  index: "a2",
  semantic: {
    layer: "F.Cu",
    width: 0.25,
    net: "GND",
    points: [
      [0, 0],
      [1, 1],
    ],
  },
  visual: {},
};
const via: Element = {
  id: "via",
  page: PAGE.id,
  type: "pcb.via",
  index: "a3",
  semantic: {
    at: [1, 1],
    diameter: 0.8,
    drill: 0.4,
    layers: ["F.Cu", "B.Cu"],
    net: "GND",
  },
  visual: {},
};
const document: Document = {
  schemaVersion: 1,
  id: "doc",
  title: "PCB",
  pages: [PAGE],
  elements: [footprint, track, via],
};

test("footprint coordinate command rounds to nanometres", () => {
  expect(pcbSemanticCommand(footprint, "x", 12.3456789)).toMatchObject({
    type: "updateSemantic",
    id: "fp",
    semantic: { at: [12.345679, 2] },
  });
});

test("track width and via dimensions reject invalid values", () => {
  expect(pcbSemanticCommand(track, "width", 0)).toBeNull();
  expect(pcbSemanticCommand(track, "width", -0.1)).toBeNull();
  expect(pcbSemanticCommand(track, "width", 0.0000001)).toBeNull();
  expect(pcbSemanticCommand(via, "drill", 0.8)).toBeNull();
  expect(pcbSemanticCommand(via, "drill", 0)).toBeNull();
});

test("net edit updates the semantic net", () => {
  expect(pcbSemanticCommand(track, "net", "VCC")).toMatchObject({
    type: "updateSemantic",
    semantic: { net: "VCC" },
  });
});

test("Select net ids are pcbNetMembers", () => {
  expect(pcbNetMemberIds(document, PAGE.id, "GND")).toEqual(
    pcbNetMembers(document, PAGE.id, "GND"),
  );
  expect(pcbNetMemberIds(document, PAGE.id, "")).toEqual([]);
});
