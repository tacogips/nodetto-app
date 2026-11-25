import { expect, test } from "bun:test";
import { cadElement } from "../../../core/src/cad/testing/documents.ts";
import {
  displayedExtrudeTargets,
  earlierExtrudeBodies,
  orderExtrudeTargets,
  selectTargets,
  targetSelectionWork,
  targetsForOperation,
} from "./extrude-targets.ts";

test("extrude targets follow displayed history and operation rules", () => {
  const left = cadElement("left", "cad.extrude", "a", { op: "new" });
  const right = cadElement("right", "cad.mesh", "b", {});
  const cut = cadElement("cut", "cad.extrude", "c", { op: "cut" });
  const current = cadElement("current", "cad.extrude", "d", { op: "cut" });
  const later = cadElement("later", "cad.extrude", "e", { op: "new" });
  const elements = [later, right, cut, current, left];
  expect(
    earlierExtrudeBodies(elements, current).map((item) => item.id),
  ).toEqual(["left", "right"]);
  const displayed = displayedExtrudeTargets(elements, current, [
    "right",
    "detached",
    "left",
    "detached",
  ]);
  expect(displayed).toEqual(["left", "right", "detached", "detached"]);
  expect(targetsForOperation("new", displayed)).toEqual([]);
  expect(targetsForOperation("add", displayed)).toEqual(["left"]);
  expect(targetsForOperation("add", [])).toEqual([]);
  expect(targetsForOperation("cut", displayed)).toEqual([
    "left",
    "right",
    "detached",
  ]);
  expect(targetsForOperation("intersect", displayed)).toEqual([
    "left",
    "right",
    "detached",
  ]);
});

test("target selection and ordering do linear work", () => {
  const visits: number[] = [];
  for (const n of [500, 1000]) {
    const ids = Array.from({ length: n }, (_, index) => `body-${index}`);
    Object.assign(targetSelectionWork, { builds: 0, visits: 0, queries: 0 });
    const selection = selectTargets(ids);
    expect(selection.ids).toEqual(ids);
    for (const id of ids) expect(selection.has(id)).toBe(true);
    expect(targetSelectionWork).toEqual({ builds: 1, visits: n, queries: n });
    targetSelectionWork.visits = 0;
    expect(orderExtrudeTargets(ids, ids)).toEqual(ids);
    expect(targetSelectionWork.visits).toBe(2 * n);
    visits.push(targetSelectionWork.visits);
  }
  expect(visits[1]).toBe(2 * (visits[0] ?? 0));
  expect(selectTargets(["a", 7, null, "b"]).ids).toEqual(["a", "b"]);
  expect(
    orderExtrudeTargets(["a", "b", "c"], ["c", "missing", "a", "missing"]),
  ).toEqual(["a", "c", "missing", "missing"]);
});
