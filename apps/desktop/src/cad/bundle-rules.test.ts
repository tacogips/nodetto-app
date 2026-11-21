import { expect, test } from "bun:test";
import { checkBundleModules } from "./bundle-rules.ts";

const entry =
  "/work/node_modules/.bun/manifold-3d@3.5.5/node_modules/manifold-3d/manifold.js";
const wasm = "assets/manifold-C5c1.wasm";
const packages = ["manifold-3d", "sharp", "@img/sharp-darwin-arm64"];

test("the library entry and its URL module are allowed", () => {
  expect(
    checkBundleModules(
      [
        entry,
        "/work/node_modules/manifold-3d/manifold.wasm?url",
        "/work/packages/core/src/icons/sharp-lucide-data.generated.ts",
        "/work/node_modules/sharpen/main.js",
      ],
      [wasm, "index.html"],
      packages,
    ),
  ).toEqual([]);
});

test("other Manifold modules and installed-only packages are rejected", () => {
  const forbidden = [
    "/work/node_modules/manifold-3d/lib/manifoldCAD.js",
    "/work/node_modules/@img/sharp-darwin-arm64/lib/index.js",
    "C:\\work\\node_modules\\sharp\\lib\\index.js",
  ];
  expect(checkBundleModules([entry, ...forbidden], [wasm], packages)).toEqual(
    forbidden,
  );
});

test("missing worker evidence or any extra WASM is rejected", () => {
  expect(checkBundleModules([], [wasm], packages)).toEqual([
    "The module graph is missing manifold-3d/manifold.js",
  ]);
  expect(checkBundleModules([entry], [], packages)).toEqual([
    "Expected one WASM asset, found 0",
  ]);
  expect(checkBundleModules([entry], [wasm, "other.wasm"], packages)).toEqual([
    "Expected one WASM asset, found 2",
  ]);
});
