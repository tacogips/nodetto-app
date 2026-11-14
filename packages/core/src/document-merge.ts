// Three-way document merge and document-to-store diffs.
//
// Used when a file the app has open changes on disk (for example nodetto-cli
// edited it). Elements and pages merge by id; inside an element that both
// sides changed, plain objects merge key by key, so an agent moving a table
// and a person renaming a column of that table both survive. Arrays and
// scalars are atomic: when both sides changed the same one differently, the
// local value wins and the element is reported as a conflict.

import type { Document, Element, Page } from "@nodetto/ir";
import { getElementTypeDefinition, isPlainObject } from "@nodetto/ir";
import type { StoreCommit } from "./store.ts";

export interface MergeConflict {
  readonly id: string;
  readonly kind: "element" | "page" | "document";
  readonly reason: "both-changed" | "deleted-locally" | "deleted-remotely";
}

export interface MergeResult {
  readonly document: Document;
  readonly conflicts: readonly MergeConflict[];
}

function same(left: unknown, right: unknown): boolean {
  return JSON.stringify(left) === JSON.stringify(right);
}

/** Merge one JSON value; `conflict` is set when local overrode a remote change. */
function mergeValue(
  base: unknown,
  local: unknown,
  remote: unknown,
  conflict: { value: boolean },
): unknown {
  if (same(local, remote)) return local;
  if (same(local, base)) return remote;
  if (same(remote, base)) return local;
  if (isPlainObject(base) && isPlainObject(local) && isPlainObject(remote)) {
    const result: Record<string, unknown> = {};
    const keys = new Set([
      ...Object.keys(base),
      ...Object.keys(local),
      ...Object.keys(remote),
    ]);
    for (const key of keys) {
      const merged = mergeValue(base[key], local[key], remote[key], conflict);
      if (merged !== undefined) result[key] = merged;
    }
    return result;
  }
  conflict.value = true;
  return local;
}

function mergeById<T extends { readonly id: string }>(
  kind: "element" | "page",
  base: readonly T[],
  local: readonly T[],
  remote: readonly T[],
  conflicts: MergeConflict[],
): T[] {
  const baseMap = new Map(base.map((item) => [item.id, item]));
  const localMap = new Map(local.map((item) => [item.id, item]));
  const remoteMap = new Map(remote.map((item) => [item.id, item]));
  const ids = [
    ...new Set([...localMap.keys(), ...remoteMap.keys(), ...baseMap.keys()]),
  ];
  const result: T[] = [];
  for (const id of ids) {
    const b = baseMap.get(id);
    const l = localMap.get(id);
    const r = remoteMap.get(id);
    if (l === undefined && r === undefined) continue;
    if (b === undefined) {
      // Added on one or both sides.
      if (l !== undefined && r !== undefined && !same(l, r)) {
        const conflict = { value: false };
        result.push(mergeValue({}, l, r, conflict) as T);
        if (conflict.value)
          conflicts.push({ id, kind, reason: "both-changed" });
      } else result.push((l ?? r) as T);
      continue;
    }
    if (l === undefined) {
      // Deleted locally: stays deleted unless remote changed it meanwhile.
      if (r !== undefined && !same(r, b))
        conflicts.push({ id, kind, reason: "deleted-locally" });
      continue;
    }
    if (r === undefined) {
      if (!same(l, b)) {
        // Remote deleted what the person is editing: keep the local edit.
        conflicts.push({ id, kind, reason: "deleted-remotely" });
        result.push(l);
      }
      continue;
    }
    const conflict = { value: false };
    result.push(mergeValue(b, l, r, conflict) as T);
    if (conflict.value) conflicts.push({ id, kind, reason: "both-changed" });
  }
  return result;
}

/** Merge `local` and `remote`, which both derive from `base`. */
export function mergeDocuments(
  base: Document,
  local: Document,
  remote: Document,
): MergeResult {
  const conflicts: MergeConflict[] = [];
  const pages = mergeById<Page>(
    "page",
    base.pages,
    local.pages,
    remote.pages,
    conflicts,
  );
  const pageIds = new Set(pages.map((page) => page.id));
  const elements = mergeById<Element>(
    "element",
    base.elements,
    local.elements,
    remote.elements,
    conflicts,
  ).filter((element) => pageIds.has(element.page));
  const meta = { value: false };
  const title = mergeValue(base.title, local.title, remote.title, meta);
  const extensions = mergeValue(
    base.extensions,
    local.extensions,
    remote.extensions,
    meta,
  );
  if (meta.value)
    conflicts.push({ id: local.id, kind: "document", reason: "both-changed" });
  return {
    document: {
      ...local,
      title: typeof title === "string" ? title : local.title,
      ...(extensions === undefined
        ? {}
        : { extensions: extensions as Document["extensions"] }),
      pages,
      elements,
    },
    conflicts,
  };
}

/**
 * The store commit that turns `current` into `target`, or null when document
 * metadata changed and only a full load can express it.
 */
export function diffDocuments(
  current: Document,
  target: Document,
): StoreCommit | null {
  if (
    current.id !== target.id ||
    current.title !== target.title ||
    current.schemaVersion !== target.schemaVersion ||
    !same(current.extensions, target.extensions) ||
    !same(current.unknownRecords, target.unknownRecords)
  )
    return null;
  const currentElements = new Map(
    current.elements.map((element) => [element.id, element]),
  );
  const targetElements = new Map(
    target.elements.map((element) => [element.id, element]),
  );
  const currentPages = new Map(current.pages.map((page) => [page.id, page]));
  const targetPages = new Map(target.pages.map((page) => [page.id, page]));
  return {
    insertPages: target.pages.filter((page) => !currentPages.has(page.id)),
    updatePages: target.pages.filter((page) => {
      const before = currentPages.get(page.id);
      return before !== undefined && !same(before, page);
    }),
    removePages: current.pages
      .filter((page) => !targetPages.has(page.id))
      .map((page) => page.id),
    insert: target.elements.filter(
      (element) => !currentElements.has(element.id),
    ),
    update: target.elements.filter((element) => {
      const before = currentElements.get(element.id);
      return before !== undefined && !same(before, element);
    }),
    remove: current.elements
      .filter((element) => !targetElements.has(element.id))
      .map((element) => element.id),
  };
}

export function isEmptyCommit(commit: StoreCommit): boolean {
  return (
    !commit.insert?.length &&
    !commit.update?.length &&
    !commit.remove?.length &&
    !commit.insertPages?.length &&
    !commit.updatePages?.length &&
    !commit.removePages?.length
  );
}

export interface VersionConflict {
  readonly kind: "document" | "page" | "element";
  readonly id: string;
  readonly type?: string;
  readonly path?: string;
  readonly reason:
    | "field"
    | "both-added"
    | "deleted-in-ours"
    | "deleted-in-theirs";
  readonly base?: unknown;
  readonly ours?: unknown;
  readonly theirs?: unknown;
}

const compareVersionStrings = (a: string, b: string): number =>
  a < b ? -1 : a > b ? 1 : 0;

/** Merge versions for the CLI while leaving the live editor merge unchanged. */
export function mergeDocumentVersions(
  base: Document,
  ours: Document,
  theirs: Document,
): { document: Document; conflicts: VersionConflict[] } {
  const conflicts: VersionConflict[] = [];
  function value(
    b: unknown,
    o: unknown,
    t: unknown,
    record: Omit<VersionConflict, "reason">,
    path: string,
    added: boolean,
  ): unknown {
    if (same(o, t)) return o;
    if (same(o, b)) return t;
    if (same(t, b)) return o;
    const objectBase =
      added && b === undefined && isPlainObject(o) && isPlainObject(t) ? {} : b;
    if (isPlainObject(objectBase) && isPlainObject(o) && isPlainObject(t)) {
      const result: Record<string, unknown> = {};
      const keys = [
        ...new Set([
          ...Object.keys(objectBase),
          ...Object.keys(o),
          ...Object.keys(t),
        ]),
      ].sort(compareVersionStrings);
      for (const key of keys) {
        const v = value(
          objectBase[key],
          o[key],
          t[key],
          record,
          path ? `${path}.${key}` : key,
          added,
        );
        if (v !== undefined) result[key] = v;
      }
      return result;
    }
    conflicts.push({
      ...record,
      path,
      reason: added ? "both-added" : "field",
      base: b,
      ours: o,
      theirs: t,
    });
    return o;
  }
  function records<T extends { readonly id: string }>(
    kind: "page" | "element",
    bs: readonly T[],
    os: readonly T[],
    ts: readonly T[],
  ): T[] {
    const bm = new Map(bs.map((x) => [x.id, x]));
    const om = new Map(os.map((x) => [x.id, x]));
    const tm = new Map(ts.map((x) => [x.id, x]));
    const ids = [...new Set([...bm.keys(), ...om.keys(), ...tm.keys()])].sort(
      compareVersionStrings,
    );
    const out: T[] = [];
    for (const id of ids) {
      const b = bm.get(id);
      const o = om.get(id);
      const t = tm.get(id);
      if (!o && !t) continue;
      const record = {
        kind,
        id,
        ...(kind === "element"
          ? { type: ((o ?? t ?? b) as unknown as Element).type }
          : {}),
      };
      if (!b) {
        if (o && t) out.push(value({}, o, t, record, "", true) as T);
        else out.push((o ?? t) as T);
      } else if (!o) {
        if (t && !same(b, t))
          conflicts.push({ ...record, reason: "deleted-in-ours" });
      } else if (!t) {
        if (!same(b, o)) {
          out.push(o);
          conflicts.push({ ...record, reason: "deleted-in-theirs" });
        }
      } else out.push(value(b, o, t, record, "", false) as T);
    }
    return out;
  }
  const pages = records("page", base.pages, ours.pages, theirs.pages);
  const elements = records(
    "element",
    base.elements,
    ours.elements,
    theirs.elements,
  );
  const oursPages = new Map(ours.pages.map((p) => [p.id, p]));
  const oursElements = new Map(ours.elements.map((e) => [e.id, e]));
  const baseElements = new Map(base.elements.map((e) => [e.id, e]));
  const theirsElements = new Map(theirs.elements.map((e) => [e.id, e]));
  const addConflict = (c: VersionConflict) => {
    if (
      !conflicts.some(
        (x) =>
          x.kind === c.kind &&
          x.id === c.id &&
          x.reason === c.reason &&
          x.path === c.path,
      )
    )
      conflicts.push(c);
  };
  for (
    let pass = 0;
    pass <=
    base.elements.length +
      ours.elements.length +
      theirs.elements.length +
      ours.pages.length;
    pass++
  ) {
    let changed = false;
    const pageIds = new Set(pages.map((p) => p.id));
    const elementIds = new Set(elements.map((e) => e.id));
    for (const e of [...elements]) {
      if (!pageIds.has(e.page)) {
        const page = oursPages.get(e.page);
        if (page && oursElements.has(e.id)) {
          pages.push(page);
          pageIds.add(page.id);
          addConflict({
            kind: "page",
            id: page.id,
            reason: "deleted-in-theirs",
          });
        } else {
          elements.splice(elements.indexOf(e), 1);
          elementIds.delete(e.id);
          if (!same(baseElements.get(e.id), e))
            addConflict({
              kind: "element",
              id: e.id,
              type: e.type,
              reason: "deleted-in-ours",
            });
        }
        changed = true;
        continue;
      }
      for (const ref of getElementTypeDefinition(e.type)?.references(
        e.semantic,
      ) ?? []) {
        if (elementIds.has(ref.id)) continue;
        if (
          !baseElements.has(ref.id) &&
          !oursElements.has(ref.id) &&
          !theirsElements.has(ref.id)
        )
          continue;
        const original = oursElements.get(ref.id);
        if (original) {
          elements.push(original);
          elementIds.add(original.id);
          addConflict({
            kind: "element",
            id: original.id,
            type: original.type,
            reason: "deleted-in-theirs",
          });
        } else {
          elements.splice(elements.indexOf(e), 1);
          elementIds.delete(e.id);
          addConflict({
            kind: "element",
            id: e.id,
            type: e.type,
            reason: "deleted-in-ours",
          });
        }
        changed = true;
        break;
      }
    }
    if (!changed) break;
  }
  pages.sort((a, b) => compareVersionStrings(a.id, b.id));
  elements.sort((a, b) => compareVersionStrings(a.id, b.id));
  const header = { kind: "document" as const, id: ours.id };
  const title = value(
    base.title,
    ours.title,
    theirs.title,
    header,
    "title",
    false,
  ) as string;
  const extensions = value(
    base.extensions,
    ours.extensions,
    theirs.extensions,
    header,
    "extensions",
    false,
  ) as Document["extensions"];
  const canonicalValue = (v: unknown): unknown => {
    if (Array.isArray(v)) return v.map(canonicalValue);
    if (!isPlainObject(v)) return v;
    const result: Record<string, unknown> = {};
    for (const key of Object.keys(v).sort(compareVersionStrings))
      result[key] = canonicalValue(v[key]);
    return result;
  };
  const unknownKey = (r: NonNullable<Document["unknownRecords"]>[number]) =>
    JSON.stringify([r.kind, canonicalValue(r.data)]);
  const bm = new Map(
    (base.unknownRecords ?? []).map((r) => [unknownKey(r), r]),
  );
  const om = new Map(
    (ours.unknownRecords ?? []).map((r) => [unknownKey(r), r]),
  );
  const tm = new Map(
    (theirs.unknownRecords ?? []).map((r) => [unknownKey(r), r]),
  );
  const unknownRecords = [...new Set([...om.keys(), ...tm.keys()])]
    .filter((k) => !bm.has(k) || (om.has(k) && tm.has(k)))
    .sort(compareVersionStrings)
    .map(
      (k) =>
        (om.get(k) ?? tm.get(k)) as NonNullable<
          Document["unknownRecords"]
        >[number],
    );
  conflicts.sort(
    (a, b) =>
      compareVersionStrings(
        String(["document", "page", "element"].indexOf(a.kind)),
        String(["document", "page", "element"].indexOf(b.kind)),
      ) ||
      compareVersionStrings(a.id, b.id) ||
      compareVersionStrings(a.path ?? "", b.path ?? ""),
  );
  const document: Document = {
    ...ours,
    title,
    extensions,
    pages,
    elements,
    unknownRecords,
  };
  return { document, conflicts };
}
