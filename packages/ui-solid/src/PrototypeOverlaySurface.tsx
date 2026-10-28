// One open prototype overlay: an optional backdrop that dismisses it and the
// overlay screen itself, placed over the base screen with its own scrolling
// surface and hotspots. Only the topmost overlay is interactive.

import type { Editor } from "@nodetto/core";
import type { Element, FrameSemantic } from "@nodetto/ir";
import { For, type JSX, Show } from "solid-js";
import {
  type PrototypeLinkHandlers,
  PrototypeHotspots,
} from "./PrototypeHotspots.tsx";
import { PrototypeLayer } from "./PrototypeLayer.tsx";
import {
  prototypeOverlayPlacement,
  type PrototypeOverlayEntry,
} from "./prototype-overlays.ts";
import {
  prototypeElementsById,
  prototypeIsFixed,
  prototypeScrollMode,
  prototypeSurfaceContext,
  type PrototypeView,
  prototypeVisualRoots,
} from "./prototype-surface.ts";
import type { PrototypeSurfaceScroll } from "./prototype-surface-scroll.ts";

export function PrototypeOverlaySurface(props: {
  readonly runtime: Editor;
  readonly overlay: {
    readonly entry: PrototypeOverlayEntry;
    readonly view: PrototypeView;
  };
  /** Bounds of the base screen the overlay is placed over. */
  readonly screenBounds: PrototypeView["bounds"];
  /** Whether this is the topmost, interactive overlay. */
  readonly top: boolean;
  readonly markerPrefix: string;
  readonly scroll: PrototypeSurfaceScroll;
  readonly handlers: PrototypeLinkHandlers;
  readonly onDismiss: () => void;
}): JSX.Element {
  const { overlay, runtime, markerPrefix } = props;
  const {
    beginScrollGesture,
    finishScrollGesture,
    keyboardScrollSurface,
    moveScrollGesture,
    scrollAt,
    scrollSurface,
  } = props.scroll;
  const elementsById = prototypeElementsById;
  const scrollMode = prototypeScrollMode;
  const visualRoots = (view: PrototypeView): readonly Element[] =>
    prototypeVisualRoots(runtime, view);
  const isFixed = (view: PrototypeView, id: string): boolean =>
    prototypeIsFixed(runtime, view, id);
  const surfaceContext = (view: PrototypeView) =>
    prototypeSurfaceContext(runtime, view);
  const placement = () =>
    prototypeOverlayPlacement(
      props.screenBounds,
      overlay.view.bounds,
      overlay.entry,
    );
  const top = () => props.top;
  return (
    <div
      data-prototype-overlay={overlay.entry.key}
      style={{
        position: "absolute",
        inset: 0,
        background: overlay.entry.backdrop
          ? "rgba(0, 0, 0, 0.35)"
          : "transparent",
        "pointer-events": top() ? "auto" : "none",
      }}
      onClick={() => {
        if (top()) props.onDismiss();
      }}
      onPointerDown={(event) => event.stopPropagation()}
      onWheel={(event) => event.stopPropagation()}
      onKeyDown={(event) => event.stopPropagation()}
    >
      <div
        role="dialog"
        tabIndex={top() ? 0 : -1}
        data-prototype-active-surface={top() ? "true" : undefined}
        aria-label={
          (overlay.view.frame.semantic as FrameSemantic).name ||
          "Prototype overlay"
        }
        style={{
          position: "absolute",
          left: `${placement().x - props.screenBounds.x}px`,
          top: `${placement().y - props.screenBounds.y}px`,
          width: `${overlay.view.bounds.width}px`,
          height: `${overlay.view.bounds.height}px`,
          overflow: "hidden",
          background: "white",
          "touch-action": scrollMode(overlay.view) === "none" ? "auto" : "none",
        }}
        onPointerDown={(event) => {
          beginScrollGesture(event, overlay.view);
          event.stopPropagation();
        }}
        onPointerMove={(event) => moveScrollGesture(event, overlay.view)}
        onPointerUp={finishScrollGesture}
        onPointerCancel={finishScrollGesture}
        onClick={(event) => event.stopPropagation()}
        onWheel={(event) => {
          if (top()) scrollSurface(event, overlay.view);
        }}
        onKeyDown={(event) => {
          if (top()) keyboardScrollSurface(event, overlay.view);
        }}
      >
        <div
          style={{
            position: "absolute",
            left: `${-overlay.view.bounds.x}px`,
            top: `${-overlay.view.bounds.y}px`,
          }}
        >
          <For
            each={overlay.view.elements.filter(
              (element) => element.id === overlay.view.frame.id,
            )}
          >
            {(element) => (
              <PrototypeLayer
                editor={runtime}
                element={element}
                elements={elementsById(overlay.view)}
                markerPrefix={`${markerPrefix}overlay-`}
                context={surfaceContext(overlay.view)}
              />
            )}
          </For>
        </div>
        <div
          style={{
            position: "absolute",
            left: `${-overlay.view.bounds.x - scrollAt(overlay.view.frame.id).x}px`,
            top: `${-overlay.view.bounds.y - scrollAt(overlay.view.frame.id).y}px`,
          }}
        >
          <For
            each={visualRoots(overlay.view).filter(
              (element) => !isFixed(overlay.view, element.id),
            )}
          >
            {(element) => (
              <PrototypeLayer
                editor={runtime}
                element={element}
                elements={elementsById(overlay.view)}
                markerPrefix={`${markerPrefix}overlay-`}
                context={surfaceContext(overlay.view)}
              />
            )}
          </For>
          <Show when={top()}>
            <PrototypeHotspots
              runtime={runtime}
              view={overlay.view}
              fixed={false}
              handlers={props.handlers}
            />
          </Show>
        </div>
        <div
          style={{
            position: "absolute",
            left: `${-overlay.view.bounds.x}px`,
            top: `${-overlay.view.bounds.y}px`,
          }}
        >
          <For
            each={visualRoots(overlay.view).filter((element) =>
              isFixed(overlay.view, element.id),
            )}
          >
            {(element) => (
              <PrototypeLayer
                editor={runtime}
                element={element}
                elements={elementsById(overlay.view)}
                markerPrefix={`${markerPrefix}overlay-fixed-`}
                context={surfaceContext(overlay.view)}
              />
            )}
          </For>
          <Show when={top()}>
            <PrototypeHotspots
              runtime={runtime}
              view={overlay.view}
              fixed={true}
              handlers={props.handlers}
            />
          </Show>
        </div>
      </div>
    </div>
  );
}
