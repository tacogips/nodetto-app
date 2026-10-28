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
import { pcbLayerColor } from "./shapes/pcb-view.ts";
import "./PcbLayersPanel.css";

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
    <label class="nodetto-pcb-tool-option">
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
    >
      <details>
        <summary>Layers</summary>
        <div class="nodetto-pcb-layers-section">
          <For each={model().layers}>
            {(layer) => (
              <label class="nodetto-pcb-layer">
                <input
                  type="checkbox"
                  checked={!model().hidden.has(layer)}
                  onChange={(event) =>
                    setPcbLayerHidden(
                      pageId(),
                      layer,
                      !event.currentTarget.checked,
                    )
                  }
                />
                <span
                  class="nodetto-pcb-layer-swatch"
                  style={{ background: pcbLayerColor(layer) }}
                />
                {layer}
              </label>
            )}
          </For>
        </div>
      </details>
      <details>
        <summary>Tool options</summary>
        <div class="nodetto-pcb-layers-section">
          <label class="nodetto-pcb-tool-option">
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
          <label class="nodetto-pcb-tool-option">
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
              viaDiameter > options().viaDrill &&
              setPcbToolOptions({ viaDiameter })
            );
          })}
          {numberInput("Via drill", options().viaDrill, (viaDrill) => {
            return (
              viaDrill < options().viaDiameter &&
              setPcbToolOptions({ viaDrill })
            );
          })}
        </div>
      </details>
    </aside>
  );
}
