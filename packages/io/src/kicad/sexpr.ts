import type { BreadboardImportDiagnostic } from "@nodetto/ir";

export type SexprNode = SexprList | SexprAtom;
export interface SexprList {
  readonly kind: "list";
  readonly items: readonly SexprNode[];
  readonly line: number;
  readonly column: number;
}
export interface SexprAtom {
  readonly kind: "atom";
  readonly text: string;
  readonly quoted: boolean;
  readonly line: number;
  readonly column: number;
}

interface Token {
  readonly kind: "open" | "close" | "atom";
  readonly text: string;
  readonly quoted: boolean;
  readonly line: number;
  readonly column: number;
}

const diagnostic = (
  code: string,
  message: string,
  token?: Pick<Token, "line" | "column">,
): BreadboardImportDiagnostic => ({
  severity: code === "sexpr.empty" ? "error" : "warning",
  code,
  message,
  ...(token ? { line: token.line, column: token.column } : {}),
});

function tokenize(
  text: string,
  diagnostics: BreadboardImportDiagnostic[],
): Token[] {
  const tokens: Token[] = [];
  let i = 0;
  let line = 1;
  let column = 1;
  const advance = () => {
    const char = text.charAt(i);
    i += 1;
    if (char === "\n") {
      line += 1;
      column = 1;
    } else column += 1;
    return char;
  };
  while (i < text.length) {
    const char = text.charAt(i);
    if (/\s/.test(char)) {
      advance();
      continue;
    }
    const start = { line, column };
    if (char === "(" || char === ")") {
      advance();
      tokens.push({
        kind: char === "(" ? "open" : "close",
        text: char,
        quoted: false,
        ...start,
      });
      continue;
    }
    if (char === '"') {
      advance();
      let value = "";
      let closed = false;
      while (i < text.length) {
        const next = advance();
        if (next === '"') {
          closed = true;
          break;
        }
        if (next === "\\" && i < text.length) {
          const escaped = advance();
          const escapes: Readonly<Record<string, string>> = {
            '"': '"',
            "\\": "\\",
            n: "\n",
            r: "\r",
            t: "\t",
          };
          value += escapes[escaped] ?? escaped;
        } else value += next;
      }
      tokens.push({ kind: "atom", text: value, quoted: true, ...start });
      if (!closed)
        diagnostics.push(
          diagnostic(
            "sexpr.unterminatedString",
            "String reaches end of input.",
            start,
          ),
        );
      continue;
    }
    let value = "";
    while (i < text.length && !/[\s()"]/.test(text.charAt(i)))
      value += advance();
    if (value)
      tokens.push({ kind: "atom", text: value, quoted: false, ...start });
  }
  return tokens;
}

export function readSexpr(text: string): {
  root?: SexprList;
  diagnostics: BreadboardImportDiagnostic[];
} {
  const diagnostics: BreadboardImportDiagnostic[] = [];
  const tokens = tokenize(text, diagnostics);
  const roots: SexprList[] = [];
  const stack: { token: Token; items: SexprNode[]; drop: boolean }[] = [];
  let tooDeep = false;
  let trailing = false;
  for (const token of tokens) {
    if (roots.length > 0 && stack.length === 0) {
      if (!trailing)
        diagnostics.push(
          diagnostic(
            "sexpr.trailingContent",
            "Content after the first top-level list was ignored.",
            token,
          ),
        );
      trailing = true;
      continue;
    }
    if (token.kind === "open") {
      const drop = stack.length >= 256 || stack.some((frame) => frame.drop);
      if (stack.length >= 256 && !tooDeep) {
        diagnostics.push(
          diagnostic(
            "sexpr.tooDeep",
            "Lists deeper than 256 levels were dropped.",
            token,
          ),
        );
        tooDeep = true;
      }
      stack.push({ token, items: [], drop });
    } else if (token.kind === "close") {
      const frame = stack.pop();
      if (!frame) {
        diagnostics.push(
          diagnostic(
            "sexpr.unexpectedClose",
            "A closing parenthesis without an open list was ignored.",
            token,
          ),
        );
        continue;
      }
      const list: SexprList = {
        kind: "list",
        items: frame.items,
        line: frame.token.line,
        column: frame.token.column,
      };
      if (!frame.drop) {
        const parent = stack.at(-1);
        if (parent) parent.items.push(list);
        else roots.push(list);
      }
    } else {
      const atom: SexprAtom = {
        kind: "atom",
        text: token.text,
        quoted: token.quoted,
        line: token.line,
        column: token.column,
      };
      const parent = stack.at(-1);
      if (parent && !parent.drop) parent.items.push(atom);
    }
  }
  const outermost = stack[0];
  if (outermost) {
    diagnostics.push(
      diagnostic(
        "sexpr.unclosedList",
        "Open lists were closed at end of input.",
        outermost.token,
      ),
    );
    while (stack.length > 0) {
      const frame = stack.pop();
      if (!frame || frame.drop) continue;
      const list: SexprList = {
        kind: "list",
        items: frame.items,
        line: frame.token.line,
        column: frame.token.column,
      };
      const parent = stack.at(-1);
      if (parent && !parent.drop) parent.items.push(list);
      else if (!parent) roots.push(list);
    }
  }
  const root = roots[0];
  if (!root)
    diagnostics.push(
      diagnostic("sexpr.empty", "No S-expression list was found."),
    );
  return { ...(root ? { root } : {}), diagnostics };
}

export function atomAt(list: SexprList, index: number): string | undefined {
  const node = list.items[index];
  return node?.kind === "atom" ? node.text : undefined;
}

export function child(list: SexprList, head: string): SexprList | undefined {
  return list.items.find(
    (node): node is SexprList =>
      node.kind === "list" && atomAt(node, 0) === head,
  );
}

export function children(list: SexprList, head: string): SexprList[] {
  return list.items.filter(
    (node): node is SexprList =>
      node.kind === "list" && atomAt(node, 0) === head,
  );
}

export function numberAt(
  list: SexprList,
  index: number,
  diagnostics: BreadboardImportDiagnostic[],
): number | undefined {
  const atom = list.items[index];
  if (atom?.kind !== "atom") return undefined;
  const value = Number(atom.text);
  if (Number.isFinite(value)) return value;
  diagnostics.push({
    severity: "warning",
    code: "kicad.invalidNumber",
    message: `Invalid number '${atom.text}'.`,
    line: atom.line,
    column: atom.column,
  });
  return undefined;
}
