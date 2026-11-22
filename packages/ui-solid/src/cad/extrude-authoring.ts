import {
  CommandError,
  defaultExtrude,
  type Editor,
  extrudeCommands,
  extrudeIntent,
  prepareExtrudePreview,
  toWorld,
  type ViewportSize,
} from "@nodetto/core";
import {
  type CadExtrudeSemantic,
  type Element,
  type ElementId,
  getElementTypeDefinition,
  type PageId,
} from "@nodetto/ir";
import {
  type Accessor,
  createEffect,
  createMemo,
  createSignal,
  on,
} from "solid-js";
import { Tool, type ToolKind } from "../tools.ts";
import {
  alignToFrame,
  type Camera3d,
  cameraViewHeight,
  viewProjection,
} from "./camera3d.ts";
import {
  CAD_DRAG_THRESHOLD,
  dragDistance,
  type ExtrudeDrag,
  extrudeTip,
  projectExtrudePoint,
} from "./extrude-interaction.ts";
import {
  cadAuthoringIds,
  type SketchViewportPoint,
} from "./sketch-authoring.ts";

type Prepared = Exclude<
  ReturnType<typeof prepareExtrudePreview>,
  { error: string }
>;
type SelectedExtrude = {
  element: Element;
  semantic: CadExtrudeSemantic;
  preview: Prepared;
  positiveOp: CadExtrudeSemantic["op"];
};
type Drag = ExtrudeDrag & {
  readonly pointerId: number;
  readonly from: SketchViewportPoint;
  readonly camera: Camera3d;
  readonly feature: SelectedExtrude;
  readonly moved: boolean;
};

function selectionOf(editor: Editor, ids: ReadonlySet<ElementId>) {
  if (ids.size !== 1) return undefined;
  for (const id of ids) return editor.store.get(id);
}

export function createExtrudeAuthoring(options: {
  editor: Editor;
  pageId: PageId;
  revision: Accessor<number>;
  selection: Accessor<ReadonlySet<ElementId>>;
  tool: Accessor<ToolKind>;
  selectTool: () => void;
  focus: () => void;
  geometryElements: Accessor<readonly Element[]>;
  camera: Accessor<Camera3d>;
  changeCamera: (camera: Camera3d) => void;
  size: Accessor<ViewportSize>;
}) {
  const { editor, pageId } = options;
  const [drag, setDrag] = createSignal<Drag>();
  const [notice, setNotice] = createSignal<string>();
  const selected = createMemo(() => {
    options.revision();
    return selectionOf(editor, options.selection());
  });
  const active = createMemo<SelectedExtrude | undefined>(() => {
    if (options.tool() !== Tool.Select) return;
    options.revision();
    const element = selected();
    if (
      element?.type !== "cad.extrude" ||
      element.page !== pageId ||
      element.visual.hidden ||
      element.visual.locked ||
      editor.readOnly ||
      getElementTypeDefinition("cad.extrude")?.validateSemantic(
        element.semantic,
        "semantic",
      ).length !== 0
    )
      return;
    const semantic = element.semantic as CadExtrudeSemantic;
    if (semantic.suppressed || semantic.sketch === undefined) return;
    const sketch = editor.store.get(semantic.sketch);
    if (!sketch) return;
    const elements = options.geometryElements();
    const preview = prepareExtrudePreview(elements, semantic, element.id);
    if ("error" in preview) return;
    const positiveOp =
      semantic.op === "add" || semantic.op === "cut"
        ? extrudeIntent(elements, sketch, 1)
        : "new";
    return { element, semantic, preview, positiveOp };
  });

  function begin(): ElementId | undefined {
    if (
      editor.readOnly ||
      editor.currentPageId !== pageId ||
      !editor.canCreateOn(pageId, "cad.extrude")
    )
      return;
    const sketch = selectionOf(editor, editor.selection.ids());
    if (
      sketch?.type !== "cad.sketch" ||
      sketch.page !== pageId ||
      sketch.visual.hidden
    ) {
      setNotice("Select a visible sketch to extrude it.");
      return;
    }
    if (sketch.visual.locked) {
      setNotice("This sketch is read-only.");
      return;
    }

    const elements = editor.store.getPageElements(pageId);
    const names = new Set(
      elements.flatMap(({ type, semantic }) =>
        type === "cad.extrude" &&
        typeof semantic === "object" &&
        semantic !== null &&
        "name" in semantic
          ? [semantic.name]
          : [],
      ),
    );
    let number = 1;
    while (names.has(`Extrude ${number}`)) number++;
    const params = defaultExtrude(options.geometryElements(), sketch.id);
    const { id, commands } = extrudeCommands(
      pageId,
      sketch,
      { ...params, name: `Extrude ${number}` },
      cadAuthoringIds(elements),
    );
    const command = commands[0];
    if (command?.type !== "createElement") return;
    try {
      editor.apply(commands);
    } catch (error) {
      if (!(error instanceof CommandError)) throw error;
      setNotice(
        error.issues[0]?.message ?? "The extrude could not be created.",
      );
      return;
    }
    editor.selection.set([id]);
    return id;
  }

  function showHandle({ preview, semantic }: SelectedExtrude): void {
    const camera = options.camera();
    const { width, height } = options.size();
    const { frame } = preview;
    const matrix = viewProjection(camera, width / height);
    const anchor = projectExtrudePoint(matrix, frame.o);
    const tip = projectExtrudePoint(
      matrix,
      extrudeTip(frame, semantic.distance),
    );
    // Sketch tools look directly down the normal. Tilt that view so the
    // handle has a screen direction by which it can be dragged.
    if (
      !anchor ||
      !tip ||
      Math.hypot((tip.x - anchor.x) * width, (tip.y - anchor.y) * height) < 1
    ) {
      const { n, u, v } = frame;
      options.changeCamera(
        alignToFrame(
          {
            ...frame,
            n: [
              n[0] + 0.6 * (u[0] + v[0]),
              n[1] + 0.6 * (u[1] + v[1]),
              n[2] + 0.6 * (u[2] + v[2]),
            ],
          },
          camera.distance,
        ),
      );
    }
  }

  createEffect(
    on(
      options.tool,
      (tool) => {
        if (tool !== Tool.Select) setNotice(undefined);
        if (tool !== Tool.CadExtrude) return;
        const id = begin();
        options.selectTool();
        const feature = active();
        if (id !== undefined && feature?.element.id === id) showHandle(feature);
        options.focus();
      },
      { defer: true },
    ),
  );
  createEffect(
    on(options.selection, () => setNotice(undefined), { defer: true }),
  );
  createEffect(() => {
    const stroke = drag();
    if (stroke && active() !== stroke.feature) setDrag(undefined);
  });

  const mesh = createMemo(() => {
    const stroke = drag();
    return stroke?.moved && stroke.feature === active()
      ? stroke.feature.preview.mesh(stroke.distance)
      : null;
  });

  const lines = createMemo(() => {
    const feature = active();
    if (!feature) return null;
    const { frame } = feature.preview;
    const stroke = drag();
    const distance =
      stroke?.feature === feature ? stroke.distance : feature.semantic.distance;
    const { symmetric } = feature.semantic;
    const tip = extrudeTip(frame, distance, symmetric);
    const length = Math.min(
      Math.abs(distance) * (symmetric ? 0.5 : 1),
      (cameraViewHeight(options.camera()) * 10) /
        Math.max(1, options.size().height),
    );
    const wing = { ...frame, o: tip };
    const back = -Math.sign(distance) * length;
    const spread = length / 2;
    return new Float32Array([
      ...frame.o,
      ...tip,
      ...tip,
      ...toWorld(wing, [spread, 0], back),
      ...tip,
      ...toWorld(wing, [-spread, 0], back),
      ...tip,
      ...toWorld(wing, [0, spread], back),
      ...tip,
      ...toWorld(wing, [0, -spread], back),
    ]);
  });

  function start(
    pointerId: number,
    point: SketchViewportPoint | null,
  ): boolean {
    const feature = active();
    if (!feature || !point || editor.currentPageId !== pageId) return false;
    const { distance, symmetric } = feature.semantic;
    const camera = options.camera();
    const tip = projectExtrudePoint(
      viewProjection(camera, point.width / point.height),
      extrudeTip(feature.preview.frame, distance, symmetric),
    );
    if (
      !tip ||
      Math.hypot(
        (tip.x - point.x) * point.width,
        (tip.y - point.y) * point.height,
      ) > 20
    )
      return false;
    setNotice(undefined);
    setDrag({
      pointerId,
      feature,
      from: point,
      camera,
      startDistance: distance,
      distance,
      moved: false,
    });
    return true;
  }

  function move(pointerId: number, point: SketchViewportPoint | null): void {
    const stroke = drag();
    if (!stroke || stroke.pointerId !== pointerId || !point) return;
    const { feature, from, camera, startDistance } = stroke;
    if (
      !stroke.moved &&
      Math.hypot(
        (point.x - from.x) * from.width,
        (point.y - from.y) * from.height,
      ) <
        2 * CAD_DRAG_THRESHOLD
    )
      return;
    const distance = dragDistance(
      feature.preview.frame,
      camera,
      from.width / from.height,
      from,
      point,
      startDistance,
      { symmetric: feature.semantic.symmetric, previous: stroke.distance },
    );
    if (!stroke.moved || distance !== stroke.distance)
      setDrag({ ...stroke, distance, moved: true });
  }

  function end(
    pointerId: number,
    point: SketchViewportPoint | null,
    commit: boolean,
  ): boolean {
    const current = drag();
    if (!current || current.pointerId !== pointerId) return false;
    if (commit) move(pointerId, point);
    const stroke = drag();
    const preview = mesh();
    setDrag(undefined);
    if (
      !commit ||
      !stroke ||
      !point ||
      stroke.feature !== active() ||
      stroke.distance === stroke.startDistance ||
      editor.readOnly ||
      editor.currentPageId !== pageId
    )
      return true;
    if (preview && "error" in preview) {
      setNotice(`Extrude distance could not be applied (${preview.error}).`);
      return true;
    }
    const { element, semantic, positiveOp } = stroke.feature;
    const op =
      positiveOp === "add" || positiveOp === "cut"
        ? stroke.distance > 0 === (positiveOp === "add")
          ? "add"
          : "cut"
        : semantic.op;
    try {
      editor.apply([
        {
          type: "updateSemantic",
          id: element.id,
          semantic: { ...semantic, distance: stroke.distance, op },
        },
      ]);
    } catch (error) {
      if (!(error instanceof CommandError)) throw error;
      setNotice(
        error.issues[0]?.message ??
          "The extrude distance could not be applied.",
      );
    }
    return true;
  }

  function cancel(): boolean {
    if (!drag()) return false;
    setDrag(undefined);
    return true;
  }

  return {
    dragging: () => drag() !== undefined,
    lines,
    mesh: () => {
      const preview = mesh();
      return preview && !("error" in preview) ? preview : null;
    },
    status: () => {
      const preview = mesh();
      const stroke = drag();
      if (preview && "error" in preview)
        return `Extrude preview unavailable (${preview.error}).`;
      return stroke?.moved
        ? `Extrude distance ${stroke.distance} mm`
        : notice();
    },
    start,
    move,
    end,
    cancel,
  };
}
