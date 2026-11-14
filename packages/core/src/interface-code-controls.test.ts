import { expect, test } from "bun:test";
import { generateInterfaceCode } from "./interface-code.ts";
import { makeEditor } from "./test-helpers.ts";

test("handoff renders underline tabs using their accent", () => {
  const editor = makeEditor();
  const tabs = editor.buildElement("ui.control", {
    semantic: {
      control: "tabs",
      label: "Tabs",
      options: ["One", "Two"],
      indicator: "underline",
    },
    visual: {
      x: 0,
      y: 0,
      width: 200,
      height: 40,
      style: { fill: "#ffffff", accentColor: "#e0531f" },
    },
  });
  const frame = editor.buildElement("frame", {
    semantic: { name: "Screen", memberIds: [tabs.id] },
    visual: { x: 0, y: 0, width: 300, height: 600 },
  });
  editor.apply(
    [frame, tabs].map((element) => ({
      type: "createElement" as const,
      element,
    })),
  );
  const code = generateInterfaceCode(editor, frame.id)!;
  expect(code.css).toContain("border-bottom: 2px solid #e0531f");
  expect(code.css).not.toContain("#137e7e");
  expect(code.html).toContain('aria-selected="true"');
});

test("handoff emits icon, badge and multiline control styles", () => {
  const editor = makeEditor();
  const button = editor.buildElement("ui.control", {
    semantic: {
      control: "button",
      label: "Mark\nread",
      leadingIcon: "bell",
      badge: "3",
    },
    visual: {
      x: 0,
      y: 0,
      width: 200,
      height: 60,
      textPadding: 16,
      style: { textAlign: "start" },
    },
  });
  const frame = editor.buildElement("frame", {
    semantic: { name: "Screen", memberIds: [button.id] },
    visual: { x: 0, y: 0, width: 300, height: 600 },
  });
  editor.apply(
    [frame, button].map((element) => ({
      type: "createElement" as const,
      element,
    })),
  );
  const code = generateInterfaceCode(editor, frame.id)!;
  expect(code.html).toContain('<svg class="nodetto-control-icon');
  expect(code.html).toContain('nodetto-control-badge">3</span>');
  expect(code.css).toContain("white-space: pre-line;");
  expect(code.css).toContain("padding: 16px;");
  expect(code.css).toContain("text-align: start;");
});

test("decorated inputs reserve space for both icons", () => {
  const editor = makeEditor();
  const input = editor.buildElement("ui.control", {
    semantic: {
      control: "input",
      label: "Search",
      leadingIcon: "search",
      trailingIcon: "bell",
      iconSize: 20,
    },
    visual: { x: 0, y: 0, width: 200, height: 44, textPadding: 12 },
  });
  const frame = editor.buildElement("frame", {
    semantic: { name: "Screen", memberIds: [input.id] },
    visual: { x: 0, y: 0, width: 300, height: 600 },
  });
  editor.apply(
    [frame, input].map((element) => ({
      type: "createElement" as const,
      element,
    })),
  );
  const code = generateInterfaceCode(editor, frame.id)!;
  expect(code.html).toContain("nodetto-control-wrap");
  expect(code.css).toContain("padding: 12px 38px 12px 38px;");
});
