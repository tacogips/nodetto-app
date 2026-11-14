import { expect, test } from "bun:test";
import type { Element, FrameSemantic } from "@nodetto/ir";
import { makeEditor } from "../../test-helpers.ts";
import { lintAppDesignPage } from "../../app-design-lint/index.ts";
import { lintTextLayoutPage } from "../../text-layout-lint/index.ts";
import { IOS_TINT } from "./style.ts";
import { applyKitProps, insertKitComponent, IOS_KIT } from "./index.ts";

function child(
  editor: ReturnType<typeof makeEditor>,
  root: string,
  key: string,
): Element {
  const seen = new Set<string>();
  const visit = (id: string): Element | undefined => {
    if (seen.has(id)) return undefined;
    seen.add(id);
    const element = editor.store.get(id);
    if (!element) return undefined;
    if (element.visual.componentKey === key) return element;
    if (element.type === "frame") {
      for (const id of (element.semantic as FrameSemantic).memberIds ?? []) {
        const found = visit(id);
        if (found) return found;
      }
    }
    return undefined;
  };
  const found = visit(root);
  if (!found) throw new Error(`missing child ${key}`);
  return found;
}

const content = [
  "ios:search-field",
  "ios:list-row",
  "ios:section-header",
  "ios:chip",
  "ios:fab",
  "ios:icon-button",
  "ios:text-field",
  "ios:composer",
  "ios:card",
  "ios:badge",
] as const;

test("every default kit component has no app-design findings", () => {
  const fractional: string[] = [];
  for (const kit of IOS_KIT) {
    const editor = makeEditor();
    const phone = editor.buildElement("frame", {
      semantic: { name: "Phone", memberIds: [], platform: "ios" },
      visual: { x: 0, y: 0, width: 390, height: 844 },
    });
    editor.apply([{ type: "createElement", element: phone }]);
    insertKitComponent(editor, kit.id, {
      page: editor.currentPageId,
      parentId: phone.id,
    });
    const page = editor.store.getPage(editor.currentPageId)!;
    expect({
      kit: kit.id,
      findings: lintAppDesignPage(
        editor.store,
        page,
        editor.createShapeContext(),
      ),
    }).toEqual({ kit: kit.id, findings: [] });
    for (const candidate of editor.store.listPages()) {
      expect({
        kit: kit.id,
        findings: lintTextLayoutPage(editor.getSnapshot(), candidate.id).filter(
          (finding) => finding.ruleId === "note-overflow",
        ),
      }).toEqual({ kit: kit.id, findings: [] });
    }
    for (const element of editor.store.listElements()) {
      for (const field of ["x", "y", "width", "height"] as const) {
        const value = element.visual[field];
        if (value !== undefined && Math.abs(value - Math.round(value)) >= 0.001)
          fractional.push(
            `${kit.id}:${element.visual.componentKey}:${field}=${value}`,
          );
      }
    }
  }
  expect(fractional).toEqual([]);
});

test("tab bars distribute whole-point slots and lint cleanly with badges", () => {
  for (const width of [390, 402]) {
    for (const count of [2, 3, 4, 5]) {
      for (const badge of [false, true]) {
        const editor = makeEditor();
        const phone = editor.buildElement("frame", {
          semantic: { name: "Phone", memberIds: [], platform: "ios" },
          visual: { x: 0, y: 0, width, height: 844 },
        });
        editor.apply([{ type: "createElement", element: phone }]);
        const id = insertKitComponent(editor, "ios:tab-bar", {
          page: editor.currentPageId,
          parentId: phone.id,
          props: {
            items: Array.from({ length: count }, (_, i) => ({
              label: `Item ${i + 1}`,
              ...(badge && i === 0 ? { badge: "1" } : {}),
            })),
          },
        });
        const slots = Array.from({ length: count }, (_, i) =>
          child(editor, id, `item${i + 1}`),
        );
        expect(
          slots.reduce((sum, slot) => sum + (slot.visual.width ?? 0), 0),
        ).toBe(width);
        for (let i = 1; i <= count; i++) {
          const slot = child(editor, id, `item${i}`).visual;
          const center = slot.x! + Math.floor(slot.width! / 2);
          const icon = child(editor, id, `item${i}Icon`).visual;
          const label = child(editor, id, `item${i}Label`).visual;
          const indicator = child(editor, id, `item${i}Indicator`).visual;
          expect(icon.x! + icon.width! / 2).toBe(center);
          expect(label.x! + label.width! / 2).toBe(center);
          expect([indicator.x, indicator.width]).toEqual([
            label.x,
            label.width,
          ]);
          for (const suffix of ["Badge", "BadgeBackground"]) {
            const badgeVisual = child(editor, id, `item${i}${suffix}`).visual;
            expect([badgeVisual.x, badgeVisual.y]).toEqual([
              center + 8,
              slot.y! + 3,
            ]);
          }
          for (const suffix of [
            "",
            "Icon",
            "Label",
            "Badge",
            "BadgeBackground",
            "Indicator",
          ]) {
            const visual = child(editor, id, `item${i}${suffix}`).visual;
            for (const field of ["x", "y", "width", "height"] as const) {
              const value = visual[field];
              if (value !== undefined) expect(value).toBe(Math.round(value));
            }
          }
        }
        expect(
          lintAppDesignPage(
            editor.store,
            editor.store.getPage(editor.currentPageId)!,
            editor.createShapeContext(),
          ),
        ).toEqual([]);
      }
    }
  }
});

test("tab bar count changes preserve centered children and undo", () => {
  const editor = makeEditor();
  const id = insertKitComponent(editor, "ios:tab-bar", {
    page: editor.currentPageId,
    props: {
      items: Array.from({ length: 4 }, (_, i) => ({
        label: `Item ${i}`,
        ...(i === 1 ? { badge: "1" } : {}),
      })),
    },
  });
  const keys = [
    "item2",
    "item2Icon",
    "item2Badge",
    "item2BadgeBackground",
    "item2Label",
    "item2Indicator",
  ];
  const before = keys.map((key) => ({ ...child(editor, id, key).visual }));
  applyKitProps(editor, id, { count: 3 });
  const slot = child(editor, id, "item2").visual;
  const icon = child(editor, id, "item2Icon").visual;
  expect([slot.x, slot.width]).toEqual([130, 130]);
  expect(icon.x! + icon.width! / 2).toBe(195);
  expect(icon.x).not.toBe(before[1]!.x! + (130 - 98) + 33 / 2);
  expect(icon.x).toBe(slot.x! + Math.floor(slot.width! / 2) - icon.width! / 2);
  for (const key of keys.slice(2, 4))
    expect(child(editor, id, key).visual.x).toBe(
      slot.x! + Math.round(slot.width! / 2) + 8,
    );
  expect(editor.undo()).toBe(true);
  expect(keys.map((key) => child(editor, id, key).visual)).toEqual(before);
  applyKitProps(editor, id, { count: 5 });
  const five = keys.map((key) => ({ ...child(editor, id, key).visual }));
  applyKitProps(editor, id, { count: 3 });
  applyKitProps(editor, id, { count: 5 });
  expect(keys.map((key) => child(editor, id, key).visual)).toEqual(five);
  expect(editor.undo()).toBe(true);
  expect(child(editor, id, "item2").visual.width).toBe(130);
});

test("tab bar honors moved children and 402-point widths", () => {
  const editor = makeEditor();
  const id = insertKitComponent(editor, "ios:tab-bar", {
    page: editor.currentPageId,
    width: 402,
    props: { count: 4 },
  });
  expect(
    [1, 2, 3, 4].reduce(
      (sum, i) => sum + child(editor, id, `item${i}`).visual.width!,
      0,
    ),
  ).toBe(402);
  for (const i of [1, 2, 3, 4])
    for (const suffix of [
      "",
      "Icon",
      "Label",
      "Badge",
      "BadgeBackground",
      "Indicator",
    ])
      for (const value of ["x", "y", "width", "height"] as const) {
        const n = child(editor, id, `item${i}${suffix}`).visual[value];
        if (n !== undefined) expect(n).toBe(Math.round(n));
      }
  const icon = child(editor, id, "item1Icon");
  editor.apply([
    {
      type: "replaceVisual",
      id: icon.id,
      visual: { ...icon.visual, x: icon.visual.x! + 10 },
    },
  ]);
  const hidden = { ...child(editor, id, "item5Icon").visual };
  applyKitProps(editor, id, { count: 3 });
  const slot = child(editor, id, "item1").visual;
  const moved = child(editor, id, "item1Icon").visual;
  expect(
    Math.abs(
      moved.x! - (slot.x! + Math.floor(slot.width! / 2) - moved.width! / 2),
    ),
  ).toBeGreaterThan(1);
  expect(child(editor, id, "item5Icon").visual).toEqual(hidden);
});

const dimensions: Record<
  string,
  { key?: string; width?: number; height?: number }
> = {
  "ios:search-field": { key: "background", width: 358, height: 36 },
  "ios:list-row": { width: 390, height: 44 },
  "ios:section-header": { width: 390, height: 38 },
  "ios:chip": { key: "background", height: 32 },
  "ios:fab": { width: 56, height: 56 },
  "ios:icon-button": { width: 44, height: 44 },
  "ios:text-field": { width: 358, height: 44 },
  "ios:composer": { width: 390, height: 60 },
  "ios:card": { width: 358 },
  "ios:badge": { height: 20 },
};

test("all content kit components insert into a phone and export SVG", () => {
  for (const shape of content) {
    const editor = makeEditor();
    const phone = editor.buildElement("frame", {
      semantic: { name: "Phone", memberIds: [], platform: "ios" },
      visual: { x: 0, y: 0, width: 390, height: 844 },
    });
    editor.apply([{ type: "createElement", element: phone }]);
    const id = insertKitComponent(editor, shape, {
      page: editor.currentPageId,
      parentId: phone.id,
    });
    const instance = editor.store.get(id);
    expect(instance).toBeDefined();
    expect((phone.semantic as FrameSemantic).memberIds).toEqual([]);
    expect(
      (editor.store.get(phone.id)?.semantic as FrameSemantic).memberIds,
    ).toContain(id);
    const bounds = editor.getBounds(id);
    expect(bounds?.width).toBeGreaterThan(0);
    expect(bounds?.height).toBeGreaterThan(0);
    const expected = dimensions[shape];
    if (!expected) throw new Error(`missing dimensions for ${shape}`);
    const visual = expected.key
      ? editor.getBounds(child(editor, id, expected.key).id)
      : bounds;
    if (!visual) throw new Error(`missing visual bounds for ${shape}`);
    if (expected.width !== undefined)
      expect(Math.abs(visual.width - expected.width)).toBeLessThanOrEqual(0.5);
    if (expected.height !== undefined)
      expect(Math.abs(visual.height - expected.height)).toBeLessThanOrEqual(
        0.5,
      );
    if (
      [
        "ios:search-field",
        "ios:list-row",
        "ios:chip",
        "ios:fab",
        "ios:icon-button",
        "ios:text-field",
      ].includes(shape)
    ) {
      expect(bounds?.width).toBeGreaterThanOrEqual(44);
      expect(bounds?.height).toBeGreaterThanOrEqual(44);
    }
    const svg = editor.exportPageSvg();
    expect(svg).toContain("<svg");
    expect(svg).not.toContain("unsupported");
    expect(svg).not.toContain("stroke-dasharray");
  }
});

test("content properties update row, card, and chip visuals", () => {
  const editor = makeEditor();
  const page = editor.currentPageId;
  const row = insertKitComponent(editor, "ios:list-row", { page });
  applyKitProps(editor, row, {
    subtitle: "Subtitle",
    accessory: "switch",
    divider: false,
  });
  expect(child(editor, row, "subtitle").visual.hidden).not.toBe(true);
  expect(editor.store.get(row)?.visual.height).toBe(60);
  expect(child(editor, row, "switch").type).toBe("ui.control");
  expect(child(editor, row, "switch").visual.hidden).not.toBe(true);
  expect(child(editor, row, "chevron").visual.hidden).toBe(true);
  expect(child(editor, row, "divider").visual.hidden).toBe(true);
  for (const variant of ["none", "chevron", "value", "switch", "checkmark"]) {
    applyKitProps(editor, row, { accessory: variant });
    for (const key of ["chevron", "value", "switch", "checkmark"]) {
      expect(child(editor, row, key).visual.hidden === true).toBe(
        key !== variant,
      );
    }
  }
  applyKitProps(editor, row, { subtitle: "", divider: true });
  expect(child(editor, row, "subtitle").visual.hidden).toBe(true);
  expect(editor.store.get(row)?.visual.height).toBe(44);
  expect(child(editor, row, "divider").visual.hidden).not.toBe(true);
  const card = insertKitComponent(editor, "ios:card", {
    page,
    props: { accentSide: "left" },
  });
  expect(
    child(editor, card, "background").visual.style?.strokeSides?.left,
  ).toBe(4);
  const chip = insertKitComponent(editor, "ios:chip", {
    page,
    props: { selected: true },
  });
  expect(child(editor, chip, "background").visual.style?.fill).toBe(IOS_TINT);
  applyKitProps(editor, chip, { selected: false });
  expect(child(editor, chip, "background").visual.style?.fill).not.toBe(
    IOS_TINT,
  );
  const search = insertKitComponent(editor, "ios:search-field", { page });
  applyKitProps(editor, search, { value: "Query" });
  expect(child(editor, search, "placeholder").visual.hidden).toBe(true);
  expect(child(editor, search, "value").visual.hidden).not.toBe(true);
  applyKitProps(editor, search, { value: "" });
  expect(child(editor, search, "placeholder").visual.hidden).not.toBe(true);
  expect(child(editor, search, "value").visual.hidden).toBe(true);
});

test("iOS kit has sixteen unique component ids", () => {
  expect(IOS_KIT).toHaveLength(16);
  expect(new Set(IOS_KIT.map((item) => item.id)).size).toBe(16);
});

test("content layout, wrapping and shadow use the editor contracts", () => {
  const editor = makeEditor();
  const page = editor.currentPageId;
  const row = insertKitComponent(editor, "ios:list-row", { page });
  const rowLayout = (editor.store.get(row)?.semantic as FrameSemantic).layout;
  expect(rowLayout?.direction).toBe("horizontal");
  expect(rowLayout?.gap).toBe(12);
  expect(child(editor, row, "textColumn").visual.layoutGrow).toBe(1);
  expect(child(editor, row, "divider").visual.layoutPosition).toBe("absolute");
  const chip = insertKitComponent(editor, "ios:chip", { page });
  expect(
    (editor.store.get(chip)?.semantic as FrameSemantic).layout?.widthSizing,
  ).toBe("hug");
  applyKitProps(editor, chip, { leadingIcon: "bell" });
  expect(child(editor, chip, "leadingIcon").visual.hidden).not.toBe(true);
  const card = insertKitComponent(editor, "ios:card", { page });
  expect(
    (editor.store.get(card)?.semantic as FrameSemantic).layout?.heightSizing,
  ).toBe("hug");
  expect(child(editor, card, "body").visual.textResize).toBe("auto-height");
  const badge = insertKitComponent(editor, "ios:badge", { page });
  expect(
    (editor.store.get(badge)?.semantic as FrameSemantic).layout?.widthSizing,
  ).toBe("hug");
  const composer = insertKitComponent(editor, "ios:composer", { page });
  expect(
    (editor.store.get(composer)?.semantic as FrameSemantic).layout?.direction,
  ).toBe("horizontal");
  const input = child(editor, composer, "input");
  const inputHeight = input.visual.height ?? 0;
  expect(inputHeight).toBeGreaterThanOrEqual(44);
  expect(editor.store.get(composer)?.visual.height).toBe(inputHeight + 16);
  const fab = insertKitComponent(editor, "ios:fab", { page });
  expect(
    child(editor, fab, "background").visual.style?.effects?.[0]?.type,
  ).toBe("drop-shadow");
  expect(
    child(editor, fab, "background").visual.style?.effects?.[0],
  ).toMatchObject({ x: 0, y: 0 });
});

test("resizing content keeps dividers and backgrounds attached", () => {
  const editor = makeEditor();
  const page = editor.currentPageId;
  const row = insertKitComponent(editor, "ios:list-row", { page });
  applyKitProps(editor, row, { subtitle: "Subtitle" });
  const rowBounds = editor.getBounds(row);
  const divider = editor.getBounds(child(editor, row, "divider").id);
  if (!rowBounds || !divider) throw new Error("missing row bounds");
  expect(divider.y + divider.height).toBeCloseTo(
    rowBounds.y + rowBounds.height,
    2,
  );
  for (const [shape, props] of [
    ["ios:chip", { label: "A substantially longer label" }],
    ["ios:badge", { count: "123456789" }],
    ["ios:card", { body: "A longer paragraph of content ".repeat(12) }],
  ] as const) {
    const id = insertKitComponent(editor, shape, { page });
    const before = editor.getBounds(id);
    applyKitProps(editor, id, props);
    const after = editor.getBounds(id);
    const background = editor.getBounds(child(editor, id, "background").id);
    if (!before || !after || !background)
      throw new Error(`missing bounds for ${shape}`);
    if (shape === "ios:card") {
      expect(after.height).toBeGreaterThan(before.height);
      expect(background.height).toBeCloseTo(after.height, 2);
    } else {
      expect(after.width).toBeGreaterThan(before.width);
      expect(background.width).toBeCloseTo(after.width, 2);
    }
  }
});

test("tab bar default 402 insertion and legacy odd-slot geometry", () => {
  const editor = makeEditor();
  const phone = editor.buildElement("frame", {
    semantic: { name: "Phone", memberIds: [], platform: "ios" },
    visual: { x: 0, y: 0, width: 402, height: 844 },
  });
  editor.apply([{ type: "createElement", element: phone }]);
  const id = insertKitComponent(editor, "ios:tab-bar", {
    page: editor.currentPageId,
    parentId: phone.id,
  });
  expect(
    [1, 2, 3, 4, 5].map((i) => child(editor, id, `item${i}`).visual.width),
  ).toEqual([80, 81, 80, 81, 80]);
  expect(
    lintAppDesignPage(
      editor.store,
      editor.store.getPage(editor.currentPageId)!,
      editor.createShapeContext(),
    ),
  ).toEqual([]);
  const odd = insertKitComponent(editor, "ios:tab-bar", {
    page: editor.currentPageId,
    width: 390,
    props: { count: 4 },
  });
  const slot = child(editor, odd, "item2").visual;
  const icon = child(editor, odd, "item2Icon");
  const label = child(editor, odd, "item2Label");
  expect([slot.x, slot.width]).toEqual([98, 97]);
  expect(icon.visual.x! + icon.visual.width! / 2).toBe(146);
  expect([label.visual.x, label.visual.width]).toEqual([98, 96]);
  expect(child(editor, odd, "item2Badge").visual.x).toBe(154);
  expect(child(editor, odd, "item2BadgeBackground").visual.x).toBe(154);
  expect(child(editor, odd, "item2Badge").visual.y).toBe(slot.y! + 3);
  expect([
    child(editor, odd, "item2Indicator").visual.x,
    child(editor, odd, "item2Indicator").visual.width,
  ]).toEqual([98, 96]);
  editor.apply([
    {
      type: "replaceVisual",
      id: icon.id,
      visual: { ...icon.visual, x: icon.visual.x! + 1 },
    },
    {
      type: "replaceVisual",
      id: label.id,
      visual: { ...label.visual, width: 97 },
    },
  ]);
  applyKitProps(editor, odd, { count: 4 });
  expect(
    child(editor, odd, "item2Icon").visual.x! + icon.visual.width! / 2,
  ).toBe(146);
  expect(child(editor, odd, "item2Label").visual.width).toBe(96);
});
