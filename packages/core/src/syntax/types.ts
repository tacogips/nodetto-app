// Ported from tacogips/chilla (MIT, same owner), src/features/pr-diff/prDiffSyntaxTypes.ts.
export const SYNTAX_KINDS = [
  "plain",
  "javascript",
  "java",
  "scala",
  "lisp",
  "ruby",
  "python",
  "c",
  "cpp",
  "zig",
  "haskell",
  "swift",
  "vue",
  "sql",
  "groovy",
  "xml",
  "properties",
  "protobuf",
  "nix",
  "dockerfile",
  "makefile",
  "rust",
  "shell",
  "json",
  "markdown",
  "css",
  "toml",
  "yaml",
] as const;
export type SyntaxKind = (typeof SYNTAX_KINDS)[number];
export const SEGMENT_KINDS = [
  "plain",
  "keyword",
  "string",
  "comment",
  "number",
  "punctuation",
  "markup",
] as const;
export type SegmentKind = (typeof SEGMENT_KINDS)[number];
export interface SyntaxSegment {
  readonly text: string;
  readonly kind: SegmentKind;
}
export const SYNTAX_KIND_LABELS: Readonly<Record<SyntaxKind, string>> =
  Object.fromEntries(SYNTAX_KINDS.map((kind) => [kind, kind])) as Record<
    SyntaxKind,
    string
  >;
