import type { Editor } from "@nodetto/core";
import type { PageId } from "@nodetto/ir";
import {
  createMemo,
  createSignal,
  For,
  type JSX,
  onCleanup,
  onMount,
} from "solid-js";
import { createEditorSignals } from "./adapter.ts";
import {
  copyShapesOptions,
  defaultCopyShapesOption,
} from "./copy-shapes-options.ts";
import "./CopyShapesDialog.css";
export function CopyShapesDialog(props: {
  readonly editor: Editor;
  readonly targetId: PageId;
  readonly onClose: () => void;
}): JSX.Element {
  const signals = createEditorSignals(props.editor);
  const options = createMemo(() => {
    signals.rev();
    return copyShapesOptions(props.editor.store.listPages(), props.targetId);
  });
  const [selected, setSelected] = createSignal(
    defaultCopyShapesOption(options())?.key ?? null,
  );
  const current = () =>
    options().find((option) => option.key === selected() && !option.disabled);
  const confirm = () => {
    const item = current();
    if (item?.pageId && !props.editor.readOnly) {
      props.editor.copyPageElements(item.pageId, props.targetId);
      props.onClose();
    }
  };
  let dialog: HTMLDialogElement | undefined;
  onMount(() => {
    const previous = document.activeElement;
    dialog?.showModal();
    dialog?.querySelector<HTMLElement>('[role="listbox"]')?.focus();
    onCleanup(() => {
      dialog?.close();
      if (previous instanceof HTMLElement && previous.isConnected)
        previous.focus();
    });
  });
  return (
    <dialog
      ref={dialog}
      class="nodetto-copy-shapes-dialog"
      aria-labelledby="copy-shapes-title"
      onCancel={(event) => {
        event.preventDefault();
        props.onClose();
      }}
      onKeyUp={(event) => event.stopPropagation()}
      onKeyDown={(event) => {
        event.stopPropagation();
        if (event.key === "Escape") {
          event.preventDefault();
          props.onClose();
        } else if (event.key === "Enter") {
          event.preventDefault();
          confirm();
        } else if (event.key === "ArrowDown" || event.key === "ArrowUp") {
          event.preventDefault();
          const enabled = options().filter((option) => !option.disabled);
          if (!enabled.length) return;
          const index = enabled.findIndex(
            (option) => option.key === selected(),
          );
          const next =
            event.key === "ArrowDown"
              ? (index + 1) % enabled.length
              : index <= 0
                ? enabled.length - 1
                : index - 1;
          setSelected(enabled[next]?.key ?? null);
        }
      }}
    >
      <h2 id="copy-shapes-title">Copy shapes from page</h2>
      <div
        role="listbox"
        aria-label="Source page"
        tabIndex="0"
        aria-activedescendant={
          selected() === null
            ? undefined
            : `copy-option-${options().findIndex((option) => option.key === selected())}`
        }
      >
        <For each={options()}>
          {(option, index) => (
            <div
              id={`copy-option-${index()}`}
              role="option"
              aria-selected={selected() === option.key}
              aria-disabled={option.disabled}
              classList={{
                selected: selected() === option.key,
                disabled: option.disabled,
              }}
              onClick={() => {
                if (!option.disabled) setSelected(option.key);
              }}
            >
              {option.label}
            </div>
          )}
        </For>
      </div>
      <footer>
        <button type="button" onClick={props.onClose}>
          Cancel
        </button>
        <button
          type="button"
          disabled={!current() || props.editor.readOnly}
          onClick={confirm}
        >
          Copy
        </button>
      </footer>
    </dialog>
  );
}
