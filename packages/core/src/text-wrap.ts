import { graphemes } from "./text-layout.ts";
import { isWideCodePoint, wideAwareTextWidth } from "./wide-text-width.ts";

const closing =
  "、。，．・：；！？」』）】〉》］｝〕/／ーぁぃぅぇぉっゃゅょゎゕゖァィゥェォッャュョヮヵヶ";
const after = "、。，．・：；！？」』）】〉》］｝〕/／";
const before = "「『（【〈《［｛〔";
const wide = (s: string) => isWideCodePoint(s.codePointAt(0) ?? 0);

export function wrapTextToWidth(
  text: string,
  width: number,
  fontSize: number,
  letterSpacing = 0,
): string {
  return text
    .split("\n")
    .map((line) => {
      if (wideAwareTextWidth(line, fontSize, letterSpacing) <= width + 0.01)
        return line;
      const chars = graphemes(line);
      const lines: string[] = [];
      let start = 0;
      while (start < chars.length) {
        let end = start;
        let current = "";
        while (end < chars.length) {
          const next = current + (chars[end] ?? "");
          if (
            end > start &&
            wideAwareTextWidth(next, fontSize, letterSpacing) > width + 0.01
          )
            break;
          current = next;
          end++;
        }
        if (end === chars.length) {
          lines.push(chars.slice(start).join(""));
          break;
        }
        let chosen = end;
        let priority = 5;
        if (chars[end] === " ") {
          chosen = end + 1;
          priority = 0;
        }
        for (let i = start + 1; i <= end; i++) {
          const prev = chars[i - 1] ?? "";
          const next = chars[i] ?? "";
          const rank =
            prev === " "
              ? 0
              : after.includes(prev)
                ? 1
                : before.includes(next)
                  ? 2
                  : wide(prev) && wide(next)
                    ? 3
                    : 4;
          if (rank < priority || (rank === priority && i > chosen)) {
            priority = rank;
            chosen = i;
          }
        }
        while (chosen > start + 1 && closing.includes(chars[chosen] ?? ""))
          chosen--;
        let piece = chars.slice(start, chosen).join("");
        if ((chars[chosen - 1] ?? "") === " ") piece = piece.replace(/ +$/, "");
        lines.push(piece);
        start = chosen;
        while (chars[start] === " ") start++;
      }
      return lines.join("\n");
    })
    .join("\n");
}
