import type {
  Element,
  PcbBoardSemantic,
  PcbGraphicSemantic,
  PcbShape,
} from "@nodetto/ir";
import { element } from "../../test-helpers.ts";
import { cadElement } from "./documents.ts";

export const PCB_TEST_PAGE = {
  id: "pcb",
  kind: "pcb",
  name: "Circuit",
} as const;

export function testBoard(thickness?: number): Element<PcbBoardSemantic> {
  const semantic: PcbBoardSemantic = {
    format: "kicad_pcb",
    source: "controller.kicad_pcb",
    version: 1,
    generator: "fixture",
    maskExpansion: 0,
    layers: [],
    nets: [],
    ...(thickness === undefined ? {} : { thickness }),
  };
  return {
    ...element({
      id: "board",
      type: "pcb.board",
      page: PCB_TEST_PAGE.id,
      semantic,
    }),
    semantic,
  };
}

export function edge(
  id: string,
  shape: PcbShape,
  layer = "Edge.Cuts",
): Element<PcbGraphicSemantic> {
  const semantic = { layer, shape, width: 0.05, fill: false };
  return {
    ...element({ id, type: "pcb.graphic", page: PCB_TEST_PAGE.id, semantic }),
    semantic,
  };
}

export function boardReference(thickness?: number) {
  return cadElement("board-reference", "cad.pcb", "a0", {
    name: "Controller board",
    board: "board",
    ...(thickness === undefined ? {} : { thickness }),
  });
}
