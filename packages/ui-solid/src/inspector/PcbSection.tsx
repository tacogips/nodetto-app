import { pageCopperLayers, pcbNetNames } from "@nodetto/core";
import type { PcbBoardSemantic } from "@nodetto/ir";
import { type JSX, Show } from "solid-js";
import { createEditorSignals } from "../adapter.ts";
import {
  Field,
  NumberInput,
  Section,
  SelectInput,
  TextInput,
} from "./controls.tsx";
import type { ElementSectionProps } from "./SimpleSections.tsx";
import { editPcbSemantic, pcbNetMemberIds } from "./pcb-edits.ts";

function record(value: unknown): Record<string, unknown> {
  return typeof value === "object" && value !== null
    ? (value as Record<string, unknown>)
    : {};
}
function str(value: unknown): string {
  return typeof value === "string" ? value : "";
}
function num(value: unknown): number | null {
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

function title(type: string): string {
  if (type === "pcb.footprint") return "Footprint";
  if (type === "pcb.track") return "Track";
  if (type === "pcb.via") return "Via";
  if (type === "pcb.zone") return "Zone";
  return "Graphic";
}

export function PcbSection(props: ElementSectionProps): JSX.Element {
  const signals = createEditorSignals(props.editor);
  const current = () =>
    props.editor.store.get(props.element.id) ?? props.element;
  const data = () => record(current().semantic);
  const pageId = () => current().page;
  const document = () => {
    signals.rev();
    return props.editor.store.getSnapshot();
  };
  const board = (): PcbBoardSemantic | undefined => {
    const element = document().elements.find(
      (item) => item.page === pageId() && item.type === "pcb.board",
    );
    return element ? (element.semantic as PcbBoardSemantic) : undefined;
  };
  const layers = () => pageCopperLayers(board());
  const nets = () => pcbNetNames(document(), pageId());
  const net = () => str(data().net);
  const edit = (
    field:
      | "reference"
      | "value"
      | "x"
      | "y"
      | "width"
      | "diameter"
      | "drill"
      | "layer"
      | "net",
    value: string | number,
  ) => editPcbSemantic(props.editor, current(), field, value);
  const text = (field: "reference" | "value", label: string) => (
    <Field label={label}>
      <TextInput
        label={label}
        value={str(data()[field])}
        onCommit={(value) => edit(field, value)}
      />
    </Field>
  );
  const numeric = (
    field: "x" | "y" | "width" | "diameter" | "drill",
    label: string,
    step: number,
    min?: number,
  ) => (
    <Field label={label}>
      <NumberInput
        label={label}
        value={
          field === "x" || field === "y"
            ? num((data().at as unknown[])?.[field === "x" ? 0 : 1])
            : num(data()[field])
        }
        min={min}
        step={step}
        onCommit={(value) => edit(field, value)}
      />
    </Field>
  );
  const select = (
    field: "layer" | "net",
    label: string,
    options: readonly string[],
  ) => (
    <Field label={label}>
      <SelectInput
        label={label}
        value={str(data()[field])}
        options={options.map((value) => ({ value, label: value || "No net" }))}
        onCommit={(value) => edit(field, value)}
      />
    </Field>
  );
  const selectNetMembers = () => {
    const ids = pcbNetMemberIds(document(), pageId(), net());
    if (ids.length) props.editor.selection.set(ids);
  };
  const zoneLayers = () =>
    Array.isArray(data().layers)
      ? (data().layers as unknown[])
          .filter((value): value is string => typeof value === "string")
          .join(", ")
      : "";
  const padCount = () => {
    const pads = data().pads;
    return Array.isArray(pads) ? pads.length : 0;
  };
  const fillCount = () =>
    Array.isArray(data().filled)
      ? (data().filled as { polygons?: unknown[] }[]).reduce(
          (sum, fill) => sum + (fill.polygons?.length ?? 0),
          0,
        )
      : 0;
  return (
    <Section title={title(current().type)}>
      <Show when={current().type === "pcb.footprint"}>
        {text("reference", "Reference")}
        {text("value", "Value")}
        {numeric("x", "X (mm)", 0.001)}
        {numeric("y", "Y (mm)", 0.001)}
        <Field label="Rotation">
          <NumberInput
            label="Rotation"
            value={num(data().rotation)}
            step={1}
            onCommit={(value) =>
              props.editor.rotatePcbFootprints(
                [current().id],
                value - (num(data().rotation) ?? 0),
              )
            }
          />
        </Field>
        <Field label="Side">
          <span>{str(data().side)}</span>
        </Field>
        <Field label="Pads">
          <span>{padCount()}</span>
        </Field>
      </Show>
      <Show when={current().type === "pcb.track"}>
        {select("layer", "Layer", layers())}
        {numeric("width", "Width (mm)", 0.001, Number.MIN_VALUE)}
        {select("net", "Net", ["", ...nets()])}
        <button type="button" onClick={selectNetMembers} disabled={!net()}>
          Select net
        </button>
      </Show>
      <Show when={current().type === "pcb.via"}>
        {numeric("diameter", "Diameter (mm)", 0.001, Number.MIN_VALUE)}
        {numeric("drill", "Drill (mm)", 0.001, Number.MIN_VALUE)}
        {select("net", "Net", ["", ...nets()])}
        <button type="button" onClick={selectNetMembers} disabled={!net()}>
          Select net
        </button>
      </Show>
      <Show when={current().type === "pcb.zone"}>
        <Field label="Layers">
          <span>{zoneLayers()}</span>
        </Field>
        <Field label="Net">
          <span>{net() || "No net"}</span>
        </Field>
        <Field label="Fills">
          <span>{fillCount()}</span>
        </Field>
        <button type="button" onClick={selectNetMembers} disabled={!net()}>
          Select net
        </button>
      </Show>
      <Show when={current().type === "pcb.graphic"}>
        <Field label="Layer">
          <span>{str(data().layer)}</span>
        </Field>
        <Field label="Width (mm)">
          <span>{String(data().width ?? "")}</span>
        </Field>
      </Show>
    </Section>
  );
}
