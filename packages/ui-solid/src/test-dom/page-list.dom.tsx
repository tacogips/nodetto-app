import assert from "node:assert/strict";
import { Editor } from "@nodetto/core";
import { createSignal } from "solid-js";
import { render } from "solid-js/web";
import { PageList } from "../PageList.tsx";
import { pageMenuItems } from "../page-actions.ts";
import { PRESENTATION_HIDDEN_TITLE_SUFFIX } from "../page-presentation-toggle.ts";

function setup() {
  const editor = new Editor();
  const first = editor.currentPageId;
  editor.renamePage(first, "First");
  const second = editor.createPage({ name: "Second" });
  const third = editor.createPage({ name: "Third" });
  editor.setCurrentPage(first);
  const host = document.createElement("div");
  document.body.append(host);
  const changes: boolean[] = [];
  const copies: string[] = [];
  const [open, setOpen] = createSignal(true);
  const dispose = render(
    () => (
      <PageList
        editor={editor}
        open={open()}
        onOpenChange={(value) => {
          changes.push(value);
          setOpen(value);
        }}
        onCopyShapesFrom={(id) => copies.push(id)}
      />
    ),
    host,
  );
  const rows = () =>
    Array.from(host.querySelectorAll<HTMLElement>('[role="option"]'));
  const row = (id: string) => {
    const result = rows().find((element) => element.dataset.pageListRow === id);
    assert.ok(result, `missing row ${id}`);
    return result;
  };
  const cleanup = () => {
    dispose();
    host.remove();
  };
  return {
    editor,
    first,
    second,
    third,
    host,
    changes,
    copies,
    setOpen,
    rows,
    row,
    cleanup,
  };
}
function key(element: Element, value: string) {
  const event = new KeyboardEvent("keydown", {
    key: value,
    bubbles: true,
    cancelable: true,
  });
  element.dispatchEvent(event);
  return event;
}
function click(element: Element) {
  element.dispatchEvent(
    new MouseEvent("click", { bubbles: true, cancelable: true }),
  );
}
function dblclick(element: Element) {
  element.dispatchEvent(
    new MouseEvent("dblclick", { bubbles: true, cancelable: true }),
  );
}
function input(host: Element) {
  const element = host.querySelector<HTMLInputElement>("input");
  assert.ok(element, "missing rename input");
  return element;
}
function menuButton(row: Element) {
  const button = row.querySelector<HTMLButtonElement>(
    ".nodetto-page-list-menu-button",
  );
  assert.ok(button, "missing menu button");
  return button;
}
function menuItem(host: Element, label: string) {
  const element = Array.from(
    host.querySelectorAll<HTMLElement>(
      '[role="menu"] button, [role="menuitem"]',
    ),
  ).find((item) => item.textContent?.trim() === label);
  assert.ok(element, `missing menu item ${label}`);
  return element;
}

const scenarios: Record<string, () => void | Promise<void>> = {
  rows() {
    const s = setup();
    try {
      s.editor.setPageHiddenInPresentation(s.second, true);
      assert.equal(
        s.host.querySelector("summary")?.textContent?.trim(),
        "Pages (3)",
      );
      assert.deepEqual(
        s.rows().map((r) => r.dataset.pageListRow),
        [s.first, s.second, s.third],
      );
      assert.deepEqual(
        s
          .rows()
          .map((r) =>
            r.querySelector(".nodetto-page-list-number")?.textContent?.trim(),
          ),
        ["1", "2", "3"],
      );
      assert.deepEqual(
        s
          .rows()
          .map((r) =>
            r.querySelector(".nodetto-page-list-name")?.textContent?.trim(),
          ),
        ["First", "Second", "Third"],
      );
      assert.deepEqual(
        s.rows().map((r) => r.classList.contains("nodetto-page-list-hidden")),
        [false, true, false],
      );
      assert.ok(
        s
          .row(s.second)
          .querySelector(`[title$="${PRESENTATION_HIDDEN_TITLE_SUFFIX}"]`) ||
          s
            .row(s.second)
            .getAttribute("title")
            ?.endsWith(PRESENTATION_HIDDEN_TITLE_SUFFIX),
      );
    } finally {
      s.cleanup();
    }
  },
  highlight() {
    const s = setup();
    try {
      const check = (id: string) => {
        for (const r of s.rows()) {
          assert.equal(
            r.getAttribute("aria-selected"),
            String(r.dataset.pageListRow === id),
          );
          assert.equal(
            r.classList.contains("nodetto-page-list-active"),
            r.dataset.pageListRow === id,
          );
        }
      };
      check(s.first);
      s.editor.setCurrentPage(s.second);
      check(s.second);
      s.editor.renamePage(s.second, "Renamed");
      assert.match(s.row(s.second).textContent ?? "", /Renamed/);
      s.editor.undo();
      assert.match(s.row(s.second).textContent ?? "", /Second/);
      s.editor.redo();
      assert.match(s.row(s.second).textContent ?? "", /Renamed/);
    } finally {
      s.cleanup();
    }
  },
  click() {
    const s = setup();
    try {
      const r = s.row(s.third);
      r.focus();
      click(r);
      assert.equal(s.editor.currentPageId, s.third);
      assert.equal(document.activeElement, r);
      assert.equal(s.row(s.third), r);
    } finally {
      s.cleanup();
    }
  },
  async keyboard() {
    const s = setup();
    let propagated = 0;
    const listener = () => {
      propagated++;
    };
    window.addEventListener("keydown", listener);
    try {
      s.row(s.first).focus();
      assert.equal(key(s.row(s.first), "ArrowDown").defaultPrevented, true);
      await Promise.resolve();
      assert.equal(document.activeElement, s.row(s.second));
      assert.equal(s.editor.currentPageId, s.first);
      assert.equal(key(s.row(s.second), "ArrowUp").defaultPrevented, true);
      await Promise.resolve();
      assert.equal(document.activeElement, s.row(s.first));
      key(s.row(s.first), "ArrowDown");
      await Promise.resolve();
      const second = s.row(s.second);
      assert.equal(key(second, "Enter").defaultPrevented, true);
      assert.equal(s.editor.currentPageId, s.second);
      assert.equal(document.activeElement, second);
      assert.equal(second.dataset.pageListRow, s.second);
      assert.equal(s.row(s.second), second);
      assert.equal(key(second, "ArrowDown").defaultPrevented, true);
      await Promise.resolve();
      assert.equal(document.activeElement, s.row(s.third));
      assert.equal(key(s.row(s.third), " ").defaultPrevented, true);
      assert.equal(s.editor.currentPageId, s.third);
      assert.equal(propagated, 0);
    } finally {
      window.removeEventListener("keydown", listener);
      s.cleanup();
    }
  },
  fold() {
    const s = setup();
    try {
      const details = s.host.querySelector("details");
      assert.ok(details);
      assert.equal(s.rows().length, 3);
      details.open = false;
      details.dispatchEvent(new Event("toggle"));
      assert.deepEqual(s.changes, [false]);
      assert.equal(s.rows().length, 0);
      details.open = true;
      details.dispatchEvent(new Event("toggle"));
      assert.deepEqual(s.changes, [false, true]);
      assert.equal(s.rows().length, 3);
    } finally {
      s.cleanup();
    }
  },
  "read-only"() {
    const s = setup();
    try {
      click(menuButton(s.row(s.second)));
      assert.ok(s.host.querySelector('[role="menu"]'));
      s.editor.setReadOnly(true);
      assert.equal(s.host.querySelector('[role="menu"]'), null);
      s.editor.setReadOnly(false);
      key(s.row(s.second), "F2");
      assert.ok(s.host.querySelector("input"));
      s.editor.setReadOnly(true);
      assert.equal(s.host.querySelector("input"), null);
      assert.equal(s.host.querySelector(".nodetto-page-list-add"), null);
      assert.equal(
        s.host.querySelector(".nodetto-page-list-menu-button"),
        null,
      );
      const r = s.row(s.second);
      key(r, "F2");
      dblclick(r);
      r.dispatchEvent(
        new MouseEvent("contextmenu", { bubbles: true, cancelable: true }),
      );
      assert.equal(s.host.querySelector("input"), null);
      assert.equal(s.host.querySelector('[role="menu"]'), null);
      assert.equal(s.rows().length, 3);
      click(r);
      assert.equal(s.editor.currentPageId, s.second);
    } finally {
      s.cleanup();
    }
  },
  rename() {
    const s = setup();
    try {
      const r = s.row(s.second);
      r.focus();
      key(r, "F2");
      let field = input(s.host);
      assert.equal(field.value, "Second");
      field.focus();
      s.editor.setPageHiddenInPresentation(s.third, true);
      assert.equal(input(s.host), field);
      assert.ok(field.isConnected);
      assert.equal(document.activeElement, field);
      field.value = "New name";
      field.dispatchEvent(new Event("input", { bubbles: true }));
      key(field, "Enter");
      assert.equal(s.editor.store.getPage(s.second)?.name, "New name");
      assert.match(s.row(s.second).textContent ?? "", /New name/);
      s.editor.undo();
      assert.equal(s.editor.store.getPage(s.second)?.name, "Second");
      dblclick(s.row(s.second));
      field = input(s.host);
      field.value = "Cancelled";
      field.dispatchEvent(new Event("input", { bubbles: true }));
      key(field, "Escape");
      assert.equal(s.editor.store.getPage(s.second)?.name, "Second");
      key(s.row(s.second), "F2");
      field = input(s.host);
      s.editor.renamePage(s.second, "External");
      field.value = "Stale";
      field.dispatchEvent(new Event("input", { bubbles: true }));
      key(field, "Enter");
      assert.match(s.host.textContent ?? "", /Page changed while renaming/);
      assert.equal(s.editor.store.getPage(s.second)?.name, "External");
    } finally {
      s.cleanup();
    }
  },
  async menu() {
    const s = setup();
    try {
      const row = s.row(s.second);
      const button = menuButton(row);
      const current = s.editor.currentPageId;
      button.focus();
      assert.equal(key(button, "Enter").defaultPrevented, false);
      assert.equal(s.editor.currentPageId, current);
      button.click();
      await Promise.resolve();
      const enabled = Array.from(
        s.host.querySelectorAll<HTMLButtonElement>(
          '[role="menuitem"]:not(:disabled)',
        ),
      );
      assert.ok(enabled[0]);
      assert.ok(enabled[1]);
      assert.equal(document.activeElement, enabled[0]);
      key(enabled[0], "ArrowDown");
      assert.equal(document.activeElement, enabled[1]);
      key(enabled[1], "ArrowUp");
      assert.equal(document.activeElement, enabled[0]);
      assert.equal(key(enabled[0], "Enter").defaultPrevented, false);
      assert.equal(s.editor.currentPageId, current);
      key(enabled[0], "Escape");
      await Promise.resolve();
      assert.equal(s.host.querySelector('[role="menu"]'), null);
      assert.equal(document.activeElement, row);
      row.dispatchEvent(
        new MouseEvent("contextmenu", { bubbles: true, cancelable: true }),
      );
      await Promise.resolve();
      assert.equal(
        document.activeElement,
        s.host.querySelector('[role="menuitem"]:not(:disabled)'),
      );
      key(document.activeElement as Element, "Escape");
      await Promise.resolve();
      click(menuButton(s.row(s.second)));
      const menu = s.host.querySelector('[role="menu"]');
      assert.ok(menu);
      const labels = Array.from(
        menu.querySelectorAll<HTMLElement>("button, [role=menuitem]"),
      ).map((item) => item.textContent?.trim());
      assert.deepEqual(
        labels,
        pageMenuItems(s.editor, s.second, {
          axis: "vertical",
          copyShapes: true,
        }).map((item) => item.label),
      );
      click(menuItem(s.host, "Copy shapes from page..."));
      assert.deepEqual(s.copies, [s.second]);
      click(menuButton(s.row(s.second)));
      click(menuItem(s.host, "Duplicate"));
      assert.equal(s.editor.store.listPages().length, 4);
      const add = s.host.querySelector<HTMLElement>(".nodetto-page-list-add");
      assert.ok(add);
      click(add);
      assert.equal(s.editor.store.listPages().length, 5);
    } finally {
      s.cleanup();
    }
  },
};
for (const [name, run] of Object.entries(scenarios)) {
  try {
    await run();
    console.log(`ok ${name}`);
  } catch (error) {
    console.error(`FAIL ${name}`, error);
    process.exit(1);
  }
}
