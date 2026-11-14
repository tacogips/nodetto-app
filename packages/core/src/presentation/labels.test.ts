import { expect, test } from "bun:test";
import { slideLabel } from "./labels.ts";

test("labels number only visible pages", () => {
  const pages = [
    { id: "a" },
    { id: "b", hiddenInPresentation: true },
    { id: "c" },
  ];
  expect(slideLabel(pages, "a")).toBe("Slide 1 / 2");
  expect(slideLabel(pages, "b")).toBe("Hidden from presentation");
  expect(slideLabel(pages, "c")).toBe("Slide 2 / 2");
  expect(slideLabel(pages, "unknown")).toBeNull();
});
