import type { CadKernel, KernelHandle, KernelMesh } from "@nodetto/core";
import createModule, {
  type ExecutionContext as ManifoldContext,
  type Manifold as ManifoldSolid,
} from "manifold-3d";

interface FaceSource {
  readonly original: number;
  readonly names: readonly string[];
  references: number;
}

interface OwnedSolid {
  readonly solid: ManifoldSolid;
  readonly sources: ReadonlySet<FaceSource>;
}

export async function createManifoldKernel(options?: {
  wasmUrl?: string;
}): Promise<CadKernel> {
  const wasmUrl = options?.wasmUrl;
  const module = await createModule(
    wasmUrl === undefined ? undefined : { locateFile: () => wasmUrl },
  );
  module.setup();
  const { Manifold, Mesh } = module;
  // The pinned bindings expose this constructor but omit it from their types.
  if (
    !("ExecutionContext" in module) ||
    typeof module.ExecutionContext !== "function"
  ) {
    throw new Error("Manifold did not expose ExecutionContext");
  }
  const ExecutionContext = module.ExecutionContext as new () => ManifoldContext;
  const solids = new Map<KernelHandle, OwnedSolid>();
  const sources = new Map<number, FaceSource>();
  let nextHandle = 1;

  function get(handle: KernelHandle): OwnedSolid {
    const entry = solids.get(handle);
    if (!entry) throw new Error(`Unknown CAD kernel handle ${handle}`);
    return entry;
  }

  function retain(entry: OwnedSolid): KernelHandle {
    const handle = nextHandle++;
    for (const source of entry.sources) source.references++;
    solids.set(handle, entry);
    return handle;
  }

  function checkStatus(solid: ManifoldSolid): void {
    try {
      const status = solid.status();
      if (status !== "NoError") throw new Error(`Manifold: ${status}`);
    } catch (error) {
      solid.delete();
      throw error;
    }
  }

  return {
    id: "manifold-3d@3.5.5",
    solid(mesh) {
      const original = Manifold.reserveIDs(1);
      const input = new Mesh({
        numProp: 3,
        vertProperties: new Float32Array(mesh.positions),
        triVerts: mesh.triangles,
        faceID: mesh.triFace,
        runIndex: Uint32Array.of(0, mesh.triangles.length),
        runOriginalID: Uint32Array.of(original),
      });
      // The convenience constructor throws before the caller can free an
      // invalid solid. This factory returns the handle for status checking.
      const context = new ExecutionContext();
      let solid: ManifoldSolid;
      try {
        solid = context.fromMesh(input);
      } finally {
        context.delete();
      }
      checkStatus(solid);
      const source = { original, names: [...mesh.faceNames], references: 0 };
      sources.set(original, source);
      return retain({ solid, sources: new Set([source]) });
    },
    boolean(op, target, tools) {
      const base = get(target);
      const operands = tools.map((handle) => get(handle));
      const toolSolids = operands.map(({ solid }) => solid);
      // Manifold also keeps runs for originals that contribute zero triangles.
      const originals = new Set(base.sources);
      for (const operand of operands) {
        for (const source of operand.sources) originals.add(source);
      }

      let solid: ManifoldSolid;
      if (op === "add") {
        solid = Manifold.union([base.solid, ...toolSolids]);
      } else {
        const combined = Manifold.union(toolSolids);
        try {
          solid =
            op === "cut"
              ? Manifold.difference(base.solid, combined)
              : Manifold.intersection([base.solid, combined]);
        } finally {
          combined.delete();
        }
      }
      checkStatus(solid);
      return retain({ solid, sources: originals });
    },
    mesh(handle): KernelMesh {
      const mesh = get(handle).solid.getMesh();
      const faceNames: string[] = [];
      const faceIndices = new Map<string, number>();
      const triFace = new Uint32Array(mesh.triVerts.length / 3);
      for (let run = 0; run < mesh.runOriginalID.length; run++) {
        const start = mesh.runIndex[run] / 3;
        const end = mesh.runIndex[run + 1] / 3;
        if (start === end) continue;
        const original = mesh.runOriginalID[run];
        const names = sources.get(original)?.names;
        for (let triangle = start; triangle < end; triangle++) {
          const faceId = mesh.faceID[triangle];
          const name = names?.[faceId];
          if (name === undefined)
            throw new Error(`Missing Manifold face ${original}/${faceId}`);
          let index = faceIndices.get(name);
          if (index === undefined) {
            index = faceNames.length;
            faceIndices.set(name, index);
            faceNames.push(name);
          }
          triFace[triangle] = index;
        }
      }

      let positions = mesh.vertProperties;
      if (mesh.numProp !== 3) {
        positions = new Float32Array(
          (mesh.vertProperties.length / mesh.numProp) * 3,
        );
        for (let vertex = 0; vertex < positions.length / 3; vertex++) {
          const offset = vertex * mesh.numProp;
          positions[vertex * 3] = mesh.vertProperties[offset];
          positions[vertex * 3 + 1] = mesh.vertProperties[offset + 1];
          positions[vertex * 3 + 2] = mesh.vertProperties[offset + 2];
        }
      }
      return { positions, triangles: mesh.triVerts, triFace, faceNames };
    },
    measure(handle) {
      const { solid } = get(handle);
      const volume = solid.volume();
      return {
        volume,
        area: solid.surfaceArea(),
        // A face-only intersection can have triangles but no solid volume.
        empty: volume === 0 || solid.isEmpty(),
        triangles: solid.numTri(),
      };
    },
    release(handle) {
      const entry = get(handle);
      entry.solid.delete();
      solids.delete(handle);
      for (const source of entry.sources) {
        if (--source.references === 0) sources.delete(source.original);
      }
    },
  };
}
