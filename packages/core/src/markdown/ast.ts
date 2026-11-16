export type MdInline =
  | { kind: "text"; text: string }
  | { kind: "code"; text: string }
  | { kind: "emph" | "strong" | "strike"; children: MdInline[] }
  | { kind: "link"; href: string; children: MdInline[] }
  | { kind: "break" };

export type MdBlock =
  | { kind: "heading"; level: 1 | 2 | 3 | 4 | 5 | 6; inlines: MdInline[] }
  | { kind: "paragraph"; inlines: MdInline[] }
  | { kind: "code"; language: string; text: string }
  | { kind: "quote"; blocks: MdBlock[] }
  | {
      kind: "list";
      ordered: boolean;
      start: number;
      items: { task?: boolean; blocks: MdBlock[] }[];
    }
  | {
      kind: "table";
      align: ("left" | "center" | "right" | null)[];
      header: MdInline[][];
      rows: MdInline[][][];
    }
  | { kind: "rule" };
