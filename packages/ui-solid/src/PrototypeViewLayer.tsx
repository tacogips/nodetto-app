import {
  frameTitleBox,
  prototypeFlows,
  prototypeLinkGeometry,
  resolveTitlePlacement,
  type Editor,
} from "@nodetto/core";
import type {
  ElementId,
  FrameSemantic,
  GenericEdgeSemantic,
} from "@nodetto/ir";
import { createMemo, For, Show, type Accessor } from "solid-js";

export interface PrototypeViewLayerProps {
  readonly editor: Editor;
  readonly revision: Accessor<number>;
  readonly onSelect: (id: ElementId) => void;
}

/** Overlay coordinates are page coordinates, shared with the canvas SVG. */
export function PrototypeViewLayer(props: PrototypeViewLayerProps) {
  const model = createMemo(() => {
    props.revision();
    const { editor } = props;
    const context = editor.createShapeContext();
    const page = editor.currentPageId;
    const links = editor.store.getPageElements(page).flatMap((link) => {
      if (link.type !== "edge.generic" || context.isHidden?.(link.id))
        return [];
      const semantic = link.semantic as GenericEdgeSemantic;
      if (!semantic.prototype || !semantic.from || !semantic.to) return [];
      if (
        editor.store.get(semantic.from)?.page !== page ||
        editor.store.get(semantic.to)?.page !== page
      )
        return [];
      const geometry = prototypeLinkGeometry(editor.store, context, link);
      return geometry ? [{ id: link.id, geometry }] : [];
    });
    const flags = prototypeFlows(editor.store, context).flows.flatMap(
      (flow) => {
        const frame = editor.store.get(flow.startId);
        const box = context.boundsOf(flow.startId);
        if (!frame || frame.page !== page || !box) return [];
        const semantic = frame.semantic as FrameSemantic;
        const title = frameTitleBox(box, semantic);
        const y =
          (title && resolveTitlePlacement(semantic) === "outside"
            ? title.y
            : box.y) - 8;
        return [{ name: flow.name, x: box.x, y }];
      },
    );
    return { links, flags };
  });
  const select = (id: ElementId, event: PointerEvent) => {
    event.stopPropagation();
    props.onSelect(id);
  };
  return (
    <g class="prototype-view-layer">
      <For each={model().links}>
        {({ id, geometry }) => {
          const width = () => Math.max(36, geometry.label.length * 6.6 + 12);
          const labelWidth = () => geometry.label.length * 6.6 + 10;
          const direction = () =>
            geometry.end && geometry.end.x < geometry.start.x ? -1 : 1;
          const arrow = () => {
            const end = geometry.end;
            if (!end) return "";
            return `M ${end.x - direction() * 8} ${end.y - 4} L ${end.x} ${end.y} L ${end.x - direction() * 8} ${end.y + 4} Z`;
          };
          return (
            <g
              data-prototype-link={id}
              pointer-events="all"
              onPointerDown={(event) => select(id, event)}
              style={{ cursor: "pointer" }}
            >
              <Show when={geometry.kind === "back-tag"}>
                <rect
                  x={geometry.start.x}
                  y={geometry.start.y - 18}
                  width={width()}
                  height="18"
                  rx="4"
                  fill="#7c3aed"
                />
                <text
                  x={geometry.start.x + 6}
                  y={geometry.start.y - 5}
                  fill="white"
                  font-size="11"
                >
                  {geometry.label}
                </text>
              </Show>
              <Show
                when={geometry.kind === "curve" && geometry.end && geometry.d}
              >
                <path
                  d={geometry.d}
                  fill="none"
                  stroke="transparent"
                  stroke-width="12"
                  vector-effect="non-scaling-stroke"
                />
                <path
                  d={geometry.d}
                  fill="none"
                  stroke="#7c3aed"
                  stroke-width="2"
                  vector-effect="non-scaling-stroke"
                />
                <circle
                  cx={geometry.start.x}
                  cy={geometry.start.y}
                  r="3"
                  fill="#7c3aed"
                />
                <path d={arrow()} fill="#7c3aed" />
                <Show when={geometry.label}>
                  <rect
                    x={geometry.labelPoint.x - labelWidth() / 2}
                    y={geometry.labelPoint.y - 10}
                    width={labelWidth()}
                    height="18"
                    rx="4"
                    fill="white"
                  />
                  <text
                    x={geometry.labelPoint.x}
                    y={geometry.labelPoint.y + 3}
                    text-anchor="middle"
                    font-size="11"
                    fill="#7c3aed"
                  >
                    {geometry.label}
                  </text>
                </Show>
              </Show>
            </g>
          );
        }}
      </For>
      <For each={model().flags}>
        {(flag) => (
          <g data-prototype-flow={flag.name} pointer-events="none">
            <path
              d={`M ${flag.x} ${flag.y - 10} L ${flag.x + 10} ${flag.y - 5} L ${flag.x} ${flag.y} Z`}
              fill="#7c3aed"
            />
            <text x={flag.x + 15} y={flag.y} font-size="11" fill="#7c3aed">
              {flag.name}
            </text>
          </g>
        )}
      </For>
    </g>
  );
}
