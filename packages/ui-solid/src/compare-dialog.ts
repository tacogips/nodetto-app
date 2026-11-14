import {
  type ComparisonBand,
  composeComparisonSvg,
  type Editor,
  orderedTopLevelFrames,
  pairByLeadingNumber,
  pngInfo,
  rasterDimensions,
} from "@nodetto/core";
import type { ElementId } from "@nodetto/ir";

export async function buildComparisons(input: {
  readonly editor: Editor;
  readonly artboardIds: readonly ElementId[];
  readonly references: readonly { name: string; bytes: Uint8Array }[];
  readonly scale: number;
  readonly bands: readonly ComparisonBand[];
  readonly grid?: number;
  readonly rasterize: (svg: string, scale: number) => Promise<Uint8Array>;
}): Promise<{
  readonly items: readonly {
    number: number;
    artboardId: ElementId;
    svg: string;
    warnings: readonly string[];
  }[];
}> {
  const ordered = orderedTopLevelFrames(
    input.editor.store,
    input.editor.currentPageId,
    input.editor.createShapeContext(),
  );
  const selected = new Set(input.artboardIds);
  const frames = ordered.flatMap((id, index) =>
    selected.has(id) ? [{ id, number: index + 1 }] : [],
  );
  if (!frames.length || frames.length !== selected.size)
    throw new Error("No artboard available for comparison.");
  for (const reference of input.references) {
    if (reference.bytes.length > 16 * 1024 * 1024)
      throw new Error(`${reference.name}: PNG is too large (maximum 16 MiB).`);
    const size = pngInfo(reference.bytes);
    rasterDimensions(size.width, size.height, 1);
  }
  type PairValue = {
    frame?: (typeof frames)[number];
    reference?: (typeof input.references)[number];
  };
  const pairs =
    frames.length === 1 && input.references.length === 1
      ? [
          {
            number: frames[0].number,
            actual: { frame: frames[0] },
            reference: { reference: input.references[0] },
          },
        ]
      : pairByLeadingNumber<PairValue>(
          frames.map((frame) => ({
            name: String(frame.number),
            value: { frame },
          })),
          input.references.map((reference) => ({
            name: reference.name,
            value: { reference },
          })),
        );
  const items = [];
  for (const pair of pairs) {
    const frame = pair.actual.frame;
    const reference = pair.reference.reference;
    if (!frame || !reference)
      throw new Error("Unmatched artboard or reference.");
    const svg = input.editor.exportArtboardSvg(frame.id);
    if (!svg) throw new Error(`No artboard available: ${frame.id}`);
    const actual = await input.rasterize(svg, input.scale);
    const comparison = composeComparisonSvg({
      reference: reference.bytes,
      actual,
      scale: input.scale,
      bands: input.bands,
      grid: input.grid,
    });
    items.push({ number: pair.number, artboardId: frame.id, ...comparison });
  }
  return { items };
}
