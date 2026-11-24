import { expect, test } from "bun:test";
import { cadElement } from "../../../core/src/cad/testing/documents.ts";
import {
  displayedExtrudeTargets,
  earlierExtrudeBodies,
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
