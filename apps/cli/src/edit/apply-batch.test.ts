import { expect, test } from "bun:test";
import { Editor } from "@nodetto/core";
import { parseDocument, serializeDocument } from "@nodetto/io";
import {
  obstacleRoutingBatch,
  obstacleRoutingMultiPage,
  obstacleRoutingMixedMultiPage,
  oneOpOperations,
} from "../__fixtures__/obstacle-routing-batch.ts";
import { Batch } from "./batch.ts";
import type { Element } from "@nodetto/ir";
import {
  applyBatch,
  countPageChanges,
  issueLine,
  unknownFieldKey,
} from "./apply-batch.ts";

const a: Element = {
  id: "a",
  page: "p1",
  type: "shape",
  index: "a0",
  semantic: {},
  visual: {},
};
const b: Element = {
  id: "b",
  page: "p1",
  type: "shape",
  index: "a1",
  semantic: {},
  visual: {},
};

test("unknownFieldKey resolves an element and path", () => {
  expect(unknownFieldKey("elements[1].semantic.extra", [a, b])).toEqual({
    element: b,
    path: "semantic.extra",
    key: JSON.stringify([b.id, "semantic.extra"]),
  });
});

test("unknownFieldKey ignores non-element paths", () => {
  expect(unknownFieldKey("pages[0].name", [a])).toBeUndefined();
});

test("unknownFieldKey ignores an out-of-range element", () => {
  expect(unknownFieldKey("elements[5].semantic.x", [a])).toBeUndefined();
});

test("countPageChanges omits unchanged elements", () => {
  expect([
    ...countPageChanges(new Map([[a.id, a]]), new Map([[a.id, a]])),
  ]).toEqual([]);
});

test("countPageChanges counts changes in after then removed-page order", () => {
  const removed: Element = { ...a, id: "removed", page: "p2" };
  const updated: Element = { ...a, semantic: { name: "updated" } };
  const before = new Map([
    [a.id, a],
    [removed.id, removed],
  ]);
  const after = new Map([
    [b.id, b],
    [updated.id, updated],
  ]);
  expect([...countPageChanges(before, after)]).toEqual([
    ["p1", { added: 1, updated: 1, removed: 0 }],
    ["p2", { added: 0, updated: 0, removed: 1 }],
  ]);
});

test("issueLine includes a nonempty path", () => {
  expect(issueLine({ path: "elements[0].semantic", message: "bad" })).toBe(
    "elements[0].semantic: bad",
  );
});

test("issueLine omits an empty path", () => {
  expect(issueLine({ path: "", message: "bad" })).toBe("bad");
});

test("optimized batch matches full writing on routing fixtures and arrange", () => {
  for (const build of [
    obstacleRoutingBatch,
    obstacleRoutingMultiPage,
    obstacleRoutingMixedMultiPage,
  ]) {
    const fixture = build();
    const operations = JSON.parse(fixture.operations);
    expect(applyBatch(fixture.document, operations, false)).toEqual(
      applyBatch(fixture.document, operations, false, { fullWrite: true }),
    );
  }
  const fixture = obstacleRoutingBatch();
  const operations = JSON.parse(oneOpOperations());
  expect(applyBatch(fixture.document, operations, true)).toEqual(
    applyBatch(fixture.document, operations, true, { fullWrite: true }),
  );
});

test("batch preserves untouched page object identities on frozen input", () => {
  const fixture = obstacleRoutingMultiPage();
  const document = parseDocument(fixture.document);
  const freeze = (value: unknown): void => {
    if (value && typeof value === "object" && !Object.isFrozen(value)) {
      for (const child of Object.values(value)) freeze(child);
      Object.freeze(value);
    }
  };
  freeze(document);
  const editor = new Editor({ document });
  const batch = new Batch(editor);
  const operations = JSON.parse(oneOpOperations());
  batch.apply(operations[0], 0);
  const after = editor.getSnapshot();
  const targetPage = document.elements.find(
    (element) => element.id === "edge-0",
  )?.page;
  for (const element of document.elements.filter(
    (item) => item.page !== targetPage,
  )) {
    expect(after.elements.find((item) => item.id === element.id)).toBe(element);
  }
  batch.dispose();
});

test("optimized and full validation agree for page and element changes and errors", () => {
  const fixture = obstacleRoutingMultiPage();
  const document = parseDocument(fixture.document);
  const secondPage = document.pages.find(
    (page) =>
      page.id !==
      document.elements.find((element) => element.id === "edge-0")?.page,
  );
  if (!secondPage) throw new Error("missing second page");
  const cases = [
    [{ op: "delete", id: "edge-0" }],
    [
      {
        op: "add-page",
        id: "new-page",
        name: "New",
        kind: "state",
        order: "z",
      },
    ],
    [{ op: "delete-page", id: secondPage.id }],
    [{ op: "update", id: "state-0", semantic: { extra: "new" } }],
    [{ op: "update", id: "missing", visual: { x: 1 } }],
    [{ op: "update", id: "state-0", visual: { x: "abc" } }],
  ];
  for (const operations of cases) {
    const run = (fullWrite: boolean) => {
      try {
        return {
          result: applyBatch(fixture.document, operations, false, {
            fullWrite,
          }),
        };
      } catch (error) {
        return { error: String(error) };
      }
    };
    expect(run(false)).toEqual(run(true));
  }
  const invalid = [{ op: "update", id: "state-0", visual: { x: "abc" } }];
  expect(() => applyBatch(fixture.document, invalid, false)).toThrow(
    "The result is not a valid document",
  );
  expect(() => applyBatch(fixture.document, invalid, false)).toThrow(
    "visual.x",
  );
});

test("all fixture batches accept deeply frozen input", () => {
  const freeze = (value: unknown): void => {
    if (value && typeof value === "object" && !Object.isFrozen(value)) {
      for (const child of Object.values(value)) freeze(child);
      Object.freeze(value);
    }
  };
  for (const build of [
    obstacleRoutingBatch,
    obstacleRoutingMultiPage,
    obstacleRoutingMixedMultiPage,
  ]) {
    const fixture = build();
    const document = parseDocument(fixture.document);
    freeze(document);
    const batch = new Batch(new Editor({ document }));
    const operations = JSON.parse(fixture.operations) as Record<
      string,
      unknown
    >[];
    expect(() =>
      operations.forEach((operation, index) => batch.apply(operation, index)),
    ).not.toThrow();
    batch.dispose();
  }
});

test("scoped validation matches full writing for tokens and cross-page references", () => {
  const document = parseDocument(obstacleRoutingMultiPage().document);
  const first = document.elements.find((element) => element.id === "state-0");
  const other = document.elements.find(
    (element) =>
      element.page !== first?.page && element.type === "node.generic",
  );
  if (!first || !other) throw new Error("fixture pages missing");
  const text = serializeDocument({
    ...document,
    elements: [
      ...document.elements.map((element) =>
        element.id === other.id
          ? {
              ...element,
              semantic: {
                ...(element.semantic as Record<string, unknown>),
                oldUnknown: true,
              },
            }
          : element,
      ),
      {
        id: "cross-edge",
        page: other.page,
        type: "edge.generic",
        index: "a0",
        semantic: { from: first.id, to: other.id },
        visual: {},
      },
      {
        id: "token-test",
        page: first.page,
        type: "design.token",
        index: "a1",
        semantic: { name: "Accent", kind: "color", value: "#123456" },
        visual: {},
      },
    ],
  });
  for (const operations of [
    [{ op: "update", id: "token-test", semantic: { value: "#654321" } }],
    [{ op: "delete", id: first.id }],
    [{ op: "update", id: first.id, semantic: { newUnknown: true } }],
  ]) {
    const actual = applyBatch(text, operations, false);
    expect(actual).toEqual(
      applyBatch(text, operations, false, { fullWrite: true }),
    );
    expect(
      actual.warnings.every((warning) => warning.element !== other.id),
    ).toBe(true);
  }
});
