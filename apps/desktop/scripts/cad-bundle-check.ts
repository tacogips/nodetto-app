import { createHash } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import inventory from "../../../packages/cad-kernel/licence-inventory.json";
import { build, type Plugin } from "vite";
import {
  checkBundleModules,
  isManifoldEntry,
} from "../src/cad/bundle-rules.ts";

const desktop = resolve(import.meta.dir, "..");
const evidence = resolve(desktop, "../../tmp/cad3d");
const outDir = join(evidence, "bundle-check/dist");
const [flag, label, ...extra] = process.argv.slice(2);
if (
  flag !== undefined &&
  (flag !== "--label" || !label || !/^[\w-]+$/.test(label) || extra.length)
) {
  throw new Error("Usage: cad-bundle-check.ts [--label <milestone>]");
}

const mainModules = new Set<string>();
const workerModules = new Set<string>();
const workerChunks = new Set<string>();
const assets = new Set<string>();
const mainImporters = new Map<string, readonly string[]>();
function audit(modules: Set<string>, worker: boolean): Plugin {
  return {
    name: "cad-bundle-audit",
    generateBundle(_options, output) {
      for (const [name, item] of Object.entries(output)) {
        if (item.type === "asset") assets.add(name);
        else {
          if (worker) workerChunks.add(name);
          for (const id of Object.keys(item.modules)) {
            modules.add(id);
            if (!worker && id.endsWith("/node_modules/tslib/tslib.es6.js")) {
              const info = this.getModuleInfo(id);
              if (info) {
                mainImporters.set(id, [
                  ...info.importers,
                  ...info.dynamicImporters,
                ]);
              }
            }
          }
        }
      }
    },
  };
}

await build({
  root: desktop,
  configFile: join(desktop, "vite.config.ts"),
  plugins: [audit(mainModules, false)],
  worker: { plugins: () => [audit(workerModules, true)] },
  build: { outDir, emptyOutDir: true },
});

const moduleIds = [...new Set([...mainModules, ...workerModules])].sort();
const assetNames = [...assets].sort();
// The desktop PDF code already bundles tslib 1.x. Manifold's inventory
// lists only the distinct 2.x copy installed through its native tooling.
const preexistingModules = new Map<string, readonly string[]>();
for (const [id, importers] of mainImporters) {
  if (
    workerModules.has(id) ||
    importers.length === 0 ||
    importers.some((path) => !path.includes("/node_modules/pdf-lib/"))
  ) {
    continue;
  }
  const manifest: unknown = JSON.parse(
    await readFile(join(dirname(id), "package.json"), "utf8"),
  );
  if (
    typeof manifest === "object" &&
    manifest !== null &&
    "name" in manifest &&
    manifest.name === "tslib" &&
    "version" in manifest &&
    manifest.version === "1.14.1"
  ) {
    preexistingModules.set(id, importers);
  }
}
const violations = checkBundleModules(
  moduleIds.filter((id) => !preexistingModules.has(id)),
  assetNames,
  inventory.map(({ name }) => name),
);
if (workerChunks.size === 0 || ![...workerModules].some(isManifoldEntry)) {
  violations.push("The worker module graph is missing manifold-3d/manifold.js");
}
if ([...mainModules].some(isManifoldEntry)) {
  violations.push("Manifold JavaScript also appears in the main thread bundle");
}

const wasmPath = fileURLToPath(
  import.meta.resolve("manifold-3d/manifold.wasm"),
);
const hash = (data: Uint8Array) =>
  createHash("sha256").update(data).digest("hex");
const expectedWasmSha256 = hash(await readFile(wasmPath));
const wasmAssets = assetNames.filter((asset) => asset.endsWith(".wasm"));
const wasm = await Promise.all(
  wasmAssets.map(async (asset) => {
    const sha256 = hash(await readFile(join(outDir, asset)));
    if (sha256 !== expectedWasmSha256)
      violations.push(`WASM bytes differ: ${asset}`);
    return { asset, sha256 };
  }),
);
const report = {
  moduleIds,
  workerModuleIds: [...workerModules].sort(),
  workerChunks: [...workerChunks].sort(),
  assets: assetNames,
  expectedWasmSha256,
  wasm,
  preexistingModules: Object.fromEntries(preexistingModules),
  violations,
};
if (label) {
  const destination = join(evidence, label, "bundle-check.json");
  await mkdir(dirname(destination), { recursive: true });
  await writeFile(destination, `${JSON.stringify(report, null, 2)}\n`);
}
if (violations.length > 0) throw new Error(violations.join("\n"));
console.log(
  `Checked ${moduleIds.length} modules, ${workerChunks.size} worker chunks, and ${wasm.length} WASM asset`,
);
