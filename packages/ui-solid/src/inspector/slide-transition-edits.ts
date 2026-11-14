import type { Command, Editor } from "@nodetto/core";
import {
  readSlideSettings,
  SLIDE_SETTINGS_TYPE,
  type PageId,
  type SlideSettings,
} from "@nodetto/ir";

type Patch = { [K in keyof SlideSettings]?: SlideSettings[K] | null };
function normalize(settings: Patch): SlideSettings {
  const result: Record<string, unknown> = { ...settings };
  for (const key of Object.keys(result)) {
    if (
      result[key] == null ||
      (key === "mode" && result[key] === "auto") ||
      (key === "stagger" && result[key] === true)
    )
      delete result[key];
  }
  return result as SlideSettings;
}
export function slideSettingsOf(editor: Editor, pageId: PageId): SlideSettings {
  return {
    mode: "auto",
    stagger: true,
    ...readSlideSettings(editor.store.getPageElements(pageId)),
  };
}
export function planSlideSettingsEdit(
  editor: Editor,
  pageId: PageId,
  patch: Patch,
): Command[] {
  const elements = editor.store.getPageElements(pageId);
  const carrier = elements
    .filter((e) => e.type === SLIDE_SETTINGS_TYPE)
    .sort((a, b) =>
      a.index < b.index
        ? -1
        : a.index > b.index
          ? 1
          : a.id < b.id
            ? -1
            : a.id > b.id
              ? 1
              : 0,
    )[0];
  const current = normalize(readSlideSettings(elements) ?? {});
  const next = normalize({ ...current, ...patch });
  if (
    JSON.stringify(Object.entries(current).sort()) ===
    JSON.stringify(Object.entries(next).sort())
  )
    return [];
  if (!Object.keys(next).length)
    return carrier ? [{ type: "deleteElements", ids: [carrier.id] }] : [];
  if (carrier)
    return [
      {
        type: "replaceVisual",
        id: carrier.id,
        visual: {
          ...carrier.visual,
          animation: { ...carrier.visual.animation, slide: next },
        },
      },
    ];
  return [
    {
      type: "createElement",
      element: editor.buildElement(SLIDE_SETTINGS_TYPE, {
        page: pageId,
        semantic: {},
        visual: { animation: { slide: next } },
      }),
    },
  ];
}
