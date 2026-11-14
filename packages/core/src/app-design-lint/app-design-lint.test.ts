import { expect, test } from "bun:test";
import { Editor } from "../editor.ts";
import type { FrameSemantic } from "@nodetto/ir";
import { insertKitComponent, IOS_KIT } from "../kits/ios/index.ts";
import { lintAppDesignPage } from "./index.ts";

test("checks screen descendants for geometry and text problems", () => {
  const editor = new Editor();
  const screen = editor.buildElement("frame", {
    id: "screen",
    semantic: {
      name: "Screen",
      platform: "ios",
      memberIds: ["note", "button"],
    },
    visual: { x: 0, y: 0, width: 200, height: 200 },
  });
  const note = editor.buildElement("text.note", {
    id: "note",
    semantic: { text: "A very long label that must be truncated" },
    visual: {
      x: 10.5,
      y: 10,
      width: 40,
      height: 30,
      textPadding: 0,
      textTruncate: "ellipsis",
      textMeasure: "proportional",
    },
  });
  const button = editor.buildElement("ui.control", {
    id: "button",
    semantic: { control: "button", label: "Go" },
    visual: { x: 180, y: 100, width: 30, height: 30 },
  });
  editor.apply(
    [screen, note, button].map((element) => ({
      type: "createElement" as const,
      element,
    })),
  );
  const page = editor.store.getPage(editor.currentPageId)!;
  const findings = lintAppDesignPage(
    editor.store,
    page,
    editor.createShapeContext(),
  );
  expect(
    findings.some((f) => f.elementId === "note" && f.ruleId === "app-off-grid"),
  ).toBe(true);
  expect(
    findings.some(
      (f) => f.elementId === "note" && f.ruleId === "app-text-truncated",
    ),
  ).toBe(true);
  expect(
    findings.some(
      (f) => f.elementId === "button" && f.ruleId === "app-touch-target",
    ),
  ).toBe(true);
  expect(
    findings.some(
      (f) => f.elementId === "button" && f.ruleId === "app-off-frame",
    ),
  ).toBe(true);
});

function findings(editor: Editor) {
  return lintAppDesignPage(
    editor.store,
    editor.store.getPage(editor.currentPageId)!,
    editor.createShapeContext(),
  );
}

test("hidden and component-definition contents are excluded", () => {
  const editor = new Editor();
  const hidden = editor.buildElement("text.note", {
    id: "hidden",
    semantic: { text: "W".repeat(100) },
    visual: { x: 10, y: 10, width: 20, height: 10, hidden: true },
  });
  const definitionChild = editor.buildElement("text.note", {
    id: "definition-child",
    semantic: { text: "W".repeat(100) },
    visual: { x: 10, y: 30, width: 20, height: 10 },
  });
  const definition = editor.buildElement("frame", {
    id: "definition",
    semantic: {
      name: "Definition",
      component: true,
      memberIds: [definitionChild.id],
    },
    visual: { x: 0, y: 0, width: 100, height: 100 },
  });
  const screen = editor.buildElement("frame", {
    id: "screen",
    semantic: {
      name: "Screen",
      platform: "ios",
      memberIds: [hidden.id, definition.id],
    },
    visual: { x: 0, y: 0, width: 390, height: 844 },
  });
  editor.apply(
    [hidden, definitionChild, definition, screen].map((element) => ({
      type: "createElement" as const,
      element,
    })),
  );
  expect(
    findings(editor).filter((f) =>
      [hidden.id, definitionChild.id, definition.id].includes(f.elementId),
    ),
  ).toEqual([]);
});

test("off-frame honors clipping, overlapping siblings and platform touch minimum", () => {
  for (const clipContent of [false, true]) {
    const editor = new Editor();
    const first = editor.buildElement("ui.control", {
      id: "first",
      semantic: { control: "button", label: "A" },
      visual: { x: 170, y: 10, width: 40, height: 40 },
    });
    const second = editor.buildElement("ui.control", {
      id: "second",
      semantic: { control: "button", label: "B" },
      visual: { x: 160, y: 20, width: 40, height: 40 },
    });
    const screen = editor.buildElement("frame", {
      id: "screen",
      semantic: {
        name: "Screen",
        platform: "ios",
        clipContent,
        memberIds: [first.id, second.id],
      },
      visual: { x: 0, y: 0, width: 200, height: 200 },
    });
    editor.apply(
      [first, second, screen].map((element) => ({
        type: "createElement" as const,
        element,
      })),
    );
    const result = findings(editor);
    expect(
      result.some(
        (f) => f.elementId === first.id && f.ruleId === "app-off-frame",
      ),
    ).toBe(!clipContent);
    expect(
      result.filter((f) => f.ruleId === "app-control-overlap"),
    ).toHaveLength(1);
    expect(result.filter((f) => f.ruleId === "app-touch-target")).toHaveLength(
      2,
    );
  }
});

test("default kit components on iOS screens have no app findings", () => {
  for (const kit of IOS_KIT) {
    const editor = new Editor();
    const id = insertKitComponent(editor, kit.id, {
      page: editor.currentPageId,
      x: 0,
      y: 0,
    });
    const screen = editor.buildElement("frame", {
      id: "screen",
      semantic: { name: "Screen", platform: "ios", memberIds: [id] },
      visual: { x: 0, y: 0, width: 390, height: 844 },
    });
    editor.apply([{ type: "createElement", element: screen }]);
    expect({ kit: kit.id, findings: findings(editor) }).toEqual({
      kit: kit.id,
      findings: [],
    });
  }
});

test("instance children with overridden text retain instance and screen context", () => {
  const editor = new Editor();
  const control = editor.buildElement("ui.control", {
    id: "source-control",
    semantic: { control: "button", label: "OK" },
    visual: { x: 0, y: 0, width: 80, height: 44 },
  });
  const source = editor.buildElement("frame", {
    id: "source",
    semantic: { name: "Source", component: true, memberIds: [control.id] },
    visual: { x: 0, y: 0, width: 80, height: 44 },
  });
  editor.apply(
    [control, source].map((element) => ({
      type: "createElement" as const,
      element,
    })),
  );
  const id = editor.createComponentInstance(source.id, { x: 16, y: 16 });
  if (!id) throw new Error("missing instance");
  const child = (editor.store.get(id)?.semantic as FrameSemantic)
    .memberIds?.[0];
  if (!child) throw new Error("missing child");
  editor.setText(child, "W".repeat(100));
  const screen = editor.buildElement("frame", {
    id: "screen",
    semantic: { name: "Screen", platform: "ios", memberIds: [id] },
    visual: { x: 0, y: 0, width: 390, height: 844 },
  });
  editor.apply([{ type: "createElement", element: screen }]);
  expect(
    findings(editor).filter(
      (f) => f.elementId === child && f.ruleId === "app-text-overflow",
    ),
  ).toEqual([
    expect.objectContaining({
      context: { instanceId: id, screenId: "screen" },
    }),
  ]);
});

test("grid and near-alignment rules respect their thresholds", () => {
  for (const [x, expected] of [
    [12, true],
    [16, false],
  ] as const) {
    const editor = new Editor();
    const rect = editor.buildElement("shape.geo", {
      id: "rect",
      visual: { x, y: 16, width: 32, height: 32 },
    });
    const screen = editor.buildElement("frame", {
      id: "screen",
      semantic: {
        name: "Screen",
        platform: "ios",
        memberIds: [rect.id],
        layoutGrids: [
          { id: "grid", kind: "grid", size: 8, color: "#123456", opacity: 0.2 },
        ],
      },
      visual: { x: 0, y: 0, width: 200, height: 200 },
    });
    editor.apply(
      [rect, screen].map((element) => ({
        type: "createElement" as const,
        element,
      })),
    );
    expect(
      findings(editor).some(
        (f) => f.elementId === rect.id && f.ruleId === "app-off-grid",
      ),
    ).toBe(expected);
  }
  for (const [x, expected] of [
    [17, true],
    [16, false],
    [24, false],
  ] as const) {
    const editor = new Editor();
    const a = editor.buildElement("shape.geo", {
      id: "a",
      visual: { x: 16, y: 16, width: 32, height: 32 },
    });
    const b = editor.buildElement("shape.geo", {
      id: "b",
      visual: { x, y: 80, width: 32, height: 32 },
    });
    const screen = editor.buildElement("frame", {
      id: "screen",
      semantic: { name: "Screen", platform: "ios", memberIds: [a.id, b.id] },
      visual: { x: 0, y: 0, width: 200, height: 200 },
    });
    editor.apply(
      [a, b, screen].map((element) => ({
        type: "createElement" as const,
        element,
      })),
    );
    expect(
      findings(editor).some(
        (f) => f.elementId === b.id && f.ruleId === "app-misaligned",
      ),
    ).toBe(expected);
  }
});

test("web screens do not impose a platform touch minimum", () => {
  const editor = new Editor();
  const button = editor.buildElement("ui.control", {
    id: "button",
    semantic: { control: "button", label: "" },
    visual: { x: 8, y: 8, width: 30, height: 30 },
  });
  const screen = editor.buildElement("frame", {
    id: "screen",
    semantic: { name: "Web", platform: "web", memberIds: [button.id] },
    visual: { x: 0, y: 0, width: 200, height: 200 },
  });
  editor.apply(
    [button, screen].map((element) => ({
      type: "createElement" as const,
      element,
    })),
  );
  expect(
    findings(editor).filter((f) => f.ruleId === "app-touch-target"),
  ).toEqual([]);
});

test("linked instance icon is checked even inside a large interactive ancestor", () => {
  const editor = new Editor();
  const icon = editor.buildElement("ui.icon", {
    id: "source-icon",
    semantic: { icon: "bell" },
    visual: { x: 8, y: 8, width: 24, height: 24 },
  });
  const source = editor.buildElement("frame", {
    id: "source",
    semantic: { name: "Source", component: true, memberIds: [icon.id] },
    visual: { x: 0, y: 0, width: 80, height: 44 },
  });
  editor.apply(
    [icon, source].map((element) => ({
      type: "createElement" as const,
      element,
    })),
  );
  const instance = editor.createComponentInstance(source.id, { x: 16, y: 16 });
  if (!instance) throw new Error("missing instance");
  const child = (editor.store.get(instance)?.semantic as FrameSemantic)
    .memberIds?.[0];
  if (!child) throw new Error("missing icon");
  const screen = editor.buildElement("frame", {
    id: "screen",
    semantic: { name: "Screen", platform: "ios", memberIds: [instance] },
    visual: { x: 0, y: 0, width: 390, height: 844 },
  });
  editor.apply([{ type: "createElement", element: screen }]);
  editor.createElement("edge.generic", {
    semantic: { from: child, to: screen.id, prototype: true },
  });
  expect(
    findings(editor).filter(
      (f) => f.elementId === child && f.ruleId === "app-touch-target",
    ),
  ).toEqual([
    expect.objectContaining({
      context: { instanceId: instance, screenId: screen.id },
    }),
  ]);
});

test("app page content outside screens is reported", () => {
  const editor = new Editor();
  const note = editor.buildElement("text.note", {
    id: "outside",
    semantic: { text: "Hi" },
    visual: { x: 0, y: 0, width: 80, height: 40 },
  });
  editor.apply([{ type: "createElement", element: note }]);
  const page = editor.store.getPage(editor.currentPageId)!;
  expect(
    lintAppDesignPage(
      editor.store,
      { ...page, mode: "app" },
      editor.createShapeContext(),
    ).some((f) => f.elementId === note.id && f.ruleId === "app-off-frame"),
  ).toBe(true);
});

test("nested instances report an overflowing label once", () => {
  const editor = new Editor();
  const label = editor.buildElement("ui.control", {
    id: "nested-label",
    semantic: { control: "button", label: "W".repeat(100) },
    visual: { x: 0, y: 0, width: 80, height: 44 },
  });
  const inner = editor.buildElement("frame", {
    id: "inner-source",
    semantic: { name: "Inner", component: true, memberIds: [label.id] },
    visual: { x: 0, y: 0, width: 80, height: 44 },
  });
  editor.apply(
    [label, inner].map((element) => ({
      type: "createElement" as const,
      element,
    })),
  );
  const innerInstance = editor.createComponentInstance(inner.id, {
    x: 16,
    y: 16,
  });
  if (!innerInstance) throw new Error("missing inner instance");
  const outer = editor.buildElement("frame", {
    id: "outer-source",
    semantic: { name: "Outer", component: true, memberIds: [innerInstance] },
    visual: { x: 16, y: 16, width: 80, height: 44 },
  });
  editor.apply([{ type: "createElement", element: outer }]);
  const instance = editor.createComponentInstance(outer.id, { x: 32, y: 32 });
  if (!instance) throw new Error("missing outer instance");
  const screen = editor.buildElement("frame", {
    id: "screen",
    semantic: { name: "Screen", platform: "ios", memberIds: [instance] },
    visual: { x: 0, y: 0, width: 390, height: 844 },
  });
  editor.apply([{ type: "createElement", element: screen }]);
  expect(
    findings(editor).filter((f) => f.ruleId === "app-text-overflow"),
  ).toHaveLength(1);
});
