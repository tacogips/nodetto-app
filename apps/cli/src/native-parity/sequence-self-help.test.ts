import { expect } from "bun:test";
import { compare, nativeTest } from "./harness.ts";

nativeTest("sequence self-message help matches native", () => {
  for (const page of ["edit", "types"]) {
    expect(compare(["help", page]).exitCode).toBe(0);
  }
});
