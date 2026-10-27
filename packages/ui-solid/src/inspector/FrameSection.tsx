// Artboard (frame) section: screen settings, safe area, responsive variants,
// layout grids and prototype options. Component and auto layout fields live
// in their own modules and render inside the same section.

import {
  addLayoutGrid,
  artboardOrientationIssue,
  FRAME_PRESETS,
  type FramePresetKey,
  frameParents,
  layerName,
  MAX_LAYOUT_GRIDS,
  removeLayoutGrid,
  swapArtboardOrientation,
  updateLayoutGrid,
} from "@nodetto/core";
import {
  FRAME_PLATFORMS,
  type FramePlatform,
  type FrameSemantic,
  type LayoutGrid,
  SCREEN_KINDS,
  type ScreenKind,
} from "@nodetto/ir";
import { createSignal, For, type JSX, Show } from "solid-js";
import { Switch } from "../Switch.tsx";
import { HelpHint } from "../HelpHint.tsx";
import {
  Field,
  NumberInput,
  Section,
  SelectInput,
  type SelectOption,
  TextInput,
} from "./controls.tsx";
import { FrameAutoLayoutFields } from "./FrameAutoLayoutFields.tsx";
import { FrameComponentFields } from "./FrameComponentFields.tsx";
import {
  type ElementSectionProps,
  record,
  stringOf,
} from "./semantic-fields.ts";
import { writeSemantic } from "./write.ts";

const FRAME_PLATFORM_OPTIONS: readonly SelectOption[] = [
  { value: "", label: "Unspecified" },
  ...FRAME_PLATFORMS.map((platform) => ({
    value: platform,
    label:
      platform === "ios"
        ? "iOS"
        : platform.charAt(0).toUpperCase() + platform.slice(1),
  })),
];
const RESPONSIVE_PRESET_OPTIONS: readonly SelectOption[] = Object.entries(
  FRAME_PRESETS,
).map(([value, preset]) => ({
  value,
  label: `${preset.name} (${preset.width} × ${preset.height})`,
}));
export function FrameSection(props: ElementSectionProps): JSX.Element {
  const [refreshStatus, setRefreshStatus] = createSignal("");
  const [responsivePreset, setResponsivePreset] =
    createSignal<FramePresetKey>("iphone");
  const semantic = () => props.element.semantic as FrameSemantic;
  const responsiveSourceName = (id: string): string => {
    const source = props.editor.store.get(id);
    return source ? layerName(source) : id;
  };
  const updateSafeArea = (
    side: "top" | "right" | "bottom" | "left",
    value: number,
  ): void => {
    writeSemantic(props.editor, props.element.id, {
      ...semantic(),
      safeArea: {
        top: 0,
        right: 0,
        bottom: 0,
        left: 0,
        ...semantic().safeArea,
        [side]: value,
      },
    });
  };
  const updateGrid = (index: number, patch: Partial<LayoutGrid>): void => {
    const grid = semantic().layoutGrids?.[index];
    if (!grid) return;
    updateLayoutGrid(props.editor, props.element.id, index, {
      ...grid,
      ...patch,
    } as LayoutGrid);
  };
  return (
    <Section title="Artboard">
      <Field label="Kind">
        <SelectInput
          label="Screen kind"
          value={semantic().screenKind ?? "screen"}
          options={SCREEN_KINDS.map((value) => ({
            value,
            label:
              value === "popup"
                ? "Popup / dialog"
                : value === "bottom-sheet"
                  ? "Bottom sheet"
                  : value === "popover"
                    ? "Popover"
                    : "Screen",
          }))}
          onCommit={(screenKind) =>
            writeSemantic(props.editor, props.element.id, {
              ...semantic(),
              screenKind: screenKind as ScreenKind,
            })
          }
        />
      </Field>
      <button
        type="button"
        class="nodetto-tool-button"
        disabled={
          artboardOrientationIssue(props.editor, props.element.id) !== null
        }
        title={
          artboardOrientationIssue(props.editor, props.element.id) ??
          "Swap width and height and reflow contents"
        }
        onClick={() => swapArtboardOrientation(props.editor, props.element.id)}
      >
        Swap width / height
      </button>
      <Field label="Target">
        <SelectInput
          label="Target platform"
          value={semantic().platform ?? ""}
          options={FRAME_PLATFORM_OPTIONS}
          onCommit={(platform) => {
            const { platform: _old, ...rest } = semantic();
            writeSemantic(props.editor, props.element.id, {
              ...rest,
              ...(platform ? { platform: platform as FramePlatform } : {}),
            });
          }}
        />
      </Field>
      <label>
        <Switch
          checked={semantic().showTitle !== false}
          onChange={(event) =>
            writeSemantic(props.editor, props.element.id, {
              ...semantic(),
              showTitle: event.currentTarget.checked,
            })
          }
        />
        Show artboard title
      </label>
      <details>
        <summary>Device safe area</summary>
        <label>
          <Switch
            checked={semantic().safeArea !== undefined}
            onChange={(event) => {
              if (event.currentTarget.checked) {
                writeSemantic(props.editor, props.element.id, {
                  ...semantic(),
                  safeArea: { top: 0, right: 0, bottom: 0, left: 0 },
                });
              } else {
                const { safeArea: _old, ...rest } = semantic();
                writeSemantic(props.editor, props.element.id, rest);
              }
            }}
          />
          Enable safe area
        </label>
        <Show when={semantic().safeArea}>
          <div class="nodetto-inspector-grid-2">
            <Field label="Top">
              <NumberInput
                label="Safe area top inset"
                min={0}
                value={semantic().safeArea?.top ?? 0}
                onCommit={(value) => updateSafeArea("top", value)}
              />
            </Field>
            <Field label="Right">
              <NumberInput
                label="Safe area right inset"
                min={0}
                value={semantic().safeArea?.right ?? 0}
                onCommit={(value) => updateSafeArea("right", value)}
              />
            </Field>
            <Field label="Bottom">
              <NumberInput
                label="Safe area bottom inset"
                min={0}
                value={semantic().safeArea?.bottom ?? 0}
                onCommit={(value) => updateSafeArea("bottom", value)}
              />
            </Field>
            <Field label="Left">
              <NumberInput
                label="Safe area left inset"
                min={0}
                value={semantic().safeArea?.left ?? 0}
                onCommit={(value) => updateSafeArea("left", value)}
              />
            </Field>
          </div>
        </Show>
      </details>
      <Show when={!semantic().component && !semantic().instanceOf}>
        <details>
          <summary>Responsive variants</summary>
          <Field label="Target size">
            <SelectInput
              label="Responsive variant target"
              value={responsivePreset()}
              options={RESPONSIVE_PRESET_OPTIONS}
              onCommit={(value) => setResponsivePreset(value as FramePresetKey)}
            />
          </Field>
          <button
            type="button"
            class="nodetto-inspector-button"
            onClick={() =>
              props.editor.createResponsiveVariant(
                props.element.id,
                responsivePreset(),
              )
            }
          >
            Create responsive copy
          </button>
        </details>
      </Show>
      <Show when={semantic().responsiveSource} keyed>
        {(sourceId) => (
          <details open>
            <summary>Responsive source</summary>
            <span>
              {responsiveSourceName(sourceId)}
              <HelpHint text="Refresh updates inherited content while preserving local overrides. Update structure adds and removes source layers while preserving surviving IDs, local geometry, and local layers. Detach makes this artboard independent." />
            </span>
            <div class="nodetto-inspector-actions">
              <button
                type="button"
                class="nodetto-inspector-button"
                onClick={() =>
                  setRefreshStatus(
                    props.editor.refreshResponsiveVariant(props.element.id)
                      ? "Inherited responsive content refreshed."
                      : "Refresh unavailable: check source, bindings or locks.",
                  )
                }
              >
                Refresh inherited content
              </button>
              <button
                type="button"
                class="nodetto-inspector-button"
                onClick={() =>
                  setRefreshStatus(
                    props.editor.updateResponsiveStructure(props.element.id)
                      ? "Responsive structure updated; breakpoint layout and overrides preserved."
                      : "Update unavailable: check source, bindings, duplicate keys or locks.",
                  )
                }
              >
                Update responsive structure
              </button>
              <button
                type="button"
                class="nodetto-inspector-button"
                onClick={() =>
                  props.editor.detachResponsiveVariant(props.element.id)
                }
              >
                Detach responsive source
              </button>
            </div>
            <p role="status">{refreshStatus()}</p>
          </details>
        )}
      </Show>
      <label>
        <Switch
          checked={semantic().clipContent === true}
          onChange={(event) => {
            const parents = frameParents(
              props.editor.store,
              props.element.page,
              props.editor.createShapeContext(),
            );
            writeSemantic(props.editor, props.element.id, {
              ...semantic(),
              clipContent: event.currentTarget.checked,
              memberIds:
                semantic().memberIds ??
                [...parents]
                  .filter(([, parent]) => parent === props.element.id)
                  .map(([child]) => child),
            });
          }}
        />
        Clip contents (rectangular)
      </label>
      <details>
        <summary>Layout grids ({semantic().layoutGrids?.length ?? 0})</summary>
        <For each={semantic().layoutGrids ?? []}>
          {(grid, index) => (
            <details>
              <summary>
                {grid.kind === "grid"
                  ? "Square grid"
                  : grid.kind === "columns"
                    ? "Columns"
                    : "Rows"}
              </summary>
              <label>
                <Switch
                  checked={grid.visible !== false}
                  onChange={(event) =>
                    updateGrid(index(), {
                      visible: event.currentTarget.checked,
                    })
                  }
                />
                Visible on canvas
              </label>
              <Field label="Color">
                <input
                  type="color"
                  aria-label={`${grid.kind} layout grid color`}
                  value={grid.color}
                  onChange={(event) =>
                    updateGrid(index(), { color: event.currentTarget.value })
                  }
                />
              </Field>
              <Field label="Opacity">
                <NumberInput
                  label={`${grid.kind} layout grid opacity`}
                  min={0}
                  max={1}
                  step={0.05}
                  value={grid.opacity}
                  onCommit={(opacity) => updateGrid(index(), { opacity })}
                />
              </Field>
              <Show
                when={grid.kind === "grid" ? grid : undefined}
                fallback={
                  <>
                    <Field label="Count">
                      <NumberInput
                        label={`${grid.kind} layout grid count`}
                        min={1}
                        max={24}
                        value={"count" in grid ? grid.count : 1}
                        onCommit={(count) => updateGrid(index(), { count })}
                      />
                    </Field>
                    <Field label="Gutter">
                      <NumberInput
                        label={`${grid.kind} layout grid gutter`}
                        min={0}
                        value={"gutter" in grid ? grid.gutter : 0}
                        onCommit={(gutter) => updateGrid(index(), { gutter })}
                      />
                    </Field>
                    <Field label="Margin">
                      <NumberInput
                        label={`${grid.kind} layout grid margin`}
                        min={0}
                        value={"margin" in grid ? grid.margin : 0}
                        onCommit={(margin) => updateGrid(index(), { margin })}
                      />
                    </Field>
                  </>
                }
              >
                {(square) => (
                  <Field label="Size">
                    <NumberInput
                      label="Square layout grid size"
                      min={1}
                      value={square().size}
                      onCommit={(size) => updateGrid(index(), { size })}
                    />
                  </Field>
                )}
              </Show>
              <button
                type="button"
                class="nodetto-inspector-button"
                onClick={() =>
                  removeLayoutGrid(props.editor, props.element.id, index())
                }
              >
                Remove grid
              </button>
            </details>
          )}
        </For>
        <div class="nodetto-inspector-actions">
          <For each={["grid", "columns", "rows"] as const}>
            {(kind) => (
              <button
                type="button"
                disabled={
                  (semantic().layoutGrids?.length ?? 0) >= MAX_LAYOUT_GRIDS
                }
                onClick={() =>
                  addLayoutGrid(props.editor, props.element.id, kind)
                }
              >
                Add {kind}
              </button>
            )}
          </For>
        </div>
      </details>
      <label>
        <Switch
          checked={semantic().prototypeStart === true}
          onChange={(event) => {
            const enabled = event.currentTarget.checked;
            const frames = props.editor
              .getSnapshot()
              .elements.filter(
                (item) =>
                  item.type === "frame" &&
                  (item.id === props.element.id ||
                    (enabled &&
                      (item.semantic as FrameSemantic).prototypeStart)),
              );
            props.editor.apply(
              frames.map((item) => ({
                type: "updateSemantic",
                id: item.id,
                semantic: {
                  ...(item.semantic as FrameSemantic),
                  prototypeStart: item.id === props.element.id && enabled,
                },
              })),
            );
          }}
        />
        Prototype starting screen
      </label>
      <Field label="Preview overflow">
        <SelectInput
          label="Prototype preview overflow"
          value={semantic().prototypeOverflow ?? "none"}
          options={[
            { value: "none", label: "No scrolling" },
            { value: "vertical", label: "Vertical" },
            { value: "horizontal", label: "Horizontal" },
            { value: "both", label: "Both axes" },
          ]}
          onCommit={(value) => {
            const { prototypeOverflow: _old, ...rest } = semantic();
            writeSemantic(props.editor, props.element.id, {
              ...rest,
              ...(value !== "none" ? { prototypeOverflow: value } : {}),
            });
          }}
        />
      </Field>
      <FrameComponentFields
        editor={props.editor}
        element={props.element}
        refreshStatus={refreshStatus()}
        setRefreshStatus={setRefreshStatus}
      />
      <Field label="Name">
        <TextInput
          label="Artboard name"
          value={stringOf(props.element.semantic, "name")}
          onCommit={(name) =>
            writeSemantic(props.editor, props.element.id, {
              ...record(props.element.semantic),
              name,
            })
          }
        />
      </Field>
      <FrameAutoLayoutFields editor={props.editor} element={props.element} />
    </Section>
  );
}
