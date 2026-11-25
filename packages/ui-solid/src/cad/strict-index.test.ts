import { expect, test } from "bun:test";
import { resolve } from "node:path";
import ts from "typescript";

test("CAD UI, kernel and worker compile with unchecked indexed access", () => {
  const root = resolve(import.meta.dir, "../../../..");
  const configPath = resolve(root, "tsconfig.json");
  const config = ts.readConfigFile(configPath, ts.sys.readFile);
  expect(config.error).toBeUndefined();
  const parsed = ts.parseJsonConfigFileContent(config.config, ts.sys, root);
  const program = ts.createProgram(
    [
      resolve(root, "packages/ui-solid/src/cad-ui.tsx"),
      resolve(root, "packages/cad-kernel/src/index.ts"),
      resolve(root, "packages/cad-kernel/src/worker.ts"),
    ],
    {
      ...parsed.options,
      noEmit: true,
      noUncheckedIndexedAccess: true,
    },
  );
  const diagnostics = [...parsed.errors, ...ts.getPreEmitDiagnostics(program)];
  expect(
    ts.formatDiagnosticsWithColorAndContext(diagnostics.slice(0, 10), {
      getCanonicalFileName: (file) => file,
      getCurrentDirectory: () => root,
      getNewLine: () => "\n",
    }),
  ).toBe("");
}, 60_000);
