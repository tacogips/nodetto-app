import { expect, test } from "bun:test";
import { shortIds } from "./ids.ts";

test("reserved selector IDs remain full while ordinary IDs use unique prefixes", () => {
  const ids = shortIds([
    "name:latch-bore",
    "name:latch-pin",
    "@spindle-cut",
    "collar-groove",
    "collar",
  ]);
  expect([...ids.entries()]).toEqual(
    expect.arrayContaining([
      ["name:latch-bore", "name:latch-bore"],
      ["name:latch-pin", "name:latch-pin"],
      ["@spindle-cut", "@spindle-cut"],
      ["collar-groove", "collar-"],
      ["collar", "collar"],
    ]),
  );
});
