import { expect, test } from "bun:test";
import { Editor } from "@nodetto/core";
import { cadStatusStoreFor, createCadStatusStore } from "./status-store.ts";

test("status publications replace prior results and notify until unsubscribed", () => {
  const store = createCadStatusStore();
  const seen: unknown[] = [];
  const stop = store.subscribe(() => seen.push(store.get("feature")));
  const failure = { ok: false, code: "cad.order.forward" } as const;
  store.set("page-a", [["feature", failure]]);
  expect(store.get("feature")).toEqual(failure);
  store.set("page-a", [["feature", { ok: true }]]);
  expect(store.get("feature")).toEqual({ ok: true });
  store.set("page-b", [["other", failure]]);
  expect(store.get("feature")).toBeUndefined();
  store.clear("page-a");
  expect(store.get("other")).toEqual(failure);
  stop();
  store.clear("page-b");
  expect(store.get("other")).toBeUndefined();
  expect(seen).toEqual([failure, { ok: true }, undefined]);
});

test("two editors with the same page and element ids have independent statuses", () => {
  const first = new Editor();
  const second = new Editor();
  cadStatusStoreFor(first).set("page", [["feature", { ok: true }]]);
  expect(cadStatusStoreFor(first).get("feature")).toEqual({ ok: true });
  expect(cadStatusStoreFor(second).get("feature")).toBeUndefined();
});
