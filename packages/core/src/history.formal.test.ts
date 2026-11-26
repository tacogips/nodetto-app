import { describe, expect, test } from "bun:test";
import { applyCommands, type Command, CommandError } from "./commands.ts";
import { History } from "./history.ts";
import { Store } from "./store.ts";
import { document, element, TEST_PAGE } from "./test-helpers.ts";

type Op =
  | { op: "push"; undo: string[]; redo: string[] }
  | { op: "begin" | "end" | "abort" | "undo" | "redo" | "clear" };
type ModelCommand =
  | { type: "create" | "update"; id: string; value: number }
  | { type: "delete"; ids: string[] };
type State = {
  ran: string[] | null;
  undoSize: number;
  redoSize: number;
  batching: boolean;
};
type Pair = [string, number];
type Vector =
  | { fn: "history"; in: { limit: number; ops: Op[] }; out: { ok: State[] } }
  | {
      fn: "applyCommands";
      in: { store: Pair[]; commands: ModelCommand[] };
      out: { ok: { store: Pair[]; undo: ModelCommand[] } } | { error: string };
    };

function object(x: unknown): x is Record<string, unknown> {
  return typeof x === "object" && x !== null && !Array.isArray(x);
}
function strings(x: unknown): x is string[] {
  return Array.isArray(x) && x.every((v: unknown) => typeof v === "string");
}
function pairs(x: unknown): x is Pair[] {
  return (
    Array.isArray(x) &&
    x.every(
      (v: unknown) =>
        Array.isArray(v) &&
        v.length === 2 &&
        typeof v[0] === "string" &&
        typeof v[1] === "number",
    )
  );
}
function command(x: unknown): x is ModelCommand {
  return (
    object(x) &&
    (x.type === "delete"
      ? strings(x.ids)
      : (x.type === "create" || x.type === "update") &&
        typeof x.id === "string" &&
        typeof x.value === "number")
  );
}
function op(x: unknown): x is Op {
  return (
    object(x) &&
    (x.op === "push"
      ? strings(x.undo) && strings(x.redo)
      : typeof x.op === "string" &&
        ["begin", "end", "abort", "undo", "redo", "clear"].includes(x.op))
  );
}
function state(x: unknown): x is State {
  return (
    object(x) &&
    (x.ran === null || strings(x.ran)) &&
    typeof x.undoSize === "number" &&
    typeof x.redoSize === "number" &&
    typeof x.batching === "boolean"
  );
}
function vector(x: unknown): x is Vector {
  if (!object(x) || !object(x.in) || !object(x.out)) return false;
  if (x.fn === "history")
    return (
      typeof x.in.limit === "number" &&
      Array.isArray(x.in.ops) &&
      x.in.ops.every(op) &&
      Array.isArray(x.out.ok) &&
      x.out.ok.every(state)
    );
  return (
    x.fn === "applyCommands" &&
    pairs(x.in.store) &&
    Array.isArray(x.in.commands) &&
    x.in.commands.every(command) &&
    (typeof x.out.error === "string" ||
      (object(x.out.ok) &&
        pairs(x.out.ok.store) &&
        Array.isArray(x.out.ok.undo) &&
        x.out.ok.undo.every(command)))
  );
}
const data: unknown = await Bun.file(
  new URL("../../../formal/vectors/undo.json", import.meta.url),
).json();
if (
  !object(data) ||
  !Array.isArray(data.cases) ||
  !data.cases.every(vector) ||
  data.cases.length === 0
)
  throw new Error("Invalid undo vectors");
const cases: Vector[] = data.cases;
const fixture = (id: string, x: number) =>
  element({
    id,
    type: "shape.geo",
    semantic: { geo: "rect" },
    visual: { x, y: 0 },
  });
function toCommand(c: ModelCommand): Command {
  switch (c.type) {
    case "create":
      return { type: "createElement", element: fixture(c.id, c.value) };
    case "delete":
      return { type: "deleteElements", ids: c.ids };
    case "update":
      return { type: "replaceVisual", id: c.id, visual: { x: c.value, y: 0 } };
  }
}
function fromCommand(c: Command): ModelCommand {
  switch (c.type) {
    case "createElement":
      if (typeof c.element.visual.x === "number")
        return { type: "create", id: c.element.id, value: c.element.visual.x };
      break;
    case "deleteElements":
      return { type: "delete", ids: [...c.ids] };
    case "replaceVisual":
      if (typeof c.visual.x === "number")
        return { type: "update", id: c.id, value: c.visual.x };
      break;
  }
  throw new Error("Unexpected undo command");
}
describe("Lean undo vectors", () => {
  for (const [index, v] of cases.entries())
    test(`${v.fn} ${index}`, () => {
      if (v.fn === "history") {
        let ran: string[] | null = null;
        const h = new History((commands) => {
          ran = commands.map((c) => {
            if (c.type !== "deletePage")
              throw new Error("Unexpected history command");
            return c.id;
          });
        }, v.in.limit);
        const actual: State[] = [];
        for (const action of v.in.ops) {
          ran = null;
          switch (action.op) {
            case "push":
              h.push({
                undo: action.undo.map((id) => ({ type: "deletePage", id })),
                redo: action.redo.map((id) => ({ type: "deletePage", id })),
              });
              break;
            case "begin":
              h.beginBatch();
              break;
            case "end":
              h.endBatch();
              break;
            case "abort":
              h.abortBatch();
              break;
            case "undo":
              h.undo();
              break;
            case "redo":
              h.redo();
              break;
            case "clear":
              h.clear();
              break;
          }
          actual.push({
            ran,
            undoSize: h.undoSize,
            redoSize: h.redoSize,
            batching: h.batching,
          });
        }
        expect(actual).toEqual(v.out.ok);
      } else {
        const store = new Store(
          document(v.in.store.map(([id, value]) => fixture(id, value))),
        );
        const commands = v.in.commands.map(toCommand);
        if ("error" in v.out)
          expect(() => applyCommands(store, commands)).toThrow(CommandError);
        else {
          const result = applyCommands(store, commands);
          const values = store
            .getPageElements(TEST_PAGE.id)
            .map((e) => [e.id, e.visual.x])
            .sort((a, b) => String(a[0]).localeCompare(String(b[0])));
          expect({ store: values, undo: result.undo.map(fromCommand) }).toEqual(
            v.out.ok,
          );
        }
      }
    });
});
