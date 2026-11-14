export const PRESENTATION_HIDDEN_TITLE_SUFFIX = " (hidden in presentation)";
export const PRESENTATION_HIDDEN_TAB_CLASS =
  "nodetto-page-tab-presentation-hidden";

export function presentationToggleLabel(hidden: boolean): string {
  return hidden ? "Show in presentation" : "Hide in presentation";
}
