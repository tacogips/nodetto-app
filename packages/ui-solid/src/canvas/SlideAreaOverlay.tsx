import {
  expandSlides,
  slideList,
  resolveSlideRect,
  slideLabel,
  type Editor,
} from "@nodetto/core";
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
    const meta = props.editor.store.getMeta();
    const show = effectiveShowSlideArea(props.show(), meta.slideSize);
    // Framing the page's content measures every element on it; skip that
    // for the usual case of a page that shows no slide area at all.
    if (!show) return null;
    const pageId = props.editor.currentPageId;
    const page = props.editor.store.getPage(pageId);
    const pages = props.editor.store.listPages();
    const counts = new Map<string, number>();
    for (const ref of expandSlides(
      props.editor.store,
      props.editor.registry,
      slideList(pages),
    ))
      counts.set(ref.page, (counts.get(ref.page) ?? 0) + 1);
    return slideAreaModel({
      rect: resolveSlideRect(
        props.editor.store,
        props.editor.registry,
        pageId,
        { slideSize: meta.slideSize, slideOrigin: page?.slideOrigin },
      ),
      label: slideLabel(pages, pageId, counts),
      show,
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
