import { describe, expect, test } from "bun:test";
import { evaluateGate, parseDiagnostics } from "./strict-index-gate";
const diagnostic = (path: string, line = 1, message = "bad") => `${path}(${line},2): error TS1234: ${message}`;
const existing = { path: "a.ts", exists: true, isNew: false };
const input = { baseline: diagnostic("a.ts"), baselineExit: 2, output: diagnostic("a.ts", 4), exit: 2, files: [existing] };
describe("strict index gate", () => {
  test("parses diagnostics and ignores continuation lines", () => {
    expect(parseDiagnostics(`${diagnostic("a.ts")}\n  detail\n${diagnostic("b.ts")}`).map(({ path, code, message }) => ({ path, code, message }))).toEqual([{ path: "a.ts", code: "TS1234", message: "bad" }, { path: "b.ts", code: "TS1234", message: "bad" }]);
  });
  test("normalizes extracted paths", () => expect(parseDiagnostics(diagnostic("target/strict-index/base-tree-123-456/packages/a.ts"))[0]?.path).toBe("packages/a.ts"));
  test("accepts existing diagnostics despite moved lines", () => expect(evaluateGate(input).ok).toBe(true));
  test("rejects diagnostics in new files", () => expect(evaluateGate({ ...input, files: [{ ...existing, isNew: true }] }).ok).toBe(false));
  test("rejects extra diagnostics and duplicate occurrences", () => {
    expect(evaluateGate({ ...input, output: `${input.output}\n${diagnostic("a.ts", 3, "extra")}` }).ok).toBe(false);
    expect(evaluateGate({ ...input, output: `${input.output}\n${input.output}` }).ok).toBe(false);
  });
  test("ignores unlisted diagnostics", () => expect(evaluateGate({ ...input, output: `${input.output}\n${diagnostic("b.ts")}` })).toMatchObject({ ok: true, ignored: 1 }));
  test("rejects missing files, invalid baselines, launch and compiler failures", () => {
    for (const change of [{ files: [{ ...existing, exists: false }] }, { baseline: null }, { baselineExit: null }, { exit: null }, { exit: 1 }, { exit: 2, output: "" }, { baselineExit: 2, baseline: "" }]) expect(evaluateGate({ ...input, ...change }).ok).toBe(false);
  });
  test("accepts clean compiler and baseline", () => expect(evaluateGate({ ...input, baseline: "", baselineExit: 0, output: "", exit: 0 }).ok).toBe(true));
});
