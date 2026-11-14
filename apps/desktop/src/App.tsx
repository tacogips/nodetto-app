// App shell: file controls, cloud controls, the toolbar, page tabs, the
// canvas with its floating chrome, and the Inspector column.
//
// The tool lives here rather than inside either component because both read
// it and both write it — the canvas resets to "select" after placing a
// shape, so the toolbar's highlight has to follow. The same goes for the
// snapping switches, grid visibility, the viewport size, the inline editing
// target and the context menu: each is read by one component and written by
// another, so the shell owns the signal and hands it both ways.
//
// The shell holds no document state of its own: it mirrors each session's
// state into a signal and calls back in. What it does own is the *mode* —
// one editor can be showing a local file or a cloud room, never both — and
// everything that has two implementations (undo, the title, which controls
// are live) is routed through that discriminator rather than guessed at.
//
// The pieces it composes live in `shell/`: the side panes and their layout,
// the file and status chrome, export handlers, file commands, window input
// and cloud presence.

import {
  createDesignTemplate,
  createReviewComment,
  type DesignTemplateId,
  type EditableField,
  type Editor,
  type NewReviewMessage,
  type Vec,
} from "@nodetto/core";
import type { ElementId } from "@nodetto/ir";
import {
  ExportDialog,
  Icon,
  type ActionContext,
  ContextMenu,
  BpmnProblemsPanel,
  BreadboardProblemsPanel,
  createEditorSignals,
  NodettoCanvas,
  getAction,
  HelpHint,
  Inspector,
  Layers,
  PageTabs,
  ReviewCommentPins,
  runAction,
  SelectionToolbar,
  ShapePalette,
  type SnapSettings,
  TextEditor,
  Toolbar,
  workspaceById,
  readWorkspacePreference,
  writeWorkspacePreference,
  type WorkspaceId,
  type ToolKind,
  ZoomControls,
} from "@nodetto/ui-solid";
import {
  createEffect,
  createSignal,
  type JSX,
  onCleanup,
  onMount,
  Show,
} from "solid-js";
import { CloudPanel } from "./cloud/CloudPanel.tsx";
import { PresenceOverlay } from "./cloud/PresenceOverlay.tsx";
import type { CloudSession, CloudSessionState } from "./cloud/session.ts";
import { bindCloudFileOwnership } from "./cloud/file-ownership.ts";
import { type CloudSettings, defaultCloudSettings } from "./cloud/settings.ts";
import type { ExportBackend } from "./file/backend.ts";
import { type LaunchBackend, watchOpenRequests } from "./file/launch.ts";
import { watchNativeFileMenu } from "./file/native-menu.ts";
import { loadSaveMode, storeSaveMode } from "./file/save-mode.ts";
import type { DocumentSession, SessionState } from "./file/session.ts";
import { SettingsDialog } from "./settings/SettingsDialog.tsx";
import type { CliInstaller } from "./settings/cli-install.ts";
import {
  loadEditorPreferences,
  storeEditorPreferences,
} from "./settings/preferences.ts";
import { createDocumentCommands } from "./shell/document-commands.ts";
import { DocumentBanners, DocumentStatus } from "./shell/DocumentStatus.tsx";
import { createExportHandlers } from "./shell/export-handlers.ts";
import { FileActions } from "./shell/FileActions.tsx";
import { createPaneLayout } from "./shell/pane-layout.ts";
import { createPresencePublisher } from "./shell/presence.ts";
import { PaneDivider, SidePane } from "./shell/SidePanes.tsx";
import { watchWindowInput } from "./shell/window-input.ts";
import { followPageWorkspace, selectWorkspacePage } from "./shell/workspace.ts";
import { TemplateDialog } from "./TemplateDialog.tsx";
import "./square-chrome.css";
import "./pane.css";

export { exportBaseName } from "./shell/export-handlers.ts";

export interface AppProps {
  readonly editor: Editor;
  readonly session: DocumentSession;
  /** Omitted by the local-only desktop client. */
  readonly cloud?: CloudSession;
  /** False outside Tauri: there is no filesystem to reach. */
  readonly filesAvailable: boolean;
  /** Save dialog and writer for exports; falls back to a download. */
  readonly exportBackend: ExportBackend;
  /** Documents the OS asked to open; omitted by shells without a host OS. */
  readonly launchBackend?: LaunchBackend;
  /** Installs the bundled nodetto-cli from Settings; desktop only. */
  readonly cliInstaller?: CliInstaller;
  readonly cloudSettings?: CloudSettings;
  readonly onCloudSettingsChange?: (settings: CloudSettings) => void;
  /** Opaque account lifecycle signal for invalidating cloud list pages. */
  readonly cloudRefreshToken?: unknown;
  /** Hosted shells can add account controls without coupling to public cloud code. */
  readonly headerContent?: JSX.Element;
  /** Hosted shells can mount workspace navigation above the shared Layers pane. */
  readonly navigationContent?: JSX.Element;
}

/** Which document the editor is showing. File mode is the default. */
export type DocumentMode =
  | { readonly kind: "file" }
  | { readonly kind: "cloud" };

/** The inline text editor's target (design editor-ux 3.3). */
export interface EditingTarget {
  readonly id: ElementId;
  readonly field: EditableField;
}

/** Which element (and row) the Inspector should scroll to and highlight. */
export interface InspectorFocus {
  readonly id: ElementId;
  readonly row?: number;
}

export function App(props: AppProps): JSX.Element {
  const preferenceStorage = () => {
    try {
      return window.localStorage;
    } catch {
      return undefined;
    }
  };
  const [workspace, setWorkspace] = createSignal<WorkspaceId>(
    readWorkspacePreference(preferenceStorage()),
  );
  const simpleWorkspace = () => !workspaceById(workspace()).design;
  const changeWorkspace = (id: WorkspaceId) => {
    selectWorkspacePage(props.editor, id);
    setActiveTool("select");
    setContextMenu(null);
    setWorkspace(id);
    writeWorkspacePreference(preferenceStorage(), id);
  };
  const editorSignals = createEditorSignals(props.editor);
  const [tool, setTool] = createSignal<ToolKind>("select");
  const [pendingComment, setPendingComment] = createSignal<{
    readonly input: NewReviewMessage;
    readonly target: ElementId | undefined;
    readonly onPlaced: () => void;
  } | null>(null);
  props.session.setSaveMode(loadSaveMode(preferenceStorage()));
  const [file, setFile] = createSignal<SessionState>(props.session.state());
  const [cloud, setCloud] = createSignal<CloudSessionState | undefined>(
    props.cloud?.state(),
  );
  const [settings, setSettings] = createSignal<CloudSettings>(
    props.cloudSettings ?? defaultCloudSettings(),
  );
  const [cloudPanelExpanded, setCloudPanelExpanded] = createSignal(false);

  // Editor chrome state (design editor-ux 3.3, 3.5, 3.6, 4).
  const preferences = loadEditorPreferences(preferenceStorage());
  props.session.setAutosaveDelayMs(preferences.autosaveDelayMs);
  const [autosaveDelayMs, setAutosaveDelayMs] = createSignal(
    preferences.autosaveDelayMs,
  );
  const [settingsOpen, setSettingsOpen] = createSignal(false);
  const [snap, setSnap] = createSignal<SnapSettings>(preferences.snap);
  const [showGrid, setShowGrid] = createSignal(preferences.showGrid);
  const [showRulers, setShowRulers] = createSignal(preferences.showRulers);
  const changeShowRulers = setShowRulers;
  const [viewport, setViewport] = createSignal({ width: 0, height: 0 });
  const [editing, setEditing] = createSignal<EditingTarget | null>(null);
  const [contextMenu, setContextMenu] = createSignal<{
    readonly at: Vec;
  } | null>(null);
  const [inspectorFocus, setInspectorFocus] = createSignal<
    InspectorFocus | undefined
  >(undefined);
  const [shapeDrop, setShapeDrop] = createSignal<{
    tool: ToolKind;
    client: Vec;
  }>();
  const [commentRequest, setCommentRequest] = createSignal(0);
  const [exportRequest, setExportRequest] = createSignal(0);
  const [exportError, setExportError] = createSignal<string | null>(null);
  const [canvasHost, setCanvasHost] = createSignal<HTMLDivElement>();
  const panes = createPaneLayout({
    leftPaneOpen: preferences.leftPaneOpen,
    rightPaneOpen: preferences.rightPaneOpen,
  });
  createEffect(() =>
    storeEditorPreferences(
      {
        showGrid: showGrid(),
        showRulers: showRulers(),
        leftPaneOpen: panes.leftPaneOpen(),
        rightPaneOpen: panes.rightPaneOpen(),
        snap: snap(),
        autosaveDelayMs: autosaveDelayMs(),
      },
      preferenceStorage(),
    ),
  );
  let inspectorHost: HTMLDivElement | undefined;
  let fileMenu: HTMLDetailsElement | undefined;
  let settingsButton: HTMLButtonElement | undefined;
  let cloudPanelHost: HTMLDivElement | undefined;
  let documentStatusHost: HTMLDivElement | undefined;
  const [cloudPanelTop, setCloudPanelTop] = createSignal(44);
  const dismissCloudPanel = (): void => {
    setCloudPanelExpanded(false);
    settingsButton?.focus();
  };

  const setActiveTool = (next: ToolKind): void => {
    if (props.editor.readOnly && next !== "select" && next !== "hand") return;
    if (next !== "comment") setPendingComment(null);
    setTool(next);
  };
  const beginCommentPlacement = (
    input: NewReviewMessage,
    onPlaced: () => void,
  ): void => {
    const [selected] = props.editor.selection.ids();
    setPendingComment({
      input,
      target: props.editor.selection.size === 1 ? selected : undefined,
      onPlaced,
    });
    setEditing(null);
    setContextMenu(null);
    setTool("comment");
  };
  const placeComment = (point: Vec): void => {
    const pending = pendingComment();
    if (!pending) return;
    const created = createReviewComment(
      props.editor,
      point,
      pending.input,
      pending.target,
    );
    if (created) pending.onPlaced();
  };

  onCleanup(props.session.subscribe(setFile));
  if (props.cloud) {
    onCleanup(bindCloudFileOwnership(props.cloud, props.session));
    onCleanup(props.cloud.subscribe(setCloud));
  }

  /**
   * Ownership is independent of transport status: reconnect permission probes
   * and fresh viewer snapshots must not reactivate local autosave.
   *
   * Not from the moment one is *requested*: `connecting` and `syncing` have
   * not touched the editor yet, and a connect that fails its authorization
   * probe must leave the user's open file exactly as it was.
   */
  const mode = (): DocumentMode =>
    cloud()?.ownsEditor ? { kind: "cloud" } : { kind: "file" };
  const isCloud = (): boolean => mode().kind === "cloud";
  let wasViewer = false;
  createEffect(() => {
    const viewer = cloud()?.role === "viewer";
    if (viewer === wasViewer) return;
    wasViewer = viewer;
    if (!viewer) return;
    setActiveTool("select");
    setEditing(null);
    setContextMenu(null);
  });

  const updateSettings = (next: CloudSettings): void => {
    setSettings(next);
    props.onCloudSettingsChange?.(next);
  };

  const { mayDiscard, newDocument, open, reload, openRecent } =
    createDocumentCommands(props, file, viewport);

  const [templatesOpen, setTemplatesOpen] = createSignal(false);
  const openTemplates = () => setTemplatesOpen(true);
  const useTemplate = async (id: DesignTemplateId) => {
    if (isCloud() || !mayDiscard()) return;
    const document = createDesignTemplate(id);
    if (await props.session.importDocument(document, document.title)) {
      changeWorkspace(id === "web-workspace" ? "web" : "app");
      setTemplatesOpen(false);
      const first = document.elements.find(
        (element) => element.type === "frame",
      );
      if (first) props.editor.selection.set([first.id]);
      props.editor.zoomToSelection(viewport());
    }
  };

  const isBpmnPage = (): boolean => {
    editorSignals.rev();
    return (
      props.editor.store.getPage(props.editor.currentPageId)?.kind === "bpmn"
    );
  };

  const isBreadboardPage = (): boolean => {
    editorSignals.rev();
    return (
      props.editor.store.getPage(props.editor.currentPageId)?.kind ===
      "breadboard"
    );
  };

  followPageWorkspace(props, editorSignals.rev, workspace, setWorkspace);

  onMount(() => {
    const launch = props.launchBackend;
    if (!launch) return;
    // A file opened from the OS must never be loaded into a cloud room's
    // document: hold it until the editor is back in file mode.
    const requests = watchOpenRequests(launch, openRecent, () => !isCloud());
    onCleanup(() => requests.stop());
    createEffect(() => {
      if (!isCloud()) requests.flush();
    });
  });

  // ------------------------------------------------------------ editing

  /** Start the inline editor on `id` when it has a text field. */
  const requestEdit = (id: ElementId): void => {
    if (props.editor.readOnly) return;
    const field = props.editor.editableField(id);
    if (field !== null) {
      setContextMenu(null);
      setEditing({ id, field });
    }
  };

  const focusInspector = (focus: InspectorFocus | undefined): void => {
    setInspectorFocus(focus);
    panes.restorePane("right");
    queueMicrotask(() => inspectorHost?.focus());
  };

  onCleanup(panes.releaseDrag);
  onMount(() => {
    const header = documentStatusHost;
    if (!header) return;
    const positionCloud = (): void => {
      setCloudPanelTop(header.getBoundingClientRect().bottom + 4);
    };
    const observer = new ResizeObserver(positionCloud);
    observer.observe(header);
    window.addEventListener("resize", positionCloud);
    positionCloud();
    onCleanup(() => {
      observer.disconnect();
      window.removeEventListener("resize", positionCloud);
    });
  });
  onMount(() => {
    const stop = panes.observeEditorBody();
    if (stop) onCleanup(stop);
  });

  // A focus hint is about one element; once that element leaves the
  // selection the Inspector is showing something else and the hint is stale.
  onCleanup(
    props.editor.selection.subscribe((ids) => {
      const focus = inspectorFocus();
      if (focus && !ids.has(focus.id)) {
        setInspectorFocus(undefined);
      }
    }),
  );

  // ------------------------------------------------------------- export

  /** Reveal format-specific settings before choosing a save destination. */
  const openExport = () => {
    setExportRequest((value) => value + 1);
  };
  const exportHandlers = createExportHandlers(props, setExportError);

  /** Everything the shared action table needs from the shell. */
  const actionContext = (): ActionContext => ({
    editor: props.editor,
    viewport: viewport(),
    requestEdit,
    requestComment: () => {
      setActiveTool("select");
      setEditing(null);
      setContextMenu(null);
      panes.restorePane("left");
      setCommentRequest((value) => value + 1);
    },
    exportSvg: openExport,
  });

  onMount(() => {
    const stop = watchNativeFileMenu({
      canEdit: () => props.filesAvailable && !isCloud() && !settingsOpen(),
      newDocument,
      newFromTemplate: openTemplates,
      open,
      save: () => {
        void props.session.save();
      },
      reload,
      saveAs: () => {
        void props.session.saveAs();
      },
      exportDocument: () => {
        if (settingsOpen()) return;
        runAction(getAction("exportSvg"), actionContext());
      },
    });
    onCleanup(stop);
  });

  // ----------------------------------------------------------- keyboard

  onMount(() => {
    onCleanup(
      watchWindowInput(props, {
        settingsOpen,
        isCloud,
        exportDocument: () =>
          runAction(getAction("exportSvg"), actionContext()),
        save: () => {
          void props.session.save();
        },
        cloudPanelExpanded,
        collapseCloudPanel: () => setCloudPanelExpanded(false),
        cloudPanelHost: () => cloudPanelHost,
        settingsButton: () => settingsButton,
        fileMenu: () => fileMenu,
      }),
    );
  });

  // ----------------------------------------------------------- presence

  const presence = createPresencePublisher(props, isCloud, canvasHost);

  return (
    <div
      class="app-shell"
      data-nodetto-editor=""
      classList={{ "app-cloud-mode": isCloud() }}
    >
      <Show when={templatesOpen()}>
        <TemplateDialog
          onChoose={(id) => void useTemplate(id)}
          onClose={() => setTemplatesOpen(false)}
        />
      </Show>
      <Show when={exportRequest() > 0}>
        <ExportDialog
          editor={props.editor}
          saveArtwork={
            props.exportBackend.available
              ? exportHandlers.saveArtwork
              : undefined
          }
          saveHtmlBundle={
            props.exportBackend.available
              ? exportHandlers.saveArtwork
              : undefined
          }
          exportBpmn={exportHandlers.exportBpmn}
          exportBreadboard={exportHandlers.exportBreadboard}
          exportGerber={exportHandlers.exportGerber}
          exportPcb={exportHandlers.exportPcbGerber}
          error={exportError()}
          onClose={() => setExportRequest(0)}
        />
      </Show>
      <Show when={props.cloud}>
        {(activeCloud) => (
          <div
            ref={cloudPanelHost}
            style={{ "--app-cloud-top": `${cloudPanelTop()}px` }}
          >
            <CloudPanel
              editor={props.editor}
              session={activeCloud()}
              state={cloud() ?? activeCloud().state()}
              settings={settings()}
              onSettingsChange={updateSettings}
              refreshToken={props.cloudRefreshToken}
              expanded={cloudPanelExpanded()}
              onExpandedChange={(expanded) => {
                if (expanded) setCloudPanelExpanded(true);
                else dismissCloudPanel();
              }}
              renderToggle={false}
              // Opening a room replaces what is on the canvas, exactly like opening
              // a file does, so it asks the same question first.
              mayDiscard={mayDiscard}
            />
          </div>
        )}
      </Show>
      <DocumentBanners
        file={file()}
        isCloud={isCloud()}
        problemsPanelOpen={isBpmnPage() || isBreadboardPage()}
        error={cloud()?.error ?? file().error ?? exportError()}
        onResolveConflict={(choice) =>
          void props.session.resolveConflict(choice)
        }
      />
      <Show when={settingsOpen()}>
        <SettingsDialog
          workspace={workspace()}
          onWorkspaceChange={changeWorkspace}
          showGrid={showGrid()}
          onShowGridChange={setShowGrid}
          showRulers={showRulers()}
          onShowRulersChange={changeShowRulers}
          leftPaneOpen={panes.leftPaneOpen()}
          rightPaneOpen={panes.rightPaneOpen()}
          onPaneChange={(side, open) => {
            if (open) panes.restorePane(side);
            else panes.hidePane(side);
          }}
          snap={snap()}
          onSnapChange={setSnap}
          filesAvailable={props.filesAvailable}
          saveMode={file().saveMode}
          onSaveModeChange={(mode) => {
            props.session.setSaveMode(mode);
            storeSaveMode(mode, preferenceStorage());
          }}
          autosaveDelayMs={autosaveDelayMs()}
          onAutosaveDelayChange={(delay) => {
            props.session.setAutosaveDelayMs(delay);
            setAutosaveDelayMs(delay);
          }}
          filePath={file().filePath}
          cloud={props.cloud ? settings() : undefined}
          onCloudChange={updateSettings}
          cliInstaller={props.cliInstaller}
          onOpenCloud={() => {
            setSettingsOpen(false);
            setCloudPanelExpanded(true);
            queueMicrotask(() =>
              cloudPanelHost
                ?.querySelector<HTMLElement>("input, button")
                ?.focus(),
            );
          }}
          onClose={() => {
            setSettingsOpen(false);
            queueMicrotask(() => settingsButton?.focus());
          }}
        />
      </Show>
      <Toolbar
        workspace={workspace()}
        onWorkspaceChange={changeWorkspace}
        editor={props.editor}
        tool={tool()}
        onToolChange={setActiveTool}
        context={actionContext()}
        leadingContent={
          <FileActions
            filesAvailable={props.filesAvailable}
            isCloud={isCloud()}
            file={file()}
            onNew={newDocument}
            onNewFromTemplate={openTemplates}
            onOpen={open}
            onReload={reload}
            onExport={openExport}
            onSave={() => void props.session.save()}
            onSaveAs={() => void props.session.saveAs()}
            onOpenRecent={openRecent}
            onOpenSettings={() => setSettingsOpen(true)}
            menuRef={(menu) => {
              fileMenu = menu;
            }}
            settingsButtonRef={(button) => {
              settingsButton = button;
            }}
          />
        }
        toolsContent={
          <Show
            when={
              workspace() === "bpmn" && isBpmnPage() && props.filesAvailable
            }
          >
            <button
              type="button"
              class="app-file-button app-header-icon"
              aria-label="Import BPMN"
              title="Import BPMN"
              disabled={isCloud()}
              onClick={open}
            >
              <Icon name="import" />
            </button>
          </Show>
        }
        utilitiesContent={
          <>
            <div class="app-header-slot">{props.headerContent}</div>
            <HelpHint text="Double-click to edit text; right-click for the menu; Ctrl/Cmd + wheel to zoom; Shift + 1 to fit; Ctrl/Cmd + Z to undo; Ctrl/Cmd + S to save." />
          </>
        }
      />
      <div class="app-editor-body" ref={panes.setEditorBody}>
        <SidePane
          layout={panes}
          side="left"
          label="Shapes and layers"
          restoreText="Show Shapes & layers"
        >
          <div class="app-pane-navigation">{props.navigationContent}</div>
          <ShapePalette
            editor={props.editor}
            workspace={workspace()}
            tool={tool()}
            onToolChange={setActiveTool}
            context={actionContext()}
            onShapeDrop={(tool, client) => setShapeDrop({ tool, client })}
          />
          <Layers
            simple={simpleWorkspace()}
            editor={props.editor}
            viewport={viewport()}
            commentAuthor={settings().userName}
            commentRequest={commentRequest()}
            commentPlacementActive={
              tool() === "comment" && pendingComment() !== null
            }
            onPlaceComment={beginCommentPlacement}
            onCancelCommentPlacement={() => setActiveTool("select")}
          />
        </SidePane>
        <PaneDivider layout={panes} side="left" label="Shapes and layers" />
        <div class="app-viewer-column">
          <div class="app-viewer-heading" style={panes.viewerMargins()}>
            <DocumentStatus
              isCloud={isCloud()}
              file={file()}
              cloud={cloud()}
              onUndo={() => props.cloud?.undo()}
              onRedo={() => props.cloud?.redo()}
              hostRef={(element) => {
                documentStatusHost = element;
              }}
            />
          </div>
          <div
            class="app-canvas-host"
            ref={setCanvasHost}
            onPointerMove={presence.onCanvasPointerMove}
            onPointerLeave={presence.onCanvasPointerLeave}
          >
            <NodettoCanvas
              shapeDrop={shapeDrop()}
              editor={props.editor}
              tool={tool()}
              onToolChange={setActiveTool}
              onMarquee={presence.onMarquee}
              onCommentPlace={placeComment}
              snap={snap()}
              showGrid={showGrid()}
              showRulers={showRulers()}
              onEditRequest={(id, region) => {
                if (region === "title" || region === "body") {
                  requestEdit(id);
                } else {
                  focusInspector({ id, row: region.row });
                }
              }}
              onContextMenu={(at, hit) => {
                // The menu acts on the selection. The canvas already selects
                // the hit before reporting it; this guard keeps that true if
                // the gesture layer ever stops doing so.
                if (hit !== null && !props.editor.selection.has(hit)) {
                  props.editor.selection.set([hit]);
                }
                setEditing(null);
                setContextMenu({ at: at.screen });
              }}
              onViewportResize={setViewport}
            >
              <ReviewCommentPins
                editor={props.editor}
                author={settings().userName}
              />
              <Show when={editing()}>
                {(target) => (
                  <TextEditor
                    editor={props.editor}
                    target={target()}
                    onDone={() => setEditing(null)}
                  />
                )}
              </Show>
            </NodettoCanvas>
            <Show when={isCloud()}>
              <PresenceOverlay
                editor={props.editor}
                peers={cloud()?.peers ?? []}
              />
            </Show>
            <Show when={editing() === null}>
              <SelectionToolbar
                simple={simpleWorkspace()}
                context={actionContext()}
                host={canvasHost()}
                onMore={() => {
                  const [first] = props.editor.selection.ids();
                  focusInspector(
                    first === undefined ? undefined : { id: first },
                  );
                }}
              />
            </Show>
            <Show when={contextMenu()}>
              {(menu) => (
                <ContextMenu
                  simple={simpleWorkspace()}
                  context={actionContext()}
                  at={menu().at}
                  host={canvasHost()}
                  onClose={() => setContextMenu(null)}
                />
              )}
            </Show>
          </div>
          <div class="app-viewer-footer" style={panes.viewerMargins()}>
            <PageTabs editor={props.editor} placement="bottom" />
            <ZoomControls
              context={actionContext()}
              snap={snap()}
              showGrid={showGrid()}
              showRulers={showRulers()}
              onSnapChange={setSnap}
              onShowGridChange={setShowGrid}
              onShowRulersChange={changeShowRulers}
            />
          </div>
        </div>
        <PaneDivider layout={panes} side="right" label="Properties" />
        <SidePane
          layout={panes}
          side="right"
          label="Properties"
          restoreText="Show Properties"
        >
          <div class="app-inspector" tabIndex={-1} ref={inspectorHost}>
            <Inspector
              editor={props.editor}
              focus={inspectorFocus()}
              simple={simpleWorkspace()}
              viewport={viewport}
            />
          </div>
          <Show when={isBpmnPage()}>
            <BpmnProblemsPanel
              editor={props.editor}
              viewport={viewport}
              importWarnings={file().importWarnings}
            />
          </Show>
          <Show when={isBreadboardPage()}>
            <BreadboardProblemsPanel
              editor={props.editor}
              viewport={viewport}
              importWarnings={file().importWarnings}
            />
          </Show>
        </SidePane>
      </div>
    </div>
  );
}
