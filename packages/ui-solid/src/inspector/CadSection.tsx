import {
  type Command,
  layerName,
  renameLayer,
  sketchParentOf,
} from "@nodetto/core";
import { CAD_OPERATIONS, isPlainObject } from "@nodetto/ir";
import {
  createMemo,
  createSignal,
  For,
  type JSX,
  Match,
  Show,
  Switch,
} from "solid-js";
import { createEditorSignals } from "../adapter.ts";
import {
  earlierExtrudeBodies,
  orderExtrudeTargets,
  selectTargets,
} from "../cad/extrude-targets.ts";
import { pcbBoardChoices, pcbBoardOptions } from "../cad/pcb-insert.ts";
import { cadInspectionFor, formatCadLength } from "../cad/inspection.ts";
import { useCadStatus } from "../cad/status-store.ts";
import {
  setCadBoard,
  setCadFlag,
  setCadNumber,
  setCadOperation,
  setCadPoint,
  setCadSketchBase,
} from "./cad-edits.ts";
import {
  Checkbox,
  Field,
  Section,
  SelectInput,
  TextInput,
} from "./controls.tsx";
import type { ElementSectionProps } from "./SimpleSections.tsx";

const OPERATIONS = [
  { value: CAD_OPERATIONS[0], label: "New body" },
  { value: CAD_OPERATIONS[1], label: "Add" },
  { value: CAD_OPERATIONS[2], label: "Cut" },
  { value: CAD_OPERATIONS[3], label: "Intersect" },
];

export function CadSection(props: ElementSectionProps): JSX.Element {
  const signals = createEditorSignals(props.editor);
  const statusFor = useCadStatus(props.editor);
  const current = () => {
    signals.scene.record(props.element.id);
    return props.editor.store.get(props.element.id) ?? props.element;
  };
  const semantic = () => {
    const value = current().semantic;
    return isPlainObject(value) ? value : {};
  };
  const type = () => current().type;
  const inspection = cadInspectionFor(props.editor);
  const body = () => {
    const details = inspection.details();
    return details?.elementId === current().id ? details : undefined;
  };
  const sketchParentName = () => {
    const id = sketchParentOf(current());
    const sketch = id && props.editor.store.get(id);
    return sketch ? layerName(sketch) : undefined;
  };
  const bodyName = (id: string) => {
    const element = props.editor.store.get(id);
    if (!element) return "";
    signals.scene.record(element.id);
    return layerName(element);
  };
  const selectionName = () => {
    const hit = body();
    if (hit?.face)
      return `Face · ${layerName(current())} → ${bodyName(hit.bodyId)}`;
    if (hit)
      return `${hit.reference ? "Reference body" : "Body"} · ${layerName(current())}`;
    const sketch = sketchParentName();
    switch (type()) {
      case "cad.circle":
      case "cad.arc":
      case "cad.line": {
        const entity = type().slice(4);
        return `Sketch ${entity}${sketch ? ` · ${sketch}` : ""}`;
      }
      case "cad.sketch":
        return "Sketch";
      default:
        return "Feature";
    }
  };
  const sketchRadius = createMemo(() => {
    if (type() !== "cad.sketch") return undefined;
    signals.rev();
    let min = Number.POSITIVE_INFINITY;
    let max = Number.NEGATIVE_INFINITY;
    for (const element of props.editor.store.getPageElements(current().page)) {
      if (
        element.type !== "cad.circle" ||
        sketchParentOf(element) !== current().id
      )
        continue;
      const radius = isPlainObject(element.semantic) && element.semantic.r;
      if (typeof radius !== "number" || !Number.isFinite(radius)) continue;
      min = Math.min(min, radius);
      max = Math.max(max, radius);
    }
    if (!Number.isFinite(min)) return undefined;
    return min === max
      ? formatCadLength(min)
      : `${formatCadLength(min)}–${formatCadLength(max)}`;
  });
  const readOnly = () => signals.readOnly() || current().visual.locked === true;
  const [validation, setValidation] = createSignal("");
  const edit = (change: Command | { error: string }): void => {
    if (readOnly() || !props.editor.store.has(props.element.id)) return;
    if ("error" in change) {
      setValidation(change.error === "unchanged" ? "" : change.error);
      return;
    }
    setValidation("");
    props.editor.apply([change]);
  };
  const name = () => {
    const value = semantic().name;
    return typeof value === "string" ? value : undefined;
  };
  const offset = () => {
    const plane = semantic().plane;
    return isPlainObject(plane) && typeof plane.base === "string"
      ? (plane.offset ?? 0)
      : undefined;
  };
  const operation = () => {
    const value = semantic().op;
    return typeof value === "string" ? value : "";
  };
  const selection = createMemo(() => selectTargets(semantic().bodies));
  const targets = () => selection().ids;
  const earlierBodies = createMemo(() => {
    if (type() !== "cad.extrude" || operation() === "new") return [];
    signals.rev();
    const element = current();
    return earlierExtrudeBodies(
      props.editor.store.getPageElements(element.page),
      element,
    );
  });
  const listedIds = createMemo(() => earlierBodies().map((body) => body.id));
  const orderedTargets = createMemo(() => {
    if (type() !== "cad.extrude" || operation() === "new") return targets();
    return orderExtrudeTargets(listedIds(), targets());
  });
  const status = () => statusFor(current().id);
  const board = () => {
    const id = semantic().board;
    return typeof id === "string" ? id : "";
  };
  const boardOptions = createMemo(() => {
    if (type() !== "cad.pcb") return [];
    signals.rev();
    return pcbBoardOptions(pcbBoardChoices(props.editor.getSnapshot()));
  });
  const selectedBoard = () =>
    boardOptions().some(({ value }) => value === board()) ? board() : "";

  const number = (
    label: string,
    read: () => unknown,
    update: (text: string) => Command | { error: string },
    placeholder?: string,
  ) => (
    <Field label={label}>
      <TextInput
        label={label}
        value={String(read() ?? "")}
        disabled={readOnly()}
        placeholder={placeholder}
        onCommit={(value) => edit(update(value))}
      />
    </Field>
  );
  const length = (label: string, field: string, placeholder?: string) =>
    number(
      label,
      field === "offset" ? offset : () => semantic()[field],
      (value) => setCadNumber(current(), field, value),
      placeholder,
    );
  const point = (field: "a" | "b" | "m" | "c", label: string) => (
    <For each={[0, 1] as const}>
      {(axis) =>
        number(
          `${label} ${axis === 0 ? "X" : "Y"} (mm)`,
          () => {
            const value = semantic()[field];
            return Array.isArray(value) ? value[axis] : undefined;
          },
          (value) => setCadPoint(current(), field, axis, value),
        )
      }
    </For>
  );
  const flag = (
    field: "construction" | "symmetric" | "suppressed",
    label: string,
  ) => (
    <Checkbox
      label={label}
      checked={semantic()[field] === true}
      disabled={readOnly()}
      onCommit={(checked) => edit(setCadFlag(current(), field, checked))}
    />
  );

  return (
    <Section title="3D CAD">
      <Field label="Selection">
        <output aria-label="CAD selection">{selectionName()}</output>
      </Field>
      <Show when={body()}>
        {(selected) => (
          <>
            <Field label="Body size (X × Y × Z)">
              <output aria-label="CAD body size">
                {selected().size.map(formatCadLength).join(" × ")} mm
              </output>
            </Field>
            <Show when={selected().face}>
              <button
                type="button"
                onClick={() => {
                  const id = selected().bodyId;
                  inspection.setFace(undefined);
                  props.editor.selection.set([id]);
                }}
              >
                Select body
              </button>
            </Show>
          </>
        )}
      </Show>
      <Show when={name() !== undefined}>
        <Field label="Name">
          <TextInput
            label="CAD name"
            value={name() ?? ""}
            disabled={readOnly()}
            placeholder={layerName(current())}
            onCommit={(text) => {
              if (!readOnly()) renameLayer(props.editor, current().id, text);
            }}
          />
        </Field>
      </Show>
      <Switch>
        <Match when={type() === "cad.sketch"}>
          <Show when={sketchRadius()}>
            {(radius) => (
              <Field label="Circle radius (mm)">
                <output aria-label="Sketch circle radius">{radius()}</output>
              </Field>
            )}
          </Show>
          <Show when={offset() !== undefined}>
            <>
              <Field label="Base plane">
                <SelectInput
                  label="Base plane"
                  value={String((semantic().plane as { base: string }).base)}
                  options={[
                    { value: "xy", label: "XY" },
                    { value: "yz", label: "YZ" },
                    { value: "zx", label: "ZX" },
                  ]}
                  disabled={readOnly()}
                  onCommit={(value) => edit(setCadSketchBase(current(), value))}
                />
              </Field>
              {length("Plane offset (mm)", "offset")}
            </>
          </Show>
        </Match>
        <Match when={type() === "cad.extrude"}>
          {length("Distance (mm)", "distance")}
          <Field label="Operation">
            <SelectInput
              label="Operation"
              value={operation()}
              options={OPERATIONS}
              disabled={readOnly()}
              onCommit={(value) =>
                edit(setCadOperation(current(), value, orderedTargets()))
              }
            />
          </Field>
          <Show when={operation() !== "new"}>
            <div role="group" aria-label="Target bodies">
              <div>Target bodies</div>
              <For each={earlierBodies()} fallback={<p>No earlier bodies</p>}>
                {(body) => (
                  <span
                    onClick={(event) => {
                      if (operation() === "add" && selection().has(body.id))
                        event.preventDefault();
                    }}
                  >
                    <Checkbox
                      label={layerName(body)}
                      checked={selection().has(body.id)}
                      disabled={readOnly()}
                      onCommit={(checked) => {
                        if (operation() === "add" && !checked) return;
                        const next =
                          operation() === "add"
                            ? [body.id]
                            : checked
                              ? [...orderedTargets(), body.id]
                              : orderedTargets().filter((id) => id !== body.id);
                        edit(setCadOperation(current(), operation(), next));
                      }}
                    />
                  </span>
                )}
              </For>
            </div>
          </Show>
          {flag("symmetric", "Symmetric")}
          {flag("suppressed", "Suppressed")}
        </Match>
        <Match when={type() === "cad.line" || type() === "cad.arc"}>
          {point("a", "Start")}
          <Show when={type() === "cad.arc"}>{point("m", "Midpoint")}</Show>
          {point("b", "End")}
          {flag("construction", "Construction")}
        </Match>
        <Match when={type() === "cad.circle"}>
          {point("c", "Center")}
          {length("Radius (mm)", "r")}
          {flag("construction", "Construction")}
        </Match>
        <Match when={type() === "cad.pcb"}>
          <Field label="PCB board">
            <SelectInput
              label="PCB board"
              value={selectedBoard()}
              options={
                selectedBoard()
                  ? boardOptions()
                  : [
                      {
                        value: "",
                        label: board() ? "Board unavailable" : "Choose a board",
                      },
                      ...boardOptions(),
                    ]
              }
              disabled={readOnly() || boardOptions().length === 0}
              onCommit={(value) => {
                if (boardOptions().some((option) => option.value === value))
                  edit(setCadBoard(current(), value));
              }}
            />
          </Field>
          {length("Thickness (mm)", "thickness", "Use board thickness")}
          {flag("suppressed", "Suppressed")}
        </Match>
        <Match when={type() === "cad.mesh"}>
          {flag("suppressed", "Suppressed")}
        </Match>
      </Switch>
      <Show when={validation()}>
        <p class="nodetto-authoring-warnings" role="status">
          {validation()}
        </p>
      </Show>
      <Show when={status()}>
        {(message) => (
          <Field label="Status">
            <output aria-label="CAD status">
              {(() => {
                const value = message();
                if (value.ok) return "OK";
                return value.code === "cad.pcb.openOutline" && value.detail
                  ? `${value.code} (graphic ${value.detail})`
                  : value.code;
              })()}
            </output>
          </Field>
        )}
      </Show>
    </Section>
  );
}
