import type { Editor } from "@nodetto/core";
import type { PageId } from "@nodetto/ir";
import {
  createEffect,
  createMemo,
  createSignal,
  onCleanup,
  onMount,
} from "solid-js";
import { createEditorSignals } from "../adapter.ts";
import { createPresentationController } from "./controller.ts";
import "./Presentation.css";

export interface PresentationViewProps {
  editor: Editor;
  from: PageId | null;
  onExit: (lastPageId: PageId) => void;
}
export function PresentationView(props: PresentationViewProps) {
  const controller = createPresentationController(props);
  const { rev } = createEditorSignals(props.editor);
  const [version, setVersion] = createSignal(0);
  const [viewport, setViewport] = createSignal({
    width: window.innerWidth,
    height: window.innerHeight,
  });
  const [visible, setVisible] = createSignal(true);
  let root!: HTMLDivElement;
  let timer: ReturnType<typeof setTimeout> | undefined;
  const update = () => setVersion((v) => v + 1);
  const dispatch = (action: Parameters<typeof controller.dispatch>[0]) => {
    controller.dispatch(action);
    update();
  };
  const showControls = () => {
    setVisible(true);
    clearTimeout(timer);
    timer = setTimeout(() => setVisible(false), 2000);
  };
  createEffect(() => {
    rev();
    controller.refresh();
    update();
  });
  const slide = createMemo(() => {
    version();
    rev();
    return controller.slide();
  });
  const box = createMemo(() => {
    version();
    rev();
    return controller.layout(viewport());
  });
  const state = () => {
    version();
    return controller.state();
  };
  const counter = () => {
    version();
    return controller.counterText();
  };
  onMount(() => {
    const previous = document.activeElement;
    const key = (event: KeyboardEvent) => {
      controller.handleKeyDown(event);
      update();
    };
    const resize = () =>
      setViewport({ width: window.innerWidth, height: window.innerHeight });
    window.addEventListener("keydown", key, true);
    window.addEventListener("resize", resize);
    root.focus();
    showControls();
    onCleanup(() => {
      window.removeEventListener("keydown", key, true);
      window.removeEventListener("resize", resize);
      clearTimeout(timer);
      if (previous instanceof HTMLElement) previous.focus();
    });
  });
  return (
    <div
      ref={root}
      class="nodetto-presentation"
      classList={{ "controls-hidden": !visible() }}
      tabIndex={-1}
      onPointerMove={showControls}
    >
      <div
        class="presentation-stage"
        onClick={(event) => {
          if (event.button === 0) dispatch({ type: "next" });
        }}
      >
        {!state()?.black && (
          <div
            class="presentation-slide"
            style={{
              left: `${box().x}px`,
              top: `${box().y}px`,
              width: `${box().width}px`,
              height: `${box().height}px`,
            }}
          >
            {slide().src && (
              <img
                src={slide().src ?? undefined}
                alt="Presentation slide"
                draggable={false}
              />
            )}
          </div>
        )}
      </div>
      <div
        class="presentation-controls"
        classList={{ hidden: !visible() }}
        onClick={(event) => event.stopPropagation()}
      >
        <button
          type="button"
          aria-label="Previous slide"
          onClick={() => dispatch({ type: "prev" })}
        >
          Previous
        </button>
        <span>{counter()}</span>
        <button
          type="button"
          aria-label="Next slide"
          onClick={() => dispatch({ type: "next" })}
        >
          Next
        </button>
        <button type="button" onClick={() => dispatch("exit")}>
          Exit
        </button>
      </div>
    </div>
  );
}
