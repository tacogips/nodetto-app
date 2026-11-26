import { describe, expect, test } from "bun:test";
import { coordinateKey, roundCoordinate } from "./index.ts";

describe("coordinate keys", () => {
  test("rounds negative ties away from zero", () => {
    expect(roundCoordinate(-0.125)).toBe(-0.13);
    expect(coordinateKey(-0.125)).toBe(-13);
  });

  test("maps nearby values to hundredths", () => {
    expect(coordinateKey(0.004)).toBe(0);
    expect(coordinateKey(10.004)).toBe(1000);
    expect(coordinateKey(10.008)).toBe(1001);
  });

  test("rounding is idempotent", () => {
    for (const value of [-1.005, 1.005, 3.37, -0.999, 1e9]) {
      expect(roundCoordinate(roundCoordinate(value))).toBe(
        roundCoordinate(value),
      );
    }
  });

  test("preserves distinct coordinate limits", () => {
    expect(coordinateKey(1e9)).toBe(1e11);
    expect(coordinateKey(-1e9)).toBe(-1e11);
    expect(coordinateKey(1e9)).not.toBe(coordinateKey(-1e9));
  });
});
