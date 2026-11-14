import { findIcon, renderIconMarkup, searchIcons } from "@nodetto/core";
import { createMemo, createSignal, For, type JSX } from "solid-js";
import "./IconPicker.css";

export function pickerKey(
  key: string,
  index: number,
  names: readonly string[],
  pick: (name: string) => void,
  close: () => void,
): number {
  if (key === "Escape") close();
  if (key === "Enter" && names[index]) pick(names[index]);
  if (key === "ArrowRight" || key === "ArrowDown")
    return Math.min(names.length - 1, index + (key === "ArrowDown" ? 6 : 1));
  if (key === "ArrowLeft" || key === "ArrowUp")
    return Math.max(0, index - (key === "ArrowUp" ? 6 : 1));
  return index;
}
export function IconPicker(props: {
  onPick: (name: string) => void;
  onClose: () => void;
}): JSX.Element {
  const [query, setQuery] = createSignal("");
  const [index, setIndex] = createSignal(0);
  const names = createMemo(() => searchIcons(query(), 120));
  return (
    <div
      class="nodetto-icon-picker"
      onKeyDown={(event) => {
        if (
          [
            "ArrowLeft",
            "ArrowRight",
            "ArrowUp",
            "ArrowDown",
            "Enter",
            "Escape",
          ].includes(event.key)
        ) {
          event.preventDefault();
          setIndex(
            pickerKey(event.key, index(), names(), props.onPick, props.onClose),
          );
        }
      }}
    >
      <input
        class="nodetto-input"
        aria-label="Search icons"
        autofocus
        value={query()}
        onInput={(event) => {
          setQuery(event.currentTarget.value);
          setIndex(0);
        }}
      />
      <div class="nodetto-icon-grid">
        <For each={names()}>
          {(name, at) => (
            <button
              type="button"
              aria-label={name}
              title={name}
              classList={{ selected: at() === index() }}
              onClick={() => props.onPick(name)}
            >
              <svg
                aria-hidden="true"
                width="24"
                height="24"
                innerHTML={renderIconMarkup(
                  findIcon(name) ?? { path: "" },
                  { x: 0, y: 0, width: 24, height: 24 },
                  {
                    stroke: "currentColor",
                    strokeWidth: 2,
                    fill: "none",
                    viewBox: 24,
                  },
                )}
              />
            </button>
          )}
        </For>
      </div>
    </div>
  );
}
