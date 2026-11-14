// Semantic validation of generic edges: prototype interactions and
// connector routing.

import { describe, expect, test } from "bun:test";
import { validate, expectValid } from "./test-helpers.ts";

describe("semantic validation", () => {
  test("validates prototype transition settings", () => {
    expectValid("edge.generic", {
      from: "a",
      to: "b",
      prototype: true,
      prototypeTransition: "smart",
      prototypeDuration: 420,
    });
    expect(
      validate("edge.generic", {
        from: "a",
        to: "b",
        prototype: true,
        prototypeTransition: "dissolve",
        prototypeDuration: 5001,
      }).map(({ code, path }) => ({ code, path })),
    ).toEqual([
      { code: "value.enum", path: "semantic.prototypeTransition" },
      { code: "value.max", path: "semantic.prototypeDuration" },
    ]);
  });

  test("validates portable connector routing", () => {
    for (const type of ["edge.generic", "uml.association"]) {
      const base =
        type === "uml.association"
          ? { from: "a", to: "b", kind: "assoc" }
          : { from: "a", to: "b" };
      expectValid(type, {
        ...base,
        routing: "orthogonal",
        routingAxis: "vertical",
        routingBend: 0.75,
        routingAvoidObstacles: true,
      });
      expectValid(type, {
        ...base,
        routing: "manual",
        routingWaypoints: [
          { u: 0.25, v: 40 },
          { u: 0.75, v: -20 },
        ],
      });
      expect(
        validate(type, {
          ...base,
          routing: "curved",
          routingBend: 1.5,
          routingAvoidObstacles: "yes",
        }).map(({ code, path }) => ({ code, path })),
      ).toEqual([
        { code: "value.enum", path: "semantic.routing" },
        { code: "value.max", path: "semantic.routingBend" },
        { code: "type.boolean", path: "semantic.routingAvoidObstacles" },
      ]);
    }
    expect(
      validate("edge.generic", {
        from: "a",
        to: "b",
        routing: "manual",
        routingWaypoints: [{ u: "middle", v: Number.NaN }],
      }).map(({ code, path }) => ({ code, path })),
    ).toEqual([
      { code: "type.number", path: "semantic.routingWaypoints[0].u" },
      { code: "type.number", path: "semantic.routingWaypoints[0].v" },
    ]);
    expect(
      validate("edge.generic", {
        from: "a",
        to: "b",
        routing: "manual",
        routingWaypoints: Array.from({ length: 33 }, () => ({ u: 0.5, v: 0 })),
      }).map(({ code, path }) => ({ code, path })),
    ).toEqual([{ code: "value.max", path: "semantic.routingWaypoints" }]);
  });

  test("validates fixed connector attachment sides", () => {
    expectValid("edge.generic", {
      from: "a",
      to: "b",
      fromPort: "bottom",
      toPort: "left",
    });
    expect(
      validate("edge.generic", {
        from: "a",
        to: "b",
        fromPort: "center",
        toPort: 2,
      }).map(({ path }) => path),
    ).toEqual(["semantic.fromPort", "semantic.toPort"]);
  });

  test("generic ends choose either a shape reference or a free point", () => {
    expectValid("edge.generic", {
      fromPoint: { x: 0, y: 0 },
      toPoint: { x: 100, y: 200 },
    });
    expectValid("edge.generic", {
      from: "shape",
      fromPort: "right",
      toPoint: { x: 100, y: 200 },
    });
    expect(
      validate("edge.generic", {
        from: "shape",
        fromPoint: { x: 0, y: 0 },
        to: "other",
      }).map(({ code }) => code),
    ).toContain("connector.endpointConflict");
    expect(
      validate("edge.generic", {
        fromPoint: { x: 0, y: 0 },
        fromPort: "top",
        to: "other",
      }).map(({ code }) => code),
    ).toContain("connector.detachedPort");
    expect(
      validate("edge.generic", {
        fromPoint: { x: Number.NaN, y: 0 },
        to: "other",
      }).map(({ path }) => path),
    ).toContain("semantic.fromPoint.x");
    expect(
      validate("edge.generic", {
        from: "shape",
        toPoint: { x: 0, y: 0 },
        prototype: true,
      }).map(({ code }) => code),
    ).toContain("connector.prototypeEndpoint");
  });

  test("validates prototype interaction triggers and bounded delays", () => {
    for (const prototypeAction of [
      "navigate",
      "change-to",
      "open-overlay",
      "close-overlay",
    ])
      expectValid("edge.generic", {
        from: "a",
        to: "b",
        prototype: true,
        prototypeAction,
      });
    for (const prototypeTrigger of ["click", "hover", "press", "after-delay"])
      expectValid("edge.generic", {
        from: "a",
        to: "b",
        prototype: true,
        prototypeTrigger,
        ...(prototypeTrigger === "after-delay" ? { prototypeDelay: 750 } : {}),
      });
    expect(
      validate("edge.generic", {
        from: "a",
        to: "b",
        prototype: true,
        prototypeTrigger: "double-click",
        prototypeDelay: 99,
      }).map(({ code, path }) => ({ code, path })),
    ).toEqual([
      { code: "value.enum", path: "semantic.prototypeTrigger" },
      { code: "value.min", path: "semantic.prototypeDelay" },
    ]);
    expect(
      validate("edge.generic", {
        from: "a",
        to: "b",
        prototypeDelay: 60_001,
      }).map(({ code, path }) => ({ code, path })),
    ).toEqual([{ code: "value.max", path: "semantic.prototypeDelay" }]);
    expect(
      validate("edge.generic", {
        from: "a",
        to: "b",
        prototype: true,
        prototypeAction: "swap-screen",
      }).map(({ code, path }) => ({ code, path })),
    ).toEqual([{ code: "value.enum", path: "semantic.prototypeAction" }]);
  });

  test("validates prototype overlay presentation", () => {
    for (const prototypeOverlayPosition of ["center", "top-left", "manual"])
      expectValid("edge.generic", {
        from: "a",
        to: "b",
        prototype: true,
        prototypeAction: "open-overlay",
        prototypeOverlayPosition,
        prototypeOverlayX: 24,
        prototypeOverlayY: -12,
        prototypeOverlayBackdrop: true,
        prototypeOverlayDismiss: true,
      });
    expect(
      validate("edge.generic", {
        from: "a",
        to: "b",
        prototypeOverlayPosition: "bottom",
        prototypeOverlayBackdrop: "yes",
        prototypeOverlayDismiss: 1,
      }).map(({ code, path }) => ({ code, path })),
    ).toEqual([
      { code: "value.enum", path: "semantic.prototypeOverlayPosition" },
      { code: "type.boolean", path: "semantic.prototypeOverlayBackdrop" },
      { code: "type.boolean", path: "semantic.prototypeOverlayDismiss" },
    ]);
  });
});
