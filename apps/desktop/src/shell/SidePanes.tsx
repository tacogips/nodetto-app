// The collapsible side panes and the dividers that resize them. The left
// pane holds shapes and layers, the right one the Inspector; both share the
// same frame, collapse and restore buttons, and keyboard-resizable divider.

import type { JSX } from "solid-js";
import { type PaneSide, paneBounds } from "../layout/pane.ts";
import type { PaneLayout } from "./pane-layout.ts";

export interface SidePaneProps {
  readonly layout: PaneLayout;
  readonly side: PaneSide;
  /** Names the pane in its aria-label and its collapse and restore buttons. */
  readonly label: string;
  /** The restore button's visible text. */
  readonly restoreText: string;
  readonly children: JSX.Element;
}

export function SidePane(props: SidePaneProps): JSX.Element {
  const open = () =>
    props.side === "left"
      ? props.layout.leftPaneOpen()
      : props.layout.rightPaneOpen();
  const contentId = () => `${props.side}-pane-content`;
  return (
    <aside
      class={`app-pane app-pane-${props.side}`}
      classList={{
        "is-collapsed": !open(),
        "is-overlay": open() && props.layout.paneOverlaysCanvas(),
      }}
      style={{
        "--pane-width": `${
          props.side === "left"
            ? props.layout.leftPaneWidth()
            : props.layout.rightPaneWidth()
        }px`,
      }}
      aria-label={props.label}
    >
      <div
        class="app-pane-content"
        id={contentId()}
        aria-hidden={!open()}
        inert={!open()}
      >
        <button
          type="button"
          class="app-pane-collapse"
          onClick={() => props.layout.hidePane(props.side)}
          aria-label={`Collapse ${props.label}`}
          aria-expanded="true"
          aria-controls={contentId()}
          ref={props.layout.setCollapseButton(props.side)}
          title={`Collapse ${props.label}`}
        >
          <svg viewBox="0 0 20 20" aria-hidden="true">
            <path
              d={props.side === "left" ? "M11 4l-5 6 5 6" : "M9 4l5 6-5 6"}
            />
          </svg>
        </button>
        {props.children}
      </div>
      <button
        type="button"
        class="app-pane-restore"
        onClick={() => props.layout.restorePane(props.side, true)}
        aria-label={`Show ${props.label}`}
        ref={props.layout.setRestoreButton(props.side)}
        aria-expanded="false"
        aria-controls={contentId()}
        title={`Show ${props.label}`}
      >
        {props.restoreText}
      </button>
    </aside>
  );
}

export interface PaneDividerProps {
  readonly layout: PaneLayout;
  readonly side: PaneSide;
  /** The pane this divider resizes, as its aria-label names it. */
  readonly label: string;
}

export function PaneDivider(props: PaneDividerProps): JSX.Element {
  const open = () =>
    props.side === "left"
      ? props.layout.leftPaneOpen()
      : props.layout.rightPaneOpen();
  const width = () =>
    props.side === "left"
      ? props.layout.leftPaneWidth()
      : props.layout.rightPaneWidth();
  return (
    <button
      type="button"
      class="app-pane-divider"
      classList={{
        "is-dragging": props.layout.draggingPane() === props.side,
        "is-overlay-divider": open() && props.layout.paneOverlaysCanvas(),
      }}
      style={
        open() && props.layout.paneOverlaysCanvas()
          ? { [props.side]: `${width() - 4}px` }
          : undefined
      }
      role="separator"
      aria-label={`Resize ${props.label}`}
      aria-orientation="vertical"
      aria-valuemin={paneBounds(props.layout.paneInput(props.side)).min}
      aria-valuemax={paneBounds(props.layout.paneInput(props.side)).max}
      aria-valuenow={width()}
      onPointerDown={(event) => props.layout.beginPaneResize(props.side, event)}
      onPointerMove={(event) => props.layout.movePaneResize(props.side, event)}
      onPointerUp={props.layout.endPaneResize}
      onPointerCancel={props.layout.endPaneResize}
      onKeyDown={(event) => props.layout.resizePaneByKey(props.side, event)}
    />
  );
}
