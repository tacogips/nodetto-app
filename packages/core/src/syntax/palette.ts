export interface CodePalette {
  background: string;
  border: string;
  gutter: string;
  lineNumber: string;
  plain: string;
  keyword: string;
  string: string;
  comment: string;
  number: string;
  punctuation: string;
  markup: string;
  inlineCodeBackground: string;
  link: string;
  quoteBar: string;
  tableHeader: string;
  rule: string;
}
export const CODE_PALETTES: {
  readonly light: CodePalette;
  readonly dark: CodePalette;
} = {
  light: {
    background: "#fffdf8",
    border: "#d8d2c3",
    gutter: "#fffdf8",
    lineNumber: "#596366",
    plain: "#1d2a2e",
    keyword: "#335c67",
    string: "#665021",
    comment: "#596366",
    number: "#69404e",
    punctuation: "#1d2a2e",
    markup: "#335c67",
    inlineCodeBackground: "#dbe6e8",
    link: "#335c67",
    quoteBar: "#596366",
    tableHeader: "#dbe6e8",
    rule: "#d8d2c3",
  },
  dark: {
    background: "#1f2427",
    border: "#3a4245",
    gutter: "#1f2427",
    lineNumber: "#a3adb1",
    plain: "#e6e9ea",
    keyword: "#7fb3bf",
    string: "#d6c28d",
    comment: "#a3adb1",
    number: "#dfb6c4",
    punctuation: "#e6e9ea",
    markup: "#7fb3bf",
    inlineCodeBackground: "#24393e",
    link: "#7fb3bf",
    quoteBar: "#a3adb1",
    tableHeader: "#24393e",
    rule: "#3a4245",
  },
};
export function codePaletteFor(fill: string | undefined): {
  readonly mode: "light" | "dark";
  readonly palette: CodePalette;
  readonly panelFill: string;
} {
  const panelFill = fill ?? CODE_PALETTES.light.background;
  const match = /^#([0-9a-f]{3}|[0-9a-f]{6}|[0-9a-f]{8})$/i.exec(panelFill);
  let luminance = 1;
  if (match?.[1]) {
    const hex =
      match[1].length === 3
        ? [...match[1]].map((c) => c + c).join("")
        : match[1].slice(0, 6);
    const channels = [0, 2, 4].map((i) => {
      const v = Number.parseInt(hex.slice(i, i + 2), 16) / 255;
      return v <= 0.04045 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4;
    });
    luminance =
      (channels[0] ?? 0) * 0.2126 +
      (channels[1] ?? 0) * 0.7152 +
      (channels[2] ?? 0) * 0.0722;
  }
  const mode = luminance < 0.18 ? "dark" : "light";
  return { mode, palette: CODE_PALETTES[mode], panelFill };
}
