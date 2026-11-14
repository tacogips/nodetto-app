// The editor facade: one object a renderer can hold.
//
// It owns the store, camera, selection and history, and it is the only
// entry point for mutation. Everything it exposes either reads state or
// funnels through `apply`, so there is no path by which a view can edit the
// document without validation and undo.
//
// The command plans behind its operations live under `editor/`; this module
// keeps the state and the public API.

import {
  type BooleanOperation,
  type BreadboardElementType,
  comparePageOrder,
  type ConnectorPort,
  type ConnectorPorts,
  type Document,
  type Element,
  type ElementId,
  type FractionalIndex,
  type FrameSemantic,
  type PageId,
  type PageKind,
  type PageMode,
  type Page,
  type ParticipantKind,
  isPlainObject,
  type TextMark,
  type TextMarkKind,
  type TextNoteSemantic,
  type TextResizeMode,
  type UmlComponentRelationshipKind,
  type UseCaseRelationshipKind,
  type Visual,
} from "@nodetto/ir";
import {
  type AlignMode,
  type DistributeAxis,
  planAlign,
  planDistribute,
  planMatchSize,
  type SizeDimension,
} from "./align.ts";
import { type ArrangeOptions, planArrangement } from "./arrange.ts";
import { AssetCache } from "./asset-cache.ts";
import type {
  BpmnConnectionResult,
  BpmnFlowType,
  BpmnRejection,
} from "./bpmn/connection.ts";
import {
  planBooleanGroup,
  planFlattenBooleanGroup,
} from "./boolean-operations.ts";
import { planBreadboardAnnotation } from "./breadboard/annotate.ts";
import { planBreadboardRotation } from "./breadboard/rotate.ts";
import type { BreadboardProbe } from "./breadboard/types.ts";
import {
  Camera,
  type CameraState,
  type FitOptions,
  nextZoomStep,
  type ViewportSize,
} from "./camera.ts";
import {
  Clipboard,
  type ClipboardPayload,
  copyElements,
  copyElementsInDocument,
  PASTE_OFFSET,
} from "./clipboard.ts";
import { applyCommands, type Command, type CommandResult } from "./commands.ts";
import { planResetComponentOverride } from "./component-overrides.ts";
import { planComponentRefresh } from "./component-refresh.ts";
import { componentVariants } from "./component-variants.ts";
import {
  checkBpmnSemantic,
  planBpmnConnection,
  planBpmnLane,
  planBpmnReconnect,
} from "./editor/bpmn.ts";
import {
  buildBreadboardPart,
  planBreadboardSemanticUpdate,
  sameBreadboardProbe,
} from "./editor/breadboard.ts";
import {
  planComponentInstance,
  planRebuildComponentInstance,
  planRebuildResponsiveVariant,
  planResponsiveVariant,
} from "./editor/components.ts";
import {
  connectByType,
  connectErdTables,
  connectUmlComponents,
  connectUseCases,
  placeUmlPort,
} from "./editor/connections.ts";
import {
  emptyDocument,
  PAGE_SWITCH_DIFF,
  planDuplicatePage,
  planNewPage,
  planPageMove,
} from "./editor/pages.ts";
import { planInsertCopies, topLevelAmong } from "./editor/paste.ts";
import {
  buildSequenceParticipant,
  planSequenceActivation,
  planSequenceMove,
} from "./editor/sequence.ts";
import {
  editableFieldOf,
  OPTIONAL_LABEL_TYPES,
  planSelectionStyle,
  planSelectionTextResize,
} from "./editor/style-text.ts";
import {
  HISTORY_DIFF,
  permittedCommands,
  planDerivedCommands,
  planReconciliation,
} from "./editor/transaction.ts";
import {
  movableOrigins,
  pcbViaSemantic,
  planElementMoves,
  planPcbFootprintRotation,
  resizedVisual,
} from "./editor/transform.ts";
import type {
  ApplyOptions,
  BpmnEditResult,
  CreateElementOptions,
  CreatePageOptions,
  EditableField,
  EditorListener,
  EditorOptions,
  StylePatch,
} from "./editor/types.ts";
import { compareFractional, keyAfter, type Rng } from "./fractional.ts";
import { planReorderMember, planReparent } from "./frame-membership.ts";
import { canFrameSelection, planFrameSelection } from "./frame-selection.ts";
import { expandContainers } from "./frame-tree.ts";
import type { Box, Vec } from "./geometry.ts";
import {
  planGroup,
  planUngroup,
  resolveSelectionTarget,
  topLevelIds,
} from "./group.ts";
import { History } from "./history.ts";
import { createShapeContext, hitTestPoint } from "./hit-test.ts";
import { type IdSource, newElementId } from "./ids.ts";
import { pageAfterRemoval } from "./page-order.ts";
import {
  type PcbTrackInput,
  type PcbViaInput,
  pcbInsertIndex,
  roundPcbTrackInput,
} from "./pcb-board/edit.ts";
import {
  normalizeTextMarks,
  rebaseTextMarks,
  textNoteMarks,
  toggleTextMarkRange,
} from "./rich-text.ts";
import { getSelectionBounds, Selection } from "./selection.ts";
import type {
  RasterMaskSampler,
  ShapeContext,
  ShapeUtil,
  ShapeUtilRegistry,
} from "./shape-util.ts";
import type { FramePresetKey } from "./shapes/frame.ts";
import { createDefaultRegistry } from "./shapes/index.ts";
import { USECASE_NODE_SIZES } from "./shapes/usecase.ts";
import { Store, type StoreDiff } from "./store.ts";
import {
  renderArtboardSvg,
  renderPageSvg,
  renderSelectionSvg,
  type SvgExportOptions,
} from "./svg-export.ts";
import { viewBounds } from "./view-bounds.ts";
import { planZOrder, type ZOrderAction } from "./z-order.ts";

export type {
  ApplyOptions,
  BpmnEditResult,
  CreateElementOptions,
  CreatePageOptions,
  EditableField,
  EditorListener,
  EditorOptions,
  StylePatch,
} from "./editor/types.ts";

export class Editor {
  readonly assets = new AssetCache();
  private readonlyMode = false;
  /** Local authoring policy; remote store updates remain allowed. */
  get readOnly(): boolean {
    return this.readonlyMode;
  }

  setReadOnly(value: boolean): void {
    if (value === this.readonlyMode) return;
    this.readonlyMode = value;
    this.notify(HISTORY_DIFF);
  }

  private openRevision = 0;
  /** Changes on explicit opens, not same-document collaboration refreshes. */
  get documentOpenRevision(): number {
    return this.openRevision;
  }

  readonly store: Store;
  readonly camera: Camera;
  readonly selection = new Selection();
  readonly registry: ShapeUtilRegistry;
  readonly history: History;
  /** In-editor clipboard; copy/cut fill it, paste reads it. */
  readonly clipboard = new Clipboard();

  private readonly idSource: IdSource;
  private readonly rng: Rng;
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
  private pageId: PageId;
  /** Per-client navigation state; never serialized or synchronized. */
  private readonly pageViews = new Map<PageId, CameraState>();
  private selectionAfterLoad: readonly ElementId[] | null = null;
  private knownPageOrder: readonly PageId[] = [];
  private revisionCount = 0;
  /** Set while a reset is mid-flight and the editor is not yet consistent. */
  private silenceHistory = false;

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

  private rejectBpmn(
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

  reparentElement(id: ElementId, parent: ElementId | null): boolean {
    const commands = planReparent(
      this.store,
      this.createShapeContext(),
      id,
      parent,
    );
    if (!commands.length) return false;
    this.apply(commands);
    return true;
  }

  // ------------------------------------------------------------ components

  makeComponent(id: ElementId): boolean {
    const element = this.store.get(id);
    if (
      !element ||
      element.type !== "frame" ||
      this.createShapeContext().isLocked?.(id)
    )
      return false;
    const {
      instanceOf: _instanceOf,
      autoRefresh: _autoRefresh,
      instanceBindings: _bindings,
      ...semantic
    } = element.semantic as FrameSemantic;
    this.apply([
      {
        type: "updateSemantic",
        id,
        semantic: { ...semantic, component: true },
      },
    ]);
    return true;
  }

  createComponentInstance(id: ElementId, at?: Vec): ElementId | null {
    const plan = planComponentInstance(this, this.idSource, id, at);
    if (!plan) return null;
    this.apply(plan.commands);
    this.selection.set([plan.instanceId]);
    return plan.instanceId;
  }

  detachComponentInstance(id: ElementId): boolean {
    const element = this.store.get(id);
    if (
      !element ||
      element.type !== "frame" ||
      this.createShapeContext().isLocked?.(id)
    )
      return false;
    const {
      instanceOf,
      autoRefresh: _autoRefresh,
      instanceBindings: _bindings,
      ...semantic
    } = element.semantic as FrameSemantic;
    if (!instanceOf) return false;
    this.apply([{ type: "updateSemantic", id, semantic }]);
    return true;
  }

  resetComponentInstance(id: ElementId): boolean {
    const instance = this.store.get(id);
    const sourceId =
      instance?.type === "frame"
        ? (instance.semantic as FrameSemantic).instanceOf
        : undefined;
    return sourceId ? this.rebuildComponentInstance(id, sourceId) : false;
  }

  switchComponentVariant(id: ElementId, sourceId: ElementId): boolean {
    const instance = this.store.get(id);
    if (!instance || instance.type !== "frame") return false;
    const current = (instance.semantic as FrameSemantic).instanceOf;
    if (
      !current ||
      !componentVariants(this, current).some(
        (variant) => variant.id === sourceId,
      )
    )
      return false;
    if (current === sourceId) return true;
    return this.rebuildComponentInstance(id, sourceId, true);
  }

  updateComponentStructure(id: ElementId): boolean {
    const instance = this.store.get(id);
    if (!instance || instance.type !== "frame") return false;
    const semantic = instance.semantic as FrameSemantic;
    if (!semantic.instanceOf || !semantic.instanceBindings?.length)
      return false;
    return this.rebuildComponentInstance(id, semantic.instanceOf, true, true);
  }

  /** Pure command plan used by dependency-ordered automatic refresh. */
  planComponentStructureUpdate(id: ElementId): Command[] | null {
    const instance = this.store.get(id);
    const semantic =
      instance?.type === "frame"
        ? (instance.semantic as FrameSemantic)
        : undefined;
    return semantic?.instanceOf
      ? planRebuildComponentInstance(
          this,
          this.idSource,
          id,
          semantic.instanceOf,
          true,
          true,
        )
      : null;
  }

  /** Reconcile source membership without replacing breakpoint-owned geometry. */
  updateResponsiveStructure(id: ElementId): boolean {
    const instance = this.store.get(id);
    if (!instance || instance.type !== "frame") return false;
    const semantic = instance.semantic as FrameSemantic;
    if (
      !semantic.responsiveSource ||
      semantic.instanceOf ||
      !semantic.instanceBindings?.length
    )
      return false;
    return this.rebuildResponsiveVariant(id, semantic.responsiveSource);
  }

  private rebuildComponentInstance(
    id: ElementId,
    sourceId: ElementId,
    preserveOverrides = false,
    preserveLocal = false,
  ): boolean {
    const commands = planRebuildComponentInstance(
      this,
      this.idSource,
      id,
      sourceId,
      preserveOverrides,
      preserveLocal,
    );
    if (!commands) return false;
    this.apply(commands);
    this.selection.set([id]);
    return true;
  }

  private rebuildResponsiveVariant(
    id: ElementId,
    sourceId: ElementId,
  ): boolean {
    const commands = planRebuildResponsiveVariant(
      this,
      this.idSource,
      (document) =>
        new Editor({
          document,
          registry: this.registry,
          idSource: () => "responsive-stage-unused",
        }),
      id,
      sourceId,
    );
    if (!commands) return false;
    this.apply(commands);
    this.selection.set([id]);
    return true;
  }

  reorderFrameMember(id: ElementId, direction: -1 | 1): boolean {
    const commands = planReorderMember(
      this.store,
      this.createShapeContext(),
      id,
      direction,
    );
    if (!commands.length) return false;
    this.apply(commands);
    return true;
  }

  refreshComponentInstance(id: ElementId): boolean {
    const commands = planComponentRefresh(this, id);
    if (!commands) return false;
    if (commands.length) this.apply(commands);
    return true;
  }

  /** Pull inherited content/style changes into a responsive copy. */
  refreshResponsiveVariant(id: ElementId): boolean {
    const element = this.store.get(id);
    const semantic =
      element?.type === "frame"
        ? (element.semantic as FrameSemantic)
        : undefined;
    if (!semantic?.responsiveSource || semantic.instanceOf) return false;
    const commands = planComponentRefresh(this, id);
    if (!commands) return false;
    if (commands.length) this.apply(commands);
    return true;
  }

  /** Keep current responsive content but stop future source refreshes. */
  detachResponsiveVariant(id: ElementId): boolean {
    const element = this.store.get(id);
    if (
      !element ||
      element.type !== "frame" ||
      this.createShapeContext().isLocked?.(id)
    )
      return false;
    const {
      responsiveSource,
      instanceBindings: _bindings,
      ...semantic
    } = element.semantic as FrameSemantic;
    if (!responsiveSource) return false;
    this.apply([{ type: "updateSemantic", id, semantic }]);
    return true;
  }

  resetComponentOverride(
    instanceId: ElementId,
    targetId: ElementId,
    field: string,
  ): boolean {
    const commands = planResetComponentOverride(
      this,
      instanceId,
      targetId,
      field,
    );
    if (!commands) return false;
    this.apply(commands);
    return true;
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

  // ------------------------------------------------------------ breadboard

  createBreadboardPart(
    type: BreadboardElementType,
    at: Vec,
    semantic?: Readonly<Record<string, unknown>>,
    applyOptions: ApplyOptions = {},
  ): ElementId | null {
    const element = buildBreadboardPart(this, this.rng, type, at, semantic);
    if (!element) return null;
    this.apply([{ type: "createElement", element }], applyOptions);
    return element.id;
  }

  rotateBreadboardParts(
    ids: readonly ElementId[],
    quarterTurns: 1 | -1,
    applyOptions: ApplyOptions = {},
  ): boolean {
    const commands = planBreadboardRotation(this.store, ids, quarterTurns);
    if (commands.length === 0) return false;
    this.apply(commands, applyOptions);
    return true;
  }

  updateBreadboardSemantic(
    id: ElementId,
    patch: Readonly<Record<string, unknown>>,
    applyOptions: ApplyOptions = {},
  ): boolean {
    const commands = planBreadboardSemanticUpdate(this.store, id, patch);
    if (!commands) return false;
    this.apply(commands, applyOptions);
    return true;
  }

  annotateBreadboard(pageId: PageId, applyOptions: ApplyOptions = {}): boolean {
    const commands = planBreadboardAnnotation(this.store, pageId);
    if (!commands.length) return false;
    this.apply(commands, applyOptions);
    return true;
  }

  /**
   * Connect two elements with an `edge.generic`. Returns `null` rather than
   * throwing for the cases a drag gesture routinely produces: a self
   * connection, or an endpoint that is no longer there.
   */
  connect(
    from: ElementId,
    to: ElementId,
    page: PageId = this.pageId,
    applyOptions: ApplyOptions = {},
    ports: ConnectorPorts = {},
  ): ElementId | null {
    if (from === to || !this.store.has(from) || !this.store.has(to)) {
      return null;
    }
    return this.createElement(
      "edge.generic",
      {
        page,
        semantic: {
          ...ports,
          from,
          to,
          arrowheads: { end: "arrow" },
          ...(this.store.getPage(page)?.kind === "flowchart"
            ? { routing: "orthogonal" }
            : {}),
        },
      },
      applyOptions,
    );
  }

  // ------------------------------------------------------- move and resize

  /** Move elements by a page-space delta, relative to given origins. */
  moveElements(
    moves: readonly {
      readonly id: ElementId;
      readonly x: number;
      readonly y: number;
    }[],
    applyOptions: ApplyOptions = {},
  ): void {
    const commands = planElementMoves(this.store, moves);
    if (commands.length > 0) {
      this.apply(commands, applyOptions);
    }
  }

  /** Rotate selected PCB footprints without changing their local pad geometry. */
  rotatePcbFootprints(
    ids: readonly ElementId[],
    degrees: number,
    options: ApplyOptions = {},
  ): void {
    const commands = planPcbFootprintRotation(
      this.store,
      this.createShapeContext(),
      ids,
      degrees,
    );
    if (commands.length) this.apply(commands, options);
  }

  /** Add one PCB track; returns an empty id when the target page is not PCB. */
  addPcbTrack(pageId: PageId, input: PcbTrackInput): ElementId {
    if (this.store.getPage(pageId)?.kind !== "pcb") return "";
    const element = this.buildElement("pcb.track", {
      page: pageId,
      index: pcbInsertIndex(this.store, pageId, "pcb.track"),
      semantic: roundPcbTrackInput(input),
    });
    this.apply([
      { type: "createElement", element: { ...element, visual: {} } },
    ]);
    return element.id;
  }

  /** Add one PCB via; returns an empty id when the target page is not PCB. */
  addPcbVia(pageId: PageId, input: PcbViaInput): ElementId {
    if (this.store.getPage(pageId)?.kind !== "pcb") return "";
    const element = this.buildElement("pcb.via", {
      page: pageId,
      index: pcbInsertIndex(this.store, pageId, "pcb.via"),
      semantic: pcbViaSemantic(input),
    });
    this.apply([
      { type: "createElement", element: { ...element, visual: {} } },
    ]);
    return element.id;
  }

  /** Resize through the element's ShapeUtil; a no-op for fixed shapes. */
  resizeElement(
    id: ElementId,
    box: Box,
    applyOptions: ApplyOptions = {},
  ): void {
    const element = this.store.get(id);
    if (!element) {
      return;
    }
    const util = this.registry.getOrFallback(element.type);
    if (!util.canResize || !util.resize) {
      return;
    }
    const visual = resizedVisual(element, util, this.getBounds(id), box);
    if (!visual) return;
    this.apply([{ type: "replaceVisual", id, visual }], applyOptions);
  }

  // ------------------------------------------------------ delete and copies

  deleteElements(
    ids: readonly ElementId[],
    applyOptions: ApplyOptions = {},
  ): void {
    const present = ids.filter((id) => this.store.has(id));
    if (present.length === 0) {
      return;
    }
    this.apply([{ type: "deleteElements", ids: present }], applyOptions);
  }

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
   * Clone one complete artboard beside its source and resize the clone through
   * the normal constraint/layout pipeline. Shared design resources remain
   * linked because this is an in-document responsive variant, not a portable
   * clipboard fragment. The create and derived reflow form one undo step.
   */
  createResponsiveVariant(
    id: ElementId,
    presetKey: FramePresetKey,
    applyOptions: ApplyOptions = {},
  ): ElementId | null {
    const plan = planResponsiveVariant(this, this.idSource, id, presetKey);
    if (!plan) return null;
    this.apply(plan.commands, applyOptions);
    this.selection.set([plan.createdId]);
    return plan.createdId;
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

  // ---------------------------------------------------------------- export

  private readonly requireAsset = (source: string): string => {
    const value = this.assets.resolve(source);
    if (!value)
      throw new Error(
        `Missing attachment: ${source}. Restore the file beside the document.`,
      );
    return value;
  };

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

  /** The text field a double-click on `id` edits, or `null`. */
  editableField(id: ElementId): EditableField | null {
    return editableFieldOf(this.store, id);
  }

  /** Current value of the editable text field, or `null` when none. */
  getText(id: ElementId): string | null {
    const field = this.editableField(id);
    const element = this.store.get(id);
    if (!field || !element) {
      return null;
    }
    const semantic = element.semantic;
    if (typeof semantic !== "object" || semantic === null) {
      return "";
    }
    const value = (semantic as Record<string, unknown>)[field];
    return typeof value === "string" ? value : "";
  }

  /**
   * Write the editable text field. One `updateSemantic`; the rest of the
   * payload is carried over untouched. False when the element has no such
   * field or the text did not change.
   */
  setText(
    id: ElementId,
    text: string,
    applyOptions: ApplyOptions = {},
  ): boolean {
    if (this.readOnly) return false;
    const field = this.editableField(id);
    const element = this.store.get(id);
    if (!field || !element || this.getText(id) === text) {
      return false;
    }
    const base =
      typeof element.semantic === "object" && element.semantic !== null
        ? { ...(element.semantic as Record<string, unknown>) }
        : {};
    if (element.type === "text.note") {
      const previous = this.getText(id) ?? "";
      const marks = rebaseTextMarks(previous, text, textNoteMarks(base));
      return this.setRichText(id, text, marks, applyOptions);
    }
    if (
      text === "" &&
      field === "label" &&
      OPTIONAL_LABEL_TYPES.has(element.type)
    ) {
      delete base[field];
    } else {
      base[field] = text;
    }
    this.apply([{ type: "updateSemantic", id, semantic: base }], applyOptions);
    return true;
  }

  /** Replace one text note's content and portable inline marks atomically. */
  setRichText(
    id: ElementId,
    text: string,
    marks: readonly TextMark[],
    applyOptions: ApplyOptions = {},
  ): boolean {
    const element = this.store.get(id);
    if (element?.type !== "text.note") return false;
    const semantic = element.semantic as TextNoteSemantic;
    const normalized = normalizeTextMarks(text, marks);
    const { marks: _marks, ...rest } = semantic;
    const next = {
      ...rest,
      text,
      ...(normalized.length ? { marks: normalized } : {}),
    };
    if (JSON.stringify(next) === JSON.stringify(semantic)) return false;
    this.apply([{ type: "updateSemantic", id, semantic: next }], applyOptions);
    return true;
  }

  /** Toggle formatting over a text note's half-open UTF-16 range. */
  toggleTextMark(
    id: ElementId,
    start: number,
    end: number,
    kind: TextMarkKind,
    href?: string,
    applyOptions: ApplyOptions = {},
  ): boolean {
    const element = this.store.get(id);
    if (element?.type !== "text.note") return false;
    const semantic = element.semantic as TextNoteSemantic;
    return this.setRichText(
      id,
      semantic.text,
      toggleTextMarkRange(
        semantic.text,
        textNoteMarks(semantic),
        start,
        end,
        kind,
        href,
      ),
      applyOptions,
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

  // --------------------------------------------------------------- connect

  /** Move one sequence participant/message by one semantic timeline slot. */
  moveSequenceElement(
    id: ElementId,
    delta: -1 | 1,
    applyOptions: ApplyOptions = {},
  ): boolean {
    const commands = planSequenceMove(this, this.rng, id, delta);
    if (!commands) return false;
    this.apply(commands, applyOptions);
    return true;
  }

  /** Place one ordered sequence participant with its header at a page point. */
  createSequenceParticipant(
    kind: ParticipantKind,
    centre: Vec,
    applyOptions: ApplyOptions = {},
  ): ElementId {
    const element = buildSequenceParticipant(this, this.rng, kind, centre);
    this.apply([{ type: "createElement", element }], applyOptions);
    return element.id;
  }

  /** Create an activation bar spanning this participant's current messages. */
  createSequenceActivation(
    participantId: ElementId,
    applyOptions: ApplyOptions = {},
  ): ElementId | null {
    const plan = planSequenceActivation(this, this.rng, participantId);
    if (!plan) return null;
    this.apply(plan.commands, applyOptions);
    return plan.id;
  }

  /**
   * Connect two elements with the connector their types call for: two ERD
   * tables get a relation, two UML classes an association, two sequence
   * participants a timeline message, and anything else a generic edge.
   * `null` for the same cases `connect` refuses.
   */
  connectSmart(
    from: ElementId,
    to: ElementId,
    applyOptions: ApplyOptions = {},
    ports: ConnectorPorts = {},
  ): ElementId | null {
    return connectByType(this, this.rng, from, to, applyOptions, ports);
  }

  /** Logical relations and enforced foreign keys share endpoint mappings. */
  connectErdRelation(
    from: ElementId,
    to: ElementId,
    logical: boolean,
    options: ApplyOptions = {},
    ports: ConnectorPorts = {},
  ): ElementId | null {
    return connectErdTables(this, from, to, logical, options, ports);
  }

  /** Component relationships never borrow class-association semantics. */
  connectComponent(
    from: ElementId,
    to: ElementId,
    kind: UmlComponentRelationshipKind,
    options: ApplyOptions = {},
    ports: ConnectorPorts = {},
  ): ElementId | null {
    return connectUmlComponents(this, from, to, kind, options, ports);
  }

  /** Use-case relationships connect actors, use cases and systems only. */
  connectUseCase(
    from: ElementId,
    to: ElementId,
    kind: UseCaseRelationshipKind,
    options: ApplyOptions = {},
    ports: ConnectorPorts = {},
  ): ElementId | null {
    return connectUseCases(this, from, to, kind, options, ports);
  }

  /** Click a component to attach a port to its nearest boundary. */
  createUmlPort(ownerId: ElementId, point: Vec): ElementId | null {
    return placeUmlPort(this, ownerId, point);
  }

  // ------------------------------------------------------------------ bpmn

  connectBpmn(
    from: ElementId,
    to: ElementId,
    requested?: BpmnFlowType,
    applyOptions: ApplyOptions = {},
    ports: ConnectorPorts = {},
  ): BpmnEditResult {
    const plan = planBpmnConnection(
      this.store,
      this.createShapeContext(),
      from,
      to,
      requested,
      ports,
    );
    if (!plan.ok) return this.rejectBpmn(plan);
    const id = this.createElement(
      plan.type,
      { page: plan.page, semantic: plan.semantic },
      applyOptions,
    );
    return { ok: true, id, type: plan.type };
  }

  reconnectBpmnFlow(
    id: ElementId,
    end: "from" | "to",
    target: ElementId,
    applyOptions: ApplyOptions = {},
    port?: ConnectorPort,
  ): BpmnEditResult {
    const plan = planBpmnReconnect(this.store, id, end, target, port);
    if (!plan.ok) return this.rejectBpmn(plan);
    this.apply(plan.commands, applyOptions);
    return { ok: true, id, type: plan.type };
  }

  updateBpmnSemantic(
    id: ElementId,
    semantic: unknown,
    applyOptions: ApplyOptions = {},
  ): BpmnEditResult {
    const check = checkBpmnSemantic(this.store, id, semantic);
    if (!check.ok) return this.rejectBpmn(check);
    this.apply([{ type: "updateSemantic", id, semantic }], applyOptions);
    return { ok: true, id, type: check.type };
  }

  addBpmnLane(
    parentId: ElementId,
    applyOptions: ApplyOptions = {},
  ): BpmnEditResult {
    const plan = planBpmnLane(this, this.rng, this.idSource, parentId);
    if (!plan.ok) return this.rejectBpmn(plan);
    this.apply(plan.commands, applyOptions);
    return { ok: true, id: plan.id, type: "bpmn.lane" };
  }

  // -------------------------------------------------------------- internal

  private applyPlan(
    commands: readonly Command[],
    applyOptions: ApplyOptions,
  ): boolean {
    if (this.readOnly || commands.length === 0) {
      return false;
    }
    this.apply(commands, applyOptions);
    return true;
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

  private notify(diff: StoreDiff): void {
    this.revisionCount += 1;
    for (const listener of [...this.listeners]) {
      listener(diff);
    }
  }
}
