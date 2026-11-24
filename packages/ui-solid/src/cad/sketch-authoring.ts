import {
  buildLoops,
  type CadFrame,
  type CadIds,
  CommandError,
  compareCadHistoryOrder,
  type Editor,
  isFractionalKey,
  keyAfter,
  keyBetween,
  newElementId,
  parseFaceName,
  sketchCommands,
  sketchFrameLookup,
  sketchFrameOf,
  sketchParentOf,
  toWorld,
  type ViewportSize,
} from "@nodetto/core";
import type { CadPlane, Element, ElementId, PageId } from "@nodetto/ir";
import {
  type Accessor,
  createEffect,
  createMemo,
  createSignal,
  untrack,
} from "solid-js";
import { Tool, type ToolKind } from "../tools.ts";
import {
  alignToFrame,
  type Camera3d,
  cameraViewHeight,
  screenRay,
} from "./camera3d.ts";
import type { CadPick } from "./pick.ts";
import type { CadRenderer } from "./renderer.ts";
import {
  isSketchTool,
  type SketchState,
  sketchCommitCommands,
  sketchStep,
} from "./sketch-interaction.ts";
import {
  sketchGeometry,
  sketchGridSegments,
  sketchOverlaySegments,
  sketchPreview,
} from "./sketch-overlay.ts";
import {
  intersectSketch,
  sketchCoordinates,
  snapSketchPoint,
} from "./sketch-snap.ts";

const EMPTY_LINES = new Float32Array();

export function cadAuthoringIds(elements: readonly Element[]): CadIds {
  const indexes = elements.map(({ index }) => index).sort();
  return {
    next: newElementId,
    indexAfter(previous) {
      const before = previous ?? null;
      const after = indexes.find((index) => before === null || index > before);
      return after &&
        isFractionalKey(after) &&
        (before === null || isFractionalKey(before))
        ? keyBetween(before, after)
        : keyAfter(before);
    },
    lastEntityIndex(sketch) {
      return elements
        .filter((element) => sketchParentOf(element) === sketch.id)
        .sort(compareCadHistoryOrder)
        .at(-1)?.index;
    },
  };
}

/** The highest fractional index on a page: new history goes after it. */
export function lastElementIndex(
  elements: readonly Element[],
): string | undefined {
  return elements.reduce<string | undefined>(
    (last, { index }) => (last === undefined || last < index ? index : last),
    undefined,
  );
}

export interface SketchViewportPoint {
  readonly x: number;
  readonly y: number;
  readonly width: number;
  readonly height: number;
}

export function createSketchAuthoring(options: {
  readonly editor: Editor;
  readonly pageId: PageId;
  readonly revision: Accessor<number>;
  readonly selection: Accessor<ReadonlySet<ElementId>>;
  readonly tool: Accessor<ToolKind>;
  readonly selectTool: () => void;
  readonly focus: () => void;
  readonly picked: Accessor<CadPick | null>;
  readonly geometryElements: Accessor<readonly Element[]>;
  readonly camera: Accessor<Camera3d>;
  readonly changeCamera: (camera: Camera3d) => void;
  readonly size: Accessor<ViewportSize>;
  readonly renderer: Accessor<CadRenderer | null>;
}) {
  const { editor, pageId, tool, selection, camera, changeCamera, renderer } =
    options;
  const [gesture, setGesture] = createSignal<SketchState>();
  const [notice, setNotice] = createSignal<string>();
  const elements = createMemo(() => {
    options.revision();
    return editor.store.getPageElements(pageId);
  });
  const frameOf = createMemo(() =>
    sketchFrameLookup(options.geometryElements()),
  );
  const sketchId = createMemo(() => {
    options.revision();
    const ids = selection();
    if (ids.size !== 1) return;
    const [id] = ids;
    const element = editor.store.get(id);
    if (element?.page === pageId)
      return element.type === "cad.sketch" ? id : sketchParentOf(element);
  });
  const sketch = () => {
    options.revision();
    const id = sketchId();
    const element = id === undefined ? undefined : editor.store.get(id);
    return element?.type === "cad.sketch" && element.page === pageId
      ? element
      : undefined;
  };
  const drawing = createMemo(() => isSketchTool(tool()));
  const activeFrame = createMemo(
    () => {
      const owner = sketch();
      return drawing() && owner && !owner.visual.hidden
        ? frameOf()(owner.id)
        : null;
    },
    null,
    {
      equals: (before, after) =>
        before === after ||
        Boolean(
          before &&
            after &&
            (["o", "u", "v", "n"] as const).every((axis) =>
              before[axis].every((value, i) => value === after[axis][i]),
            ),
        ),
    },
  );
  const bySketch = createMemo(() => {
    const groups = new Map<ElementId, Element[]>();
    for (const element of elements()) {
      const id = sketchParentOf(element);
      if (id === undefined) continue;
      const group = groups.get(id);
      if (group) group.push(element);
      else groups.set(id, [element]);
    }
    return groups;
  });
  const activeEntities = () => {
    const id = sketchId();
    return (id === undefined ? undefined : bySketch().get(id)) ?? [];
  };
  const endpoints = createMemo(() =>
    drawing()
      ? activeEntities().flatMap((element) =>
          element.visual.hidden
            ? []
            : (sketchGeometry(element)?.endpoints ?? []),
        )
      : [],
  );
  const entityLines = createMemo(() => {
    const result: {
      id: ElementId;
      sketch: ElementId;
      segments: Float32Array;
    }[] = [];
    const lookup = frameOf();
    for (const [id, entities] of bySketch()) {
      const owner = editor.store.get(id);
      if (owner?.visual.hidden) continue;
      const frame = lookup(id);
      if (!frame) continue;
      for (const entity of entities) {
        if (entity.visual.hidden) continue;
        const segments = sketchOverlaySegments(frame, [entity]);
        if (segments.length)
          result.push({ id: entity.id, sketch: id, segments });
      }
    }
    return result;
  });

  function align(frame: CadFrame): void {
    const current = camera();
    changeCamera({
      ...alignToFrame(frame, current.distance),
      target: toWorld(frame, sketchCoordinates(frame, current.target)),
    });
  }

  function beginSketch(): void {
    if (
      editor.readOnly ||
      editor.currentPageId !== pageId ||
      !editor.canCreateOn(pageId, "cad.sketch")
    )
      return;
    const hit = options.picked();
    let plane: CadPlane = { base: "xy" };
    if (hit) {
      const face = parseFaceName(hit.faceName);
      if (!face) {
        setNotice("This face cannot define a sketch plane.");
        return;
      }
      const entity =
        face.entity === undefined ? undefined : editor.store.get(face.entity);
      if (
        face.role === "side" &&
        (entity?.type === "cad.arc" || entity?.type === "cad.circle")
      ) {
        setNotice("A sketch requires a planar face. This face is curved.");
        return;
      }
      plane = { face };
    }
    const current = elements();
    const sketches = new Set(
      current.flatMap(({ type, semantic }) =>
        type === "cad.sketch" &&
        typeof semantic === "object" &&
        semantic !== null &&
        "name" in semantic
          ? [semantic.name]
          : [],
      ),
    );
    let number = 1;
    while (sketches.has(`Sketch ${number}`)) number++;
    const after = lastElementIndex(current);
    const { id, commands } = sketchCommands(
      pageId,
      plane,
      `Sketch ${number}`,
      cadAuthoringIds(current),
      after,
    );
    const command = commands[0];
    if (command?.type !== "createElement") return;
    const frame = sketchFrameOf(
      [...options.geometryElements(), command.element],
      id,
    );
    if (!frame) {
      setNotice("The selected face no longer defines a sketch plane.");
      return;
    }
    editor.apply(commands);
    editor.selection.set([id]);
    align(frame);
  }

  createEffect(() => {
    const current = tool();
    sketchId();
    setGesture(
      isSketchTool(current) ? { tool: current, points: [] } : undefined,
    );
    if (isSketchTool(current) || current === Tool.CadExtrude)
      setNotice(undefined);
  });
  createEffect(() => {
    if (drawing()) options.focus();
  });
  createEffect(() => {
    if (tool() !== Tool.CadSketch) return;
    untrack(() => {
      setNotice(undefined);
      beginSketch();
      options.selectTool();
      options.focus();
    });
  });
  createEffect(() => {
    const frame = activeFrame();
    const id = sketchId();
    if (frame && id !== undefined)
      untrack(() => {
        setGesture((state) => state && { tool: state.tool, points: [] });
        align(frame);
      });
  });
  createEffect(() => {
    const view = renderer();
    if (!view?.setSketchLines) return;
    const ids = selection();
    const id = sketchId();
    const active = activeFrame() !== null;
    const normal: Float32Array[] = [];
    const highlight: Float32Array[] = [];
    for (const item of entityLines()) {
      const group =
        (active && id === item.sketch) ||
        ids.has(item.id) ||
        ids.has(item.sketch)
          ? highlight
          : normal;
      group.push(item.segments);
    }
    view.setSketchLines(joinLines(normal), joinLines(highlight), active);
  });
  createEffect(() => {
    const frame = activeFrame();
    const { width, height } = options.size();
    const current = camera();
    const heightMm = cameraViewHeight(current);
    renderer()?.setSketchGrid?.(
      frame && height > 0 && width > 0
        ? sketchGridSegments(
            frame,
            current.target,
            (heightMm * width) / height,
            heightMm,
          )
        : null,
    );
  });
  const previewLines = createMemo(() => {
    const frame = activeFrame();
    const state = gesture();
    const preview = state && frame ? sketchPreview(state) : undefined;
    return frame && preview ? sketchOverlaySegments(frame, [], preview) : null;
  });

  const profileNotice = createMemo(() => {
    if (!drawing() || !activeFrame() || !activeEntities().length) return;
    const profile = buildLoops(activeEntities());
    if (!("error" in profile)) return;
    switch (profile.error) {
      case "cad.profile.open":
        return "The sketch profile is open. Connect its endpoints to close it.";
      case "cad.profile.branch":
        return "The sketch profile branches at an endpoint.";
      case "cad.profile.intersect":
        return "Sketch profiles cannot touch or intersect.";
      default:
        return `Sketch profile needs attention (${profile.error}).`;
    }
  });

  function status(): string | undefined {
    if (notice()) return notice();
    if (!drawing()) return;
    const owner = sketch();
    if (!owner) return "Select a sketch to draw on it.";
    if (owner.visual.locked || editor.readOnly)
      return "This sketch is read-only.";
    if (!activeFrame()) return "The sketch plane is unavailable.";
    return profileNotice();
  }

  function input(
    type: "down" | "move" | "up",
    viewport: SketchViewportPoint | null,
    fine: boolean,
  ): void {
    const state = gesture();
    const frame = activeFrame();
    const owner = sketch();
    if (
      !state ||
      !frame ||
      !owner ||
      !viewport ||
      owner.visual.locked ||
      editor.readOnly ||
      editor.currentPageId !== pageId ||
      !editor.canCreateOn(pageId, "cad.line")
    )
      return;
    if (type === "move" && !state.points.length) return;
    if (type === "up" && state.tool !== Tool.CadRect) return;
    const point = intersectSketch(
      frame,
      screenRay(
        camera(),
        viewport.width / viewport.height,
        viewport.x,
        viewport.y,
      ),
    );
    if (
      !point ||
      !point.every(
        (value) => Number.isFinite(value) && Math.abs(value) <= 10_000,
      )
    ) {
      if (type !== "move")
        setNotice("The point is outside the sketch plane limits.");
      else setGesture({ tool: state.tool, points: state.points });
      return;
    }
    setNotice(undefined);
    const grid = fine ? 0.1 : 1;
    const tolerance = Math.min(
      grid * 0.45,
      (cameraViewHeight(camera()) * 6) / viewport.height,
    );
    const { p } = snapSketchPoint(point, {
      grid,
      endpoints: endpoints(),
      anchor: state.points.at(-1),
      tolerance,
    });
    const result = sketchStep(state, { type, p });
    if (result.commit) {
      const commands = sketchCommitCommands(
        result.commit,
        pageId,
        owner,
        cadAuthoringIds(elements()),
      );
      if (!commands.length) {
        setNotice("The points do not define a valid sketch entity.");
        return;
      }
      try {
        editor.apply(commands);
      } catch (error) {
        if (!(error instanceof CommandError)) throw error;
        setNotice(
          error.issues[0]?.message ?? "The sketch edit could not be applied.",
        );
        return;
      }
    }
    setGesture(result.state);
  }

  function cancel(): boolean {
    const state = gesture();
    if (!state) return false;
    const result = sketchStep(state, { type: "escape" });
    setNotice(undefined);
    setGesture(result.state);
    if (result.state === state) options.selectTool();
    return true;
  }

  function cancelPointer(): void {
    setGesture((state) => state && { tool: state.tool, points: [] });
  }

  return {
    drawing,
    entityLines,
    previewLines,
    sketchId,
    status,
    input,
    cancel,
    cancelPointer,
  };
}

function joinLines(parts: readonly Float32Array[]): Float32Array {
  if (!parts.length) return EMPTY_LINES;
  const lines = new Float32Array(
    parts.reduce((count, part) => count + part.length, 0),
  );
  let offset = 0;
  for (const part of parts) {
    lines.set(part, offset);
    offset += part.length;
  }
  return lines;
}
