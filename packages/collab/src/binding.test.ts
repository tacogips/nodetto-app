import { beforeEach, describe, expect, test } from "bun:test";
import type { ErdTableSemantic, Page } from "@nodetto/ir";
import * as Y from "yjs";
import { erdDocument, freeformDocument } from "./test-fixtures.ts";
import { ELEMENTS_KEY, PAGES_KEY, applyIrToDoc } from "./ydoc.ts";
import {
  WIRE,
  Wire,
  type Peer,
  peer,
  elementIn,
  expectConverged,
} from "./binding-test-helpers.ts";

function pageIn(peer: Peer, id: string): Page | undefined {
  return peer.editor.store.getPage(id);
}

/**
 * Transactions `doc` ran that did not come off the wire. A receiving peer
 * that echoes a remote change shows up here, whatever origin it used.
 */
function countOwnTransactions(doc: Y.Doc): () => number {
  let count = 0;
  doc.on("afterTransaction", (transaction: Y.Transaction) => {
    if (transaction.origin !== WIRE) {
      count += 1;
    }
  });
  return () => count;
}

/** How much of the doc's history this client itself wrote. */
function ownClock(doc: Y.Doc): number {
  return Y.decodeStateVector(Y.encodeStateVector(doc)).get(doc.clientID) ?? 0;
}

function columnNames(peer: Peer, id: string): string[] {
  const semantic = elementIn(peer, id).semantic as {
    readonly columns: readonly { readonly name: string }[];
  };
  return semantic.columns.map((column) => column.name);
}

function renameColumn(peer: Peer, id: string, at: number, name: string): void {
  const semantic = elementIn(peer, id).semantic as {
    readonly columns: readonly Record<string, unknown>[];
  };
  peer.editor.apply([
    {
      type: "updateSemantic",
      id,
      semantic: {
        ...semantic,
        columns: semantic.columns.map((column, index) =>
          index === at ? { ...column, name } : column,
        ),
      },
    },
  ]);
}

describe("CollabBinding", () => {
  let wire: Wire;
  let a: Peer;
  let b: Peer;

  beforeEach(() => {
    wire = new Wire();
    // A opens a document into an empty room: the defensive seed of design
    // 4.4. B then joins the room it published.
    a = peer(wire, erdDocument());
    a.binding.attach();
    b = peer(wire);
    wire.flush();
    b.binding.attach();
    wire.flush();
  });

  test("shares the seeded document with a joining peer", () => {
    expect(b.editor.getSnapshot().title).toBe("Shop domain");
    expect(b.editor.currentPageId).toBe("p1");
    expectConverged(a, b, wire);
  });

  test("keeps a concurrent move and column rename (design 7.1)", () => {
    a.editor.moveElements([{ id: "t-users", x: 640, y: 220 }]);
    renameColumn(b, "t-users", 1, "email_address");
    wire.flush();

    for (const side of [a, b]) {
      expect(elementIn(side, "t-users").visual).toEqual({
        x: 640,
        y: 220,
        width: 280,
      });
      expect(columnNames(side, "t-users")).toEqual(["id", "email_address"]);
    }
    expectConverged(a, b, wire);
  });

  test("keeps concurrent renames of two columns of one table", () => {
    renameColumn(a, "t-users", 0, "uuid");
    renameColumn(b, "t-users", 1, "email_address");
    wire.flush();

    expect(columnNames(a, "t-users")).toEqual(["uuid", "email_address"]);
    expectConverged(a, b, wire);
  });

  test("merges database defaults, generated columns and indexes with peer-local undo", () => {
    const aSemantic = elementIn(a, "t-users").semantic as ErdTableSemantic;
    const bSemantic = elementIn(b, "t-users").semantic as ErdTableSemantic;
    a.editor.apply([
      {
        type: "updateSemantic",
        id: "t-users",
        semantic: {
          ...aSemantic,
          columns: aSemantic.columns.map((column) =>
            column.id === "c-id"
              ? { ...column, defaultExpression: "gen_random_uuid()" }
              : column,
          ),
        },
      },
    ]);
    b.editor.apply([
      {
        type: "updateSemantic",
        id: "t-users",
        semantic: {
          ...bSemantic,
          columns: bSemantic.columns.map((column) =>
            column.id === "c-email"
              ? { ...column, generatedExpression: "lower(email)" }
              : column,
          ),
          indexes: [
            {
              id: "i-users-email",
              columns: ["c-email", "c-id"],
              unique: true,
            },
          ],
        },
      },
    ]);
    wire.flush();

    for (const side of [a, b]) {
      const semantic = elementIn(side, "t-users").semantic as ErdTableSemantic;
      expect(semantic.columns[0]?.defaultExpression).toBe("gen_random_uuid()");
      expect(semantic.columns[1]?.generatedExpression).toBe("lower(email)");
      expect(semantic.indexes).toEqual([
        {
          id: "i-users-email",
          columns: ["c-email", "c-id"],
          unique: true,
        },
      ]);
    }
    expect(b.binding.undo()).toBe(true);
    wire.flush();
    for (const side of [a, b]) {
      const semantic = elementIn(side, "t-users").semantic as ErdTableSemantic;
      expect(semantic.columns[0]?.defaultExpression).toBe("gen_random_uuid()");
      expect(semantic.columns[1]?.generatedExpression).toBeUndefined();
      expect(semantic.indexes).toBeUndefined();
    }
    expectConverged(a, b, wire);
  });

  test("merges a check expression with an unrelated table edit and local undo", () => {
    const aSemantic = elementIn(a, "t-users").semantic as ErdTableSemantic;
    a.editor.apply([
      {
        type: "updateSemantic",
        id: "t-users",
        semantic: {
          ...aSemantic,
          checks: [{ id: "ck-email", expression: "length(email) > 0" }],
        },
      },
    ]);
    wire.flush();

    const currentA = elementIn(a, "t-users").semantic as ErdTableSemantic;
    const currentB = elementIn(b, "t-users").semantic as ErdTableSemantic;
    a.editor.apply([
      {
        type: "updateSemantic",
        id: "t-users",
        semantic: {
          ...currentA,
          checks: currentA.checks?.map((check) => ({
            ...check,
            expression: "length(email) >= 3",
          })),
        },
      },
    ]);
    b.editor.apply([
      {
        type: "updateSemantic",
        id: "t-users",
        semantic: { ...currentB, tableName: "customer_accounts" },
      },
    ]);
    wire.flush();

    for (const side of [a, b]) {
      const semantic = elementIn(side, "t-users").semantic as ErdTableSemantic;
      expect(semantic.tableName).toBe("customer_accounts");
      expect(semantic.checks?.[0]?.expression).toBe("length(email) >= 3");
    }
    expect(a.binding.undo()).toBe(true);
    wire.flush();
    for (const side of [a, b]) {
      const semantic = elementIn(side, "t-users").semantic as ErdTableSemantic;
      expect(semantic.tableName).toBe("customer_accounts");
      expect(semantic.checks?.[0]?.expression).toBe("length(email) > 0");
    }
    expectConverged(a, b, wire);
  });

  test("does not echo a remote change back onto the wire", () => {
    let localTransactions = 0;
    b.doc.on("afterTransaction", (transaction: Y.Transaction) => {
      if (transaction.origin === b.binding.origin) {
        localTransactions += 1;
      }
    });

    a.editor.moveElements([{ id: "t-orders", x: 900, y: 40 }]);
    wire.flush();

    expect(elementIn(b, "t-orders").visual.x).toBe(900);
    expect(localTransactions).toBe(0);
    expectConverged(a, b, wire);
  });

  test("ignores page switches and history-only notifications", () => {
    let transactions = 0;
    a.doc.on("afterTransaction", () => {
      transactions += 1;
    });

    a.editor.setCurrentPage("p1");
    a.editor.beginBatch();
    a.editor.endBatch();

    expect(transactions).toBe(0);
  });

  test("propagates creates and deletes", () => {
    const id = a.editor.createElement("node.generic", {
      page: "p1",
      semantic: { label: "New" },
      visual: { x: 5, y: 5 },
    });
    wire.flush();
    expect(elementIn(b, id).semantic).toEqual({ label: "New" });

    b.editor.deleteElements([id]);
    wire.flush();
    expect(a.editor.store.has(id)).toBe(false);
    expectConverged(a, b, wire);
  });

  test("re-inserts an element the local user is still editing", () => {
    // The add-wins branch of design 4.1: the Y entry is gone while the store
    // still holds the element. Deleting it under the binding's own origin
    // reproduces that state exactly — the observers skip local origins, so
    // the store is left believing the element is still there.
    Y.transact(
      a.doc,
      () => {
        a.doc.getMap<unknown>(ELEMENTS_KEY).delete("t-users");
      },
      a.binding.origin,
    );
    wire.flush();
    expect(b.editor.store.has("t-users")).toBe(false);

    a.editor.moveElements([{ id: "t-users", x: 1, y: 2 }]);
    wire.flush();

    expect(elementIn(b, "t-users").visual).toEqual({
      x: 1,
      y: 2,
      width: 280,
    });
    expect(columnNames(b, "t-users")).toEqual(["id", "email"]);
    expectConverged(a, b, wire);
  });

  test("undo reverts only the local user's work", () => {
    a.editor.moveElements([{ id: "t-users", x: 640, y: 220 }]);
    wire.flush();
    renameColumn(b, "t-users", 1, "email_address");
    wire.flush();

    expect(a.binding.canUndo()).toBe(true);
    expect(a.binding.undo()).toBe(true);
    wire.flush();

    // A's move is gone; B's rename — which arrived in between — is untouched.
    expect(elementIn(a, "t-users").visual).toEqual({
      x: 100,
      y: 100,
      width: 280,
    });
    expect(columnNames(a, "t-users")).toEqual(["id", "email_address"]);
    expectConverged(a, b, wire);

    expect(a.binding.canRedo()).toBe(true);
    expect(a.binding.redo()).toBe(true);
    wire.flush();
    expect(elementIn(a, "t-users").visual.x).toBe(640);
    expectConverged(a, b, wire);
  });

  test("has nothing to undo before the local user edits", () => {
    expect(a.binding.canUndo()).toBe(false);
    expect(a.binding.undo()).toBe(false);

    renameColumn(b, "t-users", 0, "identifier");
    wire.flush();

    // B's edit reached A's store but not A's undo stack.
    expect(columnNames(a, "t-users")).toEqual(["identifier", "email"]);
    expect(a.binding.canUndo()).toBe(false);
  });

  test("announces undo availability", () => {
    const seen: boolean[] = [];
    const stop = a.binding.onUndoState(() => {
      seen.push(a.binding.canUndo());
    });
    a.editor.moveElements([{ id: "t-users", x: 3, y: 3 }]);
    expect(seen).toEqual([true]);
    stop();
    a.binding.undo();
    expect(seen).toEqual([true]);
  });

  test("reloads the document when a peer replaces it wholesale", () => {
    applyIrToDoc(b.doc, freeformDocument());
    wire.flush();

    expect(a.editor.getSnapshot().title).toBe("Whiteboard");
    expect(a.editor.currentPageId).toBe("p1");
    expect(a.editor.store.has("s-maybe")).toBe(true);
    expect(a.editor.store.has("t-users")).toBe(false);
    expectConverged(a, b, wire);

    // The shadow was rebuilt, so the next local edit still diffs correctly.
    a.editor.moveElements([{ id: "n-idea", x: 11, y: 12 }]);
    wire.flush();
    expect(elementIn(b, "n-idea").visual.x).toBe(11);
    expectConverged(a, b, wire);
  });

  test("propagates a created page with its name and kind", () => {
    const id = a.editor.createPage({
      id: "p2",
      name: "Flows",
      kind: "sequence",
    });
    expect(a.editor.currentPageId).toBe(id);
    wire.flush();

    expect(pageIn(b, id)).toEqual({
      id,
      name: "Flows",
      kind: "sequence",
      order: a.editor.store.getPage(id)?.order,
    });
    expect(b.editor.store.listPages().map((page) => page.id)).toEqual([
      "p1",
      "p2",
    ]);
    expectConverged(a, b, wire);
  });

  test("propagates renames and kind changes as single-key writes", () => {
    const keys: string[] = [];
    b.doc.getMap<unknown>(PAGES_KEY).observeDeep((events) => {
      for (const event of events) {
        for (const key of event.changes.keys.keys()) {
          keys.push(`${event.path.join(".")}:${key}`);
        }
      }
    });

    expect(a.editor.renamePage("p1", "Entities")).toBe(true);
    wire.flush();
    expect(pageIn(b, "p1")?.name).toBe("Entities");

    expect(b.editor.setPageKind("p1", "freeform")).toBe(true);
    wire.flush();
    expect(pageIn(a, "p1")).toEqual({
      id: "p1",
      name: "Entities",
      kind: "freeform",
    });

    // One key per command, on both the receiving and the writing side.
    expect(keys).toEqual(["p1:name", "p1:kind"]);
    expectConverged(a, b, wire);
  });

  test("deletes a page together with its elements on the peer", () => {
    a.editor.createPage({ id: "p2", name: "Scratch" });
    const id = a.editor.createElement("node.generic", {
      page: "p2",
      semantic: { label: "Draft" },
      visual: { x: 1, y: 1 },
    });
    wire.flush();
    expect(pageIn(b, "p2")?.name).toBe("Scratch");
    expect(elementIn(b, id).page).toBe("p2");

    const ownTransactions = countOwnTransactions(b.doc);
    expect(a.editor.deletePage("p2")).toBe(true);
    wire.flush();

    expect(pageIn(b, "p2")).toBeUndefined();
    expect(b.editor.store.has(id)).toBe(false);
    expect(b.editor.currentPageId).toBe("p1");
    // The page and element removals arrive as one transaction, and the
    // receiving side writes nothing back for either half.
    expect(ownTransactions()).toBe(0);
    expectConverged(a, b, wire);
  });

  test("undoing a page create removes it from the peer", () => {
    a.editor.createPage({ id: "p2", name: "Scratch" });
    wire.flush();
    expect(pageIn(b, "p2")).toBeDefined();

    expect(a.binding.undo()).toBe(true);
    wire.flush();
    expect(pageIn(a, "p2")).toBeUndefined();
    expect(pageIn(b, "p2")).toBeUndefined();
    expect(a.editor.currentPageId).toBe("p1");
    expectConverged(a, b, wire);

    expect(a.binding.redo()).toBe(true);
    wire.flush();
    expect(pageIn(b, "p2")?.name).toBe("Scratch");
    expectConverged(a, b, wire);
  });

  test("undoes a duplicated page and its copies as one step", () => {
    const copy = a.editor.duplicatePage("p1");
    if (copy === null) {
      throw new Error("duplicatePage returned null");
    }
    wire.flush();
    expect(pageIn(b, copy)?.name).toBe("Domain model copy");
    expect(b.editor.store.getPageElements(copy)).toHaveLength(3);
    expect(b.editor.store.size).toBe(6);

    expect(a.binding.undo()).toBe(true);
    wire.flush();
    expect(pageIn(b, copy)).toBeUndefined();
    expect(b.editor.store.size).toBe(3);
    expectConverged(a, b, wire);
  });

  test("does not echo a remote page change back onto the wire", () => {
    const clockBefore = ownClock(b.doc);
    const ownTransactions = countOwnTransactions(b.doc);

    a.editor.createPage({ id: "p2", name: "Scratch" });
    wire.flush();
    expect(a.editor.renamePage("p2", "Notes")).toBe(true);
    wire.flush();
    expect(a.editor.deletePage("p2")).toBe(true);
    wire.flush();

    expect(pageIn(b, "p2")).toBeUndefined();
    expect(ownTransactions()).toBe(0);
    expect(ownClock(b.doc)).toBe(clockBefore);
    expectConverged(a, b, wire);
  });

  test("re-inserts a page the local user is still editing", () => {
    // The page-level twin of the element add-wins case: the Y entry is gone
    // while the store still holds the page.
    Y.transact(
      a.doc,
      () => {
        a.doc.getMap<unknown>(PAGES_KEY).delete("p1");
      },
      a.binding.origin,
    );
    wire.flush();
    expect(pageIn(b, "p1")).toBeUndefined();

    expect(a.editor.renamePage("p1", "Back")).toBe(true);
    wire.flush();

    expect(pageIn(b, "p1")).toEqual({ id: "p1", name: "Back", kind: "erd" });
    expectConverged(a, b, wire);
  });

  test("stops syncing after detach and is safe to detach twice", () => {
    a.binding.detach();
    a.binding.detach();

    a.editor.moveElements([{ id: "t-orders", x: 12, y: 12 }]);
    wire.flush();

    expect(elementIn(b, "t-orders").visual.x).toBe(460);
    expect(a.binding.canUndo()).toBe(false);
  });
});
