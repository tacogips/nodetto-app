// Component instances and responsive variants: the command plans behind
// placing, rebuilding and re-flowing a copy of a source artboard. Each plan
// is pure; the editor applies it as one undo step and fixes the selection.

import type {
  Document,
  Element,
  ElementId,
  FrameSemantic,
  Visual,
} from "@nodetto/ir";
import {
  copyElements,
  copyElementsInDocument,
  planPaste,
} from "../clipboard.ts";
import { applyCommands, type Command } from "../commands.ts";
import {
  componentBindings,
  planComponentRefresh,
} from "../component-refresh.ts";
import { localComponentLayers } from "../component-local.ts";
import { planConstraints } from "../constraints.ts";
import type { Editor } from "../editor.ts";
import { expandContainers } from "../frame-tree.ts";
import { rotatedBox, type Vec } from "../geometry.ts";
import type { IdSource } from "../ids.ts";
import { FRAME_PRESETS, type FramePresetKey } from "../shapes/frame.ts";
import { Store } from "../store.ts";
import { carryVariantOverrides, variantReuse } from "../variant-reuse.ts";

/** A throwaway editor over `document`, for staging a plan off the record. */
export type StageEditor = (document: Document) => Editor;

/** Keep breakpoint-owned geometry/state while adopting refreshed source paint. */
function responsiveVisual(existing: Element, inherited: Element): Visual {
  const {
    style,
    colorTokens,
    numberTokens,
    textStyle,
    componentKey,
    ...sourceRest
  } = inherited.visual;
  const {
    style: _style,
    colorTokens: _colors,
    numberTokens: _numbers,
    textStyle: _textStyle,
    componentKey: _componentKey,
    ...targetRest
  } = existing.visual;
  return {
    ...sourceRest,
    ...targetRest,
    ...(style ? { style } : {}),
    ...(colorTokens ? { colorTokens } : {}),
    ...(numberTokens ? { numberTokens } : {}),
    ...(textStyle ? { textStyle } : {}),
    ...(componentKey ? { componentKey } : {}),
  };
}

/** Paste a component source as a new instance bound to it. */
export function planComponentInstance(
  editor: Editor,
  idSource: IdSource,
  id: ElementId,
  at: Vec | undefined,
): { readonly instanceId: ElementId; readonly commands: Command[] } | null {
  const source = editor.store.get(id);
  if (
    !source ||
    source.type !== "frame" ||
    !(source.semantic as FrameSemantic).component
  )
    return null;
  const payload = copyElements(
    editor.store,
    expandContainers(editor.store, [id], editor.createShapeContext()),
    {
      preserveColorTokens: true,
      preserveNumberTokens: true,
      preserveTextStyles: true,
    },
  );
  const plan = planPaste(payload, {
    page: editor.currentPageId,
    idSource,
    nextIndex: () => editor.nextIndex(),
    offset: at
      ? { x: at.x - (source.visual.x ?? 0), y: at.y - (source.visual.y ?? 0) }
      : { x: (editor.getBounds(id)?.width ?? 200) + 40, y: 0 },
  });
  const instanceId = plan.mapping.get(id);
  if (!instanceId) return null;
  const commands = plan.commands.map((command): Command => {
    if (command.type !== "createElement" || command.element.id !== instanceId)
      return command;
    const {
      component: _component,
      instanceOf: _instance,
      instanceBindings: _bindings,
      ...semantic
    } = command.element.semantic as FrameSemantic;
    return {
      ...command,
      element: {
        ...command.element,
        semantic: {
          ...semantic,
          instanceOf: id,
          instanceBindings: componentBindings(editor, plan.mapping),
        },
      },
    };
  });
  return { instanceId, commands };
}

export function planRebuildComponentInstance(
  editor: Editor,
  idSource: IdSource,
  id: ElementId,
  sourceId: ElementId,
  preserveOverrides = false,
  preserveLocal = false,
): Command[] | null {
  const instance = editor.store.get(id);
  if (!instance || instance.type !== "frame") return null;
  const source = sourceId ? editor.store.get(sourceId) : undefined;
  if (
    !source ||
    source.type !== "frame" ||
    !(source.semantic as FrameSemantic).component
  )
    return null;
  const context = editor.createShapeContext();
  const oldIds = expandContainers(editor.store, [id], context);
  if (
    oldIds.some((child) => context.isLocked?.(child)) ||
    oldIds.includes(source.id) ||
    expandContainers(editor.store, [source.id], context).includes(id)
  )
    return null;
  const payload = copyElements(
    editor.store,
    expandContainers(editor.store, [source.id], context),
    {
      preserveColorTokens: true,
      preserveNumberTokens: true,
      preserveTextStyles: true,
    },
  );
  const reuse = preserveOverrides
    ? variantReuse(editor, instance, source, payload.elements)
    : new Map([[source.id, id]]);
  if (!reuse) return null;
  let at = 0;
  const plan = planPaste(payload, {
    page: instance.page,
    idSource: () => reuse.get(payload.elements[at++]?.id ?? "") ?? idSource(),
    nextIndex: () => editor.nextIndex(instance.page),
    offset: {
      x: (instance.visual.x ?? 0) - (source.visual.x ?? 0),
      y: (instance.visual.y ?? 0) - (source.visual.y ?? 0),
    },
  });
  const kept = new Set(reuse.values());
  const additions = preserveLocal
    ? localComponentLayers(editor, instance, oldIds, kept)
    : null;
  for (const local of additions?.local ?? []) kept.add(local);
  const commands: Command[] = [];
  for (const planned of plan.commands) {
    if (planned.type !== "createElement") {
      commands.push(planned);
      continue;
    }
    const inherited =
      preserveOverrides && kept.has(planned.element.id)
        ? carryVariantOverrides(editor, id, planned.element)
        : planned.element;
    const element = additions?.attach(inherited) ?? inherited;
    if (!kept.has(element.id)) {
      commands.push({ type: "createElement", element });
      continue;
    }
    if (element.id !== id) {
      commands.push(
        {
          type: "updateSemantic",
          id: element.id,
          semantic: element.semantic,
        },
        { type: "replaceVisual", id: element.id, visual: element.visual },
        { type: "reorder", id: element.id, index: element.index },
      );
      continue;
    }
    const {
      component: _component,
      instanceOf: _old,
      instanceBindings: _bindings,
      ...semantic
    } = element.semantic as FrameSemantic;
    commands.push(
      {
        type: "updateSemantic",
        id,
        semantic: {
          ...semantic,
          instanceOf: source.id,
          ...((instance.semantic as FrameSemantic).autoRefresh === undefined
            ? {}
            : {
                autoRefresh: (instance.semantic as FrameSemantic).autoRefresh,
              }),
          instanceBindings: componentBindings(editor, plan.mapping),
        },
      },
      { type: "replaceVisual", id, visual: element.visual },
    );
  }
  commands.push({
    type: "deleteElements",
    ids: oldIds.filter((child) => !kept.has(child)),
  });
  return commands;
}

/**
 * Reconcile a responsive copy's membership with its source while keeping
 * breakpoint-owned geometry. The refresh is staged in a throwaway editor so
 * the reuse mapping sees the source's current content.
 */
export function planRebuildResponsiveVariant(
  editor: Editor,
  idSource: IdSource,
  stage: StageEditor,
  id: ElementId,
  sourceId: ElementId,
): Command[] | null {
  const instance = editor.store.get(id);
  const source = editor.store.get(sourceId);
  if (
    !instance ||
    instance.type !== "frame" ||
    !source ||
    source.type !== "frame"
  )
    return null;
  const context = editor.createShapeContext();
  const oldIds = expandContainers(editor.store, [id], context);
  if (
    oldIds.some((child) => context.isLocked?.(child)) ||
    oldIds.includes(source.id) ||
    expandContainers(editor.store, [source.id], context).includes(id)
  )
    return null;

  const refresh = planComponentRefresh(editor, id);
  if (!refresh) return null;
  const staged = stage(editor.getSnapshot());
  applyCommands(staged.store, refresh);
  const stagedInstance = staged.store.get(id);
  const stagedSource = staged.store.get(sourceId);
  if (!stagedInstance || !stagedSource) return null;

  const payload = copyElements(
    staged.store,
    expandContainers(staged.store, [sourceId], staged.createShapeContext()),
    {
      preserveColorTokens: true,
      preserveNumberTokens: true,
      preserveTextStyles: true,
    },
  );
  const reuse = variantReuse(
    staged,
    stagedInstance,
    stagedSource,
    payload.elements,
  );
  if (!reuse) return null;
  let at = 0;
  const plan = planPaste(payload, {
    page: instance.page,
    idSource: () => reuse.get(payload.elements[at++]?.id ?? "") ?? idSource(),
    nextIndex: () => editor.nextIndex(instance.page),
    offset: {
      x: (instance.visual.x ?? 0) - (source.visual.x ?? 0),
      y: (instance.visual.y ?? 0) - (source.visual.y ?? 0),
    },
  });
  const kept = new Set(reuse.values());
  const additions = localComponentLayers(staged, stagedInstance, oldIds, kept);
  for (const local of additions.local) kept.add(local);
  const bindings = componentBindings(staged, plan.mapping);
  const commands: Command[] = [];
  const sourceSized: Command[] = [];
  const added = new Set<ElementId>();

  for (const planned of plan.commands) {
    if (planned.type !== "createElement") continue;
    const raw = additions.attach(planned.element);
    const inherited = kept.has(raw.id)
      ? carryVariantOverrides(staged, id, raw)
      : raw;
    const element = additions.attach(inherited);
    const existing = staged.store.get(element.id);
    if (!existing || !kept.has(element.id)) {
      commands.push({ type: "createElement", element });
      sourceSized.push({ type: "createElement", element: raw });
      added.add(element.id);
      continue;
    }

    let semantic = element.semantic;
    if (element.id === id) {
      const fresh = element.semantic as FrameSemantic;
      const current = existing.semantic as FrameSemantic;
      const {
        memberIds: _members,
        component: _component,
        instanceOf: _instanceOf,
        responsiveSource: _responsiveSource,
        instanceBindings: _instanceBindings,
        ...breakpoint
      } = current;
      semantic = {
        ...fresh,
        ...breakpoint,
        memberIds: fresh.memberIds,
        responsiveSource: sourceId,
        instanceBindings: bindings,
      };
    }
    commands.push(
      { type: "updateSemantic", id: element.id, semantic },
      {
        type: "replaceVisual",
        id: element.id,
        visual: responsiveVisual(existing, element),
      },
      { type: "reorder", id: element.id, index: element.index },
    );
    sourceSized.push(
      { type: "updateSemantic", id: raw.id, semantic: raw.semantic },
      { type: "replaceVisual", id: raw.id, visual: raw.visual },
      { type: "reorder", id: raw.id, index: raw.index },
    );
  }

  const removed = oldIds.filter((child) => !kept.has(child));
  commands.push({ type: "deleteElements", ids: removed });
  sourceSized.push({ type: "deleteElements", ids: removed });
  const beforeResize = new Store(editor.getSnapshot());
  applyCommands(beforeResize, sourceSized);
  const afterResize = new Store(editor.getSnapshot());
  applyCommands(afterResize, commands);
  const constraints = planConstraints(
    beforeResize,
    afterResize,
    editor.registry,
    added,
  );
  return [...commands, ...constraints];
}

/**
 * Clone one complete artboard beside its source at a preset size. Shared
 * design resources remain linked because this is an in-document responsive
 * variant, not a portable clipboard fragment.
 */
export function planResponsiveVariant(
  editor: Editor,
  idSource: IdSource,
  id: ElementId,
  presetKey: FramePresetKey,
): { readonly createdId: ElementId; readonly commands: Command[] } | null {
  const source = editor.store.get(id);
  const sourceBounds = editor.getBounds(id);
  const context = editor.createShapeContext();
  const sourceSemantic =
    source?.type === "frame" ? (source.semantic as FrameSemantic) : undefined;
  if (
    !source ||
    source.type !== "frame" ||
    !sourceSemantic ||
    !sourceBounds ||
    context.isLocked?.(id) ||
    sourceSemantic?.component ||
    sourceSemantic?.instanceOf
  )
    return null;
  const preset = FRAME_PRESETS[presetKey];
  const payload = copyElementsInDocument(
    editor.store,
    expandContainers(editor.store, [id], context),
  );
  const copiedIds = new Set(payload.elements.map((element) => element.id));
  const sourceEnvelope = rotatedBox(sourceBounds, source.visual.rotation ?? 0);
  const targetEnvelope = rotatedBox(
    { x: 0, y: sourceBounds.y, width: preset.width, height: preset.height },
    source.visual.rotation ?? 0,
  );
  let targetX = sourceEnvelope.x + sourceEnvelope.width + 80 - targetEnvelope.x;
  // Reserve existing screens, including hidden/locked ones. Sweep right in
  // geometric order so repeat variants do not stack at the same position.
  const obstacles = editor.store
    .getPageElements(source.page)
    .flatMap((element) => {
      if (element.type !== "frame" || copiedIds.has(element.id)) return [];
      const box = editor.getBounds(element.id, context);
      return box ? [rotatedBox(box, element.visual.rotation ?? 0)] : [];
    })
    .filter(
      (box) =>
        box.y < targetEnvelope.y + targetEnvelope.height &&
        box.y + box.height > targetEnvelope.y,
    )
    .sort((a, b) => a.x - b.x);
  for (const box of obstacles) {
    const left = targetX + targetEnvelope.x;
    if (
      left < box.x + box.width + 80 &&
      left + targetEnvelope.width + 80 > box.x
    )
      targetX = box.x + box.width + 80 - targetEnvelope.x;
  }
  if (!Number.isFinite(targetX)) return null;
  const plan = planPaste(payload, {
    page: source.page,
    idSource,
    nextIndex: () => editor.nextIndex(source.page),
    offset: { x: targetX - sourceBounds.x, y: 0 },
  });
  const createdId = plan.mapping.get(id);
  if (!createdId) return null;
  const created = plan.commands.flatMap((command) =>
    command.type === "createElement" && command.element.id === createdId
      ? [command.element]
      : [],
  )[0];
  if (!created) return null;
  const current = created.semantic as FrameSemantic;
  const {
    platform: _platform,
    safeArea: _safeArea,
    responsiveSource: _responsiveSource,
    instanceBindings: _instanceBindings,
    ...rest
  } = current;
  const semantic: FrameSemantic = {
    ...rest,
    name: `${sourceSemantic.name} — ${preset.name}`,
    platform: preset.platform,
    responsiveSource: id,
    instanceBindings: componentBindings(editor, plan.mapping),
    ...("safeArea" in preset ? { safeArea: preset.safeArea } : {}),
  };

  const retainedNumberTokens = Object.fromEntries(
    Object.entries(created.visual.numberTokens ?? {}).filter(
      ([field]) => field !== "width" && field !== "height",
    ),
  );
  const { numberTokens: _numberTokens, ...createdVisual } = created.visual;
  const resizeCommand: Command = {
    type: "replaceVisual",
    id: createdId,
    visual: {
      ...createdVisual,
      x: targetX,
      y: sourceBounds.y,
      width: preset.width,
      height: preset.height,
      ...(Object.keys(retainedNumberTokens).length
        ? { numberTokens: retainedNumberTokens }
        : {}),
    },
  };
  const semanticCommand: Command = {
    type: "updateSemantic",
    id: createdId,
    semantic,
  };
  // The normal apply pipeline cannot derive constraints for elements that
  // did not exist in its before-snapshot. Stage just this new hierarchy at
  // source size, resize it in a second temporary store, and append those
  // constraint commands to the one real transaction.
  const beforeResize = new Store(editor.store.getSnapshot());
  applyCommands(beforeResize, [...plan.commands, semanticCommand]);
  const afterResize = new Store(beforeResize.getSnapshot());
  applyCommands(afterResize, [resizeCommand]);
  const responsiveConstraints = planConstraints(
    beforeResize,
    afterResize,
    editor.registry,
  );
  return {
    createdId,
    commands: [
      ...plan.commands,
      semanticCommand,
      resizeCommand,
      ...responsiveConstraints,
    ],
  };
}
