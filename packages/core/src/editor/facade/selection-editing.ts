import type {
  BooleanOperation,
  ElementId,
  PageId,
  TextResizeMode,
} from "@nodetto/ir";
import {
  type AlignMode,
  type DistributeAxis,
  planAlign,
  planDistribute,
  planMatchSize,
  type SizeDimension,
} from "../../align.ts";
import { type ArrangeOptions, planArrangement } from "../../arrange.ts";
import {
  planBooleanGroup,
  planFlattenBooleanGroup,
} from "../../boolean-operations.ts";
import {
  type ClipboardPayload,
  copyElements,
  copyElementsInDocument,
  PASTE_OFFSET,
} from "../../clipboard.ts";
import { planInsertCopies, topLevelAmong } from "../../editor/paste.ts";
import {
  planSelectionStyle,
  planSelectionTextResize,
} from "../../editor/style-text.ts";
import type { ApplyOptions, StylePatch } from "../../editor/types.ts";
import {
  canFrameSelection,
  planFrameSelection,
} from "../../frame-selection.ts";
import type { Vec } from "../../geometry.ts";
import { planGroup, planUngroup } from "../../group.ts";
import { planZOrder, type ZOrderAction } from "../../z-order.ts";
import { ElementEditing } from "./element-editing.ts";

export class SelectionEditing extends ElementEditing {
  /** Delete the selection; a selected group takes its members with it. */
  deleteSelection(applyOptions: ApplyOptions = {}): void {
    this.deleteElements(this.expandedSelection(), applyOptions);
  }

  /**
   * Snapshot the selection into the clipboard. False when there was nothing
   * to take — an empty selection, or one holding only connectors whose
   * endpoints were not selected. A failed copy leaves an earlier payload
   * alone rather than emptying the clipboard.
   */
  copySelection(): boolean {
    if (this.selection.size === 0) {
      return false;
    }
    const payload = copyElements(this.store, this.expandedSelection());
    if (payload.elements.length === 0) {
      return false;
    }
    this.clipboard.set(payload);
    return true;
  }

  /**
   * Copy, then delete. The delete is conditional on the copy: removing
   * elements the clipboard did not take would be a cut the user cannot paste
   * back.
   */
  cutSelection(applyOptions: ApplyOptions = {}): boolean {
    if (!this.copySelection()) {
      return false;
    }
    this.deleteSelection(applyOptions);
    return true;
  }

  canPaste(): boolean {
    return !this.clipboard.isEmpty;
  }

  /**
   * Paste the clipboard onto the current page, offset one step further out
   * for each paste of the same payload, and select what landed. One undo
   * step, whatever the fragment contains.
   */
  paste(applyOptions: ApplyOptions = {}): readonly ElementId[] {
    const payload = this.clipboard.get();
    if (payload === null || payload.elements.length === 0) {
      return [];
    }
    this.clipboard.pasteGeneration += 1;
    const step = PASTE_OFFSET * this.clipboard.pasteGeneration;
    return this.insertCopies(payload, { x: step, y: step }, applyOptions);
  }

  /**
   * Copy the selection next to itself without touching the clipboard, so a
   * duplicate does not cost the user whatever they had copied earlier.
   */
  duplicateSelection(applyOptions: ApplyOptions = {}): readonly ElementId[] {
    if (this.readOnly || this.selection.size === 0) {
      return [];
    }
    const payload = copyElementsInDocument(
      this.store,
      this.expandedSelection(),
    );
    if (payload.elements.length === 0) {
      return [];
    }
    return this.insertCopies(
      payload,
      { x: PASTE_OFFSET, y: PASTE_OFFSET },
      applyOptions,
      true,
    );
  }

  /**
   * Move the selection through the page's z-order. False when the action
   * would change nothing, so a shortcut at the top of the stack costs no
   * undo step.
   */
  reorderSelection(
    action: ZOrderAction,
    applyOptions: ApplyOptions = {},
  ): boolean {
    const commands = planZOrder(
      this.store,
      this.pageId,
      new Set(this.expandedSelection()),
      action,
      this.rng,
    );
    if (commands.length === 0) {
      return false;
    }
    this.apply(commands, applyOptions);
    return true;
  }

  bringToFront(applyOptions: ApplyOptions = {}): boolean {
    return this.reorderSelection("front", applyOptions);
  }

  bringForward(applyOptions: ApplyOptions = {}): boolean {
    return this.reorderSelection("forward", applyOptions);
  }

  sendBackward(applyOptions: ApplyOptions = {}): boolean {
    return this.reorderSelection("backward", applyOptions);
  }

  sendToBack(applyOptions: ApplyOptions = {}): boolean {
    return this.reorderSelection("back", applyOptions);
  }

  /** Move the selection by a page-space delta. False when nothing moved. */
  nudgeSelection(
    dx: number,
    dy: number,
    applyOptions: ApplyOptions = {},
  ): boolean {
    if (dx === 0 && dy === 0) {
      return false;
    }
    const moves = this.movableSelection().map((origin) => ({
      id: origin.id,
      x: origin.x + dx,
      y: origin.y + dy,
    }));
    if (moves.length === 0) {
      return false;
    }
    this.moveElements(moves, applyOptions);
    return true;
  }

  /**
   * Wrap the selection in a group and select it. `null` when there is
   * nothing to group: fewer than two units, or units on different pages.
   */
  groupSelection(applyOptions: ApplyOptions = {}): ElementId | null {
    const plan = planGroup(
      this.store,
      this.selection.ids(),
      this.idSource(),
      this.rng,
    );
    if (!plan) {
      return null;
    }
    this.apply(plan.commands, applyOptions);
    this.selection.set([plan.id]);
    return plan.id;
  }

  /** Wrap eligible selected outlines in one editable Boolean group. */
  booleanSelection(
    operation: BooleanOperation,
    applyOptions: ApplyOptions = {},
  ): ElementId | null {
    const plan = planBooleanGroup(
      this.store,
      this.selection.ids(),
      this.idSource(),
      this.rng,
      this.createShapeContext(),
      operation,
    );
    if (!plan) return null;
    this.apply(plan.commands, applyOptions);
    this.selection.set([plan.id]);
    return plan.id;
  }

  /** Destructively resolve one selected Boolean group to an editable path. */
  flattenBooleanSelection(applyOptions: ApplyOptions = {}): ElementId | null {
    if (this.selection.size !== 1) return null;
    const [groupId] = this.selection.ids();
    if (!groupId) return null;
    const plan = planFlattenBooleanGroup(
      this.store,
      groupId,
      this.idSource(),
      this.createShapeContext(),
    );
    if (!plan) return null;
    this.apply(plan.commands, applyOptions);
    this.selection.set([plan.id]);
    return plan.id;
  }

  /** Wrap one or more sibling layers in a tightly fitted frame. */
  frameSelection(applyOptions: ApplyOptions = {}): ElementId | null {
    const context = this.createShapeContext();
    if (!canFrameSelection(this.store, this.selection.ids(), context))
      return null;
    const plan = planFrameSelection(
      this.store,
      this.selection.ids(),
      this.idSource(),
      context,
      this.rng,
    );
    if (!plan) return null;
    this.apply(plan.commands, applyOptions);
    this.selection.set([plan.id]);
    return plan.id;
  }

  canFrameSelection(): boolean {
    return canFrameSelection(
      this.store,
      this.selection.ids(),
      this.createShapeContext(),
    );
  }

  /** Dissolve the selected groups and select what was inside them. */
  ungroupSelection(applyOptions: ApplyOptions = {}): boolean {
    const plan = planUngroup(this.store, this.selection.ids());
    if (plan.commands.length === 0) {
      return false;
    }
    this.apply(plan.commands, applyOptions);
    this.selection.set(plan.select);
    return true;
  }

  // --------------------------------------------------------------- arrange

  alignSelection(mode: AlignMode, applyOptions: ApplyOptions = {}): boolean {
    return this.applyPlan(
      planAlign(
        this.store,
        this.selection.ids(),
        mode,
        this.createShapeContext(),
      ),
      applyOptions,
    );
  }

  distributeSelection(
    axis: DistributeAxis,
    applyOptions: ApplyOptions = {},
  ): boolean {
    return this.applyPlan(
      planDistribute(
        this.store,
        this.selection.ids(),
        axis,
        this.createShapeContext(),
      ),
      applyOptions,
    );
  }

  /**
   * Tidy the layout or remove overlaps on the current page: the selection
   * when two or more layers are selected, otherwise the whole page. One
   * undo step; false when nothing moved.
   */
  arrangeLayout(
    options: Omit<ArrangeOptions, "scope">,
    applyOptions: ApplyOptions = {},
  ): boolean {
    const selected = [...this.selection.ids()];
    return this.arrangePage(
      this.currentPageId,
      { ...options, scope: selected.length > 1 ? selected : [] },
      applyOptions,
    );
  }

  /** Tidy or de-overlap any page as one undoable batch; false if nothing moved. */
  arrangePage(
    pageId: PageId,
    options: ArrangeOptions,
    applyOptions: ApplyOptions = {},
  ): boolean {
    if (this.readOnly) return false;
    const { commands, placed } = planArrangement(
      this.store,
      pageId,
      this.createShapeContext(1),
      options,
    );
    if (!commands.length) return false;
    this.apply(commands, { ...applyOptions, placed });
    return true;
  }

  matchSelectionSize(
    dimension: SizeDimension,
    applyOptions: ApplyOptions = {},
  ): boolean {
    return this.applyPlan(
      planMatchSize(
        this.store,
        this.registry,
        this.selection.ids(),
        dimension,
        this.createShapeContext(),
      ),
      applyOptions,
    );
  }

  // ----------------------------------------------------------- style, text

  /**
   * Merge a style patch into every element the selection reaches (through
   * groups). One undo step. False when nothing changed.
   */
  setSelectionStyle(
    patch: StylePatch,
    applyOptions: ApplyOptions = {},
  ): boolean {
    return this.applyPlan(
      planSelectionStyle(this.store, this.selection.ids(), patch),
      applyOptions,
    );
  }

  /** Set Figma-style sizing for selected text notes as one undoable edit. */
  setSelectionTextResize(
    mode: TextResizeMode,
    applyOptions: ApplyOptions = {},
  ): boolean {
    return this.applyPlan(
      planSelectionTextResize(this.store, this.selection.ids(), mode),
      applyOptions,
    );
  }

  private insertCopies(
    payload: ClipboardPayload,
    offset: Vec,
    applyOptions: ApplyOptions,
    preserveParents = false,
  ): readonly ElementId[] {
    const plan = planInsertCopies(
      this,
      this.idSource,
      payload,
      offset,
      preserveParents,
    );
    if (!plan) return [];
    this.apply(plan.commands, applyOptions);
    this.selection.set(topLevelAmong(this.store, plan.ids));
    return plan.ids;
  }
}
