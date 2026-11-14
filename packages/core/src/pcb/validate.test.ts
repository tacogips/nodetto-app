import { expect, test } from "bun:test";
import {
  legendClearanceErrors,
  validateExcellon,
  validateGerber,
} from "./validate.ts";

const outline = { width: 10, height: 8 };
const gerber = (
  body = "D10*\nX1000000Y1000000D02*\nX2000000Y1000000D01*\nX3000000Y2000000D03*\n",
) =>
  `%TF.GenerationSoftware,Nodetto*%\n%TF.SameCoordinates,Original*%\n%TF.FileFunction,Copper,L1,Top*%\n%TF.FilePolarity,Positive*%\n%FSLAX46Y46*%\n%MOMM*%\n%LPD*%\nG01*\n%ADD10C,0.180000*%\n${body}M02*\n`;
const excellon = (body = "T1\nX1.000Y2.000\n") =>
  `M48\n; self-authored fixture\nFMAT,2\nMETRIC\nT1C1.000\n%\nG90\nG05\n${body}M30\n`;

function expectOne(errors: readonly string[], prefix: string): void {
  expect(errors).toHaveLength(1);
  const [first] = errors;
  expect(first).toBeDefined();
  expect(first ?? "").toStartWith(prefix);
}

test("accepts minimal Gerber and Excellon files", () => {
  expect(validateGerber(gerber(), outline)).toEqual([]);
  expect(validateExcellon(excellon(), outline)).toEqual([]);
});

test("rejects Gerber newline and data block defects with exact line reports", () => {
  expectOne(
    validateGerber(gerber().replaceAll("\n", "\r\n"), outline),
    "file: carriage return",
  );
  expectOne(
    validateGerber(gerber().slice(0, -1), outline),
    "file: final newline",
  );
  expectOne(
    validateGerber(gerber("").replace("G01*", "G01"), outline),
    "line 8: unsupported data block",
  );
  expectOne(
    validateGerber(gerber("").replace("G01*", "G01**"), outline),
    "line 8: unsupported data block",
  );
  expectOne(
    validateGerber(gerber().replace("M02*\n", "M02*\nG01*\n"), outline),
    "line 15: M02 must be the last non-empty line",
  );
});

test("rejects unsupported Gerber commands, format and units", () => {
  expectOne(
    validateGerber(
      gerber().replace("%FSLAX46Y46*%", "%FSLAX46Y46*%\n%FSLAX46Y46*"),
      outline,
    ),
    "line 6: malformed extended command",
  );
  expectOne(
    validateGerber(
      gerber().replace("%ADD10C,0.180000*%", "%AMX*%\n%ADD10C,0.180000*%"),
      outline,
    ),
    "line 9: unsupported extended command",
  );
  expectOne(
    validateGerber(
      gerber().replace("%FSLAX46Y46*%", "%FSLAX35Y35*%\n%FSLAX46Y46*%"),
      outline,
    ),
    "line 5: unsupported extended command",
  );
  expectOne(
    validateGerber(gerber().replace("%MOMM*%", "%MOIN*%\n%MOMM*%"), outline),
    "line 6: unsupported extended command",
  );
});

test("requires unique Gerber headers and defined aperture selections", () => {
  expectOne(
    validateGerber(
      gerber().replace("%TF.FileFunction,Copper,L1,Top*%\n", ""),
      outline,
    ),
    "file: TF.FileFunction",
  );
  expectOne(
    validateGerber(gerber("D11*\n"), outline),
    "line 10: undefined aperture D11",
  );
  expectOne(
    validateGerber(
      gerber().replace(
        "%ADD10C,0.180000*%",
        "%ADD10C,0.180000*%\n%ADD10C,0.200000*%",
      ),
      outline,
    ),
    "line 10: duplicate aperture D10",
  );
  expectOne(
    validateGerber(
      gerber("").replace("%ADD10C,0.180000*%", "%ADD9C,0.180000*%"),
      outline,
    ),
    "line 9: aperture code must be at least D10",
  );
  expectOne(
    validateGerber(
      gerber("X1000000Y1000000D02*\nX2000000Y1000000D01*\n"),
      outline,
    ),
    "line 11: aperture required before D01",
  );
  expectOne(
    validateGerber(gerber().replace("G01*\n", ""), outline),
    "line 11: G01 required before D01",
  );
  expectOne(
    validateGerber(gerber("D10*\nX2000000Y1000000D01*\n"), outline),
    "line 11: current point required before D01",
  );
  expectOne(
    validateGerber(
      gerber().replace(
        "%TF.FileFunction,Copper,L1,Top*%\n",
        "%TF.FileFunction,Copper,L1,Top*%\n%TF.FileFunction,Copper,L1,Top*%\n",
      ),
      outline,
    ),
    "file: TF.FileFunction must appear exactly once",
  );
  expectOne(
    validateGerber(gerber().replace("M02*\n", "M02*\nM02*\n"), outline),
    "file: M02 must appear exactly once",
  );
  expect(
    validateGerber(
      gerber("X1000000Y1000000D02*\nD10*\nX2000000Y1000000D01*\n"),
      outline,
    ),
  ).toEqual([]);
});

test("checks Gerber coordinate format, outline bounds, and termination", () => {
  expectOne(
    validateGerber(gerber("X12345678901Y0D02*\n"), outline),
    "line 10: coordinate exceeds 4.6 format",
  );
  expectOne(
    validateGerber(
      gerber().replace("X1000000Y1000000D02*", "X10000001Y1000000D02*"),
      outline,
    ),
    "line 11: coordinate outside outline",
  );
  expect(
    validateGerber(
      gerber().replace("X1000000Y1000000D02*", "X10000000Y1000000D02*"),
      outline,
    ),
  ).toEqual([]);
  expectOne(
    validateGerber(
      gerber().replace("X1000000Y1000000D02*", "X-1Y1000000D02*"),
      outline,
    ),
    "line 11: coordinate outside outline",
  );
  expectOne(
    validateGerber(gerber().replace("M02*\n", ""), outline),
    "file: M02 must appear exactly once",
  );
  expectOne(
    validateGerber(gerber().replace("M02*\n", "M02*\nG01*\n"), outline),
    "line 15: M02 must be the last non-empty line",
  );
});

test("accepts METRIC Excellon and rejects malformed headers and tools", () => {
  expectOne(
    validateExcellon(excellon().replaceAll("\n", "\r\n"), outline),
    "file: carriage return",
  );
  expectOne(
    validateExcellon(excellon().replace("M48\n", "M30\n"), outline),
    "line 1: expected M48 header",
  );
  expectOne(
    validateExcellon(excellon().replace("METRIC\n", "METRIC\nINCH\n"), outline),
    "line 5: invalid Excellon header line",
  );
  expectOne(
    validateExcellon(excellon().replace("METRIC\n", ""), outline),
    "file: METRIC units required",
  );
  expectOne(
    validateExcellon(excellon().replace("%\n", "%\nT2C0.800\n"), outline),
    "line 7: invalid Excellon body line",
  );
  expectOne(
    validateExcellon(
      excellon().replace("T1C1.000\n", "T1C1.000\nT1C0.800\n"),
      outline,
    ),
    "line 6: duplicate tool T1",
  );
  expectOne(
    validateExcellon(excellon("T2\n"), outline),
    "line 9: undefined tool T2",
  );
  expectOne(
    validateExcellon(excellon().replace("T1\nX1.000", "X1.000"), outline),
    "line 9: tool select required before hit",
  );
  const noPercent = validateExcellon("M48\nMETRIC\nT1C1.000\n", outline);
  expect(noPercent).toHaveLength(2);
  expect(noPercent).toContain("file: missing % header terminator");
  expect(noPercent).toContain("file: M30 must appear exactly once");
});

test("checks Excellon decimal coordinates, outline bounds, and termination", () => {
  expectOne(
    validateExcellon(excellon().replace("X1.000Y2.000", "X127Y5.08"), outline),
    "line 10: invalid Excellon body line",
  );
  expectOne(
    validateExcellon(
      excellon().replace("X1.000Y2.000", "X10.001Y2.000"),
      outline,
    ),
    "line 10: coordinate outside outline",
  );
  expectOne(
    validateExcellon(excellon().replace("M30\n", ""), outline),
    "file: M30 must appear exactly once",
  );
  expectOne(
    validateExcellon(excellon().replace("M30\n", "M30\nG90\n"), outline),
    "line 12: M30 must be the last non-empty line",
  );
  expectOne(
    validateExcellon(excellon().replace("M30\n", "M30\nM30\n"), outline),
    "file: M30 must appear exactly once",
  );
});

function clearanceInput(args: {
  readonly gto: string;
  readonly gts: string;
  readonly outline?: { readonly width: number; readonly height: number };
  readonly padClearance?: number;
  readonly edgeClearance?: number;
}) {
  return legendClearanceErrors({
    gto: args.gto,
    gts: args.gts,
    outline: args.outline ?? { width: 10, height: 8 },
    padClearance: args.padClearance ?? 0.15,
    edgeClearance: args.edgeClearance ?? 0.2,
  });
}
const gtsCircle = (x: number, y: number, diameter = 1.9) =>
  gerber(`D10*\nX${x * 1e6}Y${y * 1e6}D03*\n`).replace(
    "C,0.180000",
    `C,${diameter.toFixed(6)}`,
  );
const gtsSquare = (x: number, y: number, size = 1.9) =>
  `%TF.FileFunction,Soldermask,Top*%\n%FSLAX46Y46*%\n%MOMM*%\n%ADD10R,${size.toFixed(6)}X${size.toFixed(6)}*%\nD10*\nX${x * 1e6}Y${y * 1e6}D03*\nM02*\n`;
const gtoLine = (
  width: number,
  x1: number,
  y1: number,
  x2: number,
  y2: number,
) =>
  gerber(
    `D10*\nX${x1 * 1e6}Y${y1 * 1e6}D02*\nX${x2 * 1e6}Y${y2 * 1e6}D01*\n`,
  ).replace("C,0.180000", `C,${width.toFixed(6)}`);

test("checks exact circle, square, and board-edge legend clearances", () => {
  expectOne(
    clearanceInput({ gto: gtoLine(0.18, 2.4, 3, 4, 3), gts: gtsCircle(3, 4) }),
    "line 12:",
  );
  expectOne(
    clearanceInput({ gto: gtoLine(0.18, 3, 4, 3, 4), gts: gtsCircle(3, 4) }),
    "line 12:",
  );
  const tangentCircleGto = gtoLine(0.18, 2, 4, 2.81, 4);
  expect(validateGerber(tangentCircleGto, outline)).toEqual([]);
  expect(
    clearanceInput({ gto: tangentCircleGto, gts: gtsCircle(4, 4) }),
  ).toEqual([]);
  expectOne(
    clearanceInput({ gto: gtoLine(0.18, 2, 4, 4, 4), gts: gtsSquare(3, 4) }),
    "line 12:",
  );
  const squareCornerGto = gtoLine(0.18, 1, 4.2, 2, 4.2);
  expect(validateGerber(squareCornerGto, outline)).toEqual([]);
  expect(
    clearanceInput({
      gto: squareCornerGto,
      gts: gtsSquare(3, 3),
    }),
  ).toEqual([]);
  expectOne(
    clearanceInput({
      gto: gtoLine(0.18, 1, 4.17, 2.04, 4.17),
      gts: gtsSquare(3, 3),
    }),
    "line 12:",
  );
  const safeZeroLengthGto = gtoLine(0.18, 1, 1, 1, 1);
  expect(validateGerber(safeZeroLengthGto, outline)).toEqual([]);
  expect(
    clearanceInput({ gto: safeZeroLengthGto, gts: gtsCircle(3, 3) }),
  ).toEqual([]);
  expectOne(
    clearanceInput({ gto: gtoLine(0.18, 0.19, 2, 1, 2), gts: gerber("") }),
    "line 12:",
  );
  expect(
    clearanceInput({
      gto: gerber("D10*\nX2000000Y2000000D03*\n"),
      gts: gerber(""),
    }),
  ).toEqual(["line 11: unexpected flash"]);
});

test("rejects a missing clearance rule instead of passing everything", () => {
  const input = { gto: gtoLine(0.18, 2, 4, 4, 4), gts: gtsCircle(3, 4) };
  expect(() =>
    legendClearanceErrors({
      ...input,
      outline,
      padClearance: Number.NaN,
      edgeClearance: 0.2,
    }),
  ).toThrow("padClearance must be a finite number");
  expect(() =>
    legendClearanceErrors({
      ...input,
      outline,
      padClearance: 0.15,
      edgeClearance: undefined as unknown as number,
    }),
  ).toThrow("edgeClearance must be a finite number");
});
