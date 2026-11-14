import {
  Editor,
  persistentLayerPairs,
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
import {
  initialScreen,
  presentationFlows,
  presentationKeyAction,
} from "./prototype-presentation.ts";
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
  flow?: string;
}): JSX.Element {
  let dialog: HTMLDialogElement | undefined;
  let stage: HTMLDivElement | undefined;
  let outgoingLayer: HTMLDivElement | undefined;
  let outgoingTimer: number | undefined;
  let persistentTimer: number | undefined;
  let hintTimer: number | undefined;
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
    if (persistentTimer !== undefined) window.clearTimeout(persistentTimer);
    if (hintTimer !== undefined) window.clearTimeout(hintTimer);
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
  const flows = () =>
    presentationFlows(runtime.store, runtime.createShapeContext());
  const selectedFrame = frames().find((item) =>
    props.editor.selection.has(item.id),
  )?.id;
  const initial = initialScreen(
    flows(),
    props.flow,
    selectedFrame,
    frames().map((item) => item.id),
  );
  const [current, setCurrent] = createSignal(initial ?? "");
  const [selectedFlow, setSelectedFlow] = createSignal(
    flows().find((flow) => flow.startId === initial)?.name ?? "",
  );
  const [device, setDevice] = createSignal(false);
  const [showHotspots, setShowHotspots] = createSignal(false);
  const [hint, setHint] = createSignal(false);
  const [persistent, setPersistent] = createSignal<ReadonlySet<string>>(
    new Set(),
  );
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
    if (persistentTimer !== undefined) window.clearTimeout(persistentTimer);
    setPersistent(new Set<string>());
    setOverlays([]);
    scrolling.reset();
    delayedFired.clear();
    const reducedMotion = window.matchMedia(
      "(prefers-reduced-motion: reduce)",
    ).matches;
    const hasMotion =
      !reducedMotion && Number.isFinite(duration) && duration > 0;
    let persistentSources = new Set<string>();
    if (hasMotion && transition !== "instant") {
      const pairs = persistentLayerPairs(
        runtime.store,
        runtime.createShapeContext(),
        current(),
        id,
      );
      persistentSources = new Set(pairs.map((pair) => pair.from));
      setPersistent(new Set(pairs.map((pair) => pair.to)));
      persistentTimer = window.setTimeout(
        () => {
          setPersistent(new Set<string>());
          persistentTimer = undefined;
        },
        Math.min(5000, duration),
      );
    }
    const smartPlan =
      transition === "smart"
        ? prototypeSmartPlan(runtime, current(), id)
        : { steps: [], outgoing: [] };
    const source = screen();
    if (hasMotion && source && smartPlan.outgoing.length) {
      setOutgoing({
        view: source,
        ids: new Set(
          smartPlan.outgoing.filter((id) => !persistentSources.has(id)),
        ),
      });
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
          smartPlan.steps.filter((step) => !persistent().has(step.target)),
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
  const goBack = (): void => {
    if (overlays().length) {
      setOverlays(popPrototypeOverlay(overlays()));
      return;
    }
    const previous = history().at(-1);
    if (previous) {
      setHistory(history().slice(0, -1));
      showScreen(previous);
    }
  };
  const restart = (): void => {
    const id = initialScreen(
      flows(),
      selectedFlow(),
      selectedFrame,
      frames().map((item) => item.id),
    );
    setHistory([]);
    if (id) showScreen(id);
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
    if (link.action === "back") {
      goBack();
      return;
    }
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
    if (link.action === "open-overlay" || link.action === "swap-overlay") {
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
      const base =
        link.action === "swap-overlay"
          ? popPrototypeOverlay(overlays())
          : overlays();
      const next = pushPrototypeOverlay(base, entry);
      if (next === base) return;
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
  onMount(() => {
    const onKey = (event: KeyboardEvent): void => {
      const target = event.target as HTMLElement;
      if (target.matches("input, textarea, select, [contenteditable=true]"))
        return;
      const action = presentationKeyAction(event.key, {
        overlays: overlays().length,
        history: history().length,
      });
      if (!action) return;
      event.preventDefault();
      if (action === "back" || action === "close-overlay") goBack();
      else if (action === "restart") restart();
      else props.onClose();
    };
    const onPointer = (event: PointerEvent): void => {
      const target = event.target;
      if (
        !(target instanceof globalThis.Element) ||
        !target.closest('[data-prototype-active-surface="true"]') ||
        target.closest(".nodetto-prototype-hotspot")
      )
        return;
      setHint(true);
      if (hintTimer !== undefined) window.clearTimeout(hintTimer);
      hintTimer = window.setTimeout(() => setHint(false), 600);
    };
    dialog?.addEventListener("keydown", onKey, true);
    dialog?.addEventListener("pointerdown", onPointer, true);
    onCleanup(() => {
      dialog?.removeEventListener("keydown", onKey, true);
      dialog?.removeEventListener("pointerdown", onPointer, true);
    });
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
      classList={{
        "nodetto-prototype-show-hotspots": showHotspots() || hint(),
      }}
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
          onClick={goBack}
        >
          Back
        </button>
        <Show when={flows().length}>
          <select
            aria-label="Preview flow"
            value={selectedFlow()}
            onChange={(event) => {
              const name = event.currentTarget.value;
              setSelectedFlow(name);
              const flow = flows().find((item) => item.name === name);
              setHistory([]);
              if (flow) showScreen(flow.startId);
            }}
          >
            <For each={flows()}>
              {(flow) => <option value={flow.name}>{flow.name}</option>}
            </For>
          </select>
        </Show>
        <button type="button" onClick={restart}>
          Restart
        </button>
        <button
          type="button"
          aria-pressed={device()}
          onClick={() => setDevice(!device())}
        >
          Device frame
        </button>
        <button
          type="button"
          aria-pressed={showHotspots()}
          onClick={() => setShowHotspots(!showHotspots())}
        >
          Show hotspots
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
              classList={{ "nodetto-prototype-device": device() }}
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
                  ref={(element) => {
                    stage = element;
                  }}
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
                        <div
                          classList={{
                            "nodetto-prototype-persistent-hidden":
                              persistent().has(element.id),
                          }}
                        >
                          <PrototypeLayer
                            editor={runtime}
                            element={element}
                            elements={elementsById(view())}
                            markerPrefix={markerPrefix}
                            context={surfaceContext(view())}
                          />{" "}
                        </div>
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
                        <div
                          classList={{
                            "nodetto-prototype-persistent-hidden":
                              persistent().has(element.id),
                          }}
                        >
                          <PrototypeLayer
                            editor={runtime}
                            element={element}
                            elements={elementsById(view())}
                            markerPrefix={markerPrefix}
                            context={surfaceContext(view())}
                          />{" "}
                        </div>
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
                <Show when={persistent().size > 0}>
                  <div
                    data-prototype-persistent="true"
                    aria-hidden="true"
                    style={{
                      position: "absolute",
                      inset: 0,
                      "pointer-events": "none",
                    }}
                  >
                    <div
                      style={{
                        position: "absolute",
                        left: `${-view().bounds.x}px`,
                        top: `${-view().bounds.y}px`,
                      }}
                    >
                      <For
                        each={visualRoots(view()).filter((element) =>
                          persistent().has(element.id),
                        )}
                      >
                        {(element) => (
                          <PrototypeLayer
                            editor={runtime}
                            element={element}
                            elements={elementsById(view())}
                            markerPrefix={`${markerPrefix}persistent-`}
                            context={surfaceContext(view())}
                          />
                        )}
                      </For>
                    </div>
                  </div>
                </Show>
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
