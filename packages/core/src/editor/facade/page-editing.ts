import type { ElementId, PageId, PageKind, PageMode, Page } from "@nodetto/ir";
import {
  type FitOptions,
  nextZoomStep,
  type ViewportSize,
} from "../../camera.ts";
import {
  planDuplicatePage,
  planNewPage,
  planPageMove,
} from "../../editor/pages.ts";
import type { ApplyOptions, CreatePageOptions } from "../../editor/types.ts";
import type { Box, Vec } from "../../geometry.ts";
import {
  renderArtboardSvg,
  renderPageSvg,
  renderSelectionSvg,
  type SvgExportOptions,
} from "../../svg-export.ts";
import { viewBounds } from "../../view-bounds.ts";
import { SelectionEditing } from "./selection-editing.ts";

export class PageEditing extends SelectionEditing {
  /** The current page as a standalone SVG, or `null` when it is empty. */
  exportPageSvg(options: SvgExportOptions = {}): string | null {
    return renderPageSvg(this.store, this.registry, this.pageId, {
      resolveAsset: this.requireAsset,
      ...options,
    });
  }

  /** Exact artboard envelope, with no editor-title annotation. */
  exportArtboardSvg(
    id: ElementId,
    options: SvgExportOptions = {},
  ): string | null {
    return renderArtboardSvg(this.store, this.registry, id, {
      resolveAsset: this.requireAsset,
      ...options,
    });
  }

  /** The selection as a standalone SVG, or `null` when nothing is drawable. */
  exportSelectionSvg(options: SvgExportOptions = {}): string | null {
    return renderSelectionSvg(
      this.store,
      this.registry,
      this.pageId,
      this.selection.ids(),
      { resolveAsset: this.requireAsset, ...options },
    );
  }

  // ----------------------------------------------------------------- pages

  /** Add a page after the current ones and switch to it. */
  createPage(
    options: CreatePageOptions = {},
    applyOptions: ApplyOptions = {},
  ): PageId {
    const { page, commands } = planNewPage(
      this.store,
      this.rng,
      this.idSource,
      options,
    );
    this.apply(commands, applyOptions);
    this.setCurrentPage(page.id);
    return page.id;
  }

  /** Move a page one position without changing active page, camera or selection. */
  reorderPage(
    id: PageId,
    delta: -1 | 1,
    applyOptions: ApplyOptions = {},
  ): boolean {
    const index = this.store.listPages().findIndex((page) => page.id === id);
    return index >= 0 && this.reorderPageTo(id, index + delta, applyOptions);
  }

  /** Move a tab directly to its final index as one undoable document command. */
  reorderPageTo(
    id: PageId,
    target: number,
    applyOptions: ApplyOptions = {},
  ): boolean {
    const commands = planPageMove(this.store, this.rng, id, target);
    if (!commands) return false;
    this.apply(commands, applyOptions);
    return true;
  }

  renamePage(
    id: PageId,
    name: string,
    applyOptions: ApplyOptions = {},
  ): boolean {
    const page = this.store.getPage(id);
    if (!page || page.name === name) {
      return false;
    }
    this.apply([{ type: "updatePage", id, page: { name } }], applyOptions);
    return true;
  }

  setPageKind(
    id: PageId,
    kind: PageKind,
    applyOptions: ApplyOptions = {},
  ): boolean {
    const page = this.store.getPage(id);
    if (!page || page.kind === kind) {
      return false;
    }
    this.apply([{ type: "updatePage", id, page: { kind } }], applyOptions);
    return true;
  }

  /** Remember the editing mode chosen on a page; null forgets it. */
  setPageMode(
    id: PageId,
    mode: PageMode | null,
    applyOptions: ApplyOptions = {},
  ): boolean {
    const page = this.store.getPage(id);
    if (!page || (page.mode ?? null) === mode) return false;
    this.apply([{ type: "updatePage", id, page: { mode } }], applyOptions);
    return true;
  }

  /** Change ERD input syntax without changing the independently chosen export target. */
  setPageSqlDialect(
    id: PageId,
    sqlDialect: NonNullable<Page["sqlDialect"]>,
    applyOptions: ApplyOptions = {},
  ): boolean {
    const page = this.store.getPage(id);
    if (!page || (page.sqlDialect ?? "postgresql") === sqlDialect) return false;
    this.apply(
      [{ type: "updatePage", id, page: { sqlDialect } }],
      applyOptions,
    );
    return true;
  }

  setPageConnectorRouting(
    id: PageId,
    value: NonNullable<Page["connectorRouting"]> | null,
    applyOptions: ApplyOptions = {},
  ): boolean {
    const page = this.store.getPage(id);
    const current = page?.connectorRouting;
    if (
      !page ||
      (current?.routing === value?.routing &&
        current?.routingAvoidObstacles === value?.routingAvoidObstacles)
    )
      return false;
    this.apply(
      [{ type: "updatePage", id, page: { connectorRouting: value } }],
      applyOptions,
    );
    return true;
  }

  /** Select a design-token mode for one page; null restores Default. */
  setPageTokenMode(
    id: PageId,
    mode: string | null,
    applyOptions: ApplyOptions = {},
  ): boolean {
    const page = this.store.getPage(id);
    const value = mode?.trim() || null;
    if (
      !page ||
      value?.toLowerCase() === "default" ||
      (page.tokenMode ?? null) === value
    )
      return false;
    this.apply(
      [{ type: "updatePage", id, page: { tokenMode: value } }],
      applyOptions,
    );
    return true;
  }

  /** Delete a page and its elements. False for the last page or unknown ids. */
  deletePage(id: PageId, applyOptions: ApplyOptions = {}): boolean {
    if (!this.store.getPage(id) || this.store.listPages().length <= 1) {
      return false;
    }
    this.apply([{ type: "deletePage", id }], applyOptions);
    return true;
  }

  /**
   * Copy a page and everything on it (ids remapped through the clipboard
   * path) and switch to the copy. One undo step.
   */
  duplicatePage(id: PageId, applyOptions: ApplyOptions = {}): PageId | null {
    const plan = planDuplicatePage(this, this.rng, this.idSource, id);
    if (!plan) {
      return null;
    }
    this.apply(plan.commands, applyOptions);
    this.setCurrentPage(plan.page.id);
    return plan.page.id;
  }

  // ---------------------------------------------------------------- camera

  /** Union of every element's bounds on `page`, or `null` when empty. */
  pageBounds(page: PageId = this.pageId): Box | null {
    const context = this.createShapeContext();
    return viewBounds(
      this.store,
      this.store.getPageElements(page).map((element) => element.id),
      context,
    );
  }

  /** Fit the page's content in a viewport of `size`. False when empty. */
  zoomToFit(size: ViewportSize, options: FitOptions = {}): boolean {
    const bounds = this.pageBounds();
    if (!bounds) {
      return false;
    }
    this.camera.fitBox(bounds, size, options);
    return true;
  }

  /** Fit the selection, zooming in if needed. False when nothing is selected. */
  zoomToSelection(size: ViewportSize, options: FitOptions = {}): boolean {
    const bounds = viewBounds(
      this.store,
      [...this.selection.ids()],
      this.createShapeContext(),
    );
    if (!bounds) {
      return false;
    }
    this.camera.fitBox(bounds, size, { maxZoom: 4, ...options });
    return true;
  }

  zoomIn(anchor: Vec): void {
    this.camera.zoomTo(nextZoomStep(this.camera.get().z, "in"), anchor);
  }

  zoomOut(anchor: Vec): void {
    this.camera.zoomTo(nextZoomStep(this.camera.get().z, "out"), anchor);
  }

  resetZoom(anchor: Vec): void {
    this.camera.zoomTo(1, anchor);
  }
}
