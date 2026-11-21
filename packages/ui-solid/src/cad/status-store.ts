import type { CadStatus, Editor } from "@nodetto/core";
import type { ElementId, PageId } from "@nodetto/ir";
import { createSignal, onCleanup } from "solid-js";

export function createCadStatusStore() {
  let page: PageId | undefined;
  let statuses = new Map<ElementId, CadStatus>();
  const listeners = new Set<() => void>();
  return {
    set(pageId: PageId, status: readonly (readonly [ElementId, CadStatus])[]) {
      page = pageId;
      statuses = new Map(status);
      for (const listener of listeners) listener();
    },
    clear(pageId: PageId) {
      if (page !== pageId) return;
      page = undefined;
      statuses.clear();
      for (const listener of listeners) listener();
    },
    get(id: ElementId): CadStatus | undefined {
      return statuses.get(id);
    },
    subscribe(listener: () => void): () => void {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
  };
}

const stores = new WeakMap<Editor, ReturnType<typeof createCadStatusStore>>();

export function cadStatusStoreFor(editor: Editor) {
  let store = stores.get(editor);
  if (!store) {
    store = createCadStatusStore();
    stores.set(editor, store);
  }
  return store;
}

export function useCadStatus(
  editor: Editor,
): (id: ElementId) => CadStatus | undefined {
  const store = cadStatusStoreFor(editor);
  const [version, bump] = createSignal(0);
  onCleanup(store.subscribe(() => bump((value) => value + 1)));
  return (id) => {
    version();
    return store.get(id);
  };
}
