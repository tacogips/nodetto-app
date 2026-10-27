import { expect, test } from "bun:test";
import { identifyLayer, layerName } from "./layers.ts";

test("the X2 file function wins over the file name", () => {
  expect(identifyLayer("board.gtl", ["Soldermask", "Bot"])).toEqual({
    kind: "soldermask",
    side: "bottom",
  });
  expect(identifyLayer("x.gbr", ["Copper", "L3", "Inr"])).toEqual({
    kind: "copper",
    side: "inner",
    inner: 2,
  });
  expect(identifyLayer("x.gbr", ["Profile", "NP"])).toEqual({
    kind: "outline",
    side: "board",
  });
});

test("Protel, KiCad and Eagle names", () => {
  const name = (file: string) => layerName(identifyLayer(file));
  expect(
    [
      "a.GTL",
      "a.gbl",
      "a.gts",
      "a.GBS",
      "a.gto",
      "a.gbo",
      "a.gtp",
      "a.gm1",
      "a.gko",
      "a.drl",
      "a.g2",
    ].map(name),
  ).toEqual([
    "Top copper",
    "Bottom copper",
    "Top solder mask",
    "Bottom solder mask",
    "Top silkscreen",
    "Bottom silkscreen",
    "Top solder paste",
    "Board outline",
    "Board outline",
    "Drill",
    "Inner copper 2",
  ]);
  expect(
    [
      "kb-F_Cu.gbr",
      "kb-B_Mask.gbr",
      "kb-F_Silkscreen.gbr",
      "kb-Edge_Cuts.gbr",
      "kb-In1_Cu.gbr",
    ].map(name),
  ).toEqual([
    "Top copper",
    "Bottom solder mask",
    "Top silkscreen",
    "Board outline",
    "Inner copper 1",
  ]);
  expect(["b.cmp", "b.sol", "b.plc"].map(name)).toEqual([
    "Top copper",
    "Bottom copper",
    "Top silkscreen",
  ]);
  expect(name("notes.txt")).toBe("Layer");
});
