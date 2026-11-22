import { expect, test } from "bun:test";
import {
  type CadCircleSemantic,
  type CadExtrudeSemantic,
  type CadSketchSemantic,
  type Document,
  type Element,
  getElementTypeDefinition,
  isCadTypeName,
  SCHEMA_VERSION,
  validateDocument,
} from "@nodetto/ir";
import { applyCommands, type Command } from "../commands.ts";
import { mergeDocumentVersions } from "../document-merge.ts";
import { keyBetween } from "../fractional.ts";
import { Store } from "../store.ts";
import { analyzeCadPage } from "./history.ts";

function sketch(id: string, index: string): Element<CadSketchSemantic> {
  return {
    id,
    index,
    page: "model",
    type: "cad.sketch",
    semantic: { name: id, plane: { base: "xy" } },
    visual: {},
  };
}

function circle(
  id: string,
  index: string,
  parent: string,
  x: number,
  r: number,
): Element<CadCircleSemantic> {
  return {
    id,
    index,
    page: "model",
    type: "cad.circle",
    semantic: { sketch: parent, c: [x, 0], r },
    visual: {},
  };
}

const bore = circle("bore", "a4", "hole", 0, 1);
const cut: Element<CadExtrudeSemantic> = {
  id: "cut",
  index: "a5",
  page: "model",
  type: "cad.extrude",
  semantic: {
    name: "Cut",
    sketch: "hole",
    distance: -4,
    op: "cut",
    bodies: ["body"],
  },
  visual: {},
};
const base: Document = {
  schemaVersion: SCHEMA_VERSION,
  id: "cad-merge",
  title: "Bored disc",
  pages: [
    { id: "model", name: "Disc", kind: "cad3d" },
    { id: "notes", name: "Notes", kind: "freeform" },
  ],
  elements: [
    sketch("outline", "a0"),
    circle("rim", "a1", "outline", 0, 10),
    {
      id: "body",
      index: "a2",
      page: "model",
      type: "cad.extrude",
      semantic: { name: "Body", sketch: "outline", distance: 4, op: "new" },
      visual: {},
    },
    sketch("hole", "a3"),
    bore,
    cut,
  ],
};

function branch(...commands: Command[]): Document {
  const store = new Store(base);
  applyCommands(store, commands);
  return store.getSnapshot();
}

function merge(ours: Document, theirs: Document) {
  const result = mergeDocumentVersions(base, ours, theirs);
  expect(validateDocument(result.document)).toEqual([]);
  const ids = new Set(result.document.elements.map(({ id }) => id));
  for (const { type, semantic } of result.document.elements) {
    const definition = getElementTypeDefinition(type);
    for (const ref of definition?.references(semantic) ?? []) {
      expect(ids.has(ref.id)).toBe(true);
    }
  }
  return result;
}

function find(document: Document, id: string): Element | undefined {
  return document.elements.find((element) => element.id === id);
}

function changeRadius(r: number): Command {
  return {
    type: "updateSemantic",
    id: bore.id,
    semantic: { ...bore.semantic, r },
  };
}

function changeCut(patch: Partial<CadExtrudeSemantic>): Command {
  return {
    type: "updateSemantic",
    id: cut.id,
    semantic: { ...cut.semantic, ...patch },
  };
}

const deleteHole: Command = { type: "deleteElements", ids: ["hole"] };
const extraCircle = circle("extra", keyBetween("a4", "a5"), "hole", 4, 1);
const addCircle: Command = { type: "createElement", element: extraCircle };

test("edits to a circle radius and a separate extrusion distance merge cleanly", () => {
  const { document, conflicts } = merge(
    branch(changeRadius(2)),
    branch(changeCut({ distance: -6 })),
  );
  expect(conflicts).toEqual([]);
  expect(find(document, bore.id)?.semantic).toEqual({ ...bore.semantic, r: 2 });
  expect(find(document, cut.id)?.semantic).toEqual({
    ...cut.semantic,
    distance: -6,
  });
});

test("distance and operation edits to the same extrusion merge cleanly", () => {
  const { document, conflicts } = merge(
    branch(changeCut({ distance: 6 })),
    branch(changeCut({ op: "add" })),
  );
  expect(conflicts).toEqual([]);
  expect(find(document, cut.id)?.semantic).toEqual({
    ...cut.semantic,
    distance: 6,
    op: "add",
  });
});

test("divergent radius edits report semantic.r and keep ours", () => {
  const { document, conflicts } = merge(
    branch(changeRadius(2)),
    branch(changeRadius(3)),
  );
  expect(conflicts).toEqual([
    {
      kind: "element",
      type: "cad.circle",
      id: bore.id,
      path: "semantic.r",
      reason: "field",
      base: 1,
      ours: 2,
      theirs: 3,
    },
  ]);
  expect(find(document, bore.id)?.semantic).toEqual({ ...bore.semantic, r: 2 });
});

test("deleting a sketch and editing its extrusion preserve the detached edit", () => {
  const { document, conflicts } = merge(
    branch(changeCut({ distance: -6 })),
    branch(deleteHole),
  );
  expect(conflicts).toEqual([]);
  expect(find(document, "hole")).toBeUndefined();
  expect(find(document, bore.id)).toBeUndefined();
  expect(find(document, cut.id)?.semantic).toEqual({
    name: "Cut",
    distance: -6,
    op: "cut",
    bodies: ["body"],
  });
  expect(analyzeCadPage(document.elements).status.get(cut.id)).toMatchObject({
    ok: false,
    code: "cad.reference.missing",
  });
});

test("our new circle restores the sketch that theirs deleted", () => {
  const { document, conflicts } = merge(branch(addCircle), branch(deleteHole));
  expect(conflicts).toEqual([
    {
      kind: "element",
      type: "cad.sketch",
      id: "hole",
      reason: "deleted-in-theirs",
    },
  ]);
  expect(find(document, "hole")).toEqual(find(base, "hole"));
  expect(find(document, extraCircle.id)).toEqual(extraCircle);
  expect(find(document, bore.id)).toBeUndefined();
});

test("our sketch deletion drops the circle that theirs added", () => {
  const { document, conflicts } = merge(branch(deleteHole), branch(addCircle));
  expect(conflicts).toEqual([
    {
      kind: "element",
      type: "cad.circle",
      id: extraCircle.id,
      reason: "deleted-in-ours",
    },
  ]);
  expect(find(document, "hole")).toBeUndefined();
  expect(find(document, extraCircle.id)).toBeUndefined();
  expect(find(document, bore.id)).toBeUndefined();
});

test("independent circle additions to the same sketch are both kept", () => {
  const other = circle(
    "other",
    keyBetween(extraCircle.index, "a5"),
    "hole",
    -4,
    1,
  );
  const { document, conflicts } = merge(
    branch(addCircle),
    branch({ type: "createElement", element: other }),
  );
  expect(conflicts).toEqual([]);
  expect(find(document, extraCircle.id)).toEqual(extraCircle);
  expect(find(document, other.id)).toEqual(other);
});

test("concurrent features at the same fractional key sort by id", () => {
  const index = keyBetween("a2", "a3");
  const first = sketch("feature-a", index);
  const second = sketch("feature-z", index);
  const ours = branch({ type: "createElement", element: second });
  const theirs = branch({ type: "createElement", element: first });
  for (const { document, conflicts } of [
    merge(ours, theirs),
    merge(theirs, ours),
  ]) {
    expect(conflicts).toEqual([]);
    expect(find(document, first.id)).toEqual(first);
    expect(find(document, second.id)).toEqual(second);
    expect(
      analyzeCadPage(document.elements).features.map(({ id }) => id),
    ).toEqual(["outline", "body", "feature-a", "feature-z", "hole", "cut"]);
  }
});

test("2D and CAD additions merge without crossing the page content boundary", () => {
  const note: Element = {
    id: "drawing-note",
    type: "text.note",
    page: "notes",
    index: "a0",
    semantic: { text: "Check the bore" },
    visual: { x: 20, y: 20 },
  };
  const feature = sketch("spare", "a6");
  const { document, conflicts } = merge(
    branch({ type: "createElement", element: note }),
    branch({ type: "createElement", element: feature }, addCircle),
  );
  expect(conflicts).toEqual([]);
  expect(find(document, note.id)).toEqual(note);
  expect(find(document, feature.id)).toEqual(feature);
  expect(find(document, extraCircle.id)).toEqual(extraCircle);
  const kinds = new Map(document.pages.map(({ id, kind }) => [id, kind]));
  for (const { page, type } of document.elements) {
    expect(isCadTypeName(type)).toBe(kinds.get(page) === "cad3d");
  }
});
