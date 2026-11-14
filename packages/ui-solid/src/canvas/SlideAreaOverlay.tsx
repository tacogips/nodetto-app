import { resolveSlideRect, slideLabel, type Editor } from "@nodetto/core";
import { createMemo, Show, type Accessor, type JSX } from "solid-js";
import { effectiveShowSlideArea, slideAreaModel } from "./slide-area.ts";

export function SlideAreaOverlay(props: {
  editor: Editor;
  revision: Accessor<number>;
  zoom: Accessor<number>;
  show: Accessor<boolean | undefined>;
}): JSX.Element {
  const model = createMemo(() => {
    props.revision();
    const pageId = props.editor.currentPageId;
    const meta = props.editor.store.getMeta();
    const page = props.editor.store.getPage(pageId);
    return slideAreaModel({
      rect: resolveSlideRect(
        props.editor.store,
        props.editor.registry,
        pageId,
        { slideSize: meta.slideSize, slideOrigin: page?.slideOrigin },
      ),
      label: slideLabel(props.editor.store.listPages(), pageId),
      show: effectiveShowSlideArea(props.show(), meta.slideSize),
    });
  });
  return (
    <Show when={model()}>
      {(value) => {
        const r = () => value().rect;
        const path = () =>
          `M ${r().x - 100000} ${r().y - 100000} h ${r().width + 200000} v ${r().height + 200000} h ${-r().width - 200000} Z M ${r().x} ${r().y} h ${r().width} v ${r().height} h ${-r().width} Z`;
        return (
          <g class="nodetto-slide-area" pointer-events="none">
            <Show when={value().dim}>
              <path d={path()} fill-rule="evenodd" fill="rgba(0,0,0,0.06)" />
            </Show>
            <rect
              x={r().x}
              y={r().y}
              width={r().width}
              height={r().height}
              fill="none"
              stroke="currentColor"
              stroke-dasharray="6 4"
              vector-effect="non-scaling-stroke"
            />
            <Show when={value().label}>
              <text
                x={r().x}
                y={r().y - 6 / props.zoom()}
                font-size={`${12 / props.zoom()}`}
                fill="currentColor"
              >
                {value().label}
              </text>
            </Show>
          </g>
        );
      }}
    </Show>
  );
}
