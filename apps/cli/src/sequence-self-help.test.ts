import { expect, test } from "bun:test";
import { type CommandIo, runCli } from "./commands.ts";

const io: CommandIo = { readText: () => "", writeText: () => {} };

test("edit help describes sequence self-calls", () => {
  const result = runCli(["help", "edit"], io, "test");
  expect(result.exitCode).toBe(0);
  expect(result.stdout).toContain("participant");
  expect(result.stdout).toContain("itself");
  expect(result.stdout).toContain("self-call");
  expect(result.stdout).toContain("A table or state may connect to itself");
  for (const kind of ["sync", "async", "return"])
    expect(result.stdout).toContain(kind);
});

test("types help points to sequence messages", () => {
  const result = runCli(["help", "types"], io, "test");
  expect(result.exitCode).toBe(0);
  expect(result.stdout).toContain("types sequence.message");
});
