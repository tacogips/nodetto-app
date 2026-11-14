// Document assembly: layer ordering, groups and masks, clip and filter
// definitions, and the page, selection and artboard entry points.

import {
  type Element,
  type ElementId,
  type FrameSemantic,
  type GenericEdgeSemantic,
  getElementTypeDefinition,
  type GroupSemantic,
  type ImageSemantic,
  isBreadboardElementType,
  isPcbElementType,
  type PageId,
} from "@nodetto/ir";
import { connectorBackdropIds } from "../backdrops.ts";
import {
  booleanGeometry,
  booleanMaskDefinition,
} from "../boolean-operations.ts";
import {
  bpmnFlowDecoration,
  bpmnLabelBox,
  isBpmnShapeType,
} from "../bpmn/notation.ts";
import {
  breadboardLabelBounds,
  breadboardNotation,
} from "../breadboard/notation.ts";
import { intersectClip, isRasterMaskSource } from "../clipping.ts";
import { effectsBounds, layerEffects } from "../effects.ts";
import { compareFractional } from "../fractional.ts";
import { expandContainers } from "../frame-tree.ts";
import { type Box, boxCenter, rotatedBox, unionBoxes } from "../geometry.ts";
import { gradientId, strokeGradientId } from "../gradient.ts";
import { memberIdsOf } from "../group.ts";
import { connectorLabelExtent, connectorLabelLayout } from "../label-layout.ts";
import { SEQUENCE_SELF_LABEL_BOUNDS_GLYPH_WIDTH } from "../sequence-layout.ts";
import { createShapeContext } from "../hit-test.ts";
import { croppedImageBox } from "../image-crop.ts";
import { containerPaintOrder } from "../paint-order.ts";
import { selfContained } from "../references.ts";
import { prototypeFlows, prototypeLinkGeometry } from "../prototype-links.ts";
import type { ShapeContext, ShapeUtilRegistry } from "../shape-util.ts";
import {
  connectorDecoration,
  endpointReaderFor,
  resolveConnector,
} from "../shapes/connector.ts";
import { freehandGeometry } from "../shapes/freehand.ts";
import { frameTitleBox, resolveTitlePlacement } from "../shapes/frame.ts";
import { stateNodeLabelBox } from "../shapes/state.ts";
import { useCaseNodeLabelBox } from "../shapes/usecase.ts";
import { umlComponentPaintBounds } from "../shapes/umlComponent.ts";
import { PCB_BOARD_COLOR } from "../pcb-board/view.ts";
import type { Store } from "../store.ts";
import { markerDefs, renderConnector } from "./connectors.ts";
import { fmt, tag, text, wrap } from "./markup.ts";
import { renderNotationPrimitive } from "./notation.ts";
import { effectPrimitives, gradientDefinition } from "./paint.ts";
import { renderShape } from "./shapes.ts";
import {
  DEFAULT_SVG_THEME,
  type SvgExportOptions,
  type SvgTheme,
} from "./theme.ts";

const DEFAULT_PADDING = 16;
const SVG_NS = "http://www.w3.org/2000/svg";

function elementGroup(
  element: Element,
  box: Box | null,
  body: string,
  filter?: string,
): string {
  const rotation = isEdge(element.type) ? 0 : element.visual.rotation;
  const transform =
    rotation === undefined || rotation === 0 || box === null
      ? undefined
      : `rotate(${fmt(rotation)} ${fmt(box.x + box.width / 2)} ${fmt(
          box.y + box.height / 2,
        )})`;
  return wrap(
    "g",
    {
      "data-id": element.id,
      "data-type": element.type,
      transform,
      filter,
      style: element.visual.style?.blendMode
        ? `mix-blend-mode: ${element.visual.style.blendMode};`
        : undefined,
    },
    body,
  );
}

function isEdge(type: string): boolean {
  return getElementTypeDefinition(type)?.category === "edge";
}

/**
 * Render `elements` (bottom to top) as a standalone SVG document, or `null`
 * when none of them contributed any geometry.
 *
 * Connectors go in their own layer first so a line never covers the shape it
 * points at, exactly like the canvas stacks its layers.
 */
export function renderElementsSvg(
  elements: readonly Element[],
  registry: ShapeUtilRegistry,
  context: ShapeContext,
  options: SvgExportOptions = {},
  prototypeOverlay?: {
    readonly markup: string;
    readonly boxes: readonly Box[];
    readonly omitted: number;
  },
): string | null {
  const theme: SvgTheme = { ...DEFAULT_SVG_THEME, ...(options.theme ?? {}) };
  const padding = options.padding ?? DEFAULT_PADDING;
  const background = options.background ?? null;

  const rendered = new Map<ElementId, string>();
  const renderedKinds = new Map<ElementId, "connector" | "shape">();
  const groups = new Map<ElementId, Element>();
  const boxes: Box[] = [...(prototypeOverlay?.boxes ?? [])];
  const pcbBoxes: Box[] = [];
  const clips: string[] = [];
  const effects: string[] = [];
  const gradients: string[] = [];
  const booleanMasks: string[] = [];
  const rasterMasks: string[] = [];
  const activeNetlists = new Map<PageId, ElementId>();
  for (const element of [...elements]
    .filter(
      (item) =>
        item.type === "breadboard.netlist" && item.visual.hidden !== true,
    )
    .sort(
      (left, right) =>
        compareFractional(left.index, right.index) ||
        compareFractional(left.id, right.id),
    )) {
    if (!activeNetlists.has(element.page))
      activeNetlists.set(element.page, element.id);
  }
  for (const element of elements) {
    if (
      element.type === "edge.generic" &&
      (element.semantic as GenericEdgeSemantic).prototype
    )
      continue;
    if (
      element.visual.hidden ||
      context.isHidden?.(element.id) ||
      context.isMaskSource?.(element.id)
    )
      continue;
    if (element.type === "group") {
      groups.set(element.id, element);
      continue;
    }
    const box = registry
      .getOrFallback(element.type)
      .getBounds(element, context);
    const clip = context.clipOf?.(element.id);
    const clipPolygon = context.clipPolygonOf?.(element.id);
    if (box && element.visual.style?.fillGradient)
      gradients.push(
        gradientDefinition(
          gradientId(element.id),
          element.visual.style.fillGradient,
          box,
        ),
      );
    if (box && element.visual.style?.strokeGradient)
      gradients.push(
        gradientDefinition(
          strokeGradientId(element.id),
          element.visual.style.strokeGradient,
          box,
        ),
      );
    const elementEffects = layerEffects(element.visual.style);
    const drawingBox =
      element.type === "draw.freehand" && !element.visual.rotation
        ? (freehandGeometry(element)?.curveBounds ?? box)
        : box
          ? umlComponentPaintBounds(element, box)
          : box;
    const expanded = drawingBox
      ? effectsBounds(
          {
            ...drawingBox,
            width: Math.max(1, drawingBox.width),
            height: Math.max(1, drawingBox.height),
          },
          element.visual.style,
        )
      : null;
    // Filters use the element's unrotated user space. Only the resulting
    // envelope rotates into page space, around the original element center
    // (not the expanded shadow's center), before ancestor clipping.
    const pageBounds =
      expanded && box && !isEdge(element.type)
        ? rotatedBox(expanded, element.visual.rotation ?? 0, boxCenter(box))
        : expanded;
    const visible =
      clip && pageBounds ? intersectClip(pageBounds, clip) : pageBounds;
    if (clip && (!visible || visible.width <= 0 || visible.height <= 0))
      continue;
    let filter: string | undefined;
    if (elementEffects.some((effect) => effect.enabled !== false) && expanded) {
      const id = `nodetto-shadow-${effects.length}`;
      filter = `url(#${id})`;
      effects.push(
        wrap(
          "filter",
          {
            id,
            filterUnits: "userSpaceOnUse",
            ...expanded,
            "color-interpolation-filters": "sRGB",
          },
          effectPrimitives(elementEffects),
        ),
      );
    }
    const clipped = (body: string): string => {
      if (!clip) return body;
      const id = `nodetto-clip-${clips.length}`;
      clips.push(
        wrap(
          "clipPath",
          { id, clipPathUnits: "userSpaceOnUse" },
          clipPolygon && clipPolygon.length >= 3
            ? tag("polygon", {
                points: clipPolygon
                  .map((point) => `${point.x},${point.y}`)
                  .join(" "),
              })
            : tag("rect", { ...clip }),
        ),
      );
      return wrap("g", { "clip-path": `url(#${id})` }, body);
    };
    if (isEdge(element.type)) {
      const body = renderConnector(element, context, theme);
      if (body === null) {
        continue;
      }
      rendered.set(
        element.id,
        clipped(elementGroup(element, box, body, filter)),
      );
      renderedKinds.set(element.id, "connector");
    } else {
      if (box === null) {
        continue;
      }
      const breadboard = isBreadboardElementType(element.type)
        ? breadboardNotation(element, box, {
            inert:
              element.type === "breadboard.netlist" &&
              activeNetlists.get(element.page) !== element.id,
          })
        : undefined;
      const uprightLabels = breadboard?.labels.length
        ? wrap(
            "g",
            { transform: `translate(${fmt(box.x)} ${fmt(box.y)})` },
            breadboard.labels
              .map((primitive) =>
                renderNotationPrimitive(primitive, "breadboard"),
              )
              .join(""),
          )
        : "";
      rendered.set(
        element.id,
        clipped(
          elementGroup(
            element,
            box,
            renderShape(element, box, theme, options.resolveAsset, breadboard),
            filter,
          ) + uprightLabels,
        ),
      );
      renderedKinds.set(element.id, "shape");
    }
    if (box && element.type === "frame") {
      const semantic = element.semantic as FrameSemantic;
      if (resolveTitlePlacement(semantic) === "outside") {
        const title = frameTitleBox(box, semantic);
        if (title) {
          const rotated = rotatedBox(
            title,
            element.visual.rotation ?? 0,
            boxCenter(box),
          );
          const visibleTitle = clip ? intersectClip(rotated, clip) : rotated;
          if (visibleTitle) boxes.push(visibleTitle);
        }
      }
    }
    if (visible !== null) {
      boxes.push(visible);
      if (isPcbElementType(element.type)) pcbBoxes.push(visible);
    }
    if (box && isBpmnShapeType(element.type)) {
      const label = bpmnLabelBox(element, box);
      if (label) boxes.push(label);
    }
    if (box && isBreadboardElementType(element.type)) {
      const notation = breadboardNotation(element, box);
      boxes.push(...breadboardLabelBounds(notation, box));
    }
    if (box && element.type === "state.node") {
      const label = stateNodeLabelBox(element, box);
      if (label) boxes.push(label);
    }
    if (box && element.type === "usecase.node") {
      const label = useCaseNodeLabelBox(element, box);
      if (label) boxes.push(label);
    }
    if (isEdge(element.type) && element.type.startsWith("bpmn.")) {
      const resolved = resolveConnector(
        element,
        context,
        endpointReaderFor(element.type),
      );
      if (resolved) {
        for (const primitive of bpmnFlowDecoration(
          element,
          resolved.points,
          (id) => context.resolve(id),
        )) {
          if (primitive.kind === "text" && primitive.role === "flow-label") {
            boxes.push({
              x: primitive.x - 45,
              y: primitive.y - primitive.fontSize,
              width: 90,
              height: primitive.lineHeight * primitive.lines.length,
            });
          }
        }
      }
    }
    if (element.type === "sequence.message" && !clip) {
      const resolved = resolveConnector(
        element,
        context,
        endpointReaderFor(element.type),
      );
      if (resolved?.labelStartX !== undefined) {
        const layout = connectorLabelLayout(
          connectorDecoration(element).label,
          element.visual,
        );
        const extent = connectorLabelExtent(layout, resolved.labelPoint);
        if (extent) {
          let longest = 0;
          for (const line of layout.lines)
            longest = Math.max(longest, [...line].length);
          boxes.push({
            x: resolved.labelStartX,
            y: extent.y,
            width:
              longest *
              (layout.fontSize * SEQUENCE_SELF_LABEL_BOUNDS_GLYPH_WIDTH +
                Math.max(0, element.visual.style?.letterSpacing ?? 0)),
            height: extent.height,
          });
        }
      }
    }
  }

  const bounds = options.viewport ?? unionBoxes(boxes);
  const board = unionBoxes(pcbBoxes);
  if (bounds === null) {
    return null;
  }
  if (
    options.viewport &&
    (!Object.values(options.viewport).every(Number.isFinite) ||
      bounds.width <= 0 ||
      bounds.height <= 0)
  )
    return null;
  const groupParents = new Map<ElementId, ElementId>();
  for (const group of groups.values()) {
    for (const member of memberIdsOf(group)) {
      if (
        member !== group.id &&
        (rendered.has(member) || groups.has(member)) &&
        !groupParents.has(member)
      )
        groupParents.set(member, group.id);
    }
  }
  const renderUnit = (
    element: Element,
    ancestors: ReadonlySet<ElementId>,
  ): string => {
    const leaf = rendered.get(element.id);
    if (leaf !== undefined) return leaf;
    if (element.type !== "group" || ancestors.has(element.id)) return "";
    const nextAncestors = new Set(ancestors).add(element.id);
    const body = memberIdsOf(element)
      .map((id) => {
        const child = groups.get(id) ?? elements.find((item) => item.id === id);
        return child ? renderUnit(child, nextAncestors) : "";
      })
      .join("");
    if (!body) return "";
    const semantic = element.semantic as GroupSemantic;
    const boolean = booleanGeometry(element, context);
    const booleanMask = boolean
      ? `nodetto-boolean-${booleanMasks.length}`
      : undefined;
    if (boolean && booleanMask)
      booleanMasks.push(booleanMaskDefinition(booleanMask, boolean));
    const maskSource = semantic.maskId
      ? elements.find((item) => item.id === semantic.maskId)
      : undefined;
    const rasterMask =
      !boolean && isRasterMaskSource(maskSource)
        ? `nodetto-raster-mask-${rasterMasks.length}`
        : undefined;
    if (rasterMask && maskSource) {
      const groupBox = context.boundsOf(element.id);
      const sourceBox = context.boundsOf(maskSource.id);
      if (groupBox && sourceBox && groupBox.width > 0 && groupBox.height > 0) {
        const image = maskSource.semantic as ImageSemantic;
        const imageBox = image.crop
          ? croppedImageBox(image.crop, sourceBox)
          : sourceBox;
        const media = tag("image", {
          ...imageBox,
          href: options.resolveAsset
            ? options.resolveAsset(image.src)
            : image.src,
          preserveAspectRatio: "none",
        });
        const clipped = image.crop
          ? wrap("svg", { ...sourceBox, overflow: "hidden" }, media)
          : media;
        const rotation = maskSource.visual.rotation ?? 0;
        rasterMasks.push(
          wrap(
            "mask",
            {
              id: rasterMask,
              maskUnits: "userSpaceOnUse",
              ...groupBox,
              "mask-type": semantic.maskMode ?? "alpha",
            },
            rotation
              ? wrap(
                  "g",
                  {
                    transform: `rotate(${fmt(rotation)} ${fmt(sourceBox.x + sourceBox.width / 2)} ${fmt(sourceBox.y + sourceBox.height / 2)})`,
                  },
                  clipped,
                )
              : clipped,
          ),
        );
      }
    }
    const styles = [
      element.visual.style?.blendMode
        ? `mix-blend-mode: ${element.visual.style.blendMode};`
        : "",
      semantic.isolate ? "isolation: isolate;" : "",
    ]
      .filter(Boolean)
      .join(" ");
    return wrap(
      "g",
      {
        "data-id": element.id,
        "data-type": "group",
        "data-boolean-operation": boolean?.operation,
        opacity: element.visual.style?.opacity,
        style: styles || undefined,
        mask: booleanMask
          ? `url(#${booleanMask})`
          : rasterMask
            ? `url(#${rasterMask})`
            : undefined,
      },
      body,
    );
  };
  // Frames are surfaces: on a page with connectors they go beneath the
  // connector layer so their fill cannot hide the lines (see backdrops.ts).
  // Every rendered element counts towards "has connectors" (a connector
  // inside a group too, as on the canvas); only ungrouped frames qualify.
  const backdropIds = connectorBackdropIds(
    elements.filter((element) => rendered.has(element.id)),
    (id) => groupParents.has(id),
  );
  const roots = containerPaintOrder(elements, context, backdropIds).filter(
    (element) =>
      (rendered.has(element.id) || groups.has(element.id)) &&
      !groupParents.has(element.id),
  );
  const backdrops = roots
    .filter((element) => backdropIds.has(element.id))
    .map((element) => renderUnit(element, new Set()));
  const connectors = roots
    .filter((element) => renderedKinds.get(element.id) === "connector")
    .map((element) => renderUnit(element, new Set()));
  const shapes = roots
    .filter(
      (element) =>
        renderedKinds.get(element.id) !== "connector" &&
        !backdropIds.has(element.id),
    )
    .map((element) => renderUnit(element, new Set()));
  const margin = options.viewport ? 0 : padding;
  const x = bounds.x - margin;
  const y = bounds.y - margin;
  const width = bounds.width + margin * 2;
  const height = bounds.height + margin * 2;

  const markerContent = [...backdrops, ...connectors, ...shapes].join("");
  const body = [
    markerDefs(theme, markerContent),
    gradients.length ? wrap("defs", {}, gradients.join("")) : "",
    clips.length ? wrap("defs", {}, clips.join("")) : "",
    effects.length ? wrap("defs", {}, effects.join("")) : "",
    booleanMasks.length ? wrap("defs", {}, booleanMasks.join("")) : "",
    rasterMasks.length ? wrap("defs", {}, rasterMasks.join("")) : "",
    background === null
      ? ""
      : tag("rect", { x, y, width, height, fill: background }),
    board === null
      ? ""
      : tag("rect", {
          "data-layer": "pcb-board",
          x: board.x,
          y: board.y,
          width: board.width,
          height: board.height,
          fill: PCB_BOARD_COLOR,
        }),
    backdrops.length
      ? wrap("g", { "data-layer": "backdrops" }, backdrops.join(""))
      : "",
    wrap("g", { "data-layer": "connectors" }, connectors.join("")),
    wrap("g", { "data-layer": "shapes" }, shapes.join("")),
    prototypeOverlay?.omitted
      ? wrap(
          "desc",
          {},
          `${prototypeOverlay.omitted} prototype links to other pages omitted`,
        )
      : "",
    prototypeOverlay?.markup ?? "",
  ]
    .filter((part) => part !== "")
    .join("\n");

  return `${wrap(
    "svg",
    {
      xmlns: SVG_NS,
      width,
      height,
      viewBox: `${fmt(x)} ${fmt(y)} ${fmt(width)} ${fmt(height)}`,
      ...(options.viewport ? { overflow: "hidden" } : {}),
      "font-family": theme.fontFamily,
      "font-size": theme.fontSize,
    },
    `\n${body}\n`,
  )}\n`;
}

export function renderPageSvg(
  store: Store,
  registry: ShapeUtilRegistry,
  pageId: PageId,
  options: SvgExportOptions = {},
): string | null {
  const elements = store.getPageElements(pageId);
  const context = createShapeContext(store, registry, 1);
  if (!options.prototypeView)
    return renderElementsSvg(elements, registry, context, options);
  const boxes: Box[] = [];
  const parts: string[] = [];
  let omitted = 0;
  for (const link of elements) {
    if (
      link.type !== "edge.generic" ||
      link.visual.hidden ||
      context.isHidden?.(link.id)
    )
      continue;
    const semantic = link.semantic as GenericEdgeSemantic;
    if (!semantic.prototype || !semantic.from || !semantic.to) continue;
    const from = store.get(semantic.from);
    const to = store.get(semantic.to);
    if (
      !from ||
      !to ||
      context.isHidden?.(from.id) ||
      context.isHidden?.(to.id)
    )
      continue;
    if (from.page !== pageId || to.page !== pageId) {
      omitted++;
      continue;
    }
    const geometry = prototypeLinkGeometry(store, context, link);
    if (!geometry) continue;
    const { start, end, labelPoint, label } = geometry;
    if (geometry.kind === "back-tag") {
      const width = Math.max(36, label.length * 6.6 + 12);
      boxes.push({ x: start.x, y: start.y - 18, width, height: 18 });
      parts.push(
        wrap(
          "g",
          { "data-prototype-link": link.id },
          tag("rect", {
            x: start.x,
            y: start.y - 18,
            width,
            height: 18,
            rx: 4,
            fill: "#7c3aed",
          }) +
            text(
              {
                x: start.x + 6,
                y: start.y - 5,
                fill: "white",
                "font-size": 11,
              },
              label || "back",
            ),
        ),
      );
      continue;
    }
    if (!end || !geometry.d) continue;
    const k = Math.max(40, Math.abs(end.x - start.x) / 2);
    const direction = end.x >= start.x ? 1 : -1;
    const xs = [start.x, end.x, start.x + direction * k, end.x - direction * k];
    boxes.push({
      x: Math.min(...xs) - 5,
      y: Math.min(start.y, end.y) - 5,
      width: Math.max(...xs) - Math.min(...xs) + 10,
      height: Math.abs(end.y - start.y) + 10,
    });
    let body =
      tag("path", {
        d: geometry.d,
        fill: "none",
        stroke: "#7c3aed",
        "stroke-width": 2,
      }) +
      tag("circle", { cx: start.x, cy: start.y, r: 3, fill: "#7c3aed" }) +
      tag("path", {
        d: `M ${fmt(end.x - direction * 8)} ${fmt(end.y - 4)} L ${fmt(end.x)} ${fmt(end.y)} L ${fmt(end.x - direction * 8)} ${fmt(end.y + 4)} Z`,
        fill: "#7c3aed",
      });
    if (label) {
      const width = label.length * 6.6 + 10;
      boxes.push({
        x: labelPoint.x - width / 2,
        y: labelPoint.y - 10,
        width,
        height: 18,
      });
      body +=
        tag("rect", {
          x: labelPoint.x - width / 2,
          y: labelPoint.y - 10,
          width,
          height: 18,
          rx: 4,
          fill: "white",
        }) +
        text(
          {
            x: labelPoint.x,
            y: labelPoint.y + 3,
            "text-anchor": "middle",
            "font-size": 11,
            fill: "#7c3aed",
          },
          label,
        );
    }
    parts.push(wrap("g", { "data-prototype-link": link.id }, body));
  }
  for (const flow of prototypeFlows(store, context).flows) {
    const frame = store.get(flow.startId);
    if (!frame || frame.page !== pageId || context.isHidden?.(frame.id))
      continue;
    const box = context.boundsOf(frame.id);
    if (!box) continue;
    const title = frameTitleBox(box, frame.semantic as FrameSemantic);
    const y =
      (title &&
      resolveTitlePlacement(frame.semantic as FrameSemantic) === "outside"
        ? title.y
        : box.y) - 8;
    const width = 16 + flow.name.length * 6.6;
    boxes.push({ x: box.x, y: y - 12, width, height: 16 });
    parts.push(
      wrap(
        "g",
        { "data-prototype-flow": flow.name },
        tag("path", {
          d: `M ${fmt(box.x)} ${fmt(y - 10)} L ${fmt(box.x + 10)} ${fmt(y - 5)} L ${fmt(box.x)} ${fmt(y)} Z`,
          fill: "#7c3aed",
        }) +
          text(
            { x: box.x + 15, y, "font-size": 11, fill: "#7c3aed" },
            flow.name,
          ),
      ),
    );
  }
  return renderElementsSvg(elements, registry, context, options, {
    boxes,
    omitted,
    markup: parts.length
      ? wrap("g", { "data-layer": "prototype" }, parts.join(""))
      : "",
  });
}

/**
 * The selected subset of a page, in the page's own z-order, trimmed so a
 * connector whose endpoints were not both selected is left out rather than
 * exported as a line to nowhere.
 */
export function renderSelectionSvg(
  store: Store,
  registry: ShapeUtilRegistry,
  pageId: PageId,
  ids: ReadonlySet<ElementId>,
  options: SvgExportOptions = {},
): string | null {
  if (ids.size === 1) {
    const id = ids.values().next().value;
    if (id && store.get(id)?.type === "frame" && store.get(id)?.page === pageId)
      return renderArtboardSvg(store, registry, id, options);
  }
  const context = createShapeContext(store, registry, 1);
  const expanded = new Set(expandContainers(store, ids, context));
  const picked = store
    .getPageElements(pageId)
    .filter((element) => expanded.has(element.id));
  return renderElementsSvg(selfContained(picked), registry, context, options);
}

/** Exact-size artboard asset, with descendants but without its editor title. */
export function renderArtboardSvg(
  store: Store,
  registry: ShapeUtilRegistry,
  id: ElementId,
  options: SvgExportOptions = {},
): string | null {
  const frame = store.get(id);
  if (!frame || frame.type !== "frame") return null;
  const context = createShapeContext(store, registry, 1);
  if (context.isHidden?.(id)) return null;
  const box = context.boundsOf(id);
  if (!box) return null;
  const viewport = rotatedBox(box, frame.visual.rotation ?? 0);
  const ids = new Set(expandContainers(store, [id], context));
  const excluded = options.excludeIds
    ? new Set(expandContainers(store, options.excludeIds, context))
    : undefined;
  const elements = selfContained(
    store
      .getPageElements(frame.page)
      .filter((element) => ids.has(element.id) && !excluded?.has(element.id)),
  ).map((element) =>
    element.id === id
      ? {
          ...element,
          semantic: { ...(element.semantic as object), showTitle: false },
        }
      : element,
  );
  return renderElementsSvg(elements, registry, context, {
    ...options,
    viewport,
  });
}
