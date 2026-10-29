import { describe, expect, test } from "bun:test";
import { UmlComponentType } from "./semantics.ts";
import {
  ELEMENT_TYPES,
  getElementTypeDefinition,
  isKnownElementType,
  listElementTypeDefinitions,
} from "./registry.ts";

/** The v1 registry, verbatim from product design section 5.2. */
const DESIGN_TABLE_TYPES: readonly string[] = [
  "node.generic",
  "edge.generic",
  "erd.table",
  "erd.relation",
  "uml.class",
  "uml.association",
  "sequence.participant",
  "sequence.message",
  "sequence.activation",
  "draw.freehand",
  "draw.path",
  "shape.geo",
  "text.note",
  "frame",
  "group",
];

describe("registry contents", () => {
  test("registers the design table plus assets and token resources", () => {
    expect(Array.from<string>(ELEMENT_TYPES).sort()).toEqual(
      [
        ...DESIGN_TABLE_TYPES,
        "state.node",
        "state.transition",
        "usecase.node",
        "usecase.relationship",
        ...Object.values(UmlComponentType),
        "erd.view",
        "erd.materialized-view",
        "erd.function",
        "erd.procedure",
        "image.raster",
        "ui.control",
        "design.token",
        "design.guide",
        "review.comment",
        "design.text-style",
        "bpmn.participant",
        "bpmn.lane",
        "bpmn.task",
        "bpmn.subProcess",
        "bpmn.callActivity",
        "bpmn.event",
        "bpmn.boundaryEvent",
        "bpmn.gateway",
        "bpmn.dataObject",
        "bpmn.dataStore",
        "bpmn.textAnnotation",
        "bpmn.group",
        "bpmn.sequenceFlow",
        "bpmn.messageFlow",
        "bpmn.association",
        "bpmn.dataAssociation",
        "breadboard.board",
        "breadboard.wire",
        "breadboard.resistor",
        "breadboard.led",
        "breadboard.capacitor",
        "breadboard.diode",
        "breadboard.transistor",
        "breadboard.button",
        "breadboard.potentiometer",
        "breadboard.ic",
        "breadboard.header",
        "breadboard.battery",
        "breadboard.netlist",
        "pcb.board",
        "pcb.footprint",
        "pcb.track",
        "pcb.via",
        "pcb.zone",
        "pcb.graphic",
      ].sort(),
    );
  });

  test("has no duplicate entries", () => {
    expect(new Set(ELEMENT_TYPES).size).toBe(ELEMENT_TYPES.length);
  });

  test("every definition declares a key order covering its own fields", () => {
    for (const definition of listElementTypeDefinitions()) {
      expect(definition.keyOrder.keys.length).toBeGreaterThan(0);
      const declared = new Set(definition.keyOrder.keys);
      for (const child of Object.keys(definition.keyOrder.children ?? {})) {
        expect(declared.has(child)).toBe(true);
      }
    }
  });

  test("isKnownElementType tracks the registry", () => {
    expect(isKnownElementType("erd.table")).toBe(true);
    expect(isKnownElementType("vendor.future")).toBe(false);
    expect(getElementTypeDefinition("vendor.future")).toBeUndefined();
  });

  test("edges cascade and containers detach on a deleted reference", () => {
    expect(getElementTypeDefinition("erd.relation")?.onReferenceDeleted).toBe(
      "cascade",
    );
    expect(getElementTypeDefinition("edge.generic")?.onReferenceDeleted).toBe(
      "cascade",
    );
    expect(getElementTypeDefinition("group")?.onReferenceDeleted).toBe(
      "detach",
    );
  });
});
