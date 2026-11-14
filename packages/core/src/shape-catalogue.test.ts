import { describe, expect, test } from "bun:test";
import { Editor } from "./editor.ts";
import {
  connectShape,
  findShape,
  SHAPE_CATALOGUE,
  searchShapes,
  shapeCreation,
} from "./shape-catalogue.ts";
import { Tool } from "./tools.ts";

describe("shape catalogue", () => {
  test("lists each shape ID once and every shape creates a known type", () => {
    const ids = SHAPE_CATALOGUE.map((shape) => shape.id);
    expect(new Set(ids).size).toBe(ids.length);
    const editor = new Editor();
    for (const shape of SHAPE_CATALOGUE) {
      expect(editor.registry.get(shape.type)).toBeDefined();
      expect(shapeCreation(shape.id) === null).toBe(shape.connector);
    }
  });

  test("filters by words, category families and connectors", () => {
    const uml = searchShapes({ category: "uml" });
    expect(uml.length).toBeGreaterThan(0);
    expect(uml.every((shape) => shape.category.startsWith("uml-"))).toBe(true);
    expect(uml.map((shape) => shape.id)).toContain(Tool.Class);
    expect(
      searchShapes({ category: "UML state" }).map((shape) => shape.id),
    ).toContain(Tool.InitialState);
    expect(searchShapes({ query: "actor" }).map((shape) => shape.id)).toEqual([
      Tool.StickFigure,
      Tool.UseCaseActor,
      Tool.Actor,
    ]);
    expect(
      searchShapes({ category: "uml-use-case" }).map((shape) => shape.id),
    ).toContain(Tool.UseCaseSystem);
    expect(
      searchShapes({ query: "flowchart decision" }).map((shape) => shape.id),
    ).toEqual([Tool.FlowDecision]);
    const connectors = searchShapes({ category: "erd", connector: true });
    expect(connectors.map((shape) => shape.id)).toEqual([
      Tool.Relation,
      Tool.ForeignKey,
    ]);
    expect(searchShapes({ query: "no such shape" })).toEqual([]);
  });

  test("finds a shape by its ID and keeps the palette's defaults", () => {
    expect(findShape("flowchart:decision")).toMatchObject({
      label: "Decision",
      category: "flowchart",
      type: "shape.geo",
    });
    expect(shapeCreation(Tool.FlowDecision)?.semantic).toEqual({
      geo: "diamond",
      label: "Condition?",
    });
    expect(findShape("select")).toBeUndefined();
  });

  test("connects with a connector shape only between its own notation", () => {
    const editor = new Editor();
    const a = editor.createElement("uml.component", {
      semantic: { name: "Billing" },
    });
    const b = editor.createElement("uml.component", {
      semantic: { name: "Ledger" },
    });
    const dependency = connectShape(editor, Tool.Dependency, a, b);
    expect(editor.store.get(dependency ?? "")?.semantic).toMatchObject({
      kind: "dependency",
    });
    expect(connectShape(editor, Tool.Association, a, b)).toBeNull();
    const actor = editor.createElement("usecase.node", {
      semantic: { name: "Shopper", kind: "actor" },
    });
    const useCase = editor.createElement("usecase.node", {
      semantic: { name: "Pay", kind: "usecase" },
    });
    const include = connectShape(editor, Tool.UseCaseInclude, useCase, actor);
    expect(editor.store.get(include ?? "")?.semantic).toMatchObject({
      kind: "include",
    });
    expect(connectShape(editor, Tool.UseCaseExtend, a, actor)).toBeNull();
    const edge = connectShape(editor, Tool.Connector, a, b);
    expect(editor.store.get(edge ?? "")?.type).toBe("edge.generic");
  });
});
