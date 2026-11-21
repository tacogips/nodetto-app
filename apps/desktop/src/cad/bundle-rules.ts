const manifoldName = "manifold-3d";

function packagePath(moduleId: string, name: string): string | undefined {
  const prefix = `/node_modules/${name}/`;
  const normalized = `/${moduleId.replaceAll("\\", "/")}`;
  const start = normalized.lastIndexOf(prefix);
  return start < 0 ? undefined : normalized.slice(start + prefix.length);
}

export function isManifoldEntry(moduleId: string): boolean {
  return packagePath(moduleId, manifoldName) === "manifold.js";
}

export function checkBundleModules(
  moduleIds: readonly string[],
  assets: readonly string[],
  inventoryNames: readonly string[],
): string[] {
  const violations: string[] = [];
  const otherPackages = inventoryNames.filter((name) => name !== manifoldName);
  for (const id of moduleIds) {
    const path = packagePath(id, manifoldName);
    if (
      path !== undefined &&
      path !== "manifold.js" &&
      path !== "manifold.wasm?url"
    ) {
      violations.push(id);
    } else if (
      otherPackages.some((name) => packagePath(id, name) !== undefined)
    ) {
      violations.push(id);
    }
  }
  if (!moduleIds.some(isManifoldEntry)) {
    violations.push("The module graph is missing manifold-3d/manifold.js");
  }
  const wasmAssets = assets.filter((asset) => asset.endsWith(".wasm"));
  if (wasmAssets.length !== 1) {
    violations.push(`Expected one WASM asset, found ${wasmAssets.length}`);
  }
  return violations;
}
