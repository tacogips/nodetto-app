import { expect, test } from "bun:test";
import type { FrameSemantic } from "@nodetto/ir";
import {
  prototypeDelayedLink,
  prototypeSmartPlan,
  prototypeSmartPlanBetween,
  prototypeSmartSteps,
} from "./prototype.ts";
import { makeEditor } from "./test-helpers.ts";
import { Editor } from "./editor.ts";

test("smart animation compares transient component states by reused IDs", () => {
  const editor = makeEditor();
  const normalLabel = editor.buildElement("text.note", {
    semantic: { text: "Normal" },
    visual: {
      x: 510,
      y: 10,
      width: 80,
      height: 24,
      componentKey: "label",
      style: { color: "#111111" },
    },
  });
  const hoverLabel = editor.buildElement("text.note", {
    semantic: { text: "Hover" },
    visual: {
      x: 670,
      y: 12,
      width: 90,
      height: 24,
      componentKey: "label",
      style: { color: "#ffffff" },
    },
  });
  const normal = editor.buildElement("frame", {
    semantic: {
      name: "Default",
      component: true,
      variantSet: "Button",
      memberIds: [normalLabel.id],
    },
    visual: { x: 500, y: 0, width: 120, height: 44 },
  });
  const hover = editor.buildElement("frame", {
    semantic: {
      name: "Hover",
      component: true,
      variantSet: "Button",
      memberIds: [hoverLabel.id],
    },
    visual: { x: 650, y: 0, width: 130, height: 48 },
  });
  editor.apply(
    [normal, normalLabel, hover, hoverLabel].map((element) => ({
      type: "createElement" as const,
      element,
    })),
  );
  const instance = editor.createComponentInstance(normal.id, { x: 20, y: 20 });
  if (!instance) throw new Error("missing component instance");
  const targetLabel = (editor.store.get(instance)?.semantic as FrameSemantic)
    .memberIds?.[0];
  if (!targetLabel) throw new Error("missing instance label");
  const screen = editor.buildElement("frame", {
    semantic: { name: "Screen", memberIds: [instance] },
    visual: { x: 0, y: 0, width: 390, height: 844 },
  });
  editor.apply([{ type: "createElement", element: screen }]);
  const authored = editor.getSnapshot();
  const before = new Editor({
    document: editor.getSnapshot(),
    registry: editor.registry,
  });
  const runtime = new Editor({
    document: editor.getSnapshot(),
    registry: editor.registry,
  });
  expect(runtime.switchComponentVariant(instance, hover.id)).toBe(true);
  const plan = prototypeSmartPlanBetween(before, runtime, screen.id);
  expect(plan.steps.find((step) => step.target === targetLabel)).toMatchObject({
    target: targetLabel,
    fadeIn: false,
    paintFrom: { color: "#111111" },
    paintTo: { color: "#ffffff" },
  });
  expect(editor.getSnapshot()).toEqual(authored);
});

test("automatic prototype routes choose the earliest delay deterministically", () => {
  const links = [
    { id: "z", trigger: "after-delay" as const, delay: 500 },
    { id: "b", trigger: "click" as const, delay: 100 },
    { id: "a", trigger: "after-delay" as const, delay: 500 },
    { id: "later", trigger: "after-delay" as const, delay: 900 },
  ];
  expect(prototypeDelayedLink(links)?.id).toBe("a");
  expect(
    prototypeDelayedLink(links.filter((link) => link.id !== "a"))?.id,
  ).toBe("z");
  expect(
    prototypeDelayedLink(links.filter((link) => link.trigger === "click")),
  ).toBeUndefined();
  expect(links.map((link) => link.id)).toEqual(["z", "b", "a", "later"]);
});

test("smart animation matches unique keyed layers in screen-relative geometry", () => {
  const editor = makeEditor();
  const sourceHero = editor.buildElement("shape.geo", {
    visual: {
      x: 120,
      y: 240,
      width: 100,
      height: 50,
      rotation: 350,
      componentKey: "hero",
      style: {
        opacity: 0.4,
        fill: "#ff0000",
        stroke: "#111111",
        strokeWidth: 1,
        cornerRadius: 4,
        color: "#222222",
        fontSize: 12,
        fontWeight: 400,
        lineHeight: 1.2,
        letterSpacing: 0,
        effects: [
          {
            type: "drop-shadow",
            x: 0,
            y: 2,
            blur: 3,
            color: "#000000",
            opacity: 0.2,
          },
          { type: "background-blur", blur: 4 },
        ],
      },
    },
  });
  const sourceFrame = editor.buildElement("frame", {
    semantic: { name: "Source", memberIds: [sourceHero.id] },
    visual: { x: 100, y: 200, width: 400, height: 300 },
  });
  const targetHero = editor.buildElement("shape.geo", {
    visual: {
      x: 1040,
      y: 560,
      width: 200,
      height: 100,
      rotation: 10,
      componentKey: "hero",
      style: {
        opacity: 0.8,
        fill: "#0000ff",
        stroke: "#eeeeee",
        strokeWidth: 3,
        cornerRadii: {
          topLeft: 12,
          topRight: 4,
          bottomRight: 20,
          bottomLeft: 8,
        },
        color: "#ffffff",
        fontSize: 20,
        fontWeight: 700,
        lineHeight: 1.5,
        letterSpacing: 2,
        effects: [
          { type: "layer-blur", blur: 2 },
          { type: "background-blur", blur: 8 },
        ],
      },
    },
  });
  const newLayer = editor.buildElement("text.note", {
    semantic: { text: "New" },
    visual: { x: 1080, y: 700, width: 80, height: 30 },
  });
  const targetFrame = editor.buildElement("frame", {
    semantic: {
      name: "Target",
      memberIds: [targetHero.id, newLayer.id],
    },
    visual: { x: 1000, y: 500, width: 500, height: 400 },
  });
  editor.apply(
    [sourceFrame, sourceHero, targetFrame, targetHero, newLayer].map(
      (element) => ({ type: "createElement" as const, element }),
    ),
  );
  const before = editor.getSnapshot();
  const steps = prototypeSmartSteps(editor, sourceFrame.id, targetFrame.id);
  expect(steps.find((step) => step.target === targetHero.id)).toEqual({
    target: targetHero.id,
    translateX: -70,
    translateY: -45,
    scaleX: 0.5,
    scaleY: 0.5,
    rotateFrom: -10,
    rotateTo: 10,
    opacityFrom: 0.4,
    opacityTo: 0.8,
    filterFrom: "drop-shadow(0px 2px 3px rgba(0, 0, 0, 0.2))",
    filterTo: "blur(2px)",
    backdropFilterFrom: "blur(4px)",
    backdropFilterTo: "blur(8px)",
    paintFrom: {
      fill: "#ff0000",
      stroke: "#111111",
      strokeWidth: 1,
      cornerRadii: {
        topLeft: 4,
        topRight: 4,
        bottomRight: 4,
        bottomLeft: 4,
      },
      color: "#222222",
      fontSize: 12,
      fontWeight: 400,
      lineHeight: 1.2,
      letterSpacing: 0,
    },
    paintTo: {
      fill: "#0000ff",
      stroke: "#eeeeee",
      strokeWidth: 3,
      cornerRadii: {
        topLeft: 12,
        topRight: 4,
        bottomRight: 20,
        bottomLeft: 8,
      },
      color: "#ffffff",
      fontSize: 20,
      fontWeight: 700,
      lineHeight: 1.5,
      letterSpacing: 2,
    },
    fadeIn: false,
  });
  expect(steps.find((step) => step.target === newLayer.id)).toMatchObject({
    rotateFrom: 0,
    rotateTo: 0,
    opacityFrom: 0,
    opacityTo: 1,
    filterFrom: "none",
    filterTo: "none",
    fadeIn: true,
  });
  expect(editor.getSnapshot()).toEqual(before);
});

test("smart animation never guesses across duplicate keys or different types", () => {
  const editor = makeEditor();
  const sourceA = editor.buildElement("shape.geo", {
    visual: { componentKey: "duplicate" },
  });
  const sourceB = editor.buildElement("shape.geo", {
    visual: { x: 200, componentKey: "duplicate" },
  });
  const sourceText = editor.buildElement("text.note", {
    semantic: { text: "Source" },
    visual: { componentKey: "typed" },
  });
  const sourceFrame = editor.buildElement("frame", {
    semantic: {
      name: "Source",
      memberIds: [sourceA.id, sourceB.id, sourceText.id],
    },
  });
  const duplicateTarget = editor.buildElement("shape.geo", {
    visual: { x: 500, componentKey: "duplicate" },
  });
  const wrongType = editor.buildElement("shape.geo", {
    visual: { x: 700, componentKey: "typed" },
  });
  const targetFrame = editor.buildElement("frame", {
    semantic: {
      name: "Target",
      memberIds: [duplicateTarget.id, wrongType.id],
    },
    visual: { x: 500, y: 0 },
  });
  editor.apply(
    [
      sourceFrame,
      sourceA,
      sourceB,
      sourceText,
      targetFrame,
      duplicateTarget,
      wrongType,
    ].map((element) => ({ type: "createElement" as const, element })),
  );
  const steps = prototypeSmartSteps(editor, sourceFrame.id, targetFrame.id);
  expect(steps.find((step) => step.target === duplicateTarget.id)?.fadeIn).toBe(
    true,
  );
  expect(steps.find((step) => step.target === wrongType.id)?.fadeIn).toBe(true);
});

test("smart animation plans compatible gradients and discrete typography", () => {
  const editor = makeEditor();
  const sourceGradient = {
    type: "linear" as const,
    angle: 0,
    stops: [
      { offset: 0, color: "#ff0000" },
      { offset: 1, color: "#0000ff" },
    ],
  };
  const targetGradient = {
    type: "linear" as const,
    angle: 90,
    stops: [
      { offset: 0.2, color: "#00ff00" },
      { offset: 0.8, color: "#ffffff" },
    ],
  };
  const source = editor.buildElement("shape.geo", {
    visual: {
      componentKey: "paint",
      style: {
        fill: "#ff0000",
        fillGradient: sourceGradient,
        strokeCap: "butt",
        strokeJoin: "miter",
        strokeMiterLimit: 4,
        fontFamily: "Inter",
        fontStyle: "normal",
        textAlign: "start",
        textDecoration: "none",
      },
    },
  });
  const sourceFrame = editor.buildElement("frame", {
    semantic: { name: "Source", memberIds: [source.id] },
  });
  const target = editor.buildElement("shape.geo", {
    visual: {
      x: 500,
      componentKey: "paint",
      style: {
        fill: "#0000ff",
        fillGradient: targetGradient,
        strokeCap: "round",
        strokeJoin: "bevel",
        strokeMiterLimit: 8,
        fontFamily: "Georgia",
        fontStyle: "italic",
        textAlign: "middle",
        textDecoration: "underline",
      },
    },
  });
  const targetFrame = editor.buildElement("frame", {
    semantic: { name: "Target", memberIds: [target.id] },
    visual: { x: 500 },
  });
  editor.apply(
    [sourceFrame, source, targetFrame, target].map((element) => ({
      type: "createElement" as const,
      element,
    })),
  );
  const step = prototypeSmartSteps(editor, sourceFrame.id, targetFrame.id).find(
    (candidate) => candidate.target === target.id,
  );
  expect(step?.paintFrom).toEqual({
    fillGradient: sourceGradient,
    strokeCap: "butt",
    strokeJoin: "miter",
    strokeMiterLimit: 4,
    fontFamily: "Inter",
    fontStyle: "normal",
    textAlign: "start",
    textDecoration: "none",
  });
  expect(step?.paintTo).toEqual({
    fillGradient: targetGradient,
    strokeCap: "round",
    strokeJoin: "bevel",
    strokeMiterLimit: 8,
    fontFamily: "Georgia",
    fontStyle: "italic",
    textAlign: "middle",
    textDecoration: "underline",
  });
});

test("smart animation skips incompatible gradients and properties missing at either endpoint", () => {
  const editor = makeEditor();
  const source = editor.buildElement("shape.geo", {
    visual: {
      componentKey: "paint",
      style: {
        fill: "#ff0000",
        fillGradient: {
          type: "radial",
          centerX: 0.5,
          centerY: 0.5,
          radius: 0.5,
          stops: [
            { offset: 0, color: "#ff0000" },
            { offset: 1, color: "#0000ff" },
          ],
        },
        stroke: "#111111",
        strokeGradient: {
          type: "linear",
          angle: 0,
          stops: [
            { offset: 0, color: "#111111" },
            { offset: 1, color: "#555555" },
          ],
        },
        fontSize: 12,
      },
    },
  });
  const sourceFrame = editor.buildElement("frame", {
    semantic: { name: "Source", memberIds: [source.id] },
  });
  const target = editor.buildElement("shape.geo", {
    visual: {
      x: 500,
      componentKey: "paint",
      style: {
        fill: "#0000ff",
        fillGradient: {
          type: "linear",
          angle: 0,
          stops: [
            { offset: 0, color: "#000000" },
            { offset: 1, color: "#ffffff" },
          ],
        },
        stroke: "#eeeeee",
        strokeGradient: {
          type: "linear",
          angle: 90,
          stops: [
            { offset: 0, color: "#111111" },
            { offset: 0.5, color: "#777777" },
            { offset: 1, color: "#eeeeee" },
          ],
        },
        letterSpacing: 2,
      },
    },
  });
  const targetFrame = editor.buildElement("frame", {
    semantic: { name: "Target", memberIds: [target.id] },
    visual: { x: 500 },
  });
  editor.apply(
    [sourceFrame, source, targetFrame, target].map((element) => ({
      type: "createElement" as const,
      element,
    })),
  );
  const step = prototypeSmartSteps(editor, sourceFrame.id, targetFrame.id).find(
    (candidate) => candidate.target === target.id,
  );
  expect(step?.paintFrom).toBeUndefined();
  expect(step?.paintTo).toBeUndefined();
});

test("smart animation exits unmatched source layers/connectors but not the source artboard", () => {
  const editor = makeEditor();
  const matchedSource = editor.buildElement("shape.geo", {
    visual: { x: 20, y: 20, componentKey: "hero" },
  });
  const outgoingText = editor.buildElement("text.note", {
    semantic: { text: "Old badge" },
    visual: { x: 160, y: 20 },
  });
  const outgoingConnector = editor.buildElement("edge.generic", {
    semantic: { from: matchedSource.id, to: outgoingText.id },
  });
  const sourceFrame = editor.buildElement("frame", {
    semantic: {
      name: "Source",
      memberIds: [matchedSource.id, outgoingText.id],
    },
    visual: { width: 400, height: 300 },
  });
  const matchedTarget = editor.buildElement("shape.geo", {
    visual: { x: 520, y: 20, componentKey: "hero" },
  });
  const newText = editor.buildElement("text.note", {
    semantic: { text: "New badge" },
    visual: { x: 660, y: 20 },
  });
  const targetFrame = editor.buildElement("frame", {
    semantic: {
      name: "Target",
      memberIds: [matchedTarget.id, newText.id],
    },
    visual: { x: 500, width: 400, height: 300 },
  });
  editor.apply(
    [
      sourceFrame,
      matchedSource,
      outgoingText,
      outgoingConnector,
      targetFrame,
      matchedTarget,
      newText,
    ].map((element) => ({ type: "createElement" as const, element })),
  );
  const before = editor.getSnapshot();
  const plan = prototypeSmartPlan(editor, sourceFrame.id, targetFrame.id);
  expect(plan.outgoing).toEqual([outgoingText.id, outgoingConnector.id]);
  expect(
    plan.steps.find((step) => step.target === matchedTarget.id)?.fadeIn,
  ).toBe(false);
  expect(plan.steps.find((step) => step.target === newText.id)?.fadeIn).toBe(
    true,
  );
  expect(editor.getSnapshot()).toEqual(before);
});
