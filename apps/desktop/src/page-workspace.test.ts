import { describe, expect, test } from "bun:test";
import { Editor } from "@nodetto/core";
import {
  dedicatedPageKindFor,
  dedicatedWorkspaceFor,
  workspaceForPage,
} from "./page-workspace.ts";
import { selectWorkspacePage } from "./shell/workspace.ts";

describe("dedicated page workspaces", () => {
  test("maps dedicated page kinds to their workspaces", () => {
    expect(dedicatedWorkspaceFor("breadboard")).toBe("breadboard");
    expect(dedicatedWorkspaceFor("bpmn")).toBe("bpmn");
    expect(dedicatedWorkspaceFor("pcb")).toBe("pcb");
    expect(dedicatedWorkspaceFor("freeform")).toBeUndefined();
  });

  test("maps dedicated workspaces back to page kinds", () => {
    expect(dedicatedPageKindFor("breadboard")).toBe("breadboard");
    expect(dedicatedPageKindFor("bpmn")).toBe("bpmn");
    expect(dedicatedPageKindFor("pcb")).toBe("pcb");
    expect(dedicatedPageKindFor("flow")).toBeUndefined();
  });
});

describe("per-page modes", () => {
  test("a page opens in its dedicated, chosen, notation or default mode", () => {
    expect(workspaceForPage({ kind: "bpmn", mode: "erd" }, "flow")).toBe(
      "bpmn",
    );
    expect(
      workspaceForPage({ kind: "freeform", mode: "usecase" }, "flow"),
    ).toBe("usecase");
    expect(workspaceForPage({ kind: "sequence" }, "flow")).toBe("sequence");
    expect(workspaceForPage({ kind: "freeform" }, "web")).toBe("web");
    expect(workspaceForPage(undefined, "app")).toBe("app");
  });

  test("choosing a mode stores it on the page, outside the undo history", () => {
    const editor = new Editor();
    const first = editor.currentPageId;
    selectWorkspacePage(editor, "erd");
    expect(editor.store.getPage(first)?.mode).toBe("erd");
    expect(editor.canUndo()).toBe(false);
    const second = editor.createPage({ name: "Actors" });
    selectWorkspacePage(editor, "usecase");
    editor.setCurrentPage(first);
    expect(workspaceForPage(editor.store.getPage(first), "flow")).toBe("erd");
    expect(workspaceForPage(editor.store.getPage(second), "flow")).toBe(
      "usecase",
    );
    selectWorkspacePage(editor, "pcb");
    const pcb = editor.store.getPage(editor.currentPageId);
    expect(pcb?.kind).toBe("pcb");
    expect(pcb?.mode).toBeUndefined();
    selectWorkspacePage(editor, "class");
    expect(editor.currentPageId).toBe(first);
    expect(editor.store.getPage(first)?.mode).toBe("class");
  });
});
