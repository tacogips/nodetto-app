import { expect, test } from "bun:test";
import type { CadFaceRef } from "@nodetto/ir";
import { analyzeCadPage, faceBody, faceOutwardSign } from "./index.ts";
import {
  cadElement,
  extrude,
  plateElements,
  rectangle,
  sketch,
} from "./testing/documents.ts";

test("history orders features by fractional index and id and groups only local entities", () => {
  const loop = rectangle("a", 0, 0, 1, 1);
  const history = analyzeCadPage([
    sketch("z", "b"),
    sketch("b", "a"),
    ...loop,
    sketch("a", "a"),
    {
      ...cadElement("other", "cad.circle", "a", {
        sketch: "a",
        c: [0, 0],
        r: 1,
      }),
      page: "another-page",
    },
  ]);
  expect(history.features.map(({ id }) => id)).toEqual(["a", "b", "z"]);
  expect(history.entitiesOf("a")).toEqual(loop);
  expect(history.entitiesOf("unknown")).toEqual([]);
  expect(history.status.get("other")).toMatchObject({
    code: "cad.reference.missing",
  });
});

test("valid detached payloads remain analyzable and leave unrelated features intact", () => {
  const detached = [
    extrude("sketch-deleted", "c", { distance: 1, op: "new" }),
    extrude("body-deleted", "c", {
      sketch: "base",
      distance: 1,
      op: "cut",
      bodies: [],
    }),
    extrude("loop-deleted", "c", {
      sketch: "base",
      distance: 1,
      op: "new",
      loops: [],
    }),
    sketch("feature-deleted", "c", { face: { role: "end" } }),
    sketch("entity-deleted", "c", { face: { feature: "ex1", role: "side" } }),
    sketch("later", "d"),
  ];
  const { status } = analyzeCadPage([...plateElements(), ...detached]);
  expect(detached.map(({ id }) => status.get(id)?.ok)).toEqual([
    false,
    false,
    false,
    false,
    false,
    true,
  ]);
  expect(status.get("sketch-deleted")).toMatchObject({
    code: "cad.reference.missing",
  });
  expect(status.get("body-deleted")).toMatchObject({
    code: "cad.body.missing",
  });
  expect(status.get("loop-deleted")).toMatchObject({
    code: "cad.profile.empty",
  });
  expect(status.get("feature-deleted")).toMatchObject({
    code: "cad.reference.missing",
  });
  expect(status.get("entity-deleted")).toMatchObject({
    code: "cad.reference.missing",
  });
});

test("history distinguishes later references, cycles, invalid body targets and curved faces", () => {
  const { status } = analyzeCadPage([
    ...plateElements(),
    sketch("cycle-sketch", "a", {
      face: { feature: "cycle-extrude", role: "end" },
    }),
    extrude("cycle-extrude", "b", {
      sketch: "cycle-sketch",
      distance: 2,
      op: "new",
    }),
    sketch("forward", "c", { face: { feature: "later", role: "end" } }),
    extrude("later", "d", { sketch: "base", distance: 2, op: "new" }),
    extrude("bad-target", "e", {
      sketch: "base",
      distance: 2,
      op: "add",
      bodies: ["ex1", "forward"],
    }),
    extrude("later-target", "c", {
      sketch: "base",
      distance: -1,
      op: "cut",
      bodies: ["later"],
    }),
    cadElement("round", "cad.circle", "a1", {
      sketch: "base",
      c: [4, 4],
      r: 1,
    }),
    sketch("non-planar", "f", {
      face: { feature: "ex1", role: "side", entity: "round" },
    }),
    sketch("wrong-type", "f", { face: { feature: "base", role: "start" } }),
  ]);
  expect(status.get("cycle-sketch")).toMatchObject({ code: "cad.cycle" });
  expect(status.get("cycle-extrude")).toMatchObject({ code: "cad.cycle" });
  expect(status.get("forward")).toMatchObject({
    code: "cad.order.forward",
    detail: "later",
  });
  expect(status.get("later-target")).toMatchObject({
    code: "cad.order.forward",
    detail: "later",
  });
  expect(status.get("bad-target")).toMatchObject({
    code: "cad.body.reference",
  });
  expect(status.get("non-planar")).toMatchObject({
    code: "cad.plane.notPlanar",
  });
  expect(status.get("wrong-type")).toMatchObject({
    code: "cad.reference.missing",
  });
});

test("the page element limit also counts future CAD types, excluding carriers", () => {
  const source = sketch("profile", "a");
  const unknown = Array.from({ length: 20_000 }, (_, i) =>
    cadElement(`future-${i}`, "cad.future", "a", {}),
  );
  const carrier = cadElement("carrier", "design.token", "a", {});
  expect(
    analyzeCadPage([source, carrier, ...unknown.slice(1)]).status.get(
      source.id,
    ),
  ).toEqual({ ok: true });
  expect(
    analyzeCadPage([source, ...unknown]).status.get(source.id),
  ).toMatchObject({ code: "cad.limit" });
});

function cap(feature: string, role: "start" | "end"): CadFaceRef {
  return { feature, role };
}

function side(feature: string, entity: string): CadFaceRef {
  return { feature, role: "side", entity };
}

test("outward sign follows distance, stored side direction and hole depth", () => {
  const reversed = cadElement("base-edge-0", "cad.line", "a1", {
    sketch: "base",
    a: [100, 0],
    b: [0, 0],
  });
  const pocketLoop = rectangle("base", 40, 20, 10, 10).map((line) => ({
    ...line,
    id: `inner-${line.id}`,
  }));
  const elements = [
    ...plateElements().filter(({ id }) => id !== reversed.id),
    reversed,
    ...pocketLoop,
    extrude("negative", "a3", { sketch: "base", distance: -5, op: "new" }),
  ];
  expect(faceOutwardSign(elements, cap("ex1", "start"))).toBe(-1);
  expect(faceOutwardSign(elements, cap("ex1", "end"))).toBe(1);
  expect(faceOutwardSign(elements, cap("negative", "end"))).toBe(-1);
  expect(faceOutwardSign(elements, side("ex1", "base-edge-0"))).toBe(-1);
  expect(faceOutwardSign(elements, side("ex1", "inner-base-edge-0"))).toBe(-1);
  expect(faceOutwardSign(elements, side("ex1", "missing"))).toBe(0);
});

test.each([
  ["cut", 1, -1],
  ["intersect", -1, 1],
] as const)(
  "operation %s sets the floor and wall outward signs",
  (op, floorSign, wallSign) => {
    const elements = [
      ...plateElements(),
      extrude("body2", "a3", { sketch: "base", distance: 5, op: "new" }),
      sketch("pocket", "a4", { face: cap("ex1", "end") }),
      ...rectangle("pocket", 30, 20, 40, 20),
      extrude("pocket-cut", "a5", {
        sketch: "pocket",
        distance: -2,
        op,
        bodies: ["body2", "ex1"],
      }),
    ];
    expect(faceOutwardSign(elements, cap("pocket-cut", "end"))).toBe(floorSign);
    expect(faceOutwardSign(elements, side("pocket-cut", "pocket-edge-0"))).toBe(
      wallSign,
    );
    expect(faceBody(elements, cap("ex1", "end"))).toBe("ex1");
    expect(faceBody(elements, cap("pocket-cut", "end"))).toBe("body2");
    const detached = extrude("pocket-cut", "a5", {
      sketch: "pocket",
      distance: -2,
      op,
      bodies: [],
    });
    expect(
      faceBody([...elements.slice(0, -1), detached], cap("pocket-cut", "end")),
    ).toBeNull();
  },
);
