// Stroke font for PCB silkscreen text.
//
// Gerber has no text primitive, so legend text is drawn as strokes. Each glyph
// is a list of polylines on a 4 x 6 cell with y pointing up; the set covers
// what breadboard legends print: references, row and column labels, pinouts
// and polarity marks.

type Glyph = readonly (readonly (readonly [number, number])[])[];

const O: Glyph = [
  [
    [1, 0],
    [0, 1],
    [0, 5],
    [1, 6],
    [3, 6],
    [4, 5],
    [4, 1],
    [3, 0],
    [1, 0],
  ],
];
const P: Glyph = [
  [
    [0, 0],
    [0, 6],
    [3, 6],
    [4, 5],
    [4, 4],
    [3, 3],
    [0, 3],
  ],
];

const GLYPHS: Readonly<Record<string, Glyph>> = {
  " ": [],
  "+": [
    [
      [2, 1],
      [2, 5],
    ],
    [
      [0, 3],
      [4, 3],
    ],
  ],
  "-": [
    [
      [0, 3],
      [4, 3],
    ],
  ],
  "0": [
    ...O,
    [
      [0.5, 0.5],
      [3.5, 5.5],
    ],
  ],
  "1": [
    [
      [1, 5],
      [2, 6],
      [2, 0],
    ],
    [
      [1, 0],
      [3, 0],
    ],
  ],
  "2": [
    [
      [0, 5],
      [1, 6],
      [3, 6],
      [4, 5],
      [4, 4],
      [0, 0],
      [4, 0],
    ],
  ],
  "3": [
    [
      [0, 5],
      [1, 6],
      [3, 6],
      [4, 5],
      [4, 4],
      [3, 3],
      [1, 3],
    ],
    [
      [3, 3],
      [4, 2],
      [4, 1],
      [3, 0],
      [1, 0],
      [0, 1],
    ],
  ],
  "4": [
    [
      [3, 0],
      [3, 6],
      [0, 2],
      [4, 2],
    ],
  ],
  "5": [
    [
      [4, 6],
      [0, 6],
      [0, 3],
      [3, 3],
      [4, 2],
      [4, 1],
      [3, 0],
      [0, 0],
    ],
  ],
  "6": [
    [
      [4, 6],
      [1, 6],
      [0, 5],
      [0, 1],
      [1, 0],
      [3, 0],
      [4, 1],
      [4, 2],
      [3, 3],
      [0, 3],
    ],
  ],
  "7": [
    [
      [0, 6],
      [4, 6],
      [1, 0],
    ],
  ],
  "8": [
    [
      [1, 3],
      [0, 4],
      [0, 5],
      [1, 6],
      [3, 6],
      [4, 5],
      [4, 4],
      [3, 3],
      [1, 3],
      [0, 2],
      [0, 1],
      [1, 0],
      [3, 0],
      [4, 1],
      [4, 2],
      [3, 3],
    ],
  ],
  "9": [
    [
      [4, 3],
      [1, 3],
      [0, 4],
      [0, 5],
      [1, 6],
      [3, 6],
      [4, 5],
      [4, 1],
      [3, 0],
      [0, 0],
    ],
  ],
  A: [
    [
      [0, 0],
      [0, 4],
      [2, 6],
      [4, 4],
      [4, 0],
    ],
    [
      [0, 3],
      [4, 3],
    ],
  ],
  B: [
    [
      [0, 0],
      [0, 6],
      [3, 6],
      [4, 5],
      [4, 4],
      [3, 3],
      [0, 3],
    ],
    [
      [3, 3],
      [4, 2],
      [4, 1],
      [3, 0],
      [0, 0],
    ],
  ],
  C: [
    [
      [4, 5],
      [3, 6],
      [1, 6],
      [0, 5],
      [0, 1],
      [1, 0],
      [3, 0],
      [4, 1],
    ],
  ],
  D: [
    [
      [0, 0],
      [0, 6],
      [2, 6],
      [4, 4],
      [4, 2],
      [2, 0],
      [0, 0],
    ],
  ],
  E: [
    [
      [4, 6],
      [0, 6],
      [0, 0],
      [4, 0],
    ],
    [
      [0, 3],
      [3, 3],
    ],
  ],
  F: [
    [
      [4, 6],
      [0, 6],
      [0, 0],
    ],
    [
      [0, 3],
      [3, 3],
    ],
  ],
  G: [
    [
      [4, 5],
      [3, 6],
      [1, 6],
      [0, 5],
      [0, 1],
      [1, 0],
      [3, 0],
      [4, 1],
      [4, 3],
      [2, 3],
    ],
  ],
  H: [
    [
      [0, 0],
      [0, 6],
    ],
    [
      [4, 0],
      [4, 6],
    ],
    [
      [0, 3],
      [4, 3],
    ],
  ],
  I: [
    [
      [1, 6],
      [3, 6],
    ],
    [
      [2, 6],
      [2, 0],
    ],
    [
      [1, 0],
      [3, 0],
    ],
  ],
  J: [
    [
      [1, 6],
      [4, 6],
    ],
    [
      [3, 6],
      [3, 1],
      [2, 0],
      [1, 0],
      [0, 1],
    ],
  ],
  K: [
    [
      [0, 0],
      [0, 6],
    ],
    [
      [4, 6],
      [0, 2],
    ],
    [
      [1, 3],
      [4, 0],
    ],
  ],
  L: [
    [
      [0, 6],
      [0, 0],
      [4, 0],
    ],
  ],
  M: [
    [
      [0, 0],
      [0, 6],
      [2, 3],
      [4, 6],
      [4, 0],
    ],
  ],
  N: [
    [
      [0, 0],
      [0, 6],
      [4, 0],
      [4, 6],
    ],
  ],
  O,
  P,
  Q: [
    ...O,
    [
      [2, 2],
      [4, 0],
    ],
  ],
  R: [
    ...P,
    [
      [2, 3],
      [4, 0],
    ],
  ],
  S: [
    [
      [4, 5],
      [3, 6],
      [1, 6],
      [0, 5],
      [0, 4],
      [1, 3],
      [3, 3],
      [4, 2],
      [4, 1],
      [3, 0],
      [1, 0],
      [0, 1],
    ],
  ],
  T: [
    [
      [0, 6],
      [4, 6],
    ],
    [
      [2, 6],
      [2, 0],
    ],
  ],
  U: [
    [
      [0, 6],
      [0, 1],
      [1, 0],
      [3, 0],
      [4, 1],
      [4, 6],
    ],
  ],
  V: [
    [
      [0, 6],
      [2, 0],
      [4, 6],
    ],
  ],
  W: [
    [
      [0, 6],
      [1, 0],
      [2, 3],
      [3, 0],
      [4, 6],
    ],
  ],
  X: [
    [
      [0, 0],
      [4, 6],
    ],
    [
      [0, 6],
      [4, 0],
    ],
  ],
  Y: [
    [
      [0, 6],
      [2, 3],
      [4, 6],
    ],
    [
      [2, 3],
      [2, 0],
    ],
  ],
  Z: [
    [
      [0, 6],
      [4, 6],
      [0, 0],
      [4, 0],
    ],
  ],
};

const CELL_WIDTH = 4;
const CELL_HEIGHT = 6;
/** Advance per character, in cell units: the glyph plus a gap. */
const ADVANCE = CELL_WIDTH + 1.5;

export interface StrokePoint {
  readonly x: number;
  readonly y: number;
}

/** Characters the legend can draw; lower case is drawn as upper case. */
export function strokeFontSupports(character: string): boolean {
  return GLYPHS[character.toUpperCase()] !== undefined;
}

/** Width of `text` drawn `height` tall, in the same unit as `height`. */
export function strokeTextWidth(text: string, height: number): number {
  const count = [...text].length;
  if (count === 0) return 0;
  return ((count - 1) * ADVANCE + CELL_WIDTH) * (height / CELL_HEIGHT);
}

/**
 * Polylines for `text` drawn `height` tall and centred on (`x`, `y`), with y
 * pointing up. Characters the font does not cover are skipped.
 */
export function strokeText(
  text: string,
  x: number,
  y: number,
  height: number,
): readonly (readonly StrokePoint[])[] {
  const scale = height / CELL_HEIGHT;
  const left = x - strokeTextWidth(text, height) / 2;
  const bottom = y - height / 2;
  const strokes: StrokePoint[][] = [];
  [...text].forEach((character, index) => {
    const glyph = GLYPHS[character.toUpperCase()];
    if (!glyph) return;
    const originX = left + index * ADVANCE * scale;
    for (const line of glyph)
      strokes.push(
        line.map(([gx, gy]) => ({
          x: originX + gx * scale,
          y: bottom + gy * scale,
        })),
      );
  });
  return strokes;
}
