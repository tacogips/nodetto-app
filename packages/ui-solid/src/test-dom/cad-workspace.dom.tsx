import assert from "node:assert/strict";
import { Editor } from "@nodetto/core";
import { createSignal, type JSX } from "solid-js";
import { render } from "solid-js/web";
import { PageList } from "../PageList.tsx";
import { PageTabs } from "../PageTabs.tsx";
import { ShapePalette } from "../ShapePalette.tsx";
import { Toolbar } from "../Toolbar.tsx";
import { PageSection } from "../inspector/PageSection.tsx";
import { interactionFor, pointer } from "../interaction-test-helpers.ts";
import type { ActionContext } from "../shortcuts.ts";
import { Tool, type ToolKind } from "../tools.ts";
import type { WorkspaceId } from "../workspaces.ts";

Object.assign(globalThis, {
  requestAnimationFrame: window.requestAnimationFrame.bind(window),
  cancelAnimationFrame: window.cancelAnimationFrame.bind(window),
});

function withDom(view: () => JSX.Element, check: (host: HTMLElement) => void) {
  const host = document.createElement("div");
  document.body.append(host);
  const dispose = render(view, host);
  try {
    check(host);
  } finally {
    dispose();
    host.remove();
  }
}

function button(host: HTMLElement, label: string) {
  const value = host.querySelector<HTMLButtonElement>(
    `button[aria-label="${label}"]`,
  );
  assert.ok(value, label);
  return value;
}

function select(host: HTMLElement, label: string) {
  const value = host.querySelector<HTMLSelectElement>(
    `select[aria-label="${label}"]`,
  );
  assert.ok(value, label);
  return value;
}

for (const theme of ["light", "dark"]) {
  document.documentElement.dataset.nodettoTheme = theme;
  const editor = new Editor();
  const freeform = editor.currentPageId;
  const cad = editor.createPage({ kind: "cad3d", name: "3D CAD" });
  const context: ActionContext = {
    editor,
    viewport: { width: 800, height: 600 },
    requestEdit: () => {},
    exportSvg: () => {},
  };

  const [tool, setTool] = createSignal<ToolKind>(Tool.Select);
  withDom(
    () => (
      <ShapePalette
        editor={editor}
        context={context}
        tool={tool()}
        onToolChange={setTool}
        workspace="cad3d"
      />
    ),
    (host) => {
      assert.equal(host.querySelectorAll(".nodetto-shape-tile").length, 7);
      assert.equal(host.querySelector('[aria-label="Grouping"]'), null);
      const arc = button(host, "Arc");
      assert.ok(arc.querySelector('svg [stroke="currentColor"] path'));
      arc.click();
      assert.equal(tool(), Tool.CadArc);
      assert.equal(arc.getAttribute("aria-pressed"), "true");
      button(host, "Select").click();
      assert.equal(tool(), Tool.Select);
      const search = host.querySelector<HTMLInputElement>('[type="search"]');
      assert.ok(search);
      search.value = "rectangle";
      search.dispatchEvent(new Event("input", { bubbles: true }));
      assert.deepEqual(
        [...host.querySelectorAll(".nodetto-shape-tile")].map((item) =>
          item.textContent?.trim(),
        ),
        ["Rectangle"],
      );
    },
  );

  const before = editor.getSnapshot();
  for (const tool of [
    Tool.CadSketch,
    Tool.CadLine,
    Tool.CadRect,
    Tool.CadArc,
    Tool.CadCircle,
    Tool.CadExtrude,
    Tool.Rectangle,
  ]) {
    const { interaction } = interactionFor(editor, tool);
    try {
      interaction.onPointerDown(pointer());
      interaction.onPointerUp(pointer());
      interaction.placeTool(tool, { x: 10, y: 20 });
    } finally {
      interaction.dispose();
    }
  }
  assert.equal(editor.getSnapshot(), before);

  const keys = interactionFor(editor, Tool.CadArc);
  try {
    keys.interaction.onKeyDown(new KeyboardEvent("keydown", { key: "r" }));
    assert.equal(keys.tool(), Tool.CadArc);
    keys.interaction.onKeyDown(new KeyboardEvent("keydown", { key: "v" }));
    assert.equal(keys.tool(), Tool.Select);
    editor.setCurrentPage(freeform);
    keys.interaction.onKeyDown(new KeyboardEvent("keydown", { key: "r" }));
    assert.equal(keys.tool(), Tool.Rectangle);
  } finally {
    keys.interaction.dispose();
    editor.setCurrentPage(cad);
  }

  const cadPage = editor.store.getPage(cad);
  const freeformPage = editor.store.getPage(freeform);
  assert.ok(cadPage);
  assert.ok(freeformPage);
  const [page, setPage] = createSignal(cadPage);
  withDom(
    () => <PageSection editor={editor} page={page()} />,
    (host) => {
      const format = select(host, "Page diagram format");
      assert.equal(format.disabled, true);
      assert.equal(format.value, "cad3d");
      assert.equal(format.selectedOptions[0]?.textContent, "3D CAD");
      setPage(freeformPage);
      assert.equal(format.disabled, false);
      assert.equal(format.value, "freeform");
      assert.equal(format.querySelector('[value="cad3d"]'), null);
    },
  );

  const [cadAllowed, setCadAllowed] = createSignal(true);
  withDom(
    () => (
      <PageList
        editor={editor}
        cadAllowed={cadAllowed()}
        open
        onOpenChange={() => {}}
      />
    ),
    (host) => {
      button(host, "Add page").click();
      assert.equal(editor.store.getPage(editor.currentPageId)?.kind, "cad3d");
      assert.equal(
        editor.store.getPage(editor.currentPageId)?.name,
        "3D CAD 2",
      );
      setCadAllowed(false);
      button(host, "Add page").click();
      assert.equal(
        editor.store.getPage(editor.currentPageId)?.kind,
        "freeform",
      );
    },
  );
  editor.setCurrentPage(cad);
  withDom(
    () => <PageTabs editor={editor} cadAllowed={cadAllowed()} />,
    (host) => {
      button(host, "Add page").click();
      assert.equal(
        editor.store.getPage(editor.currentPageId)?.kind,
        "freeform",
      );
      editor.setCurrentPage(cad);
      setCadAllowed(true);
      button(host, "Add page").click();
      assert.equal(editor.store.getPage(editor.currentPageId)?.kind, "cad3d");
      assert.equal(
        editor.store.getPage(editor.currentPageId)?.name,
        "3D CAD 3",
      );
    },
  );

  editor.setCurrentPage(freeform);
  const [workspace, setWorkspace] = createSignal<WorkspaceId>("flow");
  setCadAllowed(false);
  withDom(
    () => (
      <Toolbar
        editor={editor}
        context={context}
        tool={tool()}
        onToolChange={setTool}
        workspace={workspace()}
        hiddenWorkspaces={cadAllowed() ? undefined : ["cad3d"]}
        onWorkspaceChange={setWorkspace}
      />
    ),
    (host) => {
      const mode = select(host, "Mode");
      assert.equal(mode.querySelector('[value="cad3d"]'), null);
      setCadAllowed(true);
      assert.equal(
        mode.querySelector('[value="cad3d"]')?.textContent,
        "3D CAD",
      );
      button(host, "Actions").click();
      assert.ok(button(host, "Import image"));
      assert.ok(select(host, "Insert UI block"));
      editor.setCurrentPage(cad);
      assert.equal(host.querySelector('[aria-label="Import image"]'), null);
      assert.equal(host.querySelector('[aria-label="Insert UI block"]'), null);
      setWorkspace("cad3d");
      assert.equal(mode.value, "cad3d");
      setCadAllowed(false);
      assert.equal(mode.querySelector('[value="cad3d"]'), null);
      assert.equal(mode.value, "");
      mode.value = "flow";
      mode.dispatchEvent(new Event("change", { bubbles: true }));
      assert.equal(workspace(), "flow");
    },
  );
  console.log(`ok ${theme}`);
}
