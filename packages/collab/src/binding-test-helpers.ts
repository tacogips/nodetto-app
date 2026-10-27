import { expect } from "bun:test";
import { Editor } from "@nodetto/core";
import type { Document, Element } from "@nodetto/ir";
import * as Y from "yjs";
import { CollabBinding } from "./binding.ts";
import { ydocToIr } from "./ydoc.ts";

/** Origin every relayed update carries; never any binding's local origin. */
export const WIRE = Symbol("wire");

/**
 * Two docs joined by a hand-cranked wire.
 *
 * Updates queue instead of being delivered, so a test can hold both peers'
 * edits in flight at once — which is the only way to write down "concurrent"
 * without real sockets.
 */
export class Wire {
  private readonly pending = new Map<Y.Doc, Uint8Array[]>();
  private readonly docs: Y.Doc[] = [];

  join(doc: Y.Doc): void {
    // The real provider opens with a state-vector handshake, so a peer that
    // joins late still receives everything written before it arrived.
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
      if (origin === WIRE) {
        return;
      }
      for (const peer of this.docs) {
        if (peer !== doc) {
          this.pending.get(peer)?.push(update);
        }
      }
    });
  }

  /** Deliver everything, including whatever delivery itself produces. */
  flush(): void {
    for (let round = 0; round < 20; round += 1) {
      let delivered = false;
      for (const doc of this.docs) {
        const queue = this.pending.get(doc) ?? [];
        if (queue.length === 0) {
          continue;
        }
        this.pending.set(doc, []);
        delivered = true;
        for (const update of queue) {
          Y.applyUpdate(doc, update, WIRE);
        }
      }
      if (!delivered) {
        return;
      }
    }
    throw new Error("wire never settled");
  }

  get queued(): number {
    let total = 0;
    for (const queue of this.pending.values()) {
      total += queue.length;
    }
    return total;
  }
}

export interface Peer {
  readonly editor: Editor;
  readonly doc: Y.Doc;
  readonly binding: CollabBinding;
}

export function peer(
  wire: Wire,
  document?: Document,
  captureTimeout = 0,
): Peer {
  const editor = new Editor(document ? { document } : {});
  const doc = new Y.Doc();
  wire.join(doc);
  const binding = new CollabBinding({ editor, doc, captureTimeout });
  return { editor, doc, binding };
}

export function elementIn(peer: Peer, id: string): Element {
  const element = peer.editor.store.get(id);
  if (!element) {
    throw new Error(`element ${id} missing from the store`);
  }
  return element;
}

/** Both editors and both docs agree, and nothing is left on the wire. */
export function expectConverged(a: Peer, b: Peer, wire: Wire): void {
  expect(wire.queued).toBe(0);
  expect(a.editor.getSnapshot()).toEqual(b.editor.getSnapshot());
  expect(ydocToIr(a.doc).elements).toEqual(ydocToIr(b.doc).elements);
  // The stores are what the users see; the docs are what the peers exchange.
  // A binding that lost track of one direction shows up as a mismatch here.
  expect(a.editor.getSnapshot().elements).toEqual(
    ydocToIr(a.doc).elements as never,
  );
}
