import { expect, test } from "bun:test";
import { pcbExportEnabled } from "./pcb-export.ts";

test("PCB export is enabled only for PCB pages with a handler", () => {
  expect(pcbExportEnabled("pcb", true)).toBe(true);
  expect(pcbExportEnabled("breadboard", true)).toBe(false);
  expect(pcbExportEnabled("pcb", false)).toBe(false);
});
