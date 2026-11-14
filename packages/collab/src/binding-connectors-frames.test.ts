import { expect, test } from "bun:test";
import { Editor, rotateElement } from "@nodetto/core";
import type { FrameSemantic } from "@nodetto/ir";
import {
  Wire,
  peer,
  elementIn,
  expectConverged,
} from "./binding-test-helpers.ts";

test("orthogonal connector routing converges with peer-local undo", () => {
  const seed = new Editor();
  const from = seed.buildElement("node.generic", {
    visual: { x: 0, y: 0, width: 100, height: 100 },
  });
  const to = seed.buildElement("node.generic", {
    visual: { x: 300, y: 200, width: 100, height: 100 },
  });
  const edge = seed.buildElement("edge.generic", {
    semantic: { from: from.id, to: to.id },
  });
  seed.apply(
    [from, to, edge].map((element) => ({
      type: "createElement" as const,
      element,
    })),
  );
  const wire = new Wire();
  const a = peer(wire, seed.getSnapshot());
  a.binding.attach();
  const b = peer(wire);
  wire.flush();
  b.binding.attach();
  wire.flush();

  a.editor.apply([
    {
      type: "updateSemantic",
      id: edge.id,
      semantic: {
        from: from.id,
        to: to.id,
        routing: "orthogonal",
        routingAxis: "vertical",
        routingBend: 0.3,
        routingAvoidObstacles: false,
      },
    },
  ]);
  b.editor.apply([
    {
      type: "updateSemantic",
      id: edge.id,
      semantic: { from: from.id, to: to.id, label: "Remote flow" },
    },
  ]);
  wire.flush();
  expect(elementIn(a, edge.id).semantic).toMatchObject({
    label: "Remote flow",
    routing: "orthogonal",
    routingAxis: "vertical",
    routingBend: 0.3,
    routingAvoidObstacles: false,
  });
  expect(elementIn(b, edge.id).semantic).toEqual(
    elementIn(a, edge.id).semantic,
  );
  expectConverged(a, b, wire);

  expect(a.binding.undo()).toBe(true);
  wire.flush();
  expect(elementIn(a, edge.id).semantic).toEqual({
    from: from.id,
    to: to.id,
    label: "Remote flow",
  });
  expectConverged(a, b, wire);
  a.binding.detach();
  b.binding.detach();
});

test("manual connector waypoints converge with peer-local undo", () => {
  const seed = new Editor();
  const from = seed.buildElement("node.generic", {
    visual: { x: 0, y: 0, width: 100, height: 100 },
  });
  const to = seed.buildElement("node.generic", {
    visual: { x: 300, y: 200, width: 100, height: 100 },
  });
  const edge = seed.buildElement("edge.generic", {
    semantic: { from: from.id, to: to.id },
  });
  seed.apply(
    [from, to, edge].map((element) => ({
      type: "createElement" as const,
      element,
    })),
  );
  const wire = new Wire();
  const a = peer(wire, seed.getSnapshot());
  a.binding.attach();
  const b = peer(wire);
  wire.flush();
  b.binding.attach();
  wire.flush();

  a.editor.apply([
    {
      type: "updateSemantic",
      id: edge.id,
      semantic: {
        from: from.id,
        to: to.id,
        routing: "manual",
        routingWaypoints: [
          { u: 0.3, v: 60 },
          { u: 0.7, v: -30 },
        ],
      },
    },
  ]);
  b.editor.apply([
    {
      type: "updateSemantic",
      id: edge.id,
      semantic: { from: from.id, to: to.id, label: "Remote manual flow" },
    },
  ]);
  wire.flush();
  expect(elementIn(a, edge.id).semantic).toMatchObject({
    label: "Remote manual flow",
    routing: "manual",
    routingWaypoints: [
      { u: 0.3, v: 60 },
      { u: 0.7, v: -30 },
    ],
  });
  expectConverged(a, b, wire);

  expect(a.binding.undo()).toBe(true);
  wire.flush();
  expect(elementIn(a, edge.id).semantic).toEqual({
    from: from.id,
    to: to.id,
    label: "Remote manual flow",
  });
  expectConverged(a, b, wire);
  a.binding.detach();
  b.binding.detach();
});

test("frame hierarchy rotation and membership freezing converge with isolated undo", () => {
  const seed = new Editor();
  const frame = seed.buildElement("frame", {
    semantic: { name: "Screen", clipContent: true },
    visual: { x: 0, y: 0, width: 200, height: 100 },
  });
  const child = seed.buildElement("node.generic", {
    semantic: { label: "Local label" },
    visual: { x: 20, y: 20, width: 40, height: 20 },
  });
  seed.apply(
    [frame, child].map((element) => ({
      type: "createElement" as const,
      element,
    })),
  );
  const wire = new Wire();
  const a = peer(wire, seed.getSnapshot());
  a.binding.attach();
  const b = peer(wire);
  wire.flush();
  b.binding.attach();
  wire.flush();

  expect(rotateElement(a.editor, frame.id, 90)).toBe(true);
  b.editor.apply([
    {
      type: "updateSemantic",
      id: child.id,
      semantic: { label: "Remote label" },
    },
  ]);
  wire.flush();
  expect(elementIn(b, frame.id).visual.rotation).toBe(90);
  expect(elementIn(b, frame.id).semantic).toMatchObject({
    memberIds: [child.id],
  });
  expect(elementIn(b, child.id).visual).toMatchObject({
    x: 100,
    y: -20,
    rotation: 90,
  });
  expectConverged(a, b, wire);

  expect(a.binding.undo()).toBe(true);
  wire.flush();
  expect(elementIn(a, child.id).semantic).toEqual({ label: "Remote label" });
  expect(elementIn(a, child.id).visual).toEqual(child.visual);
  expect(elementIn(a, frame.id).visual.rotation).toBeUndefined();
  expect(
    (elementIn(a, frame.id).semantic as FrameSemantic).memberIds,
  ).toBeUndefined();
  expectConverged(a, b, wire);
  a.binding.detach();
  b.binding.detach();
});

test("frame selection converges and local undo preserves a remote layer edit", () => {
  const seed = new Editor();
  const left = seed.buildElement("node.generic", {
    semantic: { label: "Left" },
    visual: { x: 0, y: 0, width: 100, height: 50 },
  });
  const right = seed.buildElement("node.generic", {
    semantic: { label: "Right" },
    visual: { x: 200, y: 0, width: 100, height: 50 },
  });
  seed.apply(
    [left, right].map((element) => ({
      type: "createElement" as const,
      element,
    })),
  );
  const wire = new Wire();
  const a = peer(wire, seed.getSnapshot());
  a.binding.attach();
  const b = peer(wire);
  wire.flush();
  b.binding.attach();
  wire.flush();

  a.editor.selection.set([left.id, right.id]);
  const frame = a.editor.frameSelection();
  expect(frame).not.toBeNull();
  b.editor.apply([
    {
      type: "updateSemantic",
      id: left.id,
      semantic: { label: "Remote label" },
    },
  ]);
  wire.flush();
  if (!frame) throw new Error("expected frame");
  expect(elementIn(b, frame).semantic).toMatchObject({
    memberIds: [left.id, right.id],
  });
  expectConverged(a, b, wire);

  expect(a.binding.undo()).toBe(true);
  wire.flush();
  expect(a.editor.store.has(frame)).toBe(false);
  expect(elementIn(a, left.id).semantic).toEqual({ label: "Remote label" });
  expectConverged(a, b, wire);
  a.binding.detach();
  b.binding.detach();
});

test("component geometry reset converges and local undo preserves a remote label", () => {
  const seed = new Editor();
  const child = seed.buildElement("node.generic", {
    semantic: { label: "Source" },
    visual: { x: 10, y: 10, width: 80, height: 30 },
  });
  const source = seed.buildElement("frame", {
    semantic: { name: "Card", component: true, memberIds: [child.id] },
    visual: { x: 0, y: 0, width: 100, height: 60 },
  });
  seed.apply([
    { type: "createElement", element: source },
    { type: "createElement", element: child },
  ]);
  const instance = seed.createComponentInstance(source.id);
  if (!instance) throw new Error("missing component instance");
  const target = (seed.store.get(instance)?.semantic as FrameSemantic)
    .memberIds?.[0];
  if (!target) throw new Error("missing instance child");
  seed.apply([{ type: "updateVisual", id: target, visual: { width: 160 } }]);

  const wire = new Wire();
  const a = peer(wire, seed.getSnapshot());
  a.binding.attach();
  const b = peer(wire);
  wire.flush();
  b.binding.attach();
  wire.flush();

  expect(
    a.editor.resetComponentOverride(instance, target, "geometry.width"),
  ).toBe(true);
  b.editor.apply([
    {
      type: "updateSemantic",
      id: target,
      semantic: { label: "Remote label" },
    },
  ]);
  wire.flush();
  expect(elementIn(b, target).visual.width).toBe(80);
  expectConverged(a, b, wire);

  expect(a.binding.undo()).toBe(true);
  wire.flush();
  expect(elementIn(a, target).visual.width).toBe(160);
  expect(elementIn(a, target).semantic).toEqual({ label: "Remote label" });
  expectConverged(a, b, wire);
  a.binding.detach();
  b.binding.detach();
});

test("automatic component structure converges and undoes independently", () => {
  const seed = new Editor();
  const child = seed.buildElement("node.generic", {
    semantic: { label: "Existing" },
    visual: { x: 10, y: 10, width: 80, height: 30 },
  });
  const source = seed.buildElement("frame", {
    semantic: { name: "Card", component: true, memberIds: [child.id] },
    visual: { x: 0, y: 0, width: 100, height: 60 },
  });
  seed.apply([
    { type: "createElement", element: source },
    { type: "createElement", element: child },
  ]);
  const instance = seed.createComponentInstance(source.id);
  if (!instance) throw new Error("missing component instance");
  const target = (seed.store.get(instance)?.semantic as FrameSemantic)
    .memberIds?.[0];
  if (!target) throw new Error("missing instance child");
  seed.apply([
    {
      type: "updateSemantic",
      id: instance,
      semantic: {
        ...(seed.store.get(instance)?.semantic as object),
        autoRefresh: true,
      },
    },
  ]);

  const wire = new Wire();
  const a = peer(wire, seed.getSnapshot());
  a.binding.attach();
  const b = peer(wire);
  wire.flush();
  b.binding.attach();
  wire.flush();

  const added = a.editor.buildElement("node.generic", {
    semantic: { label: "Added" },
    visual: { x: 20, y: 35, width: 60, height: 20 },
  });
  a.editor.apply([
    { type: "createElement", element: added },
    {
      type: "updateSemantic",
      id: source.id,
      semantic: {
        ...(elementIn(a, source.id).semantic as object),
        memberIds: [child.id, added.id],
      },
    },
  ]);
  b.editor.apply([
    {
      type: "updateSemantic",
      id: target,
      semantic: { label: "Remote override" },
    },
  ]);
  wire.flush();
  const addedTarget = (
    elementIn(a, instance).semantic as FrameSemantic
  ).instanceBindings?.find((binding) => binding.source === added.id)?.target;
  expect(addedTarget).toBeDefined();
  expect(elementIn(b, addedTarget ?? "").semantic).toEqual({ label: "Added" });
  expectConverged(a, b, wire);

  expect(a.binding.undo()).toBe(true);
  wire.flush();
  expect(a.editor.store.has(added.id)).toBe(false);
  expect(a.editor.store.has(addedTarget ?? "")).toBe(false);
  expect(elementIn(a, target).semantic).toEqual({ label: "Remote override" });
  expectConverged(a, b, wire);
  a.binding.detach();
  b.binding.detach();
});
