import { describe, expect, test } from "bun:test";
import { Editor } from "@nodetto/core";
import {
  BREADBOARD_ELEMENT_TYPES,
  type BreadboardNetlistSemantic,
  type BreadboardWireSemantic,
  type Document,
} from "@nodetto/ir";
import * as Y from "yjs";
import { CollabBinding } from "./binding.ts";
import { allFixtures, breadboardDocument } from "./test-fixtures.ts";
import { irToYDoc, ydocToIr } from "./ydoc.ts";

const WIRE = Symbol("wire");

class Wire {
  private readonly pending = new Map<Y.Doc, Uint8Array[]>();
  private readonly docs: Y.Doc[] = [];

  join(doc: Y.Doc): void {
    for (const existing of this.docs) {
      Y.applyUpdate(
        doc,
        Y.encodeStateAsUpdate(existing, Y.encodeStateVector(doc)),
        WIRE,
      );
      Y.applyUpdate(
        existing,
        Y.encodeStateAsUpdate(doc, Y.encodeStateVector(existing)),
        WIRE,
      );
    }
    this.docs.push(doc);
    this.pending.set(doc, []);
    doc.on("update", (update: Uint8Array, origin: unknown) => {
      if (origin === WIRE) return;
      for (const peer of this.docs) {
        if (peer !== doc) this.pending.get(peer)?.push(update);
      }
    });
  }

  flush(): void {
    for (let round = 0; round < 20; round += 1) {
      let delivered = false;
      for (const doc of this.docs) {
        const queue = this.pending.get(doc) ?? [];
        if (queue.length === 0) continue;
        this.pending.set(doc, []);
        delivered = true;
        for (const update of queue) Y.applyUpdate(doc, update, WIRE);
      }
      if (!delivered) return;
    }
    throw new Error("wire never settled");
  }

  get queued(): number {
    let total = 0;
    for (const queue of this.pending.values()) total += queue.length;
    return total;
  }
}

interface Peer {
  readonly editor: Editor;
  readonly doc: Y.Doc;
  readonly binding: CollabBinding;
}

function peer(wire: Wire, document?: Document): Peer {
  const editor = new Editor(document ? { document } : {});
  const doc = new Y.Doc();
  wire.join(doc);
  const binding = new CollabBinding({ editor, doc });
  return { editor, doc, binding };
}

function startPeers(document: Document): { wire: Wire; a: Peer; b: Peer } {
  const wire = new Wire();
  const a = peer(wire, document);
  a.binding.attach();
  const b = peer(wire);
  wire.flush();
  b.binding.attach();
  wire.flush();
  return { wire, a, b };
}

function element(peer: Peer, id: string) {
  const found = peer.editor.store.get(id);
  if (!found) throw new Error(`missing breadboard fixture element ${id}`);
  return found;
}

function expectConverged(a: Peer, b: Peer, wire: Wire): void {
  expect(wire.queued).toBe(0);
  expect(a.editor.getSnapshot()).toEqual(b.editor.getSnapshot());
  expect(ydocToIr(a.doc).pages).toEqual(ydocToIr(b.doc).pages);
  expect(ydocToIr(a.doc).elements).toEqual(ydocToIr(b.doc).elements);
  expect(a.editor.getSnapshot().elements).toEqual(
    ydocToIr(a.doc).elements as never,
  );
}

function finishPeers(...peers: Peer[]): void {
  for (const item of peers) {
    item.binding.detach();
    item.doc.destroy();
  }
}

function sortedById(document: Document): Document {
  return {
    ...document,
    pages: [...document.pages].sort((a, b) => a.id.localeCompare(b.id)),
    elements: [...document.elements].sort((a, b) => a.id.localeCompare(b.id)),
  };
}

describe("breadboard collaboration", () => {
  test("adds the breadboard document as the sixth and last fixture", () => {
    const fixtures = allFixtures();
    expect(fixtures).toHaveLength(6);
    expect(fixtures.at(-1)?.pages[0]?.kind).toBe("breadboard");
  });

  test("round-trips every breadboard type and nested sequence through Yjs", () => {
    const source = breadboardDocument();
    const doc = irToYDoc(source);
    try {
      const actual = ydocToIr(doc);
      expect(actual).toEqual(sortedById(source));
      expect(actual.pages[0]?.kind).toBe("breadboard");
      expect(actual.elements.map((item) => item.type).sort()).toEqual(
        [...BREADBOARD_ELEMENT_TYPES].sort(),
      );
      const wire = actual.elements.find((item) => item.id === "bb-wire");
      expect((wire?.semantic as BreadboardWireSemantic).points).toEqual([
        { x: 50, y: 50 },
        { x: 80, y: 50 },
        { x: 80, y: 100 },
      ]);
      const netlist = actual.elements.find((item) => item.id === "bb-netlist");
      expect((netlist?.semantic as BreadboardNetlistSemantic).nets).toEqual([
        {
          name: "N_LED",
          nodes: [
            { reference: "D1", pin: 1 },
            { reference: "R1", pin: 1 },
          ],
        },
      ]);
    } finally {
      doc.destroy();
    }
  });

  test("merges a resistor move with a concurrent wire color change", () => {
    const { wire, a, b } = startPeers(breadboardDocument());
    try {
      const resistor = element(a, "bb-resistor");
      a.editor.apply([
        { type: "updateVisual", id: resistor.id, visual: { x: 130 } },
      ]);

      const jumper = element(b, "bb-wire");
      const wireSemantic = jumper.semantic as BreadboardWireSemantic;
      b.editor.apply([
        {
          type: "updateSemantic",
          id: jumper.id,
          semantic: { ...wireSemantic, color: "blue" },
        },
      ]);
      wire.flush();

      for (const side of [a, b]) {
        expect(element(side, "bb-resistor").visual.x).toBe(130);
        expect(
          (element(side, "bb-wire").semantic as BreadboardWireSemantic).color,
        ).toBe("blue");
      }
      expectConverged(a, b, wire);
    } finally {
      finishPeers(a, b);
    }
  });

  test("merges a netlist edit with a concurrent wire deletion", () => {
    const { wire, a, b } = startPeers(breadboardDocument());
    try {
      const card = element(a, "bb-netlist");
      const netlist = card.semantic as BreadboardNetlistSemantic;
      a.editor.apply([
        {
          type: "updateSemantic",
          id: card.id,
          semantic: { ...netlist, source: "updated.net" },
        },
      ]);
      b.editor.deleteElements(["bb-wire"]);
      wire.flush();

      for (const side of [a, b]) {
        expect(
          (element(side, "bb-netlist").semantic as BreadboardNetlistSemantic)
            .source,
        ).toBe("updated.net");
        expect(side.editor.store.get("bb-wire")).toBeUndefined();
      }
      expectConverged(a, b, wire);
    } finally {
      finishPeers(a, b);
    }
  });
});
