import { pageCopperLayers, pcbNetNames } from "@nodetto/core";
import type { Editor } from "@nodetto/core";
import type { PcbBoardSemantic } from "@nodetto/ir";
import { createMemo, For } from "solid-js";
import type { Accessor, JSX } from "solid-js";
import {
  pcbHiddenLayers,
  pcbPageLayers,
  pcbToolOptions,
  setPcbLayerHidden,
  setPcbToolOptions,
} from "./pcb-state.ts";

export function PcbLayersPanel(props: {
  readonly editor: Editor;
  readonly revision: Accessor<number>;
}): JSX.Element {
  const pageId = () => props.editor.currentPageId;
  const model = createMemo(() => {
    props.revision();
    const elements = props.editor.store.getPageElements(pageId());
    const boardElement = elements.find(
      (element) => element.type === "pcb.board",
    );
    const board = boardElement?.semantic as PcbBoardSemantic | undefined;
    const hidden = pcbHiddenLayers(pageId());
    return {
      elements,
      board,
      hidden,
      layers: pcbPageLayers(board, elements),
      copper: pageCopperLayers(board),
      nets: pcbNetNames(props.editor.getSnapshot(), pageId()),
    };
  });
  const options = () => {
    props.revision();
    return pcbToolOptions();
  };
  const numberInput = (
    label: string,
    value: number,
    update: (value: number) => boolean,
  ): JSX.Element => (
    <label
      style={{
        display: "grid",
        "grid-template-columns": "1fr 5rem",
        gap: "0.4rem",
      }}
    >
      {label}
      <input
        aria-label={label}
        type="number"
        min="0.000001"
        step="any"
        value={value}
        onInput={(event) => {
          const next = Number(event.currentTarget.value);
          if (!Number.isFinite(next) || next <= 0 || !update(next))
            event.currentTarget.value = String(value);
        }}
      />
    </label>
  );
  return (
    <aside
      class="nodetto-pcb-layers-panel"
      aria-label="PCB layers and tool options"
      style={{
        position: "absolute",
        right: "12px",
        top: "12px",
        "z-index": 20,
        padding: "10px",
        background: "#20242b",
        color: "white",
        "font-size": "12px",
        "max-height": "80%",
        overflow: "auto",
        "min-width": "190px",
      }}
    >
      <h3>Layers</h3>
      <For each={model().layers}>
        {(layer) => (
          <label
            style={{ display: "flex", gap: "0.5rem", "align-items": "center" }}
          >
            <input
              type="checkbox"
              checked={!model().hidden.has(layer)}
              onChange={(event) =>
                setPcbLayerHidden(pageId(), layer, !event.currentTarget.checked)
              }
            />
            {layer}
          </label>
        )}
      </For>
      <h3>Tool options</h3>
      <label
        style={{
          display: "grid",
          "grid-template-columns": "1fr 7rem",
          gap: "0.4rem",
        }}
      >
        Copper layer
        <select
          aria-label="Copper layer"
          value={options().layer}
          onChange={(event) =>
            setPcbToolOptions({ layer: event.currentTarget.value })
          }
        >
          <For each={model().copper}>
            {(layer) => <option value={layer}>{layer}</option>}
          </For>
        </select>
      </label>
      <label
        style={{
          display: "grid",
          "grid-template-columns": "1fr 7rem",
          gap: "0.4rem",
        }}
      >
        Net
        <select
          aria-label="Net"
          value={options().net}
          onChange={(event) =>
            setPcbToolOptions({ net: event.currentTarget.value })
          }
        >
          <option value="">No net</option>
          <For each={model().nets}>
            {(net) => <option value={net}>{net}</option>}
          </For>
        </select>
      </label>
      {numberInput("Track width", options().width, (width) =>
        setPcbToolOptions({ width }),
      )}
      {numberInput("Via diameter", options().viaDiameter, (viaDiameter) => {
        return (
          viaDiameter > options().viaDrill && setPcbToolOptions({ viaDiameter })
        );
      })}
      {numberInput("Via drill", options().viaDrill, (viaDrill) => {
        return (
          viaDrill < options().viaDiameter && setPcbToolOptions({ viaDrill })
        );
      })}
    </aside>
  );
}
