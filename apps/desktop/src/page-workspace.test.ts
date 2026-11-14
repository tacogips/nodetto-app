import { describe, expect, test } from "bun:test";
import {
  dedicatedPageKindFor,
  dedicatedWorkspaceFor,
} from "./page-workspace.ts";

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
