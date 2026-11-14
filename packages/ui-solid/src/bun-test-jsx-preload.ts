import { plugin } from "bun";

plugin({
  name: "solid-test-jsx",
  setup(build) {
    build.onLoad({ filter: /\.tsx$/ }, async ({ path }) => ({
      contents: `/** @jsxImportSource solid-js/h */\n${await Bun.file(path).text()}`,
      loader: "tsx",
    }));
  },
});
