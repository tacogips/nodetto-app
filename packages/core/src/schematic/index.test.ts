import { describe, expect, test } from "bun:test";
import * as core from "../index.ts";

describe("schematic core exports", () => {
  test("exposes the public API through the core root", () => {
    expect(typeof core.computeSchematicConnectivity).toBe("function");
    expect(typeof core.lintSchematicPage).toBe("function");
    expect(typeof core.toSchematicNetlist).toBe("function");
    expect(typeof core.layoutSchematicImport).toBe("function");
    expect(typeof core.schematicNotation).toBe("function");
    expect(typeof core.schematicPcbParityFindings).toBe("function");
    expect(typeof core.shiftedTarget).toBe("function");
    expect(typeof core.snapSchematicDelta).toBe("function");
    expect("UnionFind" in core).toBe(false);
  });
});
