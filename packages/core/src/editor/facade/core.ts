import {
  comparePageOrder,
  type Document,
  type Element,
  type ElementId,
  type FractionalIndex,
  type PageId,
  isPlainObject,
  type Visual,
} from "@nodetto/ir";
import { AssetCache } from "../../asset-cache.ts";
import type {
  BpmnConnectionResult,
  BpmnRejection,
} from "../../bpmn/connection.ts";
import type { BreadboardProbe } from "../../breadboard/types.ts";
import { Camera, type CameraState } from "../../camera.ts";
import { Clipboard } from "../../clipboard.ts";
import {
  applyCommands,
  type Command,
  type CommandResult,
} from "../../commands.ts";
import { sameBreadboardProbe } from "../../editor/breadboard.ts";
import { emptyDocument, PAGE_SWITCH_DIFF } from "../../editor/pages.ts";
import {
  HISTORY_DIFF,
  permittedCommands,
  planDerivedCommands,
  planReconciliation,
} from "../../editor/transaction.ts";
import { movableOrigins } from "../../editor/transform.ts";
import type {
  ApplyOptions,
  BpmnEditResult,
  CreateElementOptions,
  EditorListener,
  EditorOptions,
} from "../../editor/types.ts";
import { compareFractional, keyAfter, type Rng } from "../../fractional.ts";
import { expandContainers } from "../../frame-tree.ts";
import type { Box, Vec } from "../../geometry.ts";
import { resolveSelectionTarget, topLevelIds } from "../../group.ts";
import { History } from "../../history.ts";
import { createShapeContext, hitTestPoint } from "../../hit-test.ts";
import { type IdSource, newElementId } from "../../ids.ts";
import { pageAfterRemoval } from "../../page-order.ts";
import { getSelectionBounds, Selection } from "../../selection.ts";
import type {
  RasterMaskSampler,
  ShapeContext,
  ShapeUtil,
  ShapeUtilRegistry,
} from "../../shape-util.ts";
import { createDefaultRegistry } from "../../shapes/index.ts";
import { USECASE_NODE_SIZES } from "../../shapes/usecase.ts";
import { Store, type StoreDiff } from "../../store.ts";

export class EditorCore {
  readonly assets = new AssetCache();
  private readonlyMode = false;

  private openRevision = 0;

  readonly store: Store;
  readonly camera: Camera;
  readonly selection = new Selection();
  readonly registry: ShapeUtilRegistry;
  readonly history: History;
  /** In-editor clipboard; copy/cut fill it, paste reads it. */
  readonly clipboard = new Clipboard();

  protected readonly idSource: IdSource;
  protected readonly rng: Rng;
  private rasterMaskSampler: RasterMaskSampler | undefined;
  private shapeContextCache:
    | {
        readonly storeRevision: number;
        readonly registryRevision: number;
        readonly sampler: RasterMaskSampler | undefined;
        readonly context: ShapeContext;
      }
    | undefined;
  private readonly listeners = new Set<EditorListener>();
  private readonly bpmnRejectionListeners = new Set<
    (rejection: BpmnRejection) => void
  >();
  private readonly breadboardProbeListeners = new Set<
    (probe: BreadboardProbe | null) => void
  >();
  private probe: BreadboardProbe | null = null;
  /** Highest index handed out per page, so a batch of builds stays ordered. */
  private readonly pendingTop = new Map<PageId, FractionalIndex>();
  protected pageId: PageId;
  /** Per-client navigation state; never serialized or synchronized. */
  private readonly pageViews = new Map<PageId, CameraState>();
  private selectionAfterLoad: readonly ElementId[] | null = null;
  private knownPageOrder: readonly PageId[] = [];
  private revisionCount = 0;
  /** Set while a reset is mid-flight and the editor is not yet consistent. */
  private silenceHistory = false;

  // ---------------------------------------------------------------- export

  protected readonly requireAsset = (source: string): string => {
    const value = this.assets.resolve(source);
    if (!value)
      throw new Error(
        `Missing attachment: ${source}. Restore the file beside the document.`,
      );
    return value;
  };
  /** Local authoring policy; remote store updates remain allowed. */
  get readOnly(): boolean {
    return this.readonlyMode;
  }

  setReadOnly(value: boolean): void {
    if (value === this.readonlyMode) return;
    this.readonlyMode = value;
    this.notify(HISTORY_DIFF);
  }
  /** Changes on explicit opens, not same-document collaboration refreshes. */
  get documentOpenRevision(): number {
    return this.openRevision;
  }

  constructor(options: EditorOptions = {}) {
    this.assets.subscribe(() => this.notify(HISTORY_DIFF));
    this.idSource = options.idSource ?? (() => newElementId());
    this.rng = options.rng ?? Math.random;
    this.registry = options.registry ?? createDefaultRegistry();
    const document =
      options.document ?? emptyDocument(this.idSource(), this.idSource());
    this.store = new Store(document);
    this.camera = new Camera(options.camera);
    this.history = new History((commands) => {
      if (!this.readOnly) applyCommands(this.store, commands);
    });
    this.knownPageOrder = this.store.listPages().map((page) => page.id);
    this.pageId = this.knownPageOrder[0] ?? "";
    this.store.subscribe((diff) => {
      if (this.selectionAfterLoad !== null) {
        const ids = this.selectionAfterLoad;
        this.selectionAfterLoad = null;
        this.selection.set(
          ids.filter((id) => this.store.get(id)?.page === this.pageId),
        );
      } else {
        this.selection.prune(diff);
      }
      // A deleted (or undone) page must never stay current: a renderer
      // asked for its elements would draw nothing and the next click would
      // create an element on a page the store does not have.
      if (diff.pagesChanged && !this.store.getPage(this.pageId)) {
        this.pageViews.set(this.pageId, this.camera.get());
        this.pageId = pageAfterRemoval(
          this.knownPageOrder,
          this.store.listPages(),
          this.pageId,
        );
        this.selection.clear();
        this.camera.set(
          this.pageViews.get(this.pageId) ?? { x: 0, y: 0, z: 1 },
        );
      }
      if (diff.pagesChanged)
        this.knownPageOrder = this.store.listPages().map((page) => page.id);
      this.notify(diff);
    });
    this.history.subscribe(() => {
      if (!this.silenceHistory) {
        this.notify(HISTORY_DIFF);
      }
    });
  }

  /** Bumped on every store change; renderers use it as a signal source. */
  get revision(): number {
    return this.revisionCount;
  }

  subscribe(listener: EditorListener): () => void {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  }

  onBpmnRejection(listener: (rejection: BpmnRejection) => void): () => void {
    this.bpmnRejectionListeners.add(listener);
    return () => this.bpmnRejectionListeners.delete(listener);
  }

  breadboardProbe(): BreadboardProbe | null {
    return this.probe;
  }

  setBreadboardProbe(probe: BreadboardProbe | null): void {
    if (sameBreadboardProbe(this.probe, probe)) return;
    this.probe = probe;
    for (const listener of [...this.breadboardProbeListeners]) listener(probe);
  }

  onBreadboardProbeChange(
    listener: (probe: BreadboardProbe | null) => void,
  ): () => void {
    this.breadboardProbeListeners.add(listener);
    return () => this.breadboardProbeListeners.delete(listener);
  }

  protected rejectBpmn(
    result: Extract<BpmnConnectionResult, { ok: false }>,
  ): BpmnEditResult {
    for (const listener of this.bpmnRejectionListeners) listener(result);
    return result;
  }

  get currentPageId(): PageId {
    return this.pageId;
  }

  /**
   * Switch the visible page. Unknown ids are ignored. The change is
   * announced like a store change, because a renderer that only listens for
   * document edits would otherwise keep drawing the previous page.
   */
  setCurrentPage(pageId: PageId): void {
    if (pageId === this.pageId || !this.store.getPage(pageId)) {
      return;
    }
    this.pageViews.set(this.pageId, this.camera.get());
    this.pageId = pageId;
    this.setBreadboardProbe(null);
    this.selection.clear();
    this.camera.set(this.pageViews.get(pageId) ?? { x: 0, y: 0, z: 1 });
    this.notify(PAGE_SWITCH_DIFF);
  }

  /**
   * Replace the open document.
   *
   * A load is announced exactly once, by the store, and every other piece of
   * editor state is already describing the new document by the time that
   * happens. Dropping the undo stack is the one reset that would otherwise
   * announce itself — on its own, while the page and the store still belong
   * to the outgoing document — so its notification is held back and the
   * store's diff speaks for the whole load.
   * Same-document collaboration refreshes can preserve local page, camera and
   * surviving selection with preserveView; explicit opens reset those states.
   */
  loadDocument(
    document: Document,
    options: { preserveView?: boolean } = {},
  ): void {
    const preserveView =
      options.preserveView === true && document.id === this.store.getMeta().id;
    if (!preserveView) this.openRevision += 1;
    const selected = preserveView ? [...this.selection.ids()] : [];
    if (preserveView) this.pageViews.set(this.pageId, this.camera.get());
    else this.pageViews.clear();
    this.silenceHistory = true;
    try {
      this.history.clear();
    } finally {
      this.silenceHistory = false;
    }
    if (!preserveView) this.selection.clear();
    this.pendingTop.clear();
    const pages = [...document.pages].sort(comparePageOrder);
    this.pageId =
      preserveView && document.pages.some((page) => page.id === this.pageId)
        ? this.pageId
        : preserveView
          ? pageAfterRemoval(this.knownPageOrder, pages, this.pageId)
          : (pages[0]?.id ?? "");
    this.camera.set(this.pageViews.get(this.pageId) ?? { x: 0, y: 0, z: 1 });
    this.selectionAfterLoad = preserveView ? selected : null;
    this.store.loadDocument(document);
    if (!preserveView) this.assets.clear();
  }

  getSnapshot(): Document {
    return this.store.getSnapshot();
  }

  // ----------------------------------------------------------- transactions

  apply(
    commands: readonly Command[],
    options: ApplyOptions = {},
  ): CommandResult {
    if (this.readOnly) return { undo: [], redo: [] };
    const context = this.createShapeContext();
    const permitted = permittedCommands(this.store, context, commands);
    const derived = planDerivedCommands({
      store: this.store,
      registry: this.registry,
      context,
      permitted,
      placed: options.placed,
      rasterMaskSampler: this.rasterMaskSampler,
      resolveAsset: this.assets.resolve,
    });
    const result = applyCommands(this.store, [...permitted, ...derived]);
    if (options.history !== "ignore") {
      this.history.push(result);
    }
    return result;
  }

  /** Recompute derived colors/layout from merged state without local undo entries. */
  reconcileDerivedState(): void {
    const commands = planReconciliation(this.store, this.registry);
    if (commands?.length) applyCommands(this.store, commands);
  }

  undo(): boolean {
    if (this.readOnly) return false;
    return this.history.undo();
  }

  redo(): boolean {
    if (this.readOnly) return false;
    return this.history.redo();
  }

  canUndo(): boolean {
    if (this.readOnly) return false;
    return this.history.canUndo();
  }

  canRedo(): boolean {
    if (this.readOnly) return false;
    return this.history.canRedo();
  }

  /** Coalesce every apply until `endBatch` into a single undo step. */
  beginBatch(): void {
    this.history.beginBatch();
  }

  endBatch(): void {
    this.history.endBatch();
  }

  /**
   * Close the batch by undoing it. A gesture the user abandoned should leave
   * the document exactly as it found it, and cost no undo step.
   */
  abortBatch(): void {
    this.history.abortBatch();
  }

  // ---------------------------------------------------------------- shapes

  getShapeUtil(type: string): ShapeUtil {
    return this.registry.getOrFallback(type);
  }

  /**
   * Installs a platform-local decoded-pixel reader for raster mask picking.
   * It is deliberately ephemeral: document data and headless behavior retain
   * the deterministic source-box fallback when no sampler is present.
   */
  setRasterMaskSampler(sampler: RasterMaskSampler | undefined): void {
    this.rasterMaskSampler = sampler;
  }

  createShapeContext(zoom: number = this.camera.get().z): ShapeContext {
    const cached = this.shapeContextCache;
    if (
      cached &&
      cached.storeRevision === this.store.revision &&
      cached.registryRevision === this.registry.revision &&
      cached.sampler === this.rasterMaskSampler &&
      cached.context.zoom === zoom
    )
      return cached.context;
    const context = createShapeContext(
      this.store,
      this.registry,
      zoom,
      this.rasterMaskSampler,
      this.assets.resolve,
    );
    this.shapeContextCache = {
      storeRevision: this.store.revision,
      registryRevision: this.registry.revision,
      sampler: this.rasterMaskSampler,
      context,
    };
    return context;
  }

  getBounds(id: ElementId, context = this.createShapeContext()): Box | null {
    return context.boundsOf(id);
  }

  getSelectionBounds(context = this.createShapeContext()): Box | null {
    return getSelectionBounds(
      this.selection,
      this.store,
      this.registry,
      context,
    );
  }

  hitTest(point: Vec, context = this.createShapeContext()): ElementId | null {
    return hitTestPoint(this.store, this.registry, this.pageId, point, {
      context,
    });
  }

  /** The next z-order key above everything currently on `page`. */
  nextIndex(page: PageId = this.pageId): FractionalIndex {
    let top: FractionalIndex | null = this.pendingTop.get(page) ?? null;
    for (const element of this.store.getPageElements(page)) {
      if (top === null || compareFractional(element.index, top) > 0) {
        top = element.index;
      }
    }
    const next = keyAfter(top, this.rng);
    this.pendingTop.set(page, next);
    return next;
  }

  /**
   * Build an element without applying it, so several can be created in one
   * atomic batch. Missing semantic/visual fall back to the ShapeUtil's
   * defaults; supplied fields win.
   */
  buildElement(type: string, options: CreateElementOptions = {}): Element {
    const util = this.registry.getOrFallback(type);
    const page = options.page ?? this.pageId;
    const compactState =
      type === "state.node" &&
      isPlainObject(options.semantic) &&
      options.semantic["kind"] !== "state";
    const useCaseKind =
      type === "usecase.node" && isPlainObject(options.semantic)
        ? options.semantic["kind"]
        : undefined;
    const defaultVisual = compactState
      ? { ...util.defaultVisual(), width: 32, height: 32 }
      : useCaseKind === "actor" || useCaseKind === "system"
        ? { ...util.defaultVisual(), ...USECASE_NODE_SIZES[useCaseKind] }
        : util.defaultVisual();
    const visual: Visual = { ...defaultVisual, ...(options.visual ?? {}) };
    const semantic =
      options.semantic === undefined
        ? util.defaultSemantic()
        : options.semantic;
    return {
      id: options.id ?? this.idSource(),
      page,
      type,
      index: options.index ?? this.nextIndex(page),
      semantic,
      ...(options.accessibility
        ? { accessibility: options.accessibility }
        : {}),
      visual,
    };
  }

  /** Build, apply and select nothing; returns the new element's id. */
  createElement(
    type: string,
    options: CreateElementOptions = {},
    applyOptions: ApplyOptions = {},
  ): ElementId {
    const element = this.buildElement(type, options);
    this.apply([{ type: "createElement", element }], applyOptions);
    return element.id;
  }

  // ---------------------------------------------------------------- groups

  /** Which element a click on `hit` selects (design editor-ux 3.1). */
  resolveSelectionTarget(hit: ElementId): ElementId {
    return resolveSelectionTarget(this.store, hit, this.selection.ids());
  }

  /** Select every top-level element on the current page. */
  selectAll(): void {
    this.selection.set(topLevelIds(this.store, this.pageId));
  }

  /**
   * The positioned elements a drag of the selection moves, with their
   * current origins: the selection expanded through groups, minus anything
   * that has no coordinates of its own (connectors, derived layouts).
   */
  movableSelection(): readonly {
    readonly id: ElementId;
    readonly x: number;
    readonly y: number;
  }[] {
    return movableOrigins(this.store, this.expandedSelection());
  }

  /** Current selection plus contained artboard contents and group members. */
  expandedSelection(): readonly ElementId[] {
    return expandContainers(
      this.store,
      this.selection.ids(),
      this.createShapeContext(),
    );
  }

  // -------------------------------------------------------------- internal

  protected applyPlan(
    commands: readonly Command[],
    applyOptions: ApplyOptions,
  ): boolean {
    if (this.readOnly || commands.length === 0) {
      return false;
    }
    this.apply(commands, applyOptions);
    return true;
  }

  private notify(diff: StoreDiff): void {
    this.revisionCount += 1;
    for (const listener of [...this.listeners]) {
      listener(diff);
    }
  }
}
