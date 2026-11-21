import { expect, test } from "bun:test";
import { createHash } from "node:crypto";
import { existsSync, readFileSync, realpathSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import ts from "typescript";

const root = dirname(
  fileURLToPath(new URL("../../../bun.lock", import.meta.url)),
);
const workspace = join(root, "packages/cad-kernel");
const source = join(workspace, "src");
const barePackage = "manifold-3d";
const wasmSha256 =
  "b172438703ef72dea983481a9a0328d43a9f09e224f6ab093e7bbc99f4372314";

function findManifest(from: string, name: string): string | undefined {
  let directory = from;
  while (true) {
    const candidate = join(directory, "node_modules", name, "package.json");
    if (existsSync(candidate)) return realpathSync(candidate);
    if (directory === root || directory === dirname(directory))
      return undefined;
    directory = dirname(directory);
  }
}

function installedManifest(path: readonly string[]): string | undefined {
  const [name, ...nested] = path;
  // Bun can put already-resolved packages in its isolated store instead of
  // leaving root symlinks for transitive dependencies.
  let manifest =
    findManifest(workspace, name) ??
    findManifest(join(root, "node_modules/.bun"), name);
  for (const dependency of nested) {
    if (!manifest) return undefined;
    manifest = findManifest(dirname(manifest), dependency);
  }
  return manifest;
}

function fromManifold(file: string): string {
  const manifest = findManifest(workspace, barePackage);
  if (!manifest) throw new Error("The workspace Manifold package is missing");
  return join(dirname(manifest), file);
}

function walkSyntax(path: string, visit: (node: ts.Node) => void): void {
  const tree = ts.createSourceFile(
    path,
    readFileSync(path, "utf8"),
    ts.ScriptTarget.ESNext,
  );
  function walk(node: ts.Node): void {
    visit(node);
    ts.forEachChild(node, walk);
  }
  walk(tree);
}

function isRequireCall(node: ts.CallExpression): boolean {
  return ts.isIdentifier(node.expression) && node.expression.text === "require";
}

test("CAD kernel sources only import local code, nodetto, and the bare Manifold entry", () => {
  const files = [...new Bun.Glob("**/*.ts").scanSync(source)].filter(
    (file) => !file.endsWith(".test.ts"),
  );
  expect(files).toContain("manifold-kernel.ts");
  const specifiers = new Set<string>();
  for (const file of files) {
    walkSyntax(join(source, file), (node) => {
      let specifier: ts.Node | undefined;
      if (ts.isImportDeclaration(node) || ts.isExportDeclaration(node)) {
        specifier = node.moduleSpecifier;
      } else if (ts.isExternalModuleReference(node)) {
        specifier = node.expression;
      } else if (ts.isImportTypeNode(node)) {
        specifier = ts.isLiteralTypeNode(node.argument)
          ? node.argument.literal
          : node.argument;
      } else if (
        ts.isCallExpression(node) &&
        (node.expression.kind === ts.SyntaxKind.ImportKeyword ||
          isRequireCall(node))
      ) {
        specifier = node.arguments[0];
        if (!specifier) throw new Error(`Missing module specifier in ${file}`);
      }
      if (!specifier) return;
      if (!ts.isStringLiteralLike(specifier))
        throw new Error(`Nonliteral module specifier in ${file}`);
      specifiers.add(specifier.text);
      expect(specifier.text).toMatch(/^(?:\.\.?\/|@nodetto\/|manifold-3d$)/);
    });
  }
  expect(specifiers.has(barePackage)).toBe(true);
});

test("core and IR manifests keep the CAD kernel out of their dependency lists", () => {
  for (const name of ["core", "ir"]) {
    const manifest = readFileSync(
      join(root, "packages", name, "package.json"),
      "utf8",
    );
    expect(manifest).not.toContain(barePackage);
    expect(manifest).not.toContain("@nodetto/cad-kernel");
  }
});

interface LockMetadata {
  dependencies?: Record<string, string>;
  peerDependencies?: Record<string, string>;
  optionalDependencies?: Record<string, string>;
  optionalPeers?: string[];
}

interface InventoryEntry {
  lockKey?: string;
  name: string;
  version: string;
  license: string;
  use: "distributed" | "installed-only" | "not-installed";
}

test("the Manifold licence inventory covers its locked dependency and platform packages", () => {
  const { packages } = Bun.JSONC.parse(
    readFileSync(join(root, "bun.lock"), "utf8"),
  ) as { packages: Record<string, [string, string?, LockMetadata?]> };
  const inventory = JSON.parse(
    readFileSync(join(workspace, "licence-inventory.json"), "utf8"),
  ) as InventoryEntry[];
  const byKey = new Map(
    inventory.map((entry) => [entry.lockKey ?? entry.name, entry]),
  );
  const seen = new Set<string>();
  const edges = [
    "dependencies",
    "peerDependencies",
    "optionalDependencies",
  ] as const;

  function visit(path: readonly string[]): void {
    const key = path.join("/");
    if (seen.has(key)) return;
    seen.add(key);
    const [reference, , metadata] = packages[key];
    const entry = byKey.get(key);
    if (!entry) throw new Error(`Missing licence entry for ${key}`);
    expect(path.at(-1)).toBe(entry.name);
    expect(reference).toBe(`${entry.name}@${entry.version}`);
    const file = installedManifest(path);
    if (file) {
      const manifest = JSON.parse(readFileSync(file, "utf8"));
      expect(manifest.name).toBe(entry.name);
      expect(manifest.version).toBe(entry.version);
      expect(manifest.license).toBe(entry.license);
    }
    for (const field of edges) {
      for (const name of Object.keys(metadata?.[field] ?? {})) {
        // Bun keys nested versions by the parent's path. Walk the package
        // scopes outwards before using the root resolution.
        let candidate: string[] | undefined;
        for (let depth = path.length; depth >= 0; depth--) {
          const resolution = [...path.slice(0, depth), name];
          if (Object.hasOwn(packages, resolution.join("/"))) {
            candidate = resolution;
            break;
          }
        }
        if (candidate) visit(candidate);
        else if (
          field !== "peerDependencies" ||
          !metadata?.optionalPeers?.includes(name)
        )
          throw new Error(`Unresolved dependency ${name} of ${key}`);
      }
    }
  }

  visit([barePackage]);
  expect([...seen].sort()).toEqual([...byKey.keys()].sort());
  expect(inventory).toHaveLength(seen.size);
  expect(
    inventory
      .filter(({ use }) => use === "distributed")
      .map(({ name }) => name),
  ).toEqual([barePackage]);
  expect(
    inventory.some(
      ({ name, license }) =>
        name.startsWith("@img/sharp-libvips-") && license.startsWith("LGPL-"),
    ),
  ).toBe(true);
});

test("the audited Manifold entry only loads its Node built-ins", () => {
  walkSyntax(fromManifold("manifold.js"), (node) => {
    if (
      ts.isImportDeclaration(node) ||
      ts.isImportEqualsDeclaration(node) ||
      (ts.isExportDeclaration(node) && node.moduleSpecifier)
    ) {
      throw new Error("Manifold added a static import");
    }
    if (
      ts.isCallExpression(node) &&
      node.expression.kind === ts.SyntaxKind.ImportKeyword
    ) {
      const specifier = node.arguments[0];
      if (!specifier || !ts.isStringLiteralLike(specifier))
        throw new Error("Manifold added a nonliteral dynamic import");
      expect(specifier.text).toBe("node:module");
    } else if (ts.isCallExpression(node) && isRequireCall(node)) {
      const specifier = node.arguments[0];
      if (!specifier || !ts.isStringLiteralLike(specifier))
        throw new Error("Manifold added a nonliteral require");
      expect(specifier.text).toMatch(/^node:(?:fs|path|url)$/);
    }
  });
});

test("the installed WASM matches the audited artifact", () => {
  const hash = createHash("sha256")
    .update(readFileSync(fromManifold("manifold.wasm")))
    .digest("hex");
  expect(hash).toBe(wasmSha256);
  expect(readFileSync(join(root, "THIRD_PARTY_NOTICES.md"), "utf8")).toContain(
    hash,
  );
});
