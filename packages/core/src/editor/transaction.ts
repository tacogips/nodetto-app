// The editor's transaction pipeline: which commands of a batch may run, and
// the derived commands (tokens, layout, constraints, diagram-specific
// carries) a batch implies. `Editor.apply` runs both as one history entry.

import {
  type ElementId,
  type FrameSemantic,
  UmlComponentType,
} from "@nodetto/ir";
import { planAspectRatios } from "../aspect-ratio.ts";
import { planAutoComponentRefresh } from "../auto-component-refresh.ts";
import { planAutoLayout } from "../auto-layout.ts";
import {
  planBpmnLaneLayout,
  planBpmnMembership,
  planBpmnTranslations,
} from "../bpmn/containment.ts";
import { planBreadboardTranslations } from "../breadboard/board-carry.ts";
import { planColorTokens } from "../color-tokens.ts";
import { applyCommands, type Command } from "../commands.ts";
import { planConstraints } from "../constraints.ts";
import { planFrameTranslations } from "../frame-translation.ts";
import { createShapeContext } from "../hit-test.ts";
import { planManualRoutePreservation } from "../manual-route-preservation.ts";
import { planNumberTokens } from "../number-tokens.ts";
import { planPcbTrackFollow } from "../pcb-board/follow.ts";
import type {
  RasterMaskSampler,
  ShapeContext,
  ShapeUtilRegistry,
} from "../shape-util.ts";
import { Store, type StoreDiff } from "../store.ts";
import { planTextResize } from "../text-layout.ts";
import { planTextStyles } from "../text-styles.ts";
import { planUmlPorts } from "../uml-ports.ts";

/**
 * Announced when undo/redo availability changes on its own — closing a batch
 * adds a history entry without touching an element, so a toolbar watching
 * only the store would show the previous edit's state.
 */
export const HISTORY_DIFF: StoreDiff = {
  added: [],
  updated: [],
  removed: [],
  pagesChanged: false,
};

/** The commands of a batch that do not edit a locked layer. */
export function permittedCommands(
  store: Store,
  context: ShapeContext,
  commands: readonly Command[],
): Command[] {
  return commands.flatMap((command): Command[] => {
    // Explicit layer state controls remain available to unlock a layer.
    if (
      command.type === "updateVisual" &&
      Object.keys(command.visual).every(
        (key) => key === "locked" || key === "hidden",
      )
    )
      return [command];
    if (command.type === "deleteElements")
      return [
        {
          ...command,
          ids: command.ids.filter((id) => !context.isLocked?.(id)),
        },
      ];
    if (
      "id" in command &&
      store.has(command.id) &&
      context.isLocked?.(command.id)
    )
      return [];
    return [command];
  });
}

export interface DerivedPlanInput {
  readonly store: Store;
  readonly registry: ShapeUtilRegistry;
  readonly context: ShapeContext;
  readonly permitted: readonly Command[];
  readonly placed: ReadonlySet<ElementId> | undefined;
  readonly rasterMaskSampler: RasterMaskSampler | undefined;
  readonly resolveAsset: (source: string) => string | undefined;
}

/** The derived commands that follow `permitted` in the same transaction. */
export function planDerivedCommands(input: DerivedPlanInput): Command[] {
  const { store, registry, context, permitted, placed } = input;
  let derived: Command[] = [];
  if (
    permitted.length &&
    (store
      .getSnapshot()
      .elements.some(
        (element) =>
          element.type === UmlComponentType.Port ||
          element.visual.colorTokens ||
          element.visual.numberTokens ||
          element.visual.textStyle ||
          element.visual.aspectRatio !== undefined ||
          element.visual.textResize === "auto-width" ||
          element.visual.textResize === "auto-height" ||
          (element.type === "frame" &&
            (element.semantic as { layout?: unknown }).layout),
      ) ||
      permitted.some(
        (command) =>
          command.type === "updateSemantic" ||
          command.type === "updateVisual" ||
          command.type === "replaceVisual" ||
          command.type === "deleteElements" ||
          command.type === "deletePage" ||
          command.type === "createElement",
      ))
  ) {
    const draft = new Store(store.getSnapshot());
    applyCommands(draft, permitted);
    derived = [
      ...planTextStyles(draft, registry),
      ...planColorTokens(draft, registry),
      ...planNumberTokens(draft, registry),
      ...planAutoComponentRefresh(draft, registry),
      ...planTextStyles(draft, registry),
      ...planColorTokens(draft, registry),
      ...planNumberTokens(draft, registry),
      ...planTextResize(draft, registry),
      ...planAspectRatios(draft, registry),
      ...planFrameTranslations(store, draft, registry, placed),
      ...planConstraints(store, draft, registry),
    ];
    if (
      store.listPages().some((page) => page.kind === "bpmn") ||
      draft.listPages().some((page) => page.kind === "bpmn") ||
      store
        .listElements()
        .some((element) => element.type.startsWith("bpmn.")) ||
      draft.listElements().some((element) => element.type.startsWith("bpmn."))
    ) {
      derived.push(...planBpmnLaneLayout(store, draft));
      derived.push(...planBpmnTranslations(store, draft));
      derived.push(...planBpmnMembership(store, draft));
    }
    if (
      store.listPages().some((page) => page.kind === "breadboard") ||
      draft.listPages().some((page) => page.kind === "breadboard") ||
      store
        .listElements()
        .some((element) => element.type.startsWith("breadboard.")) ||
      draft
        .listElements()
        .some((element) => element.type.startsWith("breadboard."))
    ) {
      derived.push(...planBreadboardTranslations(store, draft));
    }
    if (
      store.listPages().some((page) => page.kind === "pcb") ||
      draft.listPages().some((page) => page.kind === "pcb") ||
      store.listElements().some((element) => element.type.startsWith("pcb.")) ||
      draft.listElements().some((element) => element.type.startsWith("pcb."))
    ) {
      derived.push(...planPcbTrackFollow(store, draft));
    }
    const beforeLayout = new Store(draft.getSnapshot());
    derived.push(...planAutoLayout(draft, registry));
    const resizedText = planTextResize(draft, registry);
    derived.push(...resizedText);
    if (resizedText.length) derived.push(...planAutoLayout(draft, registry));
    const constrainedAspect = planAspectRatios(draft, registry);
    derived.push(...constrainedAspect);
    if (constrainedAspect.length)
      derived.push(...planAutoLayout(draft, registry));
    derived.push(
      ...planFrameTranslations(beforeLayout, draft, registry, placed),
    );
    derived.push(...planConstraints(beforeLayout, draft, registry));
    derived.push(...planUmlPorts(store, draft));
    derived.push(
      ...planManualRoutePreservation(store, draft, context, () =>
        createShapeContext(
          draft,
          registry,
          context.zoom,
          input.rasterMaskSampler,
          input.resolveAsset,
        ),
      ),
    );
  }
  return derived;
}

/**
 * Derived colors/layout recomputed from merged state, or `null` when the
 * document has nothing derived to recompute.
 */
export function planReconciliation(
  store: Store,
  registry: ShapeUtilRegistry,
): Command[] | null {
  if (
    !store
      .getSnapshot()
      .elements.some(
        (element) =>
          element.type === UmlComponentType.Port ||
          element.visual.colorTokens ||
          element.visual.numberTokens ||
          element.visual.textStyle ||
          element.visual.aspectRatio !== undefined ||
          element.visual.textResize === "auto-width" ||
          element.visual.textResize === "auto-height" ||
          (element.type === "frame" &&
            (element.semantic as FrameSemantic).layout),
      )
  )
    return null;
  const before = new Store(store.getSnapshot());
  const draft = new Store(before.getSnapshot());
  const commands = planTextStyles(draft, registry);
  commands.push(...planColorTokens(draft, registry));
  commands.push(...planNumberTokens(draft, registry));
  commands.push(...planTextResize(draft, registry));
  commands.push(...planAspectRatios(draft, registry));
  commands.push(...planAutoLayout(draft, registry));
  const resizedText = planTextResize(draft, registry);
  commands.push(...resizedText);
  if (resizedText.length) commands.push(...planAutoLayout(draft, registry));
  const constrainedAspect = planAspectRatios(draft, registry);
  commands.push(...constrainedAspect);
  if (constrainedAspect.length)
    commands.push(...planAutoLayout(draft, registry));
  commands.push(...planFrameTranslations(before, draft, registry));
  commands.push(...planConstraints(before, draft, registry));
  commands.push(...planUmlPorts(before, draft));
  return commands;
}
