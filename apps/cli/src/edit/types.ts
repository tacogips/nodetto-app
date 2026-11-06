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

export interface ConvertReport {
  readonly operation: number;
  readonly id: string;
  readonly fromType: string;
  readonly toType: string;
  readonly shape?: string;
  readonly mapped: readonly { readonly from: string; readonly to: string }[];
  readonly dropped: readonly string[];
  readonly connectors: readonly {
    readonly id: string;
    readonly type: string;
    readonly keptPorts?: readonly string[];
  }[];
}

export interface ReconnectReport {
  readonly operation: number;
  readonly deleted: string;
  readonly to: string;
  readonly connectors: readonly string[];
}

export interface BatchResult {
  readonly matches?: readonly MatchReport[];
  readonly converted?: readonly ConvertReport[];
  readonly reconnected?: readonly ReconnectReport[];
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
