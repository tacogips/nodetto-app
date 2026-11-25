import { expect, test } from "bun:test";
import type {
  CadFaceRef,
  CadLineSemantic,
  Element as IrElement,
} from "@nodetto/ir";
import {
  analyzeCadPage,
  checkCadPage,
  faceBody,
  faceOutwardSign,
} from "./index.ts";
import { visitCadConstruction } from "./construction.ts";
import {
  cadFailure,
  cadGeometryWork,
  createCadGeometry,
  extrudeGeometryOf,
  scanCadPage,
  sketchFrameLookup,
} from "./history.ts";
import { faceFrame } from "./frames.ts";
import { generateCadDocument } from "./testing/generate.ts";
import { buildLoops, type CadLoop } from "./loops.ts";
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

test("construction shares each sketch contour across many selected extrusions", () => {
  const vertices = Array.from({ length: 64 }, (_, i) => {
    const angle = (i * 2 * Math.PI) / 64;
    return [
      Math.round(Math.cos(angle) * 1000),
      Math.round(Math.sin(angle) * 1000),
    ] as const;
  });
  const edges = vertices.map((a, i) =>
    cadElement(`edge-${i}`, "cad.line", "a1", {
      sketch: "profile",
      a,
      b: vertices[(i + 1) % vertices.length],
    }),
  );
  const features = edges.map((edge, i) =>
    extrude(`ex-${i}`, "b", {
      sketch: "profile",
      distance: 1,
      op: "new",
      loops: [edge.id],
    }),
  );
  const stats = { profileBuilds: 0, pointArrays: 0, retainedTools: 0 };
  const tools = new Map<string, readonly CadLoop[]>();
  const report = visitCadConstruction(
    [sketch("profile", "a"), ...edges, ...features],
    "cad",
    {
      tool(feature, tool) {
        tools.set(feature.id, tool.loops);
      },
    },
    stats,
  );
  expect(report.errors).toEqual([]);
  for (const feature of features) {
    const expected = buildLoops(edges, feature.semantic.loops);
    expect("loops" in expected && tools.get(feature.id)).toEqual(
      "loops" in expected && expected.loops,
    );
  }
  expect(stats).toEqual({ profileBuilds: 1, pointArrays: 1, retainedTools: 0 });

  const repeated = Array.from({ length: 1000 }, (_, i) =>
    extrude(`repeat-${i}`, "b", {
      sketch: "profile",
      distance: 1,
      op: "new",
      loops: ["edge-0"],
    }),
  );
  const repeatedStats = { profileBuilds: 0, pointArrays: 0, retainedTools: 0 };
  const repeatedReport = visitCadConstruction(
    [sketch("profile", "a"), ...edges, ...repeated],
    "cad",
    { tool() {} },
    repeatedStats,
  );
  expect(repeatedReport.errors).toEqual([]);
  expect(repeatedStats).toEqual({
    profileBuilds: 1,
    pointArrays: 1,
    retainedTools: 0,
  });
});

test("construction retains only tools referenced by sketch faces", () => {
  const elements = [
    ...plateElements(),
    sketch("upper", "a3", { face: { feature: "ex1", role: "end" } }),
    ...rectangle("upper", 2, 2, 5, 5),
    extrude("ex2", "a4", { sketch: "upper", distance: 2, op: "new" }),
  ];
  const stats = { profileBuilds: 0, pointArrays: 0, retainedTools: 0 };
  const report = visitCadConstruction(elements, "cad", { tool() {} }, stats);
  expect(report.errors).toEqual([]);
  expect(stats.retainedTools).toBe(1);
});

test("shared profiles preserve selection, nesting and errors outside the selection", () => {
  const outer = rectangle("profile", 0, 0, 10, 10);
  const inner = rectangle("inner", 2, 2, 2, 2).map((edge) => ({
    ...edge,
    semantic: { ...edge.semantic, sketch: "profile" },
  }));
  const entities = [...outer, ...inner];
  const geometry = createCadGeometry(
    scanCadPage([sketch("profile", "a"), ...entities]),
  );
  const frame = geometry.sketch({ base: "xy" });
  if ("ok" in frame) throw new Error("invalid frame");
  geometry.frames.set("profile", frame);
  const semantic = {
    sketch: "profile",
    distance: 1,
    op: "new" as const,
    name: "test",
  };
  expect(geometry.extrude({ ...semantic, loops: ["missing"] })).toEqual({
    ok: false,
    code: "cad.profile.empty",
  });
  const tool = geometry.extrude({
    ...semantic,
    loops: ["profile-edge-0", "inner-edge-0"],
  });
  expect(
    "loops" in tool && tool.loops.map((loop) => loop.depth).sort(),
  ).toEqual([0, 1]);
  const invalid = [
    cadElement("zero-0", "cad.line", "a1", {
      sketch: "profile",
      a: [20, 0],
      b: [21, 0],
    }),
    cadElement("zero-1", "cad.line", "a1", {
      sketch: "profile",
      a: [21, 0],
      b: [22, 0],
    }),
    cadElement("zero-2", "cad.line", "a1", {
      sketch: "profile",
      a: [22, 0],
      b: [20, 0],
    }),
  ];
  const expected = buildLoops([...outer, ...invalid], ["profile-edge-0"]);
  const broken = createCadGeometry(
    scanCadPage([sketch("profile", "a"), ...outer, ...invalid]),
  );
  broken.frames.set("profile", frame);
  expect(expected).toEqual({ error: "cad.profile.empty", at: "zero-0" });
  if ("error" in expected)
    expect(broken.extrude({ ...semantic, loops: ["profile-edge-0"] })).toEqual(
      cadFailure(expected.error, expected.at),
    );
});

function resetWork() {
  cadGeometryWork.profileBuilds = 0;
  cadGeometryWork.statusVisits = 0;
  cadGeometryWork.loopProbes = 0;
  cadGeometryWork.featureUpdates = 0;
}

function chain(count: number, distance = 1) {
  return Array.from({ length: count }, (_, i) => {
    const id = `chain-${i}`;
    const index = (n: number) => `f${String(n).padStart(4, "0")}`;
    return [
      sketch(
        id,
        index(i * 2),
        i === 0
          ? { base: "xy" }
          : { face: { feature: `chain-ex-${i - 1}`, role: "end" } },
      ),
      ...rectangle(id, 0, 0, 1, 1),
      extrude(`chain-ex-${i}`, index(i * 2 + 1), {
        sketch: id,
        distance: i === 0 ? distance : 1,
        op: "new",
      }),
    ];
  }).flat();
}

test("face resolution shares feature updates and handles failed chains", () => {
  const valid = chain(2);
  const suppressed = valid.map((element) =>
    element.id === "chain-ex-0"
      ? extrude("chain-ex-0", "f0001", {
          sketch: "chain-0",
          distance: 1,
          op: "new",
          suppressed: true,
        })
      : element,
  );
  const broken = valid.filter(({ id }) => id !== "chain-0-edge-0");
  for (const elements of [valid, suppressed, broken]) {
    const lookup = sketchFrameLookup(elements);
    resetWork();
    const frame = lookup("chain-1");
    if (elements === valid) expect(cadGeometryWork.featureUpdates).toBe(3);
    resetWork();
    const result = extrudeGeometryOf(elements, {
      name: "test",
      sketch: "chain-1",
      distance: 1,
      op: "new",
    });
    if (elements === valid) expect(cadGeometryWork.featureUpdates).toBe(3);
    expect(frame === null).toBe("ok" in result);
    if (!("ok" in result)) expect(frame).toEqual(result.frame);
  }
});

test.each([40, 80])(
  "face frame lookup shares ancestors for %i sketches",
  (count) => {
    const lookup = sketchFrameLookup(chain(count));
    resetWork();
    for (let i = 0; i < count; i++) {
      expect(lookup(`chain-${i}`)).toEqual({
        o: [0, 0, i],
        u: [1, 0, 0],
        v: [0, 1, 0],
        n: [0, 0, 1],
      });
    }
    console.log(`chain ${count}: ${cadGeometryWork.profileBuilds}`);
    expect(cadGeometryWork.profileBuilds).toBe(count - 1);
    const changed = sketchFrameLookup(chain(count, 3));
    for (let i = 1; i < count; i++)
      expect(changed(`chain-${i}`)?.o).toEqual([0, 0, i + 2]);
    const broken = chain(count).filter(({ id }) => id !== "chain-0-edge-0");
    const failed = sketchFrameLookup(broken);
    for (let i = 1; i < count; i++) expect(failed(`chain-${i}`)).toBeNull();
  },
);

test.each([250, 500])(
  "shared sketch selection performs linear work for %i contours",
  (count) => {
    const entities = Array.from({ length: count }, (_, i) =>
      cadElement(`circle-${i}`, "cad.circle", "a1", {
        sketch: "profile",
        c: [i * 3, 0],
        r: 1,
      }),
    );
    const geometry = createCadGeometry(
      scanCadPage([sketch("profile", "a"), ...entities]),
    );
    const frame = geometry.sketch({ base: "xy" });
    if ("ok" in frame) throw new Error("invalid frame");
    geometry.frames.set("profile", frame);
    resetWork();
    for (const entity of entities) {
      const result = geometry.extrude({
        name: "test",
        sketch: "profile",
        distance: 1,
        op: "new",
        loops: [entity.id],
      });
      expect("loops" in result).toBe(true);
    }
    console.log(
      `contours ${count}: ${cadGeometryWork.statusVisits} ${cadGeometryWork.loopProbes}`,
    );
    expect(cadGeometryWork.statusVisits).toBe(count);
    expect(cadGeometryWork.loopProbes).toBe(2 * count);
    const selection = [
      `circle-${count - 1}`,
      "missing",
      "circle-0",
      "circle-0",
    ];
    const profile = buildLoops(entities);
    if ("error" in profile) throw new Error(profile.error);
    const expected = profile.loops.filter((loop) =>
      loop.members.some((id) => new Set(selection).has(id)),
    );
    const result = geometry.extrude({
      name: "test",
      sketch: "profile",
      distance: 1,
      op: "new",
      loops: selection,
    });
    expect("loops" in result && result.loops).toEqual(expected);
  },
);

test("extrusion preserves frame and entity failure precedence", () => {
  const bad = cadElement("bad-circle", "cad.circle", "a1", {
    sketch: "profile",
    c: [0, 0],
    r: -1,
  });
  const open = cadElement("open", "cad.line", "a1", {
    sketch: "profile",
    a: [0, 0],
    b: [1, 0],
  });
  const history = scanCadPage([sketch("profile", "a"), bad, open]);
  const geometry = createCadGeometry(history);
  const semantic = {
    name: "test",
    sketch: "profile",
    distance: 1,
    op: "new" as const,
    loops: ["missing"],
  };
  expect(geometry.extrude(semantic)).toEqual(
    cadFailure("cad.reference.failed", "profile"),
  );
  const frame = geometry.sketch({ base: "xy" });
  if ("ok" in frame) throw new Error("invalid frame");
  geometry.frames.set("profile", frame);
  const failure = history.status.get(bad.id);
  if (!failure || failure.ok) throw new Error("expected entity failure");
  expect(geometry.extrude(semantic)).toEqual(failure);
});

test("extent boundary and entity failure precedence are preserved", () => {
  const run = (offset: number, invalid = false) => {
    const entities: IrElement[] = rectangle("profile", 0, 0, 4, 4);
    if (invalid)
      entities.push(
        cadElement("invalid", "cad.circle", "a1", {
          sketch: "profile",
          c: [0, 0],
          r: 0,
        }),
      );
    const geometry = createCadGeometry(
      scanCadPage([sketch("profile", "a"), ...entities]),
    );
    const frame = geometry.sketch({ base: "xy", offset });
    if ("ok" in frame) throw new Error("invalid frame");
    geometry.frames.set("profile", frame);
    return geometry.extrude({
      name: "tool",
      sketch: "profile",
      distance: 1,
      op: "new",
    });
  };
  expect("loops" in run(9999)).toBe(true);
  expect(run(9999 + 2e-9)).toMatchObject({ ok: false, code: "cad.limit" });
  expect(run(9999 + 2e-9, true)).toMatchObject({
    ok: false,
    code: "cad.profile.invalid",
  });
});

test("side membership work stays linear and preserves frames and omitted errors", () => {
  for (const mode of ["repeated", "distinct", "omitted"] as const) {
    const series: number[] = [];
    for (const count of [256, 512, 1024]) {
      const vertices = Array.from({ length: count }, (_, i) => {
        const angle = (i * 2 * Math.PI) / count;
        return [
          Math.round(5000 * Math.cos(angle)),
          Math.round(5000 * Math.sin(angle)),
        ] as const;
      });
      const edges = vertices.map((a, i) =>
        cadElement(`edge-${i}`, "cad.line", "a1", {
          sketch: "profile",
          a,
          b: vertices[(i + 1) % count],
        }),
      );
      const selected = rectangle("profile", 7000, 7000, 4, 4);
      const entities = mode === "omitted" ? [...edges, ...selected] : edges;
      const geometry = createCadGeometry(
        scanCadPage([sketch("profile", "a"), ...entities]),
      );
      const frame = geometry.sketch({ base: "xy" });
      if ("ok" in frame) throw new Error("invalid frame");
      geometry.frames.set("profile", frame);
      const tool = geometry.extrude({
        name: "tool",
        sketch: "profile",
        distance: 1,
        op: "new",
        ...(mode === "omitted" ? { loops: ["profile-edge-0"] } : {}),
      });
      if ("ok" in tool) throw new Error("invalid tool");
      geometry.extrudes.set("ex", tool);
      cadGeometryWork.sideMemberVisits = 0;
      cadGeometryWork.sideMemberIndexBuilds = 0;
      geometry.sketch({ base: "xy" });
      geometry.sketch({ face: { feature: "ex", role: "end" } });
      expect(cadGeometryWork.sideMemberVisits).toBe(0);
      expect(cadGeometryWork.sideMemberIndexBuilds).toBe(0);
      for (let i = 0; i < count; i++) {
        const edge = edges[mode === "repeated" ? count - 1 : i];
        if (!edge) throw new Error("missing edge");
        const result = geometry.sketch({
          face: { feature: "ex", role: "side", entity: edge.id },
        });
        if (mode === "omitted")
          expect(result).toEqual(cadFailure("cad.reference.missing", edge.id));
        else
          expect(result).toEqual(
            faceFrame(
              tool.frame,
              tool.span,
              "side",
              edge.semantic as CadLineSemantic,
            ),
          );
      }
      series.push(cadGeometryWork.sideMemberVisits);
      expect(cadGeometryWork.sideMemberIndexBuilds).toBe(1);
    }
    console.log(`side ${mode}: ${series.join(", ")}`);
    for (let i = 1; i < series.length; i++) {
      expect(series[i] ?? Number.POSITIVE_INFINITY).toBeLessThanOrEqual(
        2.5 * (series[i - 1] ?? 0),
      );
    }
  }
});

test("ordinary CAD check does not build side member indexes", () => {
  const doc = generateCadDocument({ features: 500, entitiesPerSketch: 18 });
  const page = doc.pages[0];
  if (!page) throw new Error("missing page");
  cadGeometryWork.sideMemberVisits = 0;
  cadGeometryWork.sideMemberIndexBuilds = 0;
  expect(checkCadPage(doc.elements, page.id).errors).toEqual([]);
  console.log(
    `ordinary side visits: ${cadGeometryWork.sideMemberVisits}; max scanned/memberTotal: 0 (no side queries)`,
  );
  expect(cadGeometryWork.sideMemberVisits).toBe(0);
  expect(cadGeometryWork.sideMemberIndexBuilds).toBe(0);
});

test("side member index builds on the query after the scan budget", () => {
  const first = rectangle("profile", 0, 0, 4, 4);
  const second = rectangle("other", 10, 0, 4, 4).map((edge) => ({
    ...edge,
    semantic: { ...edge.semantic, sketch: "profile" },
  }));
  const geometry = createCadGeometry(
    scanCadPage([sketch("profile", "a"), ...first, ...second]),
  );
  const frame = geometry.sketch({ base: "xy" });
  if ("ok" in frame) throw new Error("invalid frame");
  geometry.frames.set("profile", frame);
  const semantic = {
    name: "tool",
    sketch: "profile",
    distance: 1,
    op: "new" as const,
  };
  const tool = geometry.extrude({ ...semantic, loops: ["profile-edge-0"] });
  const other = geometry.extrude({ ...semantic, loops: ["other-edge-0"] });
  if ("ok" in tool || "ok" in other) throw new Error("invalid tool");
  geometry.extrudes.set("ex", tool);
  geometry.extrudes.set("other", other);
  cadGeometryWork.sideMemberVisits = 0;
  cadGeometryWork.sideMemberIndexBuilds = 0;
  for (let i = 0; i < 4; i++) {
    expect(
      geometry.sketch({
        face: { feature: "ex", role: "side", entity: "other-edge-0" },
      }),
    ).toEqual(cadFailure("cad.reference.missing", "other-edge-0"));
  }
  expect(cadGeometryWork.sideMemberVisits).toBe(16);
  expect(cadGeometryWork.sideMemberIndexBuilds).toBe(0);
  expect(
    geometry.sketch({
      face: { feature: "ex", role: "side", entity: "other-edge-0" },
    }),
  ).toEqual(cadFailure("cad.reference.missing", "other-edge-0"));
  expect(cadGeometryWork.sideMemberVisits).toBe(21);
  expect(cadGeometryWork.sideMemberIndexBuilds).toBe(1);
  expect(
    geometry.sketch({
      face: { feature: "other", role: "side", entity: "other-edge-0" },
    }),
  ).not.toHaveProperty("ok");
});

test("shared profile side queries use the sketch index", () => {
  for (const explicit of [false, true]) {
    for (const count of [256, 512, 1024]) {
      const vertices = Array.from({ length: count }, (_, i) => {
        const angle = (i * 2 * Math.PI) / count;
        return [
          Math.round(5000 * Math.cos(angle)),
          Math.round(5000 * Math.sin(angle)),
        ] as const;
      });
      const edges = vertices.map((a, i) =>
        cadElement(`shared-edge-${i}`, "cad.line", "a1", {
          sketch: "profile",
          a,
          b: vertices[(i + 1) % count],
        }),
      );
      const rectangleEdges = rectangle("profile", 7000, 7000, 4, 4);
      const total = explicit ? count / 4 : count;
      const features = Array.from({ length: total }, (_, i) =>
        extrude(`shared-ex-${i}`, "b", {
          sketch: "profile",
          distance: i + 1,
          op: "new",
          ...(explicit ? { loops: ["shared-edge-0"] } : {}),
        }),
      );
      const sides = features.flatMap((feature, i) =>
        (explicit ? [0, 1, 2, 3, -1] : [count - 1]).map((edge, j) =>
          sketch(`side-${i}-${j}`, "c", {
            face: {
              feature: feature.id,
              role: "side",
              entity: edge < 0 ? "profile-edge-0" : `shared-edge-${edge}`,
            },
          }),
        ),
      );
      const elements = [
        sketch("profile", "a"),
        ...edges,
        ...(explicit ? rectangleEdges : []),
        ...features,
        ...sides,
      ];
      cadGeometryWork.sideMemberVisits = 0;
      cadGeometryWork.sideMemberIndexBuilds = 0;
      cadGeometryWork.sideSelectionEntries = 0;
      const result = checkCadPage(elements, "cad");
      if (explicit) {
        expect(result.errors).toHaveLength(total);
        expect(result.errors.map(({ id }) => id).sort()).toEqual(
          features.map((_, i) => `side-${i}-4`).sort(),
        );
        for (const error of result.errors)
          expect(error).toMatchObject({ code: "cad.reference.missing" });
        expect(cadGeometryWork.sideSelectionEntries).toBe(total);
        expect(cadGeometryWork.sideMemberVisits).toBeLessThanOrEqual(
          total * 16,
        );
      } else {
        expect(result.errors).toEqual([]);
        expect(cadGeometryWork.sideMemberVisits).toBe(total);
        expect(cadGeometryWork.sideSelectionEntries).toBe(0);
      }
      expect(cadGeometryWork.sideMemberIndexBuilds).toBe(0);
      console.log(
        `shared side explicit=${explicit} count=${count} visits=${cadGeometryWork.sideMemberVisits} entries=${cadGeometryWork.sideSelectionEntries}`,
      );
      if (count === 256) {
        const geometry = createCadGeometry(scanCadPage(elements));
        const frame = geometry.sketch({ base: "xy" });
        if ("ok" in frame) throw new Error("invalid frame");
        geometry.frames.set("profile", frame);
        for (const feature of features) {
          const tool = geometry.extrude(feature.semantic);
          if ("ok" in tool) throw new Error("invalid tool");
          geometry.extrudes.set(feature.id, tool);
          if (explicit)
            expect(
              geometry.sketch({
                face: {
                  feature: feature.id,
                  role: "side",
                  entity: "profile-edge-0",
                },
              }),
            ).toEqual(cadFailure("cad.reference.missing", "profile-edge-0"));
          for (const edge of explicit ? edges.slice(0, 4) : edges.slice(-1)) {
            expect(
              geometry.sketch({
                face: { feature: feature.id, role: "side", entity: edge.id },
              }),
            ).toEqual(
              faceFrame(
                tool.frame,
                tool.span,
                "side",
                edge.semantic as CadLineSemantic,
              ),
            );
          }
        }
      }
    }
  }
});

test("ordinary CAD check performs no side selection work", () => {
  const doc = generateCadDocument({ features: 500, entitiesPerSketch: 18 });
  const page = doc.pages[0];
  if (!page) throw new Error("missing page");
  cadGeometryWork.sideMemberVisits = 0;
  cadGeometryWork.sideMemberIndexBuilds = 0;
  cadGeometryWork.sideSelectionEntries = 0;
  cadGeometryWork.profileBuilds = 0;
  cadGeometryWork.loopProbes = 0;
  expect(checkCadPage(doc.elements, page.id).errors).toEqual([]);
  expect(cadGeometryWork.sideMemberVisits).toBe(0);
  expect(cadGeometryWork.sideMemberIndexBuilds).toBe(0);
  expect(cadGeometryWork.sideSelectionEntries).toBe(0);
  console.log(
    `ordinary profile builds=${cadGeometryWork.profileBuilds} loop probes=${cadGeometryWork.loopProbes}`,
  );
});
