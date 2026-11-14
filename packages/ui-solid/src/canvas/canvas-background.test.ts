import { describe, expect, test } from "bun:test";
import { PAGE_KINDS } from "@nodetto/ir";
import { CANVAS_DARK_CLASS, canvasModeFor } from "./canvas-background.ts";

describe("canvasModeFor", () => {
  test("defaults every page kind to light without a setting", () => {
    expect(canvasModeFor("pcb", undefined)).toBe("light");
    expect(canvasModeFor("erd", undefined)).toBe("light");
    expect(canvasModeFor(undefined, undefined)).toBe("light");
  });

  test("uses the desktop defaults for PCB and diagram pages", () => {
    const setting = { diagram: "light", pcb: "dark" } as const;
    expect(canvasModeFor("pcb", setting)).toBe("dark");
    expect(canvasModeFor("freeform", setting)).toBe("light");
    expect(canvasModeFor("erd", setting)).toBe("light");
    expect(canvasModeFor("breadboard", setting)).toBe("light");
    expect(canvasModeFor("bpmn", setting)).toBe("light");
  });

  test("resolves inverted settings by page kind", () => {
    const setting = { diagram: "dark", pcb: "light" } as const;
    expect(canvasModeFor("pcb", setting)).toBe("light");
    expect(canvasModeFor("uml", setting)).toBe("dark");
    expect(canvasModeFor(undefined, setting)).toBe("dark");
  });

  test("uses the diagram mode for every non-PCB page kind", () => {
    const setting = { diagram: "dark", pcb: "light" } as const;
    for (const pageKind of PAGE_KINDS) {
      if (pageKind !== "pcb") {
        expect(canvasModeFor(pageKind, setting)).toBe("dark");
      }
    }
  });

  test("exports the dark canvas class name", () => {
    expect(CANVAS_DARK_CLASS).toBe("nodetto-canvas-dark");
  });
});
