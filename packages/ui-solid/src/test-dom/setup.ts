import { transformAsync } from "@babel/core";
import { plugin } from "bun";
import { Window } from "happy-dom";

const window = new Window({ url: "http://localhost/" });
for (const key of [
  "window",
  "document",
  "navigator",
  "HTMLElement",
  "Element",
  "Node",
  "Event",
  "MouseEvent",
  "KeyboardEvent",
  "PointerEvent",
  "CustomEvent",
  "CSS",
]) {
  const value = key === "window" ? window : window[key as keyof Window];
  Object.defineProperty(globalThis, key, {
    value,
    configurable: true,
    writable: true,
  });
}

await plugin({
  name: "page-list-dom",
  setup(build) {
    const paths: Record<string, string> = {
      "solid-js": "solid-js/dist/solid.js",
      "solid-js/web": "solid-js/web/dist/web.js",
      "solid-js/store": "solid-js/store/dist/store.js",
    };
    build.onResolve({ filter: /^solid-js(?:\/web|\/store)?$/ }, ({ path }) => ({
      path: Bun.resolveSync(paths[path] ?? path, import.meta.dir),
    }));
    build.onLoad(
      { filter: /packages\/ui-solid\/src\/.*\.tsx$/ },
      async ({ path }) => {
        const result = await transformAsync(await Bun.file(path).text(), {
          filename: path,
          presets: [["babel-preset-solid", { generate: "dom" }]],
          parserOpts: { plugins: ["typescript", "jsx"] },
        });
        return { contents: result?.code ?? "", loader: "ts" };
      },
    );
  },
});
