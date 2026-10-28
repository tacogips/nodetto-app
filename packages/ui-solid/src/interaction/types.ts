// The interaction controller's public contract and the gesture state
// machine it runs.

import type {
  Box,
  BreadboardPinRef,
  SelectionResizeSnapshot,
  SnapGuide,
  Vec,
  ViewportSize,
} from "@nodetto/core";
import type {
  ConnectorPort,
  ElementId,
  UmlComponentRelationshipKind,
} from "@nodetto/ir";
import type { Accessor } from "solid-js";
import type { ToolKind } from "../tools.ts";
import type { EditRegion, ResizeHandle } from "./geometry.ts";

export interface GridSnap {
  readonly size?: number;
  readonly origin?: Vec;
  readonly xLines: readonly number[];
  readonly yLines: readonly number[];
}

export interface PendingConnection {
  readonly from: Vec;
  readonly to: Vec;
}

export interface SnapSettings {
  readonly grid: boolean;
  readonly objects: boolean;
  /** Persistent page-guide snapping; omitted keeps the default enabled. */
  readonly guides?: boolean;
}

/** Which end of a connector an endpoint handle drags. */
export type ConnectorEnd = "from" | "to";

export interface ContextMenuPoint {
  readonly screen: Vec;
  readonly page: Vec;
}

/**
 * Runs `callback` after `delayMs` and returns a function that cancels it.
 * Injected so the nudge timer can be driven by hand in tests.
 */
export type Scheduler = (callback: () => void, delayMs: number) => () => void;

export type Gesture =
  | { readonly kind: "idle" }
  | {
      readonly kind: "rotating";
      readonly id: ElementId;
      readonly center: Vec;
      readonly startAngle: number;
      readonly rotation: number;
    }
  | {
      readonly kind: "rotating-selection";
      readonly center: Vec;
      readonly startAngle: number;
      lastDegrees: number;
    }
  | {
      readonly kind: "panning";
      lastScreen: Vec;
      readonly rightButton?: boolean;
      moved?: boolean;
    }
  | {
      readonly kind: "sequence-reorder";
      readonly id: ElementId;
      readonly axis: "x" | "y";
      readonly startScreen: Vec;
      readonly clickTarget: ElementId | null;
      moved: boolean;
    }
  | {
      readonly kind: "translating";
      readonly startPage: Vec;
      readonly startScreen: Vec;
      readonly origins: ReadonlyMap<ElementId, Vec>;
      /** Union of the moving elements' bounds before the drag. */
      readonly startBounds: Box | null;
      /** Bounds the moving box may snap to; computed once per drag. */
      readonly candidates: readonly Box[];
      readonly layoutGrid: GridSnap | null;
      /**
       * What a click (a drag that never travelled) selects on release: the
       * one level further in when a selected group's member was hit, or
       * the one hit element out of a multi-selection.
       */
      readonly clickTarget: ElementId | null;
      moved: boolean;
    }
  | {
      readonly kind: "resizing";
      readonly rotation: number;
      readonly id: ElementId;
      readonly handle: ResizeHandle;
      readonly startPage: Vec;
      readonly startBox: Box;
      readonly candidates: readonly Box[];
      readonly layoutGrid: GridSnap | null;
      /** ER/UML height follows rows, so Shift cannot couple it to width. */
      readonly derivedHeight: boolean;
      readonly aspectRatio?: number;
    }
  | {
      readonly kind: "resizing-selection";
      readonly snapshot: SelectionResizeSnapshot;
      readonly handle: ResizeHandle;
      readonly startPage: Vec;
      readonly candidates: readonly Box[];
      readonly layoutGrid: GridSnap | null;
    }
  | {
      readonly kind: "routing-bend";
      readonly startScreen: Vec;
      moved: boolean;
      readonly id: ElementId;
      readonly axis: "x" | "y";
      readonly from: number;
      readonly to: number;
    }
  | {
      readonly kind: "routing-waypoint";
      readonly startScreen: Vec;
      moved: boolean;
      readonly id: ElementId;
      readonly index: number;
      readonly fromCenter: Vec;
      readonly toCenter: Vec;
    }
  | {
      readonly kind: "breadboard-wire-point";
      readonly id: ElementId;
      readonly index: number;
      readonly origin: Vec;
      readonly points: readonly Vec[];
      moved: boolean;
      readonly startScreen: Vec;
    }
  | {
      readonly kind: "connecting";
      readonly startPage: Vec;
      readonly fromPoint?: Vec;
      readonly fromPort?: ConnectorPort;
      readonly from: ElementId;
      readonly componentKind?: UmlComponentRelationshipKind;
      readonly connectorType?: string;
      readonly logicalRelation?: boolean;
      readonly screenTransition?: boolean;
    }
  | {
      readonly kind: "reconnecting";
      readonly id: ElementId;
      readonly end: ConnectorEnd;
      /** The endpoint that stays put; never a valid drop target. */
      readonly other: ElementId;
      /** Where the rubber band is pinned, in page space. */
      readonly anchor: Vec;
    }
  | {
      readonly kind: "marquee";
      readonly startPage: Vec;
      /** Selection to keep underneath the brush (shift-drag adds). */
      readonly base: readonly ElementId[];
    };

/** The gesture variant with the given `kind`. */
export type GestureOf<K extends Gesture["kind"]> = Extract<
  Gesture,
  { readonly kind: K }
>;

export interface InteractionOptions {
  readonly tool: Accessor<ToolKind>;
  readonly setTool: (tool: ToolKind) => void;
  readonly container: () => HTMLElement | undefined;
  /** Fires as the marquee rectangle changes; `null` when the drag ends. */
  readonly onMarquee?: (rect: Box | null) => void;
  /** Exact page point selected by the review-comment placement tool. */
  readonly onCommentPlace?: (point: Vec) => void;
  /** Snapping switches; both off when omitted. */
  readonly snap?: Accessor<SnapSettings>;
  /** Canvas size in CSS pixels, for fit-to-view and zoom anchors. */
  readonly viewport?: Accessor<ViewportSize>;
  /** A double-click, Enter or F2, or a freshly placed text element. */
  readonly onEditRequest?: (id: ElementId, region: EditRegion) => void;
  /** Right-click or Shift+F10; `hit` is the (group-resolved) element. */
  readonly onContextMenu?: (
    at: ContextMenuPoint,
    hit: ElementId | null,
  ) => void;
  /** Timer for nudge coalescing; `setTimeout` when omitted. */
  readonly schedule?: Scheduler;
  /** Coalesce resize, rotation, routing and translation updates to repaint cadence; omitted for synchronous hosts. */
  readonly scheduleDragFrame?: (callback: () => void) => () => void;
}

export interface Interaction {
  placeTool(tool: ToolKind, point: Vec): void;
  onPointerDown(event: PointerEvent): void;
  onPointerMove(event: PointerEvent): void;
  onPointerUp(event: PointerEvent): void;
  onPointerCancel(event: PointerEvent): void;
  onWheel(event: WheelEvent): void;
  onKeyDown(event: KeyboardEvent): void;
  onKeyUp(event: KeyboardEvent): void;
  onDoubleClick(event: MouseEvent): void;
  onContextMenu(event: MouseEvent): void;
  /** The canvas lost focus: release the temporary hand, close open nudges. */
  onBlur(): void;
  startResize(id: ElementId, handle: ResizeHandle, event: PointerEvent): void;
  startResizeSelection(handle: ResizeHandle, event: PointerEvent): void;
  startRotate(id: ElementId, event: PointerEvent): void;
  startRotateSelection(center: Vec, event: PointerEvent): void;
  /** Drag the middle channel of a selected orthogonal connector. */
  startRouteBend(id: ElementId, event: PointerEvent): void;
  startRouteWaypoint(id: ElementId, index: number, event: PointerEvent): void;
  startBreadboardWirePoint(
    id: ElementId,
    index: number,
    event: PointerEvent,
  ): void;
  /** Drag one end of a connector to another element. */
  startReconnect(id: ElementId, end: ConnectorEnd, event: PointerEvent): void;
  /** Drag a new connector out of `from`, as the edge tool would. */
  startConnect(
    from: ElementId,
    event: PointerEvent,
    port?: ConnectorPort,
  ): void;
  /** Close a pending nudge batch now rather than when its timer fires. */
  flushNudge(): void;
  /** Cancel pending drag work and release subscriptions when the canvas unmounts. */
  dispose(): void;
  readonly pending: Accessor<PendingConnection | null>;
  /** The marquee rectangle while brush-selecting, in page space. */
  readonly marquee: Accessor<Box | null>;
  /** Snap guides for the drag in progress; empty between gestures. */
  readonly guides: Accessor<readonly SnapGuide[]>;
  /** The element a connector end would land on if released now. */
  readonly hoverTarget: Accessor<ElementId | null>;
  /** True while space is held and the pointer pans instead of selecting. */
  readonly temporaryHand: Accessor<boolean>;
  /** True for an active hand, space, middle-button or right-button pan. */
  readonly panning: Accessor<boolean>;
  readonly wireDraft: Accessor<readonly Vec[] | null>;
  readonly breadboardHover: Accessor<
    BreadboardPinRef | { wireId: ElementId } | null
  >;
  readonly pcbHover: Accessor<string>;
  readonly pcbDraft: Accessor<readonly Vec[] | null>;
}
