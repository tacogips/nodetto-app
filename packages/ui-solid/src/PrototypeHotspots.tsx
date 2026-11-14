// Clickable hotspots for the prototype links of one surface. Each hotspot
// matches its trigger (click, hover, press) and hands the link to the preview.

import { clipCss, type Editor } from "@nodetto/core";
import { For, type JSX, Show } from "solid-js";
import { prototypeEventMatches } from "./prototype-trigger.ts";
import {
  type PrototypeView,
  prototypeIsFixed,
  prototypeSurfaceContext,
} from "./prototype-surface.ts";
import type { PrototypeVariantMode } from "./prototype-variant-state.ts";

export type PrototypePreviewLink = PrototypeView["links"][number];

/** The preview's link handlers that hotspots invoke. */
export interface PrototypeLinkHandlers {
  readonly activate: (link: PrototypePreviewLink, transient?: boolean) => void;
  readonly changeVariant: (
    link: PrototypePreviewLink,
    mode: PrototypeVariantMode,
  ) => void;
  readonly beginPress: (link: PrototypePreviewLink, pointerId: number) => void;
  readonly consumeSuppressedClick: (frameId: string) => boolean;
}

export function PrototypeHotspots(hotspotProps: {
  readonly runtime: Editor;
  readonly view: PrototypeView;
  readonly fixed: boolean;
  readonly handlers: PrototypeLinkHandlers;
}): JSX.Element {
  const { activate, beginPress, changeVariant, consumeSuppressedClick } =
    hotspotProps.handlers;
  const context = prototypeSurfaceContext(
    hotspotProps.runtime,
    hotspotProps.view,
  );
  return (
    <For
      each={hotspotProps.view.links.filter(
        (link) =>
          prototypeIsFixed(
            hotspotProps.runtime,
            hotspotProps.view,
            link.from,
          ) === hotspotProps.fixed,
      )}
    >
      {(link) => (
        <Show when={link.trigger !== "after-delay"}>
          <div
            style={{
              position: "absolute",
              inset: 0,
              "pointer-events": "none",
              "clip-path": clipCss(
                context.clipPolygonOf?.(link.from) ??
                  context.clipOf?.(link.from),
              ),
            }}
          >
            <button
              type="button"
              class="nodetto-prototype-hotspot"
              aria-label={link.label}
              role={link.role}
              disabled={link.disabled}
              title={`${link.label} (${link.trigger})`}
              style={{
                "pointer-events": "auto",
                transform: link.rotation
                  ? `rotate(${link.rotation}deg)`
                  : undefined,
                "transform-origin": "center",
                left: `${link.box.x}px`,
                top: `${link.box.y}px`,
                width: `${link.box.width}px`,
                height: `${link.box.height}px`,
                "clip-path": clipCss(link.hitPolygon),
                "mask-image": link.hitMask ?? undefined,
                "mask-repeat": link.hitMask ? "no-repeat" : undefined,
                "mask-size": link.hitMask ? "100% 100%" : undefined,
              }}
              onClick={(event) => {
                if (consumeSuppressedClick(hotspotProps.view.frame.id)) {
                  event.preventDefault();
                  event.stopPropagation();
                  return;
                }
                if (
                  prototypeEventMatches(
                    link.trigger,
                    event.detail === 0 ? "keyboard-activate" : "click",
                  )
                )
                  activate(link);
              }}
              onPointerEnter={() => {
                if (prototypeEventMatches(link.trigger, "pointer-enter"))
                  activate(link, link.action === "change-to");
              }}
              onPointerLeave={() => {
                if (link.action === "change-to" && link.trigger === "hover")
                  changeVariant(link, "restore");
              }}
              onPointerDown={(event) => {
                if (
                  event.isPrimary &&
                  event.button === 0 &&
                  prototypeEventMatches(link.trigger, "pointer-down")
                )
                  link.action === "change-to"
                    ? beginPress(link, event.pointerId)
                    : activate(link);
              }}
            />
          </div>
        </Show>
      )}
    </For>
  );
}
