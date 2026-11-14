// Option and result types of the editor facade's public API.

import type {
  AccessibilityMetadata,
  Document,
  ElementId,
  FractionalIndex,
  PageId,
  PageKind,
  PageMode,
  Visual,
  VisualStyle,
} from "@nodetto/ir";
import type { BpmnRejection } from "../bpmn/connection.ts";
import type { CameraState } from "../camera.ts";
import type { Rng } from "../fractional.ts";
import type { IdSource } from "../ids.ts";
import type { ShapeUtilRegistry } from "../shape-util.ts";
import type { StoreDiff } from "../store.ts";

export interface EditorOptions {
  /** Document to open. A single empty freeform page is created otherwise. */
  readonly document?: Document;
  readonly registry?: ShapeUtilRegistry;
  readonly idSource?: IdSource;
  readonly rng?: Rng;
  readonly camera?: CameraState;
}

export interface ApplyOptions {
  /** `"ignore"` skips the history entry, e.g. when seeding a document. */
  readonly history?: "record" | "ignore";
  /**
   * Elements whose final position the batch sets explicitly (Tidy layout).
   * Moving or refitting their frame does not carry them a second time.
   */
  readonly placed?: ReadonlySet<ElementId>;
}

export interface CreateElementOptions {
  readonly page?: PageId;
  readonly id?: ElementId;
  readonly index?: FractionalIndex;
  readonly visual?: Partial<Visual>;
  readonly semantic?: unknown;
  readonly accessibility?: AccessibilityMetadata;
}

export type EditorListener = (diff: StoreDiff) => void;

/** The one text field a double-click edits on an element, by type. */
export type EditableField = "label" | "text" | "tableName" | "name" | "trigger";

/** A style change; `null` clears a field back to the stylesheet default. */
export type StylePatch = {
  readonly [K in keyof VisualStyle]?: VisualStyle[K] | null;
};

export interface CreatePageOptions {
  readonly id?: PageId;
  readonly name?: string;
  readonly kind?: PageKind;
  readonly mode?: PageMode;
}

export type BpmnEditResult =
  | { readonly ok: true; readonly id: ElementId; readonly type: string }
  | ({ readonly ok: false } & BpmnRejection);
