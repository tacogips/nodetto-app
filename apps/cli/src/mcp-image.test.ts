import { expect, test } from "bun:test";
import { capturedImage, wantsInlineImage } from "./mcp-image.ts";

test("only capture arguments with the inline flag request an image", () => {
  for (const args of [
    ["capture", "drawing.jsonl", "--inline"],
    ["capture", "--inline", "--json", "drawing.jsonl"],
  ]) {
    expect(wantsInlineImage(args)).toBe(true);
  }
  for (const args of [
    [],
    ["export", "--inline"],
    ["capture", "drawing.jsonl"],
    ["capture", "--inline=true"],
    ["capture", "--", "--inline"],
  ]) {
    expect(wantsInlineImage(args)).toBe(false);
  }
});

test("capture reports identify PNG and JPEG images in text and JSON", () => {
  for (const [stdout, path, mimeType] of [
    [
      "path: /mock/plan view.png\nformat: png\n",
      "/mock/plan view.png",
      "image/png",
    ],
    ['{"path":"/mock/front.jpg"}\n', "/mock/front.jpg", "image/jpeg"],
    ["path: /mock/side.JPEG\r\n", "/mock/side.JPEG", "image/jpeg"],
    ['{"path":"/mock/side\\nview.png"}', "/mock/side\nview.png", "image/png"],
  ] as const) {
    expect(capturedImage(stdout)).toEqual({ path, mimeType });
  }
  for (const stdout of [
    "",
    "size: 80x60\npath: /mock/plan.png\n",
    "path: /mock/plan.svg",
    "{}",
    '{"path":17}',
    '["/mock/plan.png"]',
  ]) {
    expect(capturedImage(stdout)).toBeNull();
  }
});
