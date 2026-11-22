import { expect, test } from "bun:test";
import { document } from "../test-helpers.ts";
import {
  type CadEngineRequest,
  type CadTransport,
  CadSupersededError,
  collectCadInput,
  createCadEngineClient,
} from "./engine.ts";
import { CAD_TEST_PAGE, plateElements } from "./testing/documents.ts";

import {
  boardReference,
  edge,
  PCB_TEST_PAGE,
  testBoard,
} from "./testing/pcb.ts";

function setup() {
  const posts: CadEngineRequest[] = [];
  const timers = new Set<() => void>();
  let receive: (message: unknown) => void;
  let fail: () => void;
  let restarts = 0;
  let disposals = 0;
  let clock = 0;
  const transport: CadTransport = {
    post(message, transfer) {
      expect(transfer).toEqual([]);
      posts.push(structuredClone(message) as CadEngineRequest);
    },
    onMessage(handler) {
      receive = handler;
    },
    onError(handler) {
      fail = handler;
    },
    restart() {
      restarts++;
    },
    dispose() {
      disposals++;
    },
  };
  const engine = createCadEngineClient(transport, {
    timeoutMs: 20,
    now: () => clock,
    setTimer(fn, ms) {
      expect(ms).toBe(20);
      timers.add(fn);
      return fn;
    },
    clearTimer(timer) {
      if (typeof timer === "function") {
        for (const fn of timers) if (fn === timer) timers.delete(fn);
      }
    },
  });
  return {
    engine,
    posts,
    timers,
    get restarts() {
      return restarts;
    },
    get disposals() {
      return disposals;
    },
    evaluate(revision: number) {
      return engine.evaluate({ revision, pageId: "cad", elements: [] });
    },
    answer(index: number, restart = false) {
      const {
        id,
        input: { revision },
      } = posts[index];
      receive({ id, result: { revision, status: [], bodies: [] }, restart });
    },
    advance(ms: number) {
      clock += ms;
    },
    crash() {
      fail();
    },
  };
}

test("only the newest queued request runs and an older revision cannot repaint", async () => {
  const fake = setup();
  const first = fake.evaluate(1);
  const second = fake.evaluate(2);
  const firstError = first.catch((error: unknown) => error);
  const secondError = second.catch((error: unknown) => error);
  const newest = fake.evaluate(3);
  expect(fake.posts.map(({ input }) => input.revision)).toEqual([1]);
  expect(await secondError).toBeInstanceOf(CadSupersededError);
  fake.answer(0);
  expect(await firstError).toBeInstanceOf(CadSupersededError);
  expect(fake.posts.map(({ input }) => input.revision)).toEqual([1, 3]);
  fake.answer(0);
  fake.answer(1);
  await expect(newest).resolves.toMatchObject({ revision: 3 });
  expect(fake.timers.size).toBe(0);
});

test("the watchdog restarts and ignores replies from the previous worker", async () => {
  const fake = setup();
  const timedOut = fake.evaluate(1);
  for (const timer of [...fake.timers]) timer();
  await expect(timedOut).resolves.toMatchObject({
    revision: 1,
    failure: "cad.kernel.failed",
  });
  expect(fake.restarts).toBe(1);
  const retry = fake.evaluate(1);
  fake.answer(0, true);
  fake.answer(1);
  await expect(retry).resolves.toEqual({ revision: 1, status: [], bodies: [] });
  expect(fake.restarts).toBe(1);
});

test("a late reply cannot beat an expired watchdog", async () => {
  const fake = setup();
  const result = fake.evaluate(1);
  fake.advance(20);
  fake.answer(0);
  await expect(result).resolves.toMatchObject({ failure: "cad.kernel.failed" });
  expect(fake.restarts).toBe(1);
});

test("a crashed worker is restarted before posting queued work", async () => {
  const fake = setup();
  const inFlight = fake.evaluate(1);
  const firstError = inFlight.catch((error: unknown) => error);
  const queued = fake.evaluate(2);
  fake.crash();
  expect(await firstError).toBeInstanceOf(CadSupersededError);
  expect(fake.restarts).toBe(1);
  fake.answer(1, true);
  await expect(queued).resolves.toMatchObject({ revision: 2 });
  expect(fake.restarts).toBe(2);
});

test("disposing rejects active and queued work and releases the transport", async () => {
  const fake = setup();
  const results = [fake.evaluate(1), fake.evaluate(2)].map((result) =>
    result.catch((error: unknown) => error),
  );
  fake.engine.dispose();
  fake.engine.dispose();
  expect(await Promise.all(results)).toEqual([
    new Error("CAD engine disposed"),
    new Error("CAD engine disposed"),
  ]);
  expect(fake.disposals).toBe(1);
  expect(fake.timers.size).toBe(0);
  fake.answer(0);
  await expect(fake.evaluate(3)).rejects.toThrow("CAD engine disposed");
});

test("collectCadInput selects only the requested CAD page", () => {
  const model = plateElements();
  const drawing = { id: "drawing", kind: "freeform", name: "Drawing" } as const;
  const other = { ...CAD_TEST_PAGE, id: "other" };
  const doc = document(
    [
      ...model,
      { ...model[0], page: drawing.id },
      { ...model[0], page: other.id },
    ],
    [CAD_TEST_PAGE, drawing, other],
  );
  expect(collectCadInput(doc, CAD_TEST_PAGE.id, 42)).toEqual({
    revision: 42,
    pageId: CAD_TEST_PAGE.id,
    elements: model,
  });
  expect(collectCadInput(doc, drawing.id, 43).elements).toEqual([]);
  expect(collectCadInput(doc, "missing", 44).elements).toEqual([]);
});

test("collectCadInput includes only linked boards on PCB pages and visible Edge.Cuts, once", () => {
  const board = testBoard();
  const reference = boardReference();
  const second = { ...reference, id: "other-reference" };
  const top = edge("top", { kind: "line", start: [5, 5], end: [10, 5] });
  const otherPcb = { ...PCB_TEST_PAGE, id: "other-board-page" };
  const drawing = { id: "drawing", kind: "freeform", name: "Drawing" } as const;
  const otherReference = {
    ...reference,
    id: "drawing-reference",
    semantic: { ...reference.semantic, board: "not-on-pcb" },
  };
  const doc = document(
    [
      reference,
      board,
      second,
      top,
      { ...top, id: "hidden", visual: { hidden: true } },
      { ...top, id: "track", type: "pcb.track" },
      {
        ...top,
        id: "silkscreen",
        semantic: { ...top.semantic, layer: "F.SilkS" },
      },
      { ...top, id: "other-edge", page: otherPcb.id },
      { ...board, id: "unlinked-board", page: otherPcb.id },
      { ...board, id: "not-on-pcb", page: drawing.id },
      otherReference,
    ],
    [CAD_TEST_PAGE, PCB_TEST_PAGE, otherPcb, drawing],
  );
  expect(collectCadInput(doc, CAD_TEST_PAGE.id, 1).elements).toEqual([
    reference,
    second,
    otherReference,
    board,
    top,
  ]);
});
