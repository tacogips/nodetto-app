import { describe, expect, it } from "bun:test";
import {
  BREADBOARD_EXPORTS,
  breadboardExportEnabled,
} from "./breadboard-export.ts";

describe("breadboard export options", () => {
  it("is enabled only for a breadboard page with a handler", () => {
    expect(breadboardExportEnabled("breadboard", true)).toBe(true);
    expect(breadboardExportEnabled("breadboard", false)).toBe(false);
    expect(breadboardExportEnabled("bpmn", true)).toBe(false);
    expect(breadboardExportEnabled(undefined, true)).toBe(false);
  });

  it("lists the supported exports in the desktop menu order", () => {
    expect(BREADBOARD_EXPORTS).toEqual([
      { kind: "bom", label: "BOM (CSV)", extension: "csv" },
      {
        kind: "kicad",
        label: "KiCad netlist (.net)",
        extension: "net",
      },
      {
        kind: "spice",
        label: "SPICE netlist (.cir)",
        extension: "cir",
      },
      {
        kind: "gerber",
        label: "PCB Gerber and drill (.zip)",
        extension: "zip",
      },
    ]);
  });
});
