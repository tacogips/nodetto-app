import {
  Editor,
  prototypeDelayedLink,
  prototypeFitScale,
  prototypeScreen,
  prototypeSmartPlan,
  prototypeSmartPlanBetween,
} from "@nodetto/core";
import type { Element, FrameSemantic, PrototypeTransition } from "@nodetto/ir";
import {
  createMemo,
  createEffect,
  createSignal,
  createUniqueId,
  For,
  type JSX,
  onMount,
  onCleanup,
  Show,
} from "solid-js";
import { createEditorSignals } from "./adapter.ts";
import {
  type PrototypeLinkHandlers,
  PrototypeHotspots,
} from "./PrototypeHotspots.tsx";
import { PrototypeLayer } from "./PrototypeLayer.tsx";
import { PrototypeOverlaySurface } from "./PrototypeOverlaySurface.tsx";
import { PrototypeAnimation } from "./prototype-transition.ts";
import { PrototypeSurfaceFocus } from "./prototype-surface-focus.ts";
import {
  popPrototypeOverlay,
  dismissPrototypeOverlay,
  pushPrototypeOverlay,
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
import { createPrototypeSurfaceScroll } from "./prototype-surface-scroll.ts";
import {
  PrototypeVariantState,
  type PrototypeVariantMode,
} from "./prototype-variant-state.ts";

export function PrototypePreview(props: {
  editor: Editor;
  onClose: () => void;
  toolbar?: JSX.Element;
}): JSX.Element {
  let dialog: HTMLDialogElement | undefined;
  let stage: HTMLDivElement | undefined;
  let outgoingLayer: HTMLDivElement | undefined;
  let outgoingTimer: number | undefined;
  let navigationVersion = 0;
  let overlayVersion = 0;
  const animation = new PrototypeAnimation();
  const surfaceFocus = new PrototypeSurfaceFocus();
  const runtime = new Editor({
    document: props.editor.getSnapshot(),
    registry: props.editor.registry,
  });
  runtime.assets.copyFrom(props.editor.assets);
  onCleanup(
    props.editor.assets.subscribe(() =>
      runtime.assets.copyFrom(props.editor.assets),
    ),
  );
  const variantState = new PrototypeVariantState();
  const delayedFired = new Set<string>();
  const pressCleanups = new Set<() => void>();
  const markerPrefix = `prototype-${createUniqueId()}-`;
  const previousFocus = document.activeElement;
  onMount(() => dialog?.showModal());
  onCleanup(() => {
    navigationVersion += 1;
    if (outgoingTimer !== undefined) window.clearTimeout(outgoingTimer);
    scrolling.dispose();
    animation.cancel();
    surfaceFocus.dispose();
    for (const cleanup of pressCleanups) cleanup();
    // Cleanup runs before the modal leaves the DOM. Restore focus only once
    // the dialog no longer makes the toolbar inert.
    queueMicrotask(() => {
      if (previousFocus instanceof HTMLElement && previousFocus.isConnected)
        previousFocus.focus();
    });
  });
  const sourceSignals = createEditorSignals(props.editor);
  const signals = createEditorSignals(runtime);
  const frames = () => {
    signals.rev();
    return runtime
      .getSnapshot()
      .elements.filter(
        (item) =>
          item.type === "frame" &&
          !runtime.createShapeContext().isHidden?.(item.id),
      );
  };
  const start = frames().find(
    (item) => (item.semantic as FrameSemantic).prototypeStart,
  );
  const selected =
    start ??
    frames().find((item) => props.editor.selection.has(item.id)) ??
    frames()[0];
  const [current, setCurrent] = createSignal(selected?.id ?? "");
  const [outgoing, setOutgoing] = createSignal<{
    readonly view: PrototypeView;
    readonly ids: ReadonlySet<string>;
  }>();
  const [history, setHistory] = createSignal<string[]>([]);
  const [overlays, setOverlays] = createSignal<
    readonly PrototypeOverlayEntry[]
  >([]);
  const scrolling = createPrototypeSurfaceScroll(runtime, () => scale());
  const [zoom, setZoom] = createSignal("fit");
  const [scroll, setScroll] = createSignal<HTMLDivElement>();
  const [viewport, setViewport] = createSignal({ width: 0, height: 0 });
  createEffect(() => {
    sourceSignals.rev();
    runtime.loadDocument(props.editor.getSnapshot());
    runtime.assets.copyFrom(props.editor.assets);
    variantState.clear();
    delayedFired.clear();
    setOverlays([]);
    scrolling.reset();
    if (!runtime.store.get(current())) {
      const fallback = frames()[0];
      setCurrent(fallback?.id ?? "");
      setHistory([]);
    }
  });
  createEffect(() => {
    const element = scroll();
    if (!element) return;
    const measure = (): void => {
      setViewport({ width: element.clientWidth, height: element.clientHeight });
    };
    measure();
    if (typeof ResizeObserver !== "undefined") {
      const observer = new ResizeObserver(measure);
      observer.observe(element);
      onCleanup(() => observer.disconnect());
    }
  });
  const screen = createMemo(() => {
    signals.rev();
    return prototypeScreen(runtime, current());
  });
  const overlayViews = createMemo(() => {
    signals.rev();
    return overlays().flatMap((entry) => {
      const view = prototypeScreen(runtime, entry.frameId);
      return view ? [{ entry, view }] : [];
    });
  });
  const activeFrame = (): string => overlays().at(-1)?.frameId ?? current();
  createEffect(() => {
    surfaceFocus.update(
      overlayViews().at(-1)?.entry.key ?? null,
      () =>
        dialog?.querySelector<HTMLElement>(
          '[data-prototype-active-surface="true"]',
        ) ?? null,
    );
  });
  const activeView = (): PrototypeView | undefined =>
    overlayViews().at(-1)?.view ?? screen() ?? undefined;
  const elementsById = prototypeElementsById;
  const visualRoots = (view: PrototypeView): readonly Element[] =>
    prototypeVisualRoots(runtime, view);
  const isFixed = (view: PrototypeView, id: string): boolean =>
    prototypeIsFixed(runtime, view, id);
  const scrollMode = prototypeScrollMode;
  const surfaceContext = (view: PrototypeView) =>
    prototypeSurfaceContext(runtime, view);
  const {
    scrollAt,
    scrollSurface,
    keyboardScrollSurface,
    beginScrollGesture,
    moveScrollGesture,
    finishScrollGesture,
  } = scrolling;
  const showScreen = (
    id: string,
    transition: PrototypeTransition = "instant",
    duration = 250,
  ): void => {
    animation.cancel();
    if (outgoingTimer !== undefined) {
      window.clearTimeout(outgoingTimer);
      outgoingTimer = undefined;
    }
    outgoingLayer = undefined;
    setOutgoing(undefined);
    setOverlays([]);
    scrolling.reset();
    delayedFired.clear();
    const reducedMotion = window.matchMedia(
      "(prefers-reduced-motion: reduce)",
    ).matches;
    const hasMotion =
      !reducedMotion && Number.isFinite(duration) && duration > 0;
    const smartPlan =
      transition === "smart"
        ? prototypeSmartPlan(runtime, current(), id)
        : { steps: [], outgoing: [] };
    const source = screen();
    if (hasMotion && source && smartPlan.outgoing.length) {
      setOutgoing({ view: source, ids: new Set(smartPlan.outgoing) });
    }
    const version = ++navigationVersion;
    setCurrent(id);
    queueMicrotask(() => {
      if (version !== navigationVersion) return;
      const viewport = scroll();
      if (viewport) {
        viewport.scrollTop = 0;
        viewport.scrollLeft = 0;
      }
      if (transition === "smart") {
        const targets = new Map<string, HTMLElement>();
        for (const element of stage?.querySelectorAll<HTMLElement>(
          "[data-element-id]",
        ) ?? []) {
          const id = element.dataset.elementId;
          if (id) targets.set(id, element);
        }
        animation.playSmart(
          targets,
          smartPlan.steps,
          duration,
          reducedMotion,
          outgoingLayer,
        );
        if (outgoingLayer && hasMotion) {
          outgoingTimer = window.setTimeout(
            () => {
              if (version !== navigationVersion) return;
              outgoingTimer = undefined;
              outgoingLayer = undefined;
              setOutgoing(undefined);
            },
            Math.min(5000, duration),
          );
        }
      } else animation.play(stage, transition, duration, reducedMotion);
    });
  };
  const navigate = (
    id: string,
    transition: PrototypeTransition = "instant",
    duration = 250,
  ): void => {
    if (id === current()) return;
    setHistory([...history(), current()]);
    showScreen(id, transition, duration);
  };
  type PreviewLink = PrototypeView["links"][number];
  const animateVariant = (before: Editor, link: PreviewLink): void => {
    const reducedMotion = window.matchMedia(
      "(prefers-reduced-motion: reduce)",
    ).matches;
    queueMicrotask(() => {
      const targets = new Map<string, HTMLElement>();
      for (const element of stage?.querySelectorAll<HTMLElement>(
        "[data-element-id]",
      ) ?? []) {
        const id = element.dataset.elementId;
        if (id) targets.set(id, element);
      }
      if (link.transition === "smart")
        animation.playSmart(
          targets,
          prototypeSmartPlanBetween(before, runtime, activeFrame()).steps,
          link.duration,
          reducedMotion,
        );
      else
        animation.play(
          targets.get(link.from),
          link.transition,
          link.duration,
          reducedMotion,
        );
    });
  };
  const changeVariant = (
    link: PreviewLink,
    mode: PrototypeVariantMode,
  ): void => {
    const instance = runtime.store.get(link.from);
    const currentSource =
      instance?.type === "frame"
        ? (instance.semantic as FrameSemantic).instanceOf
        : undefined;
    if (!currentSource) return;
    const target = variantState.next(link.id, currentSource, link.to, mode);
    if (!target) return;
    const before = new Editor({
      document: runtime.getSnapshot(),
      registry: runtime.registry,
    });
    if (runtime.switchComponentVariant(link.from, target))
      animateVariant(before, link);
  };
  const activate = (link: PreviewLink, transient = false): void => {
    if (link.disabled) return;
    if (link.action === "change-to") {
      changeVariant(link, transient ? "activate" : "toggle");
      return;
    }
    if (link.action === "close-overlay") {
      const entry = overlays().at(-1);
      if (!entry) return;
      const target = [
        ...(stage?.querySelectorAll<HTMLElement>("[data-prototype-overlay]") ??
          []),
      ].find((element) => element.dataset.prototypeOverlay === entry.key);
      void animation
        .playExit(
          target,
          link.transition,
          link.duration,
          window.matchMedia("(prefers-reduced-motion: reduce)").matches,
        )
        .then(() => {
          if (overlays().at(-1)?.key === entry.key)
            setOverlays(popPrototypeOverlay(overlays()));
        });
      return;
    }
    if (link.action === "open-overlay") {
      const entry: PrototypeOverlayEntry = {
        key: `${link.id}-${++overlayVersion}`,
        frameId: link.to,
        position: link.overlayPosition,
        x: link.overlayX,
        y: link.overlayY,
        backdrop: link.overlayBackdrop,
        dismiss: link.overlayDismiss,
        transition: link.transition,
        duration: link.duration,
      };
      const next = pushPrototypeOverlay(overlays(), entry);
      if (next === overlays()) return;
      setOverlays(next);
      queueMicrotask(() => {
        const target = [
          ...(stage?.querySelectorAll<HTMLElement>(
            "[data-prototype-overlay]",
          ) ?? []),
        ].find((element) => element.dataset.prototypeOverlay === entry.key);
        if (!target) return;
        animation.play(
          target,
          entry.transition === "smart" ? "fade" : entry.transition,
          entry.duration,
          window.matchMedia("(prefers-reduced-motion: reduce)").matches,
        );
      });
      return;
    }
    navigate(link.to, link.transition, link.duration);
  };
  const beginPress = (link: PreviewLink, pointerId: number): void => {
    activate(link, true);
    const finish = (event: PointerEvent): void => {
      if (event.pointerId !== pointerId) return;
      cleanup();
      changeVariant(link, "restore");
    };
    const cleanup = (): void => {
      window.removeEventListener("pointerup", finish);
      window.removeEventListener("pointercancel", finish);
      pressCleanups.delete(cleanup);
    };
    pressCleanups.add(cleanup);
    window.addEventListener("pointerup", finish);
    window.addEventListener("pointercancel", finish);
  };
  createEffect(() => {
    const delayed = prototypeDelayedLink(activeView()?.links ?? []);
    const surfaceKey = `${current()}:${overlays()
      .map((entry) => entry.key)
      .join(":")}:${delayed?.id ?? ""}`;
    if (!delayed || delayedFired.has(surfaceKey)) return;
    const timer = window.setTimeout(() => {
      delayedFired.add(surfaceKey);
      activate(delayed);
    }, delayed.delay);
    onCleanup(() => window.clearTimeout(timer));
  });
  const scale = (): number =>
    zoom() === "fit"
      ? prototypeFitScale(
          screen()?.bounds ?? { width: 1, height: 1 },
          viewport(),
        )
      : Number(zoom());
  const linkHandlers: PrototypeLinkHandlers = {
    activate,
    changeVariant,
    beginPress,
    consumeSuppressedClick: scrolling.consumeSuppressedClick,
  };
  return (
    <dialog
      ref={(element) => {
        dialog = element;
      }}
      class="nodetto-prototype-overlay"
      aria-label="Prototype preview"
      on:keydown={(event) => event.stopPropagation()}
      on:keyup={(event) => event.stopPropagation()}
      on:cancel={(event) => {
        event.preventDefault();
        if (overlays().length) setOverlays(popPrototypeOverlay(overlays()));
        else props.onClose();
      }}
    >
      {props.toolbar}
      <header>
        <Show when={!props.toolbar}>
          <button type="button" onClick={props.onClose}>
            Close preview
          </button>
        </Show>
        <button
          type="button"
          disabled={!overlays().length && !history().length}
          onClick={() => {
            if (overlays().length) {
              setOverlays(popPrototypeOverlay(overlays()));
              return;
            }
            const previous = history().at(-1);
            setHistory(history().slice(0, -1));
            if (previous) showScreen(previous);
          }}
        >
          Back
        </button>
        <select
          aria-label="Preview screen"
          value={current()}
          onChange={(event) => navigate(event.currentTarget.value)}
        >
          <For each={frames()}>
            {(item) => (
              <option value={item.id}>
                {(item.semantic as FrameSemantic).name || "Artboard"}
              </option>
            )}
          </For>
        </select>
        <select
          aria-label="Preview zoom"
          value={zoom()}
          onChange={(event) => setZoom(event.currentTarget.value)}
        >
          <option value="fit">Fit screen</option>
          <option value="0.5">50%</option>
          <option value="1">100%</option>
          <option value="2">200%</option>
        </select>
      </header>
      <Show
        when={screen()}
        fallback={<p>Preview requires a visible artboard.</p>}
      >
        {(view) => (
          <div class="nodetto-prototype-scroll" ref={setScroll}>
            <div
              ref={(element) => {
                stage = element;
              }}
              style={{
                position: "relative",
                width: `${view().bounds.width * scale()}px`,
                height: `${view().bounds.height * scale()}px`,
                overflow: "hidden",
                margin: "24px auto",
              }}
            >
              <div
                style={{
                  position: "relative",
                  width: `${view().bounds.width}px`,
                  height: `${view().bounds.height}px`,
                  overflow: "hidden",
                  background: "white",
                  "transform-origin": "0 0",
                  transform: `scale(${scale()})`,
                }}
              >
                <div
                  tabIndex={overlays().length ? -1 : 0}
                  data-prototype-active-surface={
                    !overlays().length ? "true" : undefined
                  }
                  aria-label={`${(view().frame.semantic as FrameSemantic).name || "Screen"} prototype viewport`}
                  style={{
                    position: "absolute",
                    inset: 0,
                    overflow: "hidden",
                    "touch-action":
                      scrollMode(view()) === "none" ? "auto" : "none",
                  }}
                  onWheel={(event) => scrollSurface(event, view())}
                  onKeyDown={(event) => keyboardScrollSurface(event, view())}
                  onPointerDown={(event) => beginScrollGesture(event, view())}
                  onPointerMove={(event) => moveScrollGesture(event, view())}
                  onPointerUp={finishScrollGesture}
                  onPointerCancel={finishScrollGesture}
                >
                  <div
                    style={{
                      position: "absolute",
                      left: `${-view().bounds.x}px`,
                      top: `${-view().bounds.y}px`,
                    }}
                  >
                    <For
                      each={view().elements.filter(
                        (element) => element.id === view().frame.id,
                      )}
                    >
                      {(element) => (
                        <PrototypeLayer
                          editor={runtime}
                          element={element}
                          elements={elementsById(view())}
                          markerPrefix={markerPrefix}
                          context={surfaceContext(view())}
                        />
                      )}
                    </For>
                  </div>
                  <Show when={outgoing()}>
                    {(exit) => (
                      <div
                        ref={(element) => {
                          outgoingLayer = element;
                        }}
                        aria-hidden="true"
                        style={{
                          position: "absolute",
                          inset: 0,
                          overflow: "hidden",
                          "pointer-events": "none",
                        }}
                      >
                        <div
                          style={{
                            position: "absolute",
                            left: `${-exit().view.bounds.x}px`,
                            top: `${-exit().view.bounds.y}px`,
                          }}
                        >
                          <For
                            each={exit().view.elements.filter((element) =>
                              exit().ids.has(element.id),
                            )}
                          >
                            {(element) => (
                              <PrototypeLayer
                                editor={runtime}
                                element={element}
                                elements={elementsById(exit().view)}
                                markerPrefix={`${markerPrefix}outgoing-`}
                                context={surfaceContext(exit().view)}
                              />
                            )}
                          </For>
                        </div>
                      </div>
                    )}
                  </Show>
                  <div
                    style={{
                      position: "absolute",
                      left: `${-view().bounds.x - scrollAt(view().frame.id).x}px`,
                      top: `${-view().bounds.y - scrollAt(view().frame.id).y}px`,
                    }}
                  >
                    <For
                      each={visualRoots(view()).filter(
                        (element) => !isFixed(view(), element.id),
                      )}
                    >
                      {(element) => (
                        <PrototypeLayer
                          editor={runtime}
                          element={element}
                          elements={elementsById(view())}
                          markerPrefix={markerPrefix}
                          context={surfaceContext(view())}
                        />
                      )}
                    </For>
                    <Show when={!overlays().length}>
                      <PrototypeHotspots
                        runtime={runtime}
                        view={view()}
                        fixed={false}
                        handlers={linkHandlers}
                      />
                    </Show>
                  </div>
                  <div
                    style={{
                      position: "absolute",
                      left: `${-view().bounds.x}px`,
                      top: `${-view().bounds.y}px`,
                    }}
                  >
                    <For
                      each={visualRoots(view()).filter((element) =>
                        isFixed(view(), element.id),
                      )}
                    >
                      {(element) => (
                        <PrototypeLayer
                          editor={runtime}
                          element={element}
                          elements={elementsById(view())}
                          markerPrefix={markerPrefix}
                          context={surfaceContext(view())}
                        />
                      )}
                    </For>
                    <Show when={!overlays().length}>
                      <PrototypeHotspots
                        runtime={runtime}
                        view={view()}
                        fixed={true}
                        handlers={linkHandlers}
                      />
                    </Show>
                  </div>
                </div>
                <For each={overlayViews()}>
                  {(overlay, index) => (
                    <PrototypeOverlaySurface
                      runtime={runtime}
                      overlay={overlay}
                      screenBounds={view().bounds}
                      top={index() === overlays().length - 1}
                      markerPrefix={markerPrefix}
                      scroll={scrolling}
                      handlers={linkHandlers}
                      onDismiss={() =>
                        setOverlays(dismissPrototypeOverlay(overlays()))
                      }
                    />
                  )}
                </For>
              </div>
            </div>
          </div>
        )}
      </Show>
    </dialog>
  );
}
