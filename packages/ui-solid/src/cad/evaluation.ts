import {
  type CadDisplayBody,
  type CadEngine,
  type CadEngineInput,
  type CadEngineResult,
  CadSupersededError,
} from "@nodetto/core";
import { isCadTypeName, type PageId } from "@nodetto/ir";
import { type Accessor, createEffect, createSignal, onCleanup } from "solid-js";
import type { cadStatusStoreFor } from "./status-store.ts";

/**
 * Evaluates the page's CAD history whenever its records change, and
 * publishes the display bodies, the per-feature statuses and a failure line.
 */
export function createCadEvaluation(options: {
  readonly engine: Accessor<CadEngine | undefined>;
  readonly pageId: PageId;
  readonly revision: Accessor<number>;
  readonly collected: Accessor<CadEngineInput>;
  readonly statusStore: ReturnType<typeof cadStatusStoreFor>;
}): {
  readonly bodies: Accessor<readonly CadDisplayBody[]>;
  readonly failure: Accessor<string | undefined>;
} {
  const { pageId, statusStore } = options;
  const [bodies, setBodies] = createSignal<readonly CadDisplayBody[]>([]);
  const [failure, setFailure] = createSignal<string>();
  let previous: { engine: CadEngine; input: CadEngineInput } | undefined;

  createEffect(() => {
    const version = options.revision();
    const engine = options.engine();
    if (!engine) {
      previous = undefined;
      statusStore.clear(pageId);
      return;
    }
    // The editor snapshot contains plain IR records. Compare the collected
    // records so neither unrelated pages nor shared carriers trigger CAD work,
    // and any foreign records collected by the engine participate too.
    const source = options.collected();
    const input = {
      ...source,
      elements: source.elements.filter(
        ({ page, type }) => page !== pageId || isCadTypeName(type),
      ),
    };
    if (
      previous?.engine === engine &&
      previous.input.elements.length === input.elements.length &&
      input.elements.every(
        (element, i) => element === previous?.input.elements[i],
      )
    )
      return;

    const request = { engine, input };
    previous = request;
    const publishFailure = (
      code: string,
      statuses: CadEngineResult["status"] = [],
    ): void => {
      const known = new Map(statuses);
      const failed = { ok: false, code } as const;
      statusStore.set(
        pageId,
        input.elements.flatMap(({ id, page }) => {
          if (page !== pageId) return [];
          const status = known.get(id);
          return [[id, status && !status.ok ? status : failed] as const];
        }),
      );
    };
    const evaluate = async (): Promise<void> => {
      try {
        const result = await engine.evaluate(input);
        if (previous !== request || result.revision !== version) return;
        if (result.failure) {
          setFailure(`CAD evaluation failed (${result.failure}).`);
          publishFailure(result.failure, result.status);
          return;
        }
        const failed = result.status.find(([, status]) => !status.ok)?.[1];
        setFailure(
          failed && !failed.ok
            ? `CAD feature failed (${failed.code}).`
            : undefined,
        );
        setBodies(result.bodies);
        statusStore.set(pageId, result.status);
      } catch (error) {
        if (previous !== request || error instanceof CadSupersededError) return;
        setFailure("CAD evaluation failed.");
        publishFailure("cad.kernel.failed");
      }
    };
    void evaluate();
  });
  onCleanup(() => {
    previous = undefined;
    statusStore.clear(pageId);
  });

  return { bodies, failure };
}
