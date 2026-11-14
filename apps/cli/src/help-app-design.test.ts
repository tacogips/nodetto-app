import { expect, test } from "bun:test";
import { helpFor, OVERVIEW } from "./help.ts";

test("app-design edit and shape commands are discoverable", () => {
  const edit = helpFor("edit");
  for (const term of [
    "parent",
    "memberIndex",
    "props",
    "sizing",
    "layout",
    "align",
    "distribute",
    "snap",
  ]) {
    expect(edit).toContain(term);
  }
  expect(helpFor("shapes")).toContain("shapes icon");
  expect(helpFor("shapes")).toContain("ios:");
});

test("app-design exports and comparison are discoverable", () => {
  for (const term of ["--frames", "--prototype", "prototype"]) {
    expect(helpFor("export")).toContain(term);
  }
  expect(helpFor("compare")).toContain("--band");
  expect(OVERVIEW).toContain("compare");
});

test("lint help lists the seven app-design rules", () => {
  for (const rule of [
    "app-off-frame",
    "app-text-overflow",
    "app-text-truncated",
    "app-control-overlap",
    "app-off-grid",
    "app-misaligned",
    "app-touch-target",
  ]) {
    expect(helpFor("lint")).toContain(rule);
  }
});
