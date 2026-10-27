import { expect, test } from "bun:test";
import type { FrameSemantic } from "@nodetto/ir";
import { parseDocument, serializeDocument } from "@nodetto/io";
import { prototypeDelayedLink, prototypeScreen } from "./prototype.ts";
import { makeEditor } from "./test-helpers.ts";

for (const type of ["edge.generic", "erd.relation", "uml.association"]) {
  test(`preview retains internal ${type} connectors without explicit edge membership`, () => {
    const editor = makeEditor();
    const nodeType =
      type === "erd.relation"
        ? "erd.table"
        : type === "uml.association"
          ? "uml.class"
          : "node.generic";
    const first = editor.buildElement(nodeType, { visual: { x: 20, y: 20 } });
    const second = editor.buildElement(nodeType, { visual: { x: 220, y: 20 } });
    const frame = editor.buildElement("frame", {
      semantic: {
        name: "Engineering screen",
        memberIds: [first.id, second.id],
      },
      visual: { x: 0, y: 0, width: 800, height: 600 },
    });
    const semantic =
      type === "erd.relation"
        ? {
            from: { table: first.id },
            to: { table: second.id },
            cardinality: "1:*",
          }
        : {
            from: first.id,
            to: second.id,
            ...(type === "uml.association" ? { kind: "assoc" } : {}),
          };
    const edge = editor.buildElement(type, { semantic });
    const navigation = editor.buildElement("edge.generic", {
      semantic: { from: first.id, to: frame.id, prototype: true },
    });
    editor.apply(
      [frame, first, second, edge, navigation].map((element) => ({
        type: "createElement" as const,
        element,
      })),
    );
    const before = editor.getSnapshot();
    expect(
      prototypeScreen(editor, frame.id)?.elements.map((item) => item.id),
    ).toContain(edge.id);
    expect(
      prototypeScreen(editor, frame.id)?.elements.map((item) => item.id),
    ).not.toContain(navigation.id);
    expect(editor.getSnapshot()).toEqual(before);
    expect(parseDocument(serializeDocument(before))).toEqual(before);
    editor.apply([
      { type: "updateVisual", id: second.id, visual: { hidden: true } },
    ]);
    expect(
      prototypeScreen(editor, frame.id)?.elements.map((item) => item.id),
    ).not.toContain(edge.id);
    editor.undo();
    expect(
      prototypeScreen(editor, frame.id)?.elements.map((item) => item.id),
    ).toContain(edge.id);
    editor.apply([
      {
        type: "updateSemantic",
        id: frame.id,
        semantic: { name: "Engineering screen", memberIds: [first.id] },
      },
    ]);
    expect(
      prototypeScreen(editor, frame.id)?.elements.map((item) => item.id),
    ).not.toContain(edge.id);
  });
}

test("rotated hotspots retain their pivot and page-space clip", () => {
  const editor = makeEditor();
  const button = editor.buildElement("shape.geo", {
    visual: { x: 100, y: 100, width: 200, height: 40, rotation: 90 },
  });
  const start = editor.buildElement("frame", {
    semantic: { name: "Clipped", clipContent: true, memberIds: [button.id] },
    visual: { x: 170, y: 0, width: 60, height: 80 },
  });
  const end = editor.buildElement("frame", {
    semantic: { name: "Next", memberIds: [] },
  });
  const edge = editor.buildElement("edge.generic", {
    semantic: { from: button.id, to: end.id, prototype: true },
  });
  editor.apply(
    [button, start, end, edge].map((element) => ({
      type: "createElement" as const,
      element,
    })),
  );
  const before = editor.getSnapshot();
  const screen = prototypeScreen(editor, start.id);
  expect(screen?.links).toHaveLength(1);
  expect(screen?.links[0]?.box).toEqual({
    x: 100,
    y: 100,
    width: 200,
    height: 40,
  });
  expect(screen?.links[0]?.rotation).toBe(90);
  expect(screen?.links[0]?.clip).toEqual({
    x: 170,
    y: 0,
    width: 60,
    height: 80,
  });
  expect(editor.getSnapshot()).toEqual(before);
  editor.apply([
    { type: "updateVisual", id: button.id, visual: { rotation: 0 } },
  ]);
  expect(prototypeScreen(editor, start.id)?.links).toEqual([]);
});

test("off-screen and empty diagonal-corner hotspots are omitted", () => {
  const editor = makeEditor();
  const button = editor.buildElement("shape.geo", {
    visual: { x: 100, y: 100, width: 200, height: 40, rotation: 45 },
  });
  const start = editor.buildElement("frame", {
    semantic: { name: "Corner", memberIds: [button.id] },
    visual: { x: 115, y: 195, width: 5, height: 5 },
  });
  const end = editor.buildElement("frame", {
    semantic: { name: "Next", memberIds: [] },
  });
  const edge = editor.buildElement("edge.generic", {
    semantic: { from: button.id, to: end.id, prototype: true },
  });
  editor.apply(
    [button, start, end, edge].map((element) => ({
      type: "createElement" as const,
      element,
    })),
  );
  expect(prototypeScreen(editor, start.id)?.links).toEqual([]);
});

test("scrolling screens retain reachable off-viewport hotspots by enabled axis", () => {
  const editor = makeEditor();
  const below = editor.buildElement("node.generic", {
    semantic: { label: "Below" },
    visual: { x: 20, y: 900, width: 100, height: 40 },
  });
  const right = editor.buildElement("node.generic", {
    semantic: { label: "Right" },
    visual: { x: 500, y: 20, width: 100, height: 40 },
  });
  const target = editor.buildElement("frame", {
    semantic: { name: "Target", memberIds: [] },
  });
  const screen = editor.buildElement("frame", {
    semantic: {
      name: "Scrollable",
      memberIds: [below.id, right.id],
      prototypeOverflow: "vertical",
      clipContent: true,
    },
    visual: { x: 0, y: 0, width: 390, height: 844 },
  });
  const belowLink = editor.buildElement("edge.generic", {
    semantic: { from: below.id, to: target.id, prototype: true },
  });
  const rightLink = editor.buildElement("edge.generic", {
    semantic: { from: right.id, to: target.id, prototype: true },
  });
  editor.apply(
    [below, right, target, screen, belowLink, rightLink].map((element) => ({
      type: "createElement" as const,
      element,
    })),
  );
  expect(
    prototypeScreen(editor, screen.id)?.links.map((link) => link.from),
  ).toEqual([below.id]);
  editor.apply([
    {
      type: "updateSemantic",
      id: screen.id,
      semantic: {
        ...(screen.semantic as FrameSemantic),
        prototypeOverflow: "both",
      },
    },
  ]);
  expect(
    prototypeScreen(editor, screen.id)
      ?.links.map((link) => link.from)
      .sort(),
  ).toEqual([below.id, right.id].sort());
});

test("prototype hotspots resolve without mutating the editor and survive JSONL", () => {
  const editor = makeEditor();
  const button = editor.buildElement("node.generic", {
    semantic: { label: "Continue" },
    visual: { x: 20, y: 20, width: 100, height: 40 },
  });
  const start = editor.buildElement("frame", {
    semantic: { name: "Start", memberIds: [button.id] },
    visual: { x: 0, y: 0, width: 390, height: 844 },
  });
  const end = editor.buildElement("frame", {
    semantic: { name: "Done", memberIds: [] },
    visual: { x: 500, y: 0, width: 390, height: 844 },
  });
  const edge = editor.buildElement("edge.generic", {
    semantic: {
      from: button.id,
      to: end.id,
      prototype: true,
      label: "Continue",
      prototypeTrigger: "after-delay",
      prototypeDelay: 750,
      prototypeTransition: "smart",
      prototypeDuration: 420,
    },
  });
  editor.apply(
    [button, start, end, edge].map((element) => ({
      type: "createElement",
      element,
    })),
  );
  const before = editor.getSnapshot();
  const screen = prototypeScreen(editor, start.id);
  expect(screen?.links).toHaveLength(1);
  expect(screen?.links[0]?.to).toBe(end.id);
  expect(screen?.links[0]?.trigger).toBe("after-delay");
  expect(screen?.links[0]?.delay).toBe(750);
  expect(screen?.links[0]?.transition).toBe("smart");
  expect(screen?.links[0]?.duration).toBe(420);
  expect(screen?.elements.some((item) => item.id === button.id)).toBe(true);
  expect(screen?.elements.some((item) => item.id === end.id)).toBe(false);
  expect(editor.getSnapshot()).toEqual(before);
  expect(parseDocument(serializeDocument(before))).toEqual(before);
  editor.deleteElements([end.id]);
  expect(prototypeScreen(editor, start.id)?.links).toEqual([]);
  editor.undo();
  expect(prototypeScreen(editor, start.id)?.links).toHaveLength(1);
  editor.apply([
    { type: "updateVisual", id: button.id, visual: { hidden: true } },
  ]);
  expect(prototypeScreen(editor, start.id)?.links).toEqual([]);
});

test("prototype hotspots supply stable animation defaults", () => {
  const editor = makeEditor();
  const source = editor.buildElement("node.generic", {
    semantic: { label: "Open" },
  });
  const start = editor.buildElement("frame", {
    semantic: { name: "Start", memberIds: [source.id] },
  });
  const end = editor.buildElement("frame", {
    semantic: { name: "End", memberIds: [] },
  });
  const edge = editor.buildElement("edge.generic", {
    semantic: { from: source.id, to: end.id, prototype: true },
  });
  editor.apply(
    [source, start, end, edge].map((element) => ({
      type: "createElement" as const,
      element,
    })),
  );
  expect(prototypeScreen(editor, start.id)?.links[0]).toMatchObject({
    action: "navigate",
    trigger: "click",
    delay: 1000,
    transition: "instant",
    duration: 250,
  });
});

test("prototype hotspots inherit accessible names, roles, and disabled state", () => {
  const editor = makeEditor();
  const source = editor.buildElement("text.note", {
    semantic: { text: "Open" },
    accessibility: {
      role: "link",
      label: "Open account details",
      disabled: true,
    },
    visual: { x: 20, y: 20, width: 120, height: 44 },
  });
  const start = editor.buildElement("frame", {
    semantic: { name: "Start", memberIds: [source.id] },
    visual: { x: 0, y: 0, width: 320, height: 640 },
  });
  const end = editor.buildElement("frame", {
    semantic: { name: "End", memberIds: [] },
    visual: { x: 400, y: 0, width: 320, height: 640 },
  });
  const edge = editor.buildElement("edge.generic", {
    semantic: {
      from: source.id,
      to: end.id,
      prototype: true,
      prototypeTrigger: "after-delay",
    },
  });
  editor.apply(
    [start, source, end, edge].map((element) => ({
      type: "createElement" as const,
      element,
    })),
  );
  const link = prototypeScreen(editor, start.id)?.links[0];
  expect(link).toMatchObject({
    label: "Open account details",
    role: "link",
    disabled: true,
  });
  expect(prototypeDelayedLink(link ? [link] : [])).toBeUndefined();
});

test("prototype keyboard order follows explicit artboard hierarchy", () => {
  const editor = makeEditor();
  const first = editor.buildElement("node.generic", {
    id: "visual-first",
    semantic: { label: "First" },
    visual: { x: 20, y: 20, width: 100, height: 44 },
  });
  const second = editor.buildElement("node.generic", {
    id: "visual-second",
    semantic: { label: "Second" },
    visual: { x: 20, y: 80, width: 100, height: 44 },
  });
  const start = editor.buildElement("frame", {
    semantic: { name: "Start", memberIds: [second.id, first.id] },
    visual: { x: 0, y: 0, width: 320, height: 640 },
  });
  const end = editor.buildElement("frame", {
    semantic: { name: "End", memberIds: [] },
    visual: { x: 400, y: 0, width: 320, height: 640 },
  });
  const firstLink = editor.buildElement("edge.generic", {
    id: "a-first-link",
    semantic: { from: first.id, to: end.id, prototype: true },
  });
  const secondLink = editor.buildElement("edge.generic", {
    id: "z-second-link",
    semantic: { from: second.id, to: end.id, prototype: true },
  });
  editor.apply(
    [start, first, second, end, firstLink, secondLink].map((element) => ({
      type: "createElement" as const,
      element,
    })),
  );
  expect(
    prototypeScreen(editor, start.id)?.links.map((link) => link.from),
  ).toEqual([second.id, first.id]);
});

test("component-state hotspots target only compatible variants without mutating the document", () => {
  const editor = makeEditor();
  const normal = editor.buildElement("frame", {
    semantic: {
      name: "Button default",
      component: true,
      variantSet: "Button",
      variantName: "Default",
      memberIds: [],
    },
    visual: { x: 500, y: 0, width: 120, height: 44 },
  });
  const hover = editor.buildElement("frame", {
    semantic: {
      name: "Button hover",
      component: true,
      variantSet: "Button",
      variantName: "Hover",
      memberIds: [],
    },
    visual: { x: 650, y: 0, width: 120, height: 44 },
  });
  const unrelated = editor.buildElement("frame", {
    semantic: {
      name: "Card",
      component: true,
      variantSet: "Card",
      memberIds: [],
    },
    visual: { x: 800, y: 0, width: 120, height: 44 },
  });
  editor.apply(
    [normal, hover, unrelated].map((element) => ({
      type: "createElement" as const,
      element,
    })),
  );
  const instance = editor.createComponentInstance(normal.id, { x: 20, y: 20 });
  if (!instance) throw new Error("missing component instance");
  const screen = editor.buildElement("frame", {
    semantic: { name: "Screen", memberIds: [instance] },
    visual: { x: 0, y: 0, width: 390, height: 844 },
  });
  const link = editor.buildElement("edge.generic", {
    semantic: {
      from: instance,
      to: hover.id,
      prototype: true,
      prototypeAction: "change-to",
      prototypeTrigger: "hover",
      prototypeTransition: "smart",
    },
  });
  editor.apply([
    { type: "createElement", element: screen },
    { type: "createElement", element: link },
  ]);
  const before = editor.getSnapshot();
  expect(prototypeScreen(editor, screen.id)?.links[0]).toMatchObject({
    from: instance,
    to: hover.id,
    action: "change-to",
    trigger: "hover",
    label: "Change component state",
  });
  expect(editor.getSnapshot()).toEqual(before);
  editor.apply([
    {
      type: "updateSemantic",
      id: link.id,
      semantic: {
        ...(link.semantic as object),
        to: unrelated.id,
      },
    },
  ]);
  expect(prototypeScreen(editor, screen.id)?.links).toEqual([]);
  expect(parseDocument(serializeDocument(editor.getSnapshot()))).toEqual(
    editor.getSnapshot(),
  );
});

test("overlay actions resolve presentation defaults and close controls", () => {
  const editor = makeEditor();
  const opener = editor.buildElement("shape.geo", {
    visual: {
      x: 20,
      y: 20,
      width: 120,
      height: 44,
      prototypeFixed: true,
    },
  });
  const closer = editor.buildElement("shape.geo", {
    visual: { x: 640, y: 180, width: 80, height: 36 },
  });
  const base = editor.buildElement("frame", {
    semantic: {
      name: "Base",
      memberIds: [opener.id],
      prototypeOverflow: "vertical",
    },
    visual: { x: 0, y: 0, width: 390, height: 844 },
  });
  const overlay = editor.buildElement("frame", {
    semantic: { name: "Menu", memberIds: [closer.id] },
    visual: { x: 600, y: 100, width: 300, height: 400 },
  });
  const open = editor.buildElement("edge.generic", {
    semantic: {
      from: opener.id,
      to: overlay.id,
      prototype: true,
      prototypeAction: "open-overlay",
      prototypeOverlayPosition: "manual",
      prototypeOverlayX: 24,
      prototypeOverlayY: 80,
      prototypeOverlayBackdrop: true,
      prototypeOverlayDismiss: true,
    },
  });
  const close = editor.buildElement("edge.generic", {
    semantic: {
      from: closer.id,
      to: overlay.id,
      prototype: true,
      prototypeAction: "close-overlay",
    },
  });
  editor.apply(
    [opener, closer, base, overlay, open, close].map((element) => ({
      type: "createElement" as const,
      element,
    })),
  );
  expect(prototypeScreen(editor, base.id)?.links[0]).toMatchObject({
    action: "open-overlay",
    label: "Open overlay",
    overlayPosition: "manual",
    overlayX: 24,
    overlayY: 80,
    overlayBackdrop: true,
    overlayDismiss: true,
  });
  expect(prototypeScreen(editor, overlay.id)?.links[0]).toMatchObject({
    action: "close-overlay",
    label: "Close overlay",
    overlayPosition: "center",
    overlayX: 0,
    overlayY: 0,
    overlayBackdrop: false,
    overlayDismiss: false,
  });
  expect(parseDocument(serializeDocument(editor.getSnapshot()))).toEqual(
    editor.getSnapshot(),
  );
  expect(editor.undo()).toBe(true);
  expect(prototypeScreen(editor, base.id)).toBeNull();
  expect(editor.redo()).toBe(true);
  expect(
    (editor.store.get(base.id)?.semantic as FrameSemantic).prototypeOverflow,
  ).toBe("vertical");
  expect(editor.store.get(opener.id)?.visual.prototypeFixed).toBe(true);
  editor.apply([
    { type: "updateVisual", id: overlay.id, visual: { hidden: true } },
  ]);
  expect(prototypeScreen(editor, base.id)?.links).toEqual([]);
});
