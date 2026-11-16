export interface TextCodeSemantic {
  readonly code: string;
  readonly language: string;
  readonly showLineNumbers?: boolean;
  readonly wrap?: boolean;
}
export interface TextMarkdownSemantic {
  readonly markdown: string;
}
export const TEXT_SNIPPET_MAX_LENGTH = 200000;
export const TEXT_CODE_LANGUAGE_PATTERN = /^[a-z0-9][a-z0-9_+#.-]{0,31}$/;
export const PAGE_FRAME_SIZES = [
  "a4",
  "a5",
  "letter",
  "legal",
  "slide-16-9",
  "slide-4-3",
  "custom",
] as const;
export const PAGE_FRAME_ORIENTATIONS = ["portrait", "landscape"] as const;
export type PageFrameSize = (typeof PAGE_FRAME_SIZES)[number];
export type PageFrameOrientation = (typeof PAGE_FRAME_ORIENTATIONS)[number];
export interface PageFrameSpec {
  readonly size: PageFrameSize;
  readonly orientation: PageFrameOrientation;
}
export const PAGE_FLOWS = ["vertical", "horizontal"] as const;
export type PageFlow = (typeof PAGE_FLOWS)[number];
