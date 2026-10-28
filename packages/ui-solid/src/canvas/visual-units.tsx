// Rendering of the canvas's content layers: box shapes, groups (with their
// boolean and raster masks) and connectors. Units stay mounted while the
// element they show is replaced by immutable position or style updates.

import type { Editor, ShapeContext } from "@nodetto/core";
import {
  backdropEffectsCss,
  booleanGeometry,
  booleanMaskCss,
  clipCss,
  effectsCss,
  isGroup,
  memberIdsOf,
  rasterGroupMaskCss,
  shapeAuthoringWarnings,
} from "@nodetto/core";
import type { Element, ElementId } from "@nodetto/ir";
import {
  type Accessor,
  createMemo,
  createUniqueId,
  For,
  type JSX,
  Show,
  untrack,
} from "solid-js";
import { pcbHiddenLayers } from "../pcb-state.ts";
import { ConnectorMarkers, ConnectorView } from "../shapes/ConnectorView.tsx";
import { ShapeView } from "../shapes/ShapeView.tsx";
import { isConnector } from "./geometry.ts";

function InlineConnector(props: {
  readonly element: Element;
  readonly context: ShapeContext;
  readonly selected: boolean;
}): JSX.Element {
  const prefix = `canvas-group-${createUniqueId()}-`;
  return (
    <svg
      width="1"
      height="1"
      style={{
        position: "absolute",
        inset: 0,
        overflow: "visible",
        "pointer-events": "none",
      }}
    >
      <title>Grouped connector</title>
      <ConnectorMarkers prefix={prefix} />
      <g
        style={{
          "clip-path": clipCss(
            props.context.clipPolygonOf?.(props.element.id) ??
              props.context.clipOf?.(props.element.id),
          ),
          opacity: props.element.visual.style?.opacity ?? 1,
          filter: effectsCss(props.element.visual.style),
          "backdrop-filter": backdropEffectsCss(props.element.visual.style),
          "mix-blend-mode": props.element.visual.style?.blendMode ?? "normal",
        }}
      >
        <ConnectorView
          element={props.element}
          context={props.context}
          selected={props.selected}
          markerPrefix={prefix}
        />
      </g>
    </svg>
  );
}

export interface VisualUnitDeps {
  /** The canvas props; `editor` is read through them on every use. */
  readonly props: { readonly editor: Editor };
  /** The editor's document revision; reading it subscribes to changes. */
  readonly rev: Accessor<unknown>;
  readonly context: Accessor<ShapeContext>;
  readonly isSelected: (id: ElementId) => boolean;
}

export interface VisualUnitRenderer {
  /** A shape, group or grouped connector, kept mounted across updates. */
  renderStableVisualUnit(
    id: ElementId,
    ancestors?: ReadonlySet<ElementId>,
  ): JSX.Element;
  /** A top-level connector in the connector layer. */
  renderConnector(id: ElementId): JSX.Element;
}

export function createVisualUnitRenderer(
  deps: VisualUnitDeps,
): VisualUnitRenderer {
  const { props, context, isSelected } = deps;

  // Keep visual units mounted through immutable position/style updates.
  const renderStableVisualUnit = (
    id: ElementId,
    ancestors: ReadonlySet<ElementId> = new Set(),
  ): JSX.Element => {
    const initial = props.editor.store.get(id);
    if (!initial) return null;
    const element = createMemo(() => {
      deps.rev();
      return props.editor.store.get(initial.id) ?? initial;
    });
    return (
      <Show
        when={!isGroup(element()) && !isConnector(element())}
        fallback={
          <Show
            when={isGroup(element())}
            fallback={
              <InlineConnector
                element={element()}
                context={context()}
                selected={isSelected(id)}
              />
            }
          >
            {renderGroup(element, ancestors)}
          </Show>
        }
      >
        {renderShape(element)}
      </Show>
    );
  };

  const renderGroup = (
    element: () => Element,
    ancestors: ReadonlySet<ElementId> = new Set(),
  ): JSX.Element => {
    const id = untrack(() => element().id);
    if (ancestors.has(id)) return null;
    const nextAncestors = new Set(ancestors).add(id);
    const semantic = () => element().semantic as { isolate?: boolean };
    const boolean = createMemo(() => booleanGeometry(element(), context()));
    const rasterMask = createMemo(() => {
      deps.rev();
      return rasterGroupMaskCss(props.editor, element().id);
    });
    const groupBounds = createMemo(() => {
      deps.rev();
      return rasterMask() ? props.editor.getBounds(element().id) : null;
    });
    const children = createMemo(() => {
      deps.rev();
      return memberIdsOf(element()).flatMap((id) => {
        const child = props.editor.store.get(id);
        return child &&
          !context().isHidden?.(id) &&
          !context().isMaskSource?.(id)
          ? [child]
          : [];
      });
    });
    const contents = () => (
      <For each={children().map((child) => child.id)}>
        {(id) => renderStableVisualUnit(id, nextAncestors)}
      </For>
    );
    const surface = createMemo(() => {
      const geometry = boolean();
      if (geometry)
        return {
          bounds: geometry.bounds,
          mask: booleanMaskCss(geometry),
          mode: "alpha" as const,
          operation: geometry.operation,
        };
      const mask = rasterMask();
      const bounds = groupBounds();
      return mask && bounds
        ? {
            bounds,
            mask,
            mode:
              (element().semantic as { maskMode?: "alpha" | "luminance" })
                .maskMode ?? "alpha",
            operation: undefined,
          }
        : null;
    });
    return (
      <div
        data-group-id={element().id}
        data-boolean-operation={surface()?.operation}
        style={{
          position: "absolute",
          inset: surface() ? undefined : 0,
          left: surface() ? `${surface()?.bounds.x}px` : undefined,
          top: surface() ? `${surface()?.bounds.y}px` : undefined,
          width: surface() ? `${surface()?.bounds.width}px` : undefined,
          height: surface() ? `${surface()?.bounds.height}px` : undefined,
          overflow: "visible",
          "pointer-events": "none",
          opacity: element().visual.style?.opacity ?? 1,
          filter: effectsCss(element().visual.style),
          "backdrop-filter": backdropEffectsCss(element().visual.style),
          "mix-blend-mode": element().visual.style?.blendMode ?? "normal",
          isolation: semantic().isolate ? "isolate" : undefined,
          "mask-image": surface()?.mask,
          "mask-mode": surface()?.mode,
          "mask-repeat": surface() ? "no-repeat" : undefined,
          "mask-size": surface() ? "100% 100%" : undefined,
        }}
      >
        <Show when={surface()} fallback={contents()}>
          {(current) => (
            <div
              style={{
                position: "absolute",
                left: `${-current().bounds.x}px`,
                top: `${-current().bounds.y}px`,
                width: "1px",
                height: "1px",
                overflow: "visible",
              }}
            >
              {contents()}
            </div>
          )}
        </Show>
      </div>
    );
  };

  const renderShape = (element: () => Element): JSX.Element => {
    const warnings = createMemo(() => {
      deps.rev();
      return shapeAuthoringWarnings(element(), context());
    });
    const box = createMemo(() => context().boundsOf(element().id), null, {
      equals: (a, b) =>
        a === b ||
        Boolean(
          a &&
            b &&
            a.x === b.x &&
            a.y === b.y &&
            a.width === b.width &&
            a.height === b.height,
        ),
    });
    return (
      <Show when={box()}>
        {(bounds) => (
          <div
            style={{
              position: "absolute",
              inset: 0,
              "clip-path": clipCss(
                context().clipPolygonOf?.(element().id) ??
                  context().clipOf?.(element().id),
              ),
            }}
          >
            <ShapeView
              resolveAsset={(source) => {
                deps.rev();
                return props.editor.assets.resolve(source);
              }}
              warnings={warnings()}
              element={element()}
              box={bounds()}
              selected={isSelected(element().id)}
              pcbHidden={() => pcbHiddenLayers(props.editor.currentPageId)}
              showLayoutGrids
            />
          </div>
        )}
      </Show>
    );
  };

  const renderConnector = (id: ElementId): JSX.Element => {
    const initial = props.editor.store.get(id);
    if (!initial) return null;
    const element = createMemo(() => {
      deps.rev();
      return props.editor.store.get(id) ?? initial;
    });
    return (
      <g
        style={{
          "clip-path": clipCss(
            context().clipPolygonOf?.(element().id) ??
              context().clipOf?.(element().id),
          ),
          opacity: element().visual.style?.opacity ?? 1,
          filter: effectsCss(element().visual.style),
          "backdrop-filter": backdropEffectsCss(element().visual.style),
          "mix-blend-mode": element().visual.style?.blendMode ?? "normal",
        }}
      >
        <ConnectorView
          element={element()}
          context={context()}
          selected={isSelected(element().id)}
        />
      </g>
    );
  };

  return { renderStableVisualUnit, renderConnector };
}
