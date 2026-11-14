import type {
  Document,
  PcbBoardSemantic,
  PcbFootprintSemantic,
  PcbGraphicSemantic,
  PcbTrackSemantic,
  PcbViaSemantic,
  PcbZoneSemantic,
} from "@nodetto/ir";
import { pcbDocumentFromPlan } from "./page.ts";

export interface PcbDocumentSpec {
  readonly board?: Partial<PcbBoardSemantic>;
  readonly footprints?: readonly PcbFootprintSemantic[];
  readonly tracks?: readonly PcbTrackSemantic[];
  readonly vias?: readonly PcbViaSemantic[];
  readonly zones?: readonly PcbZoneSemantic[];
  readonly graphics?: readonly PcbGraphicSemantic[];
}

export function buildPcbDocument(spec: PcbDocumentSpec = {}): Document {
  const items = [
    ...(spec.footprints ?? []).flatMap((footprint) =>
      footprint.pads.map((pad) => pad.net),
    ),
    ...(spec.tracks ?? []).map((track) => track.net),
    ...(spec.vias ?? []).map((via) => via.net),
    ...(spec.zones ?? []).map((zone) => zone.net),
  ];
  const board: PcbBoardSemantic = {
    format: "kicad_pcb",
    source: "test.kicad_pcb",
    version: 20240108,
    generator: "nodetto-test",
    maskExpansion: 0,
    layers: [
      { id: 0, name: "F.Cu", type: "signal" },
      { id: 31, name: "B.Cu", type: "signal" },
      { id: 36, name: "F.SilkS", type: "user" },
      { id: 37, name: "B.SilkS", type: "user" },
      { id: 38, name: "F.Mask", type: "user" },
      { id: 39, name: "B.Mask", type: "user" },
      { id: 44, name: "Edge.Cuts", type: "user" },
    ],
    nets: [...new Set(items.filter((net) => net !== ""))],
    ...spec.board,
  };
  return pcbDocumentFromPlan(
    {
      title: "PCB test",
      board,
      graphics: spec.graphics ?? [],
      zones: spec.zones ?? [],
      tracks: spec.tracks ?? [],
      vias: spec.vias ?? [],
      footprints: spec.footprints ?? [],
    },
    { pageName: "PCB", title: "PCB test", documentId: "pcb-test-document" },
  );
}
