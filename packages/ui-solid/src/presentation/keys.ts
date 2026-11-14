import type { PresentationAction } from "@nodetto/core";

export interface PresentationKey {
  key: string;
  ctrlKey: boolean;
  metaKey: boolean;
  altKey: boolean;
}
export function presentationKeyAction(
  event: PresentationKey,
): PresentationAction | "exit" | null {
  if (event.ctrlKey || event.metaKey || event.altKey) return null;
  const key = event.key.toLowerCase();
  if (["arrowright", "arrowdown", "pagedown", " ", "n"].includes(key))
    return { type: "next" };
  if (["arrowleft", "arrowup", "pageup", "backspace", "p"].includes(key))
    return { type: "prev" };
  if (/^[0-9]$/.test(key)) return { type: "digit", digit: key };
  switch (key) {
    case "enter":
      return { type: "enter" };
    case "home":
      return { type: "first" };
    case "end":
      return { type: "last" };
    case "b":
      return { type: "toggleBlack" };
    case "escape":
      return "exit";
    default:
      return null;
  }
}
