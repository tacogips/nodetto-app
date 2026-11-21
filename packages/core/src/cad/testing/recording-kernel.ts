import type {
  CadKernel,
  KernelHandle,
  KernelMesh,
  ToolMesh,
} from "../kernel.ts";

type BooleanOp = Parameters<CadKernel["boolean"]>[0];

type Call =
  | {
      readonly kind: "solid";
      readonly handle: KernelHandle;
      readonly mesh: ToolMesh;
    }
  | {
      readonly kind: "boolean";
      readonly op: BooleanOp;
      readonly target: KernelHandle;
      readonly tools: readonly KernelHandle[];
    }
  | {
      readonly kind: "mesh" | "measure" | "release";
      readonly handle: KernelHandle;
    };

interface RecordedSolid {
  readonly mesh: ToolMesh;
  readonly empty: boolean;
  readonly triangles: number;
}

interface Options {
  readonly triangles?: number;
  readonly booleanResult?: (
    op: BooleanOp,
    target: KernelHandle,
  ) => Partial<Pick<RecordedSolid, "empty" | "triangles">>;
  readonly beforeMeasure?: (handle: KernelHandle) => void;
}

export class RecordingKernel implements CadKernel {
  readonly id = "recording";
  readonly calls: Call[] = [];
  private readonly live = new Map<KernelHandle, RecordedSolid>();
  private next = 0;

  constructor(private readonly options: Options = {}) {}

  isLive(handle: KernelHandle): boolean {
    return this.live.has(handle);
  }

  private get(handle: KernelHandle): RecordedSolid {
    const solid = this.live.get(handle);
    if (!solid) throw new Error(`Unknown solid ${handle}`);
    return solid;
  }

  private remember(value: RecordedSolid): KernelHandle {
    this.next += 1;
    this.live.set(this.next, value);
    return this.next;
  }

  solid(mesh: ToolMesh): KernelHandle {
    const handle = this.remember({
      mesh,
      empty: false,
      triangles: this.options.triangles ?? mesh.triangles.length / 3,
    });
    this.calls.push({ kind: "solid", handle, mesh });
    return handle;
  }

  boolean(
    op: BooleanOp,
    target: KernelHandle,
    tools: readonly KernelHandle[],
  ): KernelHandle {
    const solid = this.get(target);
    for (const handle of tools) this.get(handle);
    this.calls.push({ kind: "boolean", op, target, tools: [...tools] });
    return this.remember({
      ...solid,
      ...this.options.booleanResult?.(op, target),
    });
  }

  mesh(handle: KernelHandle): KernelMesh {
    const { mesh } = this.get(handle);
    this.calls.push({ kind: "mesh", handle });
    return { ...mesh, positions: Float32Array.from(mesh.positions) };
  }

  measure(handle: KernelHandle): ReturnType<CadKernel["measure"]> {
    this.calls.push({ kind: "measure", handle });
    this.options.beforeMeasure?.(handle);
    const { triangles, empty } = this.get(handle);
    return { volume: empty ? 0 : 1, area: empty ? 0 : 1, empty, triangles };
  }

  release(handle: KernelHandle): void {
    this.get(handle);
    this.live.delete(handle);
    this.calls.push({ kind: "release", handle });
  }
}
