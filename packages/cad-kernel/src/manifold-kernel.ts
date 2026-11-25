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

interface ManifoldMeshBuffers {
  readonly numProp: number;
  readonly vertProperties: Float32Array;
  readonly triVerts: Uint32Array;
  readonly runIndex: Uint32Array;
  readonly runOriginalID: Uint32Array;
  readonly faceID: Uint32Array;
}

export function readManifoldMesh(
  mesh: ManifoldMeshBuffers,
  namesOf: (original: number) => readonly string[] | undefined,
): KernelMesh {
  const invalid = (detail: string): never => {
    throw new Error(`Invalid Manifold mesh data: ${detail}`);
  };
  const at = (
    array: Float32Array | Uint32Array,
    index: number,
    field: string,
  ): number => {
    const value = array[index];
    return value === undefined
      ? invalid(`missing ${field} at ${index}`)
      : value;
  };
  if (
    !Number.isInteger(mesh.numProp) ||
    mesh.numProp < 3 ||
    mesh.vertProperties.length % mesh.numProp !== 0
  )
    invalid("invalid vertex properties");
  if (mesh.triVerts.length % 3 !== 0) invalid("invalid triangle indices");
  for (const vertex of mesh.triVerts) {
    if (vertex >= mesh.vertProperties.length / mesh.numProp)
      invalid("vertex index out of bounds");
  }
  if (mesh.triVerts.length > 0) {
    if (
      mesh.runIndex.length !== mesh.runOriginalID.length + 1 ||
      mesh.runIndex[0] !== 0 ||
      mesh.runIndex[mesh.runIndex.length - 1] !== mesh.triVerts.length ||
      mesh.faceID.length !== mesh.triVerts.length / 3
    )
      invalid("invalid run coverage");
    let previous = 0;
    for (const index of mesh.runIndex) {
      if (index % 3 !== 0 || index < previous) invalid("invalid run boundary");
      previous = index;
    }
  }
  const faceNames: string[] = [];
  const faceIndices = new Map<string, number>();
  const triFace = new Uint32Array(mesh.triVerts.length / 3);
  if (mesh.triVerts.length > 0) {
    for (let run = 0; run < mesh.runOriginalID.length; run++) {
      const start = at(mesh.runIndex, run, "runIndex") / 3;
      const end = at(mesh.runIndex, run + 1, "runIndex") / 3;
      if (start === end) continue;
      const original = at(mesh.runOriginalID, run, "runOriginalID");
      const names = namesOf(original);
      for (let triangle = start; triangle < end; triangle++) {
        const faceId = at(mesh.faceID, triangle, "faceID");
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
  }
  let positions = mesh.vertProperties;
  if (mesh.numProp !== 3) {
    positions = new Float32Array(
      (mesh.vertProperties.length / mesh.numProp) * 3,
    );
    for (let vertex = 0; vertex < positions.length / 3; vertex++) {
      const offset = vertex * mesh.numProp;
      positions[vertex * 3] = at(mesh.vertProperties, offset, "vertProperties");
      positions[vertex * 3 + 1] = at(
        mesh.vertProperties,
        offset + 1,
        "vertProperties",
      );
      positions[vertex * 3 + 2] = at(
        mesh.vertProperties,
        offset + 2,
        "vertProperties",
      );
    }
  }
  return { positions, triangles: mesh.triVerts, triFace, faceNames };
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
      return readManifoldMesh(
        get(handle).solid.getMesh(),
        (original) => sources.get(original)?.names,
      );
    },
    measure(handle) {
      const { solid } = get(handle);
      const volume = solid.volume();
      const area = solid.surfaceArea();
      return {
        volume,
        area,
        // A face-only intersection can have triangles and a rounding
        // residue for volume. Compare its thickness to half the 1 nm grid.
        empty:
          solid.isEmpty() || volume === 0 || 2 * Math.abs(volume) < area * 5e-7,
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
