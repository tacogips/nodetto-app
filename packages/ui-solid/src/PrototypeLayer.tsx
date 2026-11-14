// Static rendering of one element inside the prototype preview: groups
// (including Boolean groups) recurse into their members, connectors draw as
// SVG, and every other element renders through its ShapeView.

import {
  backdropEffectsCss,
  booleanGeometry,
  booleanMaskCss,
  clipCss,
  type Editor,
  effectsCss,
  memberIdsOf,
  type ShapeContext,
} from "@nodetto/core";
import {
  type Element,
  getElementTypeDefinition,
  type GroupSemantic,
} from "@nodetto/ir";
import { createUniqueId, For, type JSX } from "solid-js";
import { createEditorSignals } from "./adapter.ts";
import { ConnectorMarkers, ConnectorView } from "./shapes/ConnectorView.tsx";
import { ShapeView } from "./shapes/ShapeView.tsx";

export function PrototypeLayer(props: {
  readonly editor: Editor;
  readonly element: Element;
  readonly elements: ReadonlyMap<string, Element>;
  readonly markerPrefix: string;
  readonly context?: ShapeContext;
  readonly ancestors?: ReadonlySet<string>;
}): JSX.Element {
  const imageSignals =
    props.element.type === "image.raster"
      ? createEditorSignals(props.editor)
      : undefined;
  const context = props.context ?? props.editor.createShapeContext();
  if (props.element.type === "group") {
    if (props.ancestors?.has(props.element.id)) return null;
    const nextAncestors = new Set(props.ancestors).add(props.element.id);
    const style = props.element.visual.style;
    const semantic = props.element.semantic as GroupSemantic;
    const boolean = booleanGeometry(props.element, context);
    const children = memberIdsOf(props.element).flatMap((id) => {
      const element = props.elements.get(id);
      return element ? [element] : [];
    });
    const contents = (
      <For each={children}>
        {(element) => (
          <PrototypeLayer
            editor={props.editor}
            element={element}
            elements={props.elements}
            markerPrefix={props.markerPrefix}
            context={context}
            ancestors={nextAncestors}
          />
        )}
      </For>
    );
    return boolean ? (
      <div
        data-nodetto-group={props.element.id}
        data-boolean-operation={boolean.operation}
        style={{
          position: "absolute",
          left: `${boolean.bounds.x}px`,
          top: `${boolean.bounds.y}px`,
          width: `${boolean.bounds.width}px`,
          height: `${boolean.bounds.height}px`,
          overflow: "visible",
          "pointer-events": "none",
          opacity: style?.opacity ?? 1,
          filter: effectsCss(style),
          "backdrop-filter": backdropEffectsCss(style),
          "mix-blend-mode": style?.blendMode ?? "normal",
          isolation: semantic.isolate ? "isolate" : undefined,
          "mask-image": booleanMaskCss(boolean),
          "mask-repeat": "no-repeat",
          "mask-size": "100% 100%",
        }}
      >
        <div
          style={{
            position: "absolute",
            left: `${-boolean.bounds.x}px`,
            top: `${-boolean.bounds.y}px`,
            width: "1px",
            height: "1px",
            overflow: "visible",
          }}
        >
          {contents}
        </div>
      </div>
    ) : (
      <div
        data-nodetto-group={props.element.id}
        style={{
          position: "absolute",
          inset: 0,
          "pointer-events": "none",
          opacity: style?.opacity ?? 1,
          filter: effectsCss(style),
          "backdrop-filter": backdropEffectsCss(style),
          "mix-blend-mode": style?.blendMode ?? "normal",
          isolation: semantic.isolate ? "isolate" : undefined,
        }}
      >
        {contents}
      </div>
    );
  }
  if (getElementTypeDefinition(props.element.type)?.category === "edge") {
    const connectorPrefix = `${props.markerPrefix}${createUniqueId()}-`;
    return (
      <svg
        width="1"
        height="1"
        style={{
          position: "absolute",
          overflow: "visible",
          "pointer-events": "none",
        }}
      >
        <title>Diagram connector</title>
        <ConnectorMarkers prefix={connectorPrefix} />
        <g
          style={{
            "clip-path": clipCss(
              context.clipPolygonOf?.(props.element.id) ??
                context.clipOf?.(props.element.id),
            ),
            opacity: props.element.visual.style?.opacity ?? 1,
            filter: effectsCss(props.element.visual.style),
            "backdrop-filter": backdropEffectsCss(props.element.visual.style),
            "mix-blend-mode": props.element.visual.style?.blendMode ?? "normal",
          }}
        >
          <ConnectorView
            element={props.element}
            context={context}
            selected={false}
            markerPrefix={connectorPrefix}
          />
        </g>
      </svg>
    );
  }
  const box = props.editor.getBounds(props.element.id);
  return box ? (
    <div
      style={{
        position: "absolute",
        inset: 0,
        "clip-path": clipCss(
          context.clipPolygonOf?.(props.element.id) ??
            context.clipOf?.(props.element.id),
        ),
      }}
    >
      <ShapeView
        resolveAsset={(source) => {
          imageSignals?.rev();
          return props.editor.assets.resolve(source);
        }}
        element={props.element}
        box={box}
        selected={false}
        exposeAccessibility
      />
    </div>
  ) : null;
}
