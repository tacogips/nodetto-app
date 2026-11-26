import type { Editor, Vec } from "@nodetto/core";
import type { ElementId } from "@nodetto/ir";
import { createMemo, For, Show, type Accessor } from "solid-js";
import {
  schematicDraftPath,
  schematicFocusAfterNudge,
  schematicHandleKey,
  schematicNoticeLabel,
  schematicWireHandles,
} from "./schematic-overlay.ts";

export interface SchematicOverlayProps {
  readonly editor: Editor;
  readonly revision: Accessor<number>;
  readonly selection: Accessor<ReadonlySet<ElementId>>;
  readonly wireDraft: Accessor<readonly Vec[] | null>;
  readonly notice: Accessor<string | null>;
  readonly startWirePoint: (
    id: ElementId,
    index: number,
    event: PointerEvent,
  ) => void;
  readonly nudgeWirePoint: (
    id: ElementId,
    index: number,
    dx: number,
    dy: number,
  ) => number | null;
  readonly flushNudge: () => void;
}

export function SchematicOverlay(props: SchematicOverlayProps) {
  let group: SVGGElement | undefined;
  const selectedId = () =>
    props.selection().size === 1
      ? props.selection().values().next().value
      : undefined;
  const handles = createMemo(() => {
    props.revision();
    const id = selectedId();
    return schematicWireHandles(
      id ? props.editor.store.get(id) : undefined,
      id !== undefined,
    );
  });
  const notice = () => schematicNoticeLabel(props.notice(), props.wireDraft());
  return (
    <g ref={group} class="schematic-overlay">
      <style>
        {
          ".schematic-wire-handle:focus-visible { outline: none; stroke: var(--nodetto-accent); stroke-width: 3; }"
        }
      </style>
      <Show when={schematicDraftPath(props.wireDraft())}>
        {(path) => (
          <polyline
            class="schematic-wire-draft"
            points={path()}
            fill="none"
            stroke="var(--nodetto-accent)"
            stroke-width="1.5"
            stroke-dasharray="3 2"
            pointer-events="none"
            vector-effect="non-scaling-stroke"
          />
        )}
      </Show>
      <Show when={props.wireDraft()?.at(-1)}>
        {(point) => (
          <circle
            cx={point().x}
            cy={point().y}
            r="4"
            fill="none"
            stroke="var(--nodetto-accent)"
            pointer-events="none"
          />
        )}
      </Show>
      <For each={handles()}>
        {(handle) => (
          <circle
            class="schematic-wire-handle"
            data-wire-index={handle.index}
            cx={handle.at.x}
            cy={handle.at.y}
            r="4"
            fill="var(--nodetto-surface)"
            stroke="var(--nodetto-ink)"
            stroke-width="1.5"
            tabindex="0"
            role="button"
            aria-label={handle.label}
            pointer-events="all"
            style={{ cursor: "move" }}
            onPointerDown={(event) => {
              const id = selectedId();
              if (id) props.startWirePoint(id, handle.index, event);
            }}
            onKeyDown={(event) => {
              const delta = schematicHandleKey(event.key, event.shiftKey);
              const id = selectedId();
              if (!delta || !id) return;
              event.preventDefault();
              props.flushNudge();
              const index = schematicFocusAfterNudge(
                props.nudgeWirePoint(id, handle.index, delta.dx, delta.dy),
                handle.index,
              );
              queueMicrotask(() => {
                if (selectedId() === id)
                  group
                    ?.querySelector<SVGElement>(
                      `.schematic-wire-handle[data-wire-index="${index}"]`,
                    )
                    ?.focus();
              });
            }}
          />
        )}
      </For>
      <Show when={notice()}>
        {(value) => (
          <foreignObject
            x={value().at?.x ?? 0}
            y={value().at?.y ?? 0}
            width="320"
            height="60"
            pointer-events="none"
          >
            <div
              role="status"
              aria-live="polite"
              style={{
                color: "var(--nodetto-ink)",
                "background-color": "var(--nodetto-surface)",
              }}
            >
              {value().text}
            </div>
          </foreignObject>
        )}
      </Show>
    </g>
  );
}
