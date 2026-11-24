import { CommandError, type Editor, pcbReferenceCommands } from "@nodetto/core";
import type { ElementId, PageId } from "@nodetto/ir";
import {
  type Accessor,
  createEffect,
  createMemo,
  createSignal,
  For,
  type JSX,
  on,
  Show,
} from "solid-js";
import { stepMenuIndex } from "../menu-navigation.ts";
import { Tool, type ToolKind } from "../tools.ts";
import { pcbBoardChoices, pcbBoardOptions } from "./pcb-insert.ts";
import { cadAuthoringIds, lastElementIndex } from "./sketch-authoring.ts";

/**
 * The PCB board tool of a CAD page. Choosing the tool inserts the only
 * board of the document at once, or opens a menu when there are several.
 */
export function createBoardPicker(options: {
  readonly editor: Editor;
  readonly pageId: PageId;
  readonly revision: Accessor<number>;
  readonly selection: Accessor<unknown>;
  readonly tool: Accessor<ToolKind>;
  readonly selectTool: () => void;
  readonly focus: () => void;
  readonly canvas: () => HTMLCanvasElement;
}): {
  readonly open: Accessor<boolean>;
  readonly notice: Accessor<string | undefined>;
  close(restoreFocus?: boolean): void;
  /** A pointer press outside the menu closes it. */
  dismiss(event: PointerEvent): void;
  readonly Menu: () => JSX.Element;
} {
  const { editor, pageId } = options;
  const [notice, setNotice] = createSignal<string>();
  const [picker, setPicker] = createSignal<{ revision: number }>();
  let menu: HTMLDivElement | undefined;

  function canInsert(version: number): boolean {
    return (
      !editor.readOnly &&
      editor.currentPageId === pageId &&
      editor.documentOpenRevision === version &&
      editor.canCreateOn(pageId, "cad.pcb")
    );
  }

  const boardOptions = createMemo(
    () => {
      const current = picker();
      if (!current) return [];
      options.revision();
      return canInsert(current.revision)
        ? pcbBoardOptions(pcbBoardChoices(editor.getSnapshot()))
        : [];
    },
    [],
    {
      equals: (previous, next) =>
        previous.length === next.length &&
        previous.every(
          ({ value, label }, index) =>
            next[index]?.value === value && next[index]?.label === label,
        ),
    },
  );

  function close(restoreFocus = true): void {
    setPicker(undefined);
    if (restoreFocus) options.focus();
    options.selectTool();
  }

  function insert(boardId: ElementId, version: number): void {
    if (canInsert(version) && editor.store.get(boardId)?.type === "pcb.board") {
      const elements = editor.store.getPageElements(pageId);
      const commands = pcbReferenceCommands(
        pageId,
        boardId,
        "PCB board",
        cadAuthoringIds(elements),
        lastElementIndex(elements),
      );
      try {
        editor.apply(commands);
        const command = commands[0];
        if (command?.type === "createElement")
          editor.selection.set([command.element.id]);
      } catch (error) {
        if (!(error instanceof CommandError)) throw error;
        setNotice(
          error.issues[0]?.message ?? "Could not insert the PCB board.",
        );
      }
    }
    close();
  }

  createEffect(
    on(
      options.tool,
      (current) => {
        setPicker(undefined);
        if (current !== Tool.Select) setNotice(undefined);
        if (current !== Tool.CadPcb) return;
        const version = editor.documentOpenRevision;
        if (!canInsert(version)) {
          close();
          return;
        }
        const choices = pcbBoardChoices(editor.getSnapshot());
        const first = choices[0];
        if (!first) {
          setNotice("This document has no PCB page with a board.");
          close();
        } else if (choices.length === 1) {
          insert(first.boardId, version);
        } else {
          setPicker({ revision: version });
        }
      },
      { defer: true },
    ),
  );

  createEffect(() => {
    if (picker() && boardOptions().length === 0) close(false);
  });

  createEffect(
    on([options.selection, options.revision], () => setNotice(undefined), {
      defer: true,
    }),
  );

  function menuKey(
    event: KeyboardEvent & { currentTarget: HTMLDivElement },
  ): void {
    if (!["ArrowDown", "ArrowUp", "Home", "End"].includes(event.key)) return;
    event.preventDefault();
    event.stopPropagation();
    const buttons = Array.from(event.currentTarget.querySelectorAll("button"));
    const indices = buttons.map((_, index) => index);
    const active = buttons.findIndex((item) => item === document.activeElement);
    const next =
      event.key === "Home"
        ? indices[0]
        : event.key === "End"
          ? indices.at(-1)
          : stepMenuIndex(indices, active, event.key === "ArrowDown" ? 1 : -1);
    if (next != null) buttons[next]?.focus();
  }

  return {
    open: () => picker() !== undefined,
    notice,
    close,
    dismiss(event) {
      if (!picker() || (menu && event.composedPath().includes(menu))) return;
      if (event.target === options.canvas()) {
        event.preventDefault();
        event.stopPropagation();
        close();
      } else {
        close(false);
      }
    },
    Menu: () => (
      <Show when={picker()}>
        {(current) => (
          <div
            ref={menu}
            class="nodetto-context-menu"
            role="menu"
            aria-label="Choose a PCB board"
            style={{
              top: "8px",
              left: "8px",
              "max-height": "calc(100% - 16px)",
              "max-width": "calc(100% - 16px)",
              "overflow-y": "auto",
            }}
            on:keydown={menuKey}
            on:focusout={(event) => {
              if (
                event.relatedTarget instanceof Node &&
                !event.currentTarget.contains(event.relatedTarget)
              )
                close(false);
            }}
          >
            <For each={boardOptions()}>
              {(option, index) => (
                <button
                  ref={(button) => {
                    if (index() === 0)
                      queueMicrotask(() => {
                        if (button.isConnected) button.focus();
                      });
                  }}
                  type="button"
                  role="menuitem"
                  tabindex="-1"
                  class="nodetto-menu-item"
                  onClick={() => insert(option.value, current().revision)}
                >
                  <span class="nodetto-menu-label">{option.label}</span>
                </button>
              )}
            </For>
          </div>
        )}
      </Show>
    ),
  };
}
