import type { TextReplacement } from "@nodetto/core";

export type PageChangeCounts = Map<
  string,
  { added: number; updated: number; removed: number }
>;

export interface Created {
  readonly ref?: string;
  readonly id: string;
  readonly type: string;
  readonly page: string;
}

export interface EditWarning {
  readonly operation: number;
  readonly op: string;
  readonly element: string;
  readonly type: string;
  readonly path: string;
  readonly code: string;
  readonly message: string;
}

export interface MatchReport {
  readonly operation: number;
  readonly op: string;
  readonly count: number;
  readonly ids: readonly string[];
}

export interface BatchResult {
  readonly matches?: readonly MatchReport[];
  readonly warnings: readonly EditWarning[];
  readonly text: string;
  readonly created: readonly Created[];
  /** Text changed by replace-text operations. */
  readonly replaced: readonly TextReplacement[];
  readonly counts: ReadonlyMap<
    string,
    { added: number; updated: number; removed: number }
  >;
  readonly operations: number;
}
