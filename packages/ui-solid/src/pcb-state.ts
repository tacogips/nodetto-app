import { PCB_TRACK_DEFAULT_WIDTH, PCB_VIA_DEFAULT } from "@nodetto/core";
import type { Element, PageId, PcbBoardSemantic } from "@nodetto/ir";
import { createSignal } from "solid-js";

export interface PcbToolOptions {
  readonly layer: string;
  readonly net: string;
  readonly width: number;
  readonly viaDiameter: number;
  readonly viaDrill: number;
}

const defaultOptions: PcbToolOptions = {
  layer: "F.Cu",
  net: "",
  width: PCB_TRACK_DEFAULT_WIDTH,
  viaDiameter: PCB_VIA_DEFAULT.diameter,
  viaDrill: PCB_VIA_DEFAULT.drill,
};
let options = defaultOptions;
const pageLayers = new Map<
  PageId,
  {
    read: () => ReadonlySet<string>;
    write: (next: ReadonlySet<string>) => void;
  }
>();
const [toolOptions, setToolOptions] =
  createSignal<PcbToolOptions>(defaultOptions);

function layerState(pageId: PageId) {
  let entry = pageLayers.get(pageId);
  if (!entry) {
    const [read, write] = createSignal<ReadonlySet<string>>(new Set(), {
      equals: false,
    });
    entry = { read, write };
    pageLayers.set(pageId, entry);
  }
  return entry;
}

export function pcbHiddenLayers(pageId: PageId): ReadonlySet<string> {
  return layerState(pageId).read();
}

export function setPcbLayerHidden(
  pageId: PageId,
  layer: string,
  hidden: boolean,
): void {
  const state = layerState(pageId);
  const next = new Set(state.read());
  if (hidden) next.add(layer);
  else next.delete(layer);
  state.write(next);
}

export function pcbToolOptions(): PcbToolOptions {
  return toolOptions();
}

export function setPcbToolOptions(patch: Partial<PcbToolOptions>): boolean {
  const next = { ...options, ...patch };
  if (!Number.isFinite(next.width) || next.width <= 0) return false;
  if (
    !Number.isFinite(next.viaDrill) ||
    !Number.isFinite(next.viaDiameter) ||
    next.viaDrill <= 0 ||
    next.viaDiameter <= next.viaDrill
  )
    return false;
  options = next;
  setToolOptions(next);
  return true;
}

/**
 * Whether `layer` is hidden. A KiCad wildcard such as `*.Cu` is hidden once
 * both of its outer layers are.
 */
export function isPcbLayerHidden(
  hidden: ReadonlySet<string>,
  layer: string,
): boolean {
  if (hidden.has(layer)) return true;
  if (!layer.startsWith("*.")) return false;
  const suffix = layer.slice(1);
  return hidden.has(`F${suffix}`) && hidden.has(`B${suffix}`);
}

export function isPcbElementShown(
  element: Element,
  hidden: ReadonlySet<string>,
): boolean {
  if (element.visual.hidden === true) return false;
  if (element.type === "pcb.board") return true;
  const semantic = element.semantic as {
    layer?: string;
    layers?: readonly string[];
    pads?: readonly { layers: readonly string[] }[];
    graphics?: readonly { layer: string }[];
  };
  let layers: readonly string[] = [];
  if (element.type === "pcb.footprint") {
    layers = [
      ...(semantic.graphics ?? []).map((item) => item.layer),
      ...(semantic.pads ?? []).flatMap((pad) => pad.layers),
    ];
  } else if (element.type === "pcb.via") {
    layers = semantic.layers ?? [];
  } else if (element.type === "pcb.zone") {
    layers = semantic.layers ?? [];
  } else if (semantic.layer) {
    layers = [semantic.layer];
  }
  return (
    layers.length === 0 ||
    layers.some((layer) => !isPcbLayerHidden(hidden, layer))
  );
}

export function pcbPageLayers(
  board: PcbBoardSemantic | undefined,
  elements: readonly Element[],
): readonly string[] {
  const declared = board?.layers.map((layer) => layer.name) ?? [];
  const used = new Set<string>(declared);
  for (const element of elements) {
    // The board's own `layers` are the declared layer records read above.
    if (!element.type.startsWith("pcb.") || element.type === "pcb.board")
      continue;
    const semantic = element.semantic as {
      layer?: string;
      layers?: readonly string[];
      pads?: readonly { layers: readonly string[] }[];
      graphics?: readonly { layer: string }[];
    };
    if (semantic.layer) used.add(semantic.layer);
    for (const layer of semantic.layers ?? []) used.add(layer);
    for (const graphic of semantic.graphics ?? []) used.add(graphic.layer);
    for (const pad of semantic.pads ?? [])
      for (const layer of pad.layers) used.add(layer);
  }
  // Wildcards such as `*.Cu` follow their concrete layers.
  return [...used].filter((layer) => !layer.startsWith("*."));
}
