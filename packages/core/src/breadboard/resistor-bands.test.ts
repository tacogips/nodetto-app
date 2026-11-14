import { describe, expect, test } from "bun:test";
import { resistorBands } from "./resistor-bands.ts";

describe("resistorBands", () => {
  test("derives four-band values and equivalent notation", () => {
    expect(resistorBands("220", 4)).toEqual(["red", "red", "brown", "gold"]);
    expect(resistorBands("4.7k", 4)).toEqual([
      "yellow",
      "violet",
      "red",
      "gold",
    ]);
    expect(resistorBands("4k7", 4)).toEqual(resistorBands("4.7k", 4));
    expect(resistorBands("1M", 4)).toEqual(["brown", "black", "green", "gold"]);
    expect(resistorBands("0.47", 4)).toEqual([
      "yellow",
      "violet",
      "silver",
      "gold",
    ]);
  });

  test("supports five bands and tolerance choices", () => {
    expect(resistorBands("10k", 5, 1)).toEqual([
      "brown",
      "black",
      "black",
      "red",
      "brown",
    ]);
    expect(resistorBands("10k", 5, 20)).toEqual([
      "brown",
      "black",
      "black",
      "red",
    ]);
    expect(resistorBands("10k", 5)).toEqual([
      "brown",
      "black",
      "black",
      "red",
      "brown",
    ]);
    expect(resistorBands("220", 4, 0.1)?.at(-1)).toBe("violet");
  });

  test("handles zero and rejects values without an exact code", () => {
    expect(resistorBands("0", 4)).toEqual(["black"]);
    expect(resistorBands("4.75k", 4)).toBeNull();
    expect(resistorBands("abc", 4)).toBeNull();
    expect(resistorBands("1e12", 4)).toBeNull();
    expect(resistorBands("-220", 4)).toBeNull();
  });
});
