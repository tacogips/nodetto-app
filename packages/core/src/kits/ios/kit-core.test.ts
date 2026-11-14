import { expect, test } from "bun:test";
import type { Element, FrameSemantic } from "@nodetto/ir";
import { makeEditor } from "../../test-helpers.ts";
import { applyKitProps, insertKitComponent, IOS_KIT } from "./index.ts";
import type { KitComponent } from "./types.ts";

function child(
  editor: ReturnType<typeof makeEditor>,
  root: string,
  key: string,
): Element {
  const seen = new Set<string>();
  const find = (id: string): Element | undefined => {
    if (seen.has(id)) return undefined;
    seen.add(id);
    const element = editor.store.get(id);
    if (!element) return undefined;
    if (element.visual.componentKey === key) return element;
    if (element.type === "frame") {
      for (const member of (element.semantic as FrameSemantic).memberIds ??
        []) {
        const result = find(member);
        if (result) return result;
      }
    }
    return undefined;
  };
  const result = find(root);
  if (!result) throw new Error(`missing child ${key}`);
  return result;
}

test("kit reuses a definition, applies props to instances and preserves overrides on refresh", () => {
  const editor = makeEditor();
  const page = editor.currentPageId;
  const first = insertKitComponent(editor, "ios:nav-bar", {
    page,
    props: { title: "Inbox", back: true, backLabel: "Back" },
  });
  const second = insertKitComponent(editor, "ios:nav-bar", { page, y: 100 });
  expect(editor.currentPageId).toBe(page);
  const definitions = editor.store
    .listElements()
    .filter(
      (e) =>
        e.type === "frame" &&
        (e.semantic as FrameSemantic).component &&
        (e.semantic as FrameSemantic).kit === "ios:nav-bar@1",
    );
  expect(definitions).toHaveLength(1);
  const definition = definitions[0];
  if (!definition) throw new Error("missing definition");
  expect(
    editor.store.listPages().filter((p) => p.name === "iOS kit"),
  ).toHaveLength(1);
  expect((editor.store.get(first)?.semantic as FrameSemantic).instanceOf).toBe(
    definition.id,
  );
  expect((editor.store.get(second)?.semantic as FrameSemantic).instanceOf).toBe(
    definition.id,
  );
  expect(
    (child(editor, first, "title").semantic as { text: string }).text,
  ).toBe("Inbox");
  expect(
    (child(editor, definition.id, "title").semantic as { text: string }).text,
  ).toBe("Title");
  expect(editor.refreshComponentInstance(first)).toBe(true);
  expect(
    (child(editor, first, "title").semantic as { text: string }).text,
  ).toBe("Inbox");
  expect(() => applyKitProps(editor, first, { invalid: true })).toThrow(
    'unknown property "invalid"',
  );
  expect(() => applyKitProps(editor, first, { invalid: true })).toThrow(
    "title",
  );
});

test("tab slots hide unused items and color the selected icon", () => {
  const editor = makeEditor();
  const id = insertKitComponent(editor, "ios:tab-bar", {
    page: editor.currentPageId,
    props: {
      items: [
        { label: "One", icon: "house" },
        { label: "Two", icon: "bell" },
        { label: "Three" },
        { label: "Four" },
      ],
      active: 1,
      activeColor: "#123456",
    },
  });
  expect(child(editor, id, "item5").visual.hidden).toBe(true);
  expect(child(editor, id, "item2Icon").visual.style?.stroke).toBe("#123456");
  expect(
    (child(editor, id, "item2Label").semantic as { text: string }).text,
  ).toBe("Two");
});

test("full-width kit insertion adopts parent width", () => {
  const editor = makeEditor();
  const parent = editor.buildElement("frame", {
    semantic: { name: "Phone", memberIds: [] },
    visual: { x: 40, y: 20, width: 402, height: 874 },
  });
  editor.apply([{ type: "createElement", element: parent }]);
  const id = insertKitComponent(editor, "ios:status-bar", {
    page: editor.currentPageId,
    parentId: parent.id,
  });
  expect(editor.store.get(id)?.visual.width).toBe(402);
  expect(child(editor, id, "battery").visual.x).toBe(40 + 347 + 12);
  expect(editor.store.get(id)?.visual.x).toBe(40);
  expect(
    (editor.store.get(parent.id)?.semantic as FrameSemantic).memberIds,
  ).toContain(id);
});

test("each bar exports supported SVG markup", () => {
  for (const id of [
    "ios:status-bar",
    "ios:home-indicator",
    "ios:nav-bar",
    "ios:tab-bar",
    "ios:top-tabs",
    "ios:segmented",
  ]) {
    const editor = makeEditor();
    insertKitComponent(editor, id, { page: editor.currentPageId });
    const svg = editor.exportPageSvg();
    expect(svg).toContain("<svg");
    expect(svg).not.toContain("unsupported");
    if (["ios:status-bar", "ios:nav-bar", "ios:tab-bar"].includes(id))
      expect(svg).toContain('data-type="ui.icon"');
  }
});

test("slot property updates preserve the selected index and both custom colors", () => {
  const editor = makeEditor();
  const id = insertKitComponent(editor, "ios:tab-bar", {
    page: editor.currentPageId,
    props: { active: 1, activeColor: "#123456", inactiveColor: "#654321" },
  });
  applyKitProps(editor, id, { activeColor: "#abcdef" });
  expect(child(editor, id, "item2Icon").visual.style?.stroke).toBe("#abcdef");
  expect(child(editor, id, "item1Icon").visual.style?.stroke).toBe("#654321");
  applyKitProps(editor, id, { active: 3 });
  expect(child(editor, id, "item4Icon").visual.style?.stroke).toBe("#abcdef");
  expect(child(editor, id, "item2Icon").visual.style?.stroke).toBe("#654321");
  applyKitProps(editor, id, { inactiveColor: "#112233" });
  expect(child(editor, id, "item4Icon").visual.style?.stroke).toBe("#abcdef");
  expect(child(editor, id, "item2Icon").visual.style?.stroke).toBe("#112233");
});

test("visible slots distribute across the entire component as the count changes", () => {
  const editor = makeEditor();
  for (const shape of ["ios:tab-bar", "ios:top-tabs", "ios:segmented"]) {
    const id = insertKitComponent(editor, shape, {
      page: editor.currentPageId,
      props: {
        items: [{ label: "One" }, { label: "Two" }, { label: "Three" }],
      },
    });
    const root = editor.getBounds(id);
    const first = editor.getBounds(child(editor, id, "item1").id);
    const middle = editor.getBounds(child(editor, id, "item2").id);
    const third = editor.getBounds(child(editor, id, "item3").id);
    if (!root || !first || !middle || !third)
      throw new Error("missing slot bounds");
    expect(first.x).toBeCloseTo(root.x, 4);
    expect(Math.abs(first.width - root.width / 3)).toBeLessThanOrEqual(1);
    expect(Math.abs(middle.width - root.width / 3)).toBeLessThanOrEqual(1);
    expect(Math.abs(third.width - root.width / 3)).toBeLessThanOrEqual(1);
    expect(first.x + first.width).toBeCloseTo(middle.x, 4);
    expect(middle.x + middle.width).toBeCloseTo(third.x, 4);
    expect(third.x + third.width).toBeCloseTo(root.x + root.width, 4);
    for (let n = 1; n <= 3; n++) {
      const slot = editor.getBounds(child(editor, id, `item${n}`).id);
      const label = editor.getBounds(child(editor, id, `item${n}Label`).id);
      if (!slot || !label) throw new Error("missing content bounds");
      expect(label.x).toBeGreaterThanOrEqual(slot.x);
      expect(label.x + label.width).toBeLessThanOrEqual(slot.x + slot.width);
      expect(label.x + label.width / 2).toBeCloseTo(slot.x + slot.width / 2, 4);
      if (shape === "ios:tab-bar") {
        const icon = editor.getBounds(child(editor, id, `item${n}Icon`).id);
        if (!icon) throw new Error("missing icon bounds");
        expect(
          Math.abs(icon.x + icon.width / 2 - (slot.x + slot.width / 2)),
        ).toBeLessThanOrEqual(0.5);
      }
    }
    expect(child(editor, id, "item4").visual.hidden).toBe(true);
    applyKitProps(editor, id, { count: 2 });
    const second = editor.getBounds(child(editor, id, "item2").id);
    if (!second) throw new Error("missing second slot bounds");
    expect(second.x + second.width).toBeCloseTo(root.x + root.width, 4);
    expect(child(editor, id, "item3").visual.hidden).toBe(true);
  }
});

test("tab item badges show a filled background and disappear when cleared", () => {
  const editor = makeEditor();
  const id = insertKitComponent(editor, "ios:tab-bar", {
    page: editor.currentPageId,
    props: { items: [{ label: "One", badge: "3" }, { label: "Two" }] },
  });
  const badge = child(editor, id, "item1Badge");
  const background = child(editor, id, "item1BadgeBackground");
  expect((badge.semantic as { text: string }).text).toBe("3");
  expect(badge.visual.hidden).not.toBe(true);
  expect(background.visual.hidden).not.toBe(true);
  expect(typeof background.visual.style?.fill).toBe("string");
  expect(background.visual.style?.fill).not.toBe("none");
  expect(child(editor, id, "item2BadgeBackground").visual.hidden).toBe(true);
  applyKitProps(editor, id, {
    items: [{ label: "One", badge: "" }, { label: "Two" }],
  });
  expect(child(editor, id, "item1Badge").visual.hidden).toBe(true);
  expect(child(editor, id, "item1BadgeBackground").visual.hidden).toBe(true);
});

test("full-width navigation keeps its trailing icon centered in its button", () => {
  for (const width of [390, 402]) {
    const editor = makeEditor();
    const parent = editor.buildElement("frame", {
      semantic: { name: "Phone", memberIds: [] },
      visual: { x: 100, y: 50, width, height: 874 },
    });
    editor.apply([{ type: "createElement", element: parent }]);
    const id = insertKitComponent(editor, "ios:nav-bar", {
      page: editor.currentPageId,
      parentId: parent.id,
    });
    const instance = editor.getBounds(id);
    const button = editor.getBounds(child(editor, id, "trailingButton").id);
    const icon = editor.getBounds(child(editor, id, "trailingIcon").id);
    const title = editor.getBounds(child(editor, id, "title").id);
    if (!instance || !button || !icon || !title)
      throw new Error("missing nav-bar bounds");
    expect(instance.width).toBe(width);
    expect(button.width).toBe(44);
    expect(button.height).toBe(44);
    expect(icon.x).toBe(button.x + 10);
    expect(icon.y).toBe(button.y + 10);
    expect(button.x + 44).toBe(instance.x + width);
    expect(title.x + title.width / 2).toBe(instance.x + width / 2);
    if (width === 390) expect(icon.x).toBe(instance.x + 356);
  }
});

test("declarative property effects compose in one undo and restore defaults", () => {
  const base = IOS_KIT.find((kit) => kit.id === "ios:nav-bar");
  if (!base) throw new Error("missing navigation kit");
  const synthetic: KitComponent = {
    ...base,
    id: "ios:effect-test",
    build(editor, at) {
      const built = base.build(editor, at);
      return {
        ...built,
        frame: {
          ...built.frame,
          semantic: {
            ...(built.frame.semantic as FrameSemantic),
            kit: "ios:effect-test@1",
          },
        },
      };
    },
    props: [
      {
        name: "text",
        type: "text",
        default: "",
        targets: [{ key: "title", field: "text" }],
        effects: [
          {
            kind: "geometry",
            key: "title",
            condition: "non-empty",
            height: { whenTrue: 60, whenFalse: 22 },
          },
        ],
      },
      {
        name: "variant",
        type: "enum",
        default: "one",
        values: ["one", "two", "none"],
        targets: [],
        effects: [
          {
            kind: "variant",
            keys: ["backIcon", "trailingIcon"],
            cases: { one: ["backIcon"], two: ["trailingIcon"], none: [] },
          },
        ],
      },
      {
        name: "selected",
        type: "boolean",
        default: false,
        targets: [],
        effects: [
          {
            kind: "style",
            key: "title",
            cases: {
              true: { fill: "#111111", stroke: "#222222", color: "#ffffff" },
              false: { fill: "none", stroke: "none", color: "#000000" },
            },
          },
        ],
      },
      {
        name: "accent",
        type: "enum",
        default: "none",
        values: ["left", "none"],
        targets: [],
        effects: [
          {
            kind: "strokeSides",
            key: "title",
            cases: {
              left: {
                strokeSides: { left: 4 },
                strokeAlign: "inside",
                stroke: "#123456",
              },
              none: {
                strokeSides: {},
                strokeAlign: "center",
                stroke: "#000000",
              },
            },
          },
        ],
      },
      {
        name: "raw",
        type: "text",
        default: "Title",
        targets: [{ key: "backLabel", field: "text" }],
      },
    ],
  };
  (IOS_KIT as KitComponent[]).push(synthetic);
  try {
    const editor = makeEditor();
    const id = insertKitComponent(editor, synthetic.id, {
      page: editor.currentPageId,
    });
    const before = child(editor, id, "title");
    applyKitProps(editor, id, {
      text: "Hello",
      variant: "two",
      selected: true,
      accent: "left",
      raw: "Raw",
    });
    let title = child(editor, id, "title");
    expect(title.visual.height).toBe(60);
    expect(title.visual.style).toMatchObject({
      fill: "#111111",
      stroke: "#123456",
      color: "#ffffff",
      strokeSides: { left: 4 },
      strokeAlign: "inside",
    });
    expect(child(editor, id, "backIcon").visual.hidden).toBe(true);
    expect(child(editor, id, "trailingIcon").visual.hidden).toBe(false);
    expect(
      (child(editor, id, "backLabel").semantic as { text: string }).text,
    ).toBe("Raw");
    expect(editor.undo()).toBe(true);
    expect(child(editor, id, "title")).toEqual(before);
    expect(
      (child(editor, id, "backLabel").semantic as { text: string }).text,
    ).toBe("Back");
    for (const [value, visible] of [
      ["one", "backIcon"],
      ["two", "trailingIcon"],
      ["none", ""],
    ] as const) {
      applyKitProps(editor, id, { variant: value });
      for (const key of ["backIcon", "trailingIcon"])
        expect(child(editor, id, key).visual.hidden).toBe(key !== visible);
    }
    applyKitProps(editor, id, { text: "Hello", selected: true });
    applyKitProps(editor, id, { text: "", selected: false });
    title = child(editor, id, "title");
    expect(title.visual.height).toBe(22);
    expect(title.visual.style).toMatchObject({
      fill: "none",
      stroke: "none",
      color: "#000000",
    });
  } finally {
    (IOS_KIT as KitComponent[]).splice(
      (IOS_KIT as KitComponent[]).indexOf(synthetic),
      1,
    );
  }
});
