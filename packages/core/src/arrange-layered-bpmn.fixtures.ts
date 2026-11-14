import { document, element, makeEditor } from "./test-helpers.ts";

const page = { id: "page-1", name: "BPMN", kind: "bpmn" as const };
const pool = (id: string, y: number, collapsed = false) =>
  element({
    id,
    type: "bpmn.participant",
    semantic: { name: id, collapsed },
    visual: { x: 0, y, width: 500, height: 240 },
  });
const lane = (id: string, parent: string, y: number) =>
  element({
    id,
    type: "bpmn.lane",
    semantic: { name: id, parent },
    visual: { x: 30, y, width: 470, height: 240 },
  });
const task = (id: string, x: number, y: number, parent?: string) =>
  element({
    id,
    type: "bpmn.task",
    semantic: {
      name: id,
      taskType: "user",
      loop: "none",
      ...(parent ? { parent } : {}),
    },
    visual: { x, y, width: 100, height: 60 },
  });
const flow = (
  id: string,
  from: string,
  to: string,
  type = "bpmn.sequenceFlow",
) => element({ id, type, semantic: { from, to }, visual: {} });
const build = (entries: ReturnType<typeof element>[]) => () =>
  makeEditor({ document: document(entries, [page]) });

export const DEPTH_ONE_FIXTURES = [
  {
    name: "two-pools-message-flow",
    build: build([
      pool("p", 0),
      lane("l", "p", 0),
      task("a", 70, 40, "l"),
      pool("q", 400),
      lane("m", "q", 400),
      task("b", 70, 440, "m"),
      flow("f", "a", "b", "bpmn.messageFlow"),
    ]),
  },
  {
    name: "pool-no-lanes-free-row",
    build: build([pool("p", 0), task("a", 70, 40, "p"), task("b", 70, 400)]),
  },
  {
    name: "collapsed-pool",
    build: build([
      pool("p", 0),
      task("a", 70, 40, "p"),
      pool("q", 400, true),
      task("b", 70, 440, "q"),
    ]),
  },
  {
    name: "subprocess-boundary",
    build: build([
      pool("p", 0),
      element({
        id: "sub",
        type: "bpmn.subProcess",
        semantic: {
          name: "Sub",
          parent: "p",
          expanded: true,
          triggeredByEvent: false,
          adHoc: false,
          loop: "none",
        },
        visual: { x: 70, y: 40, width: 200, height: 100 },
      }),
      task("inner", 90, 60, "sub"),
      element({
        id: "boundary",
        type: "bpmn.boundaryEvent",
        semantic: {
          name: "Boundary",
          attachedTo: "sub",
          definitions: [],
          cancelActivity: true,
        },
        visual: { x: 100, y: 125, width: 30, height: 30 },
      }),
      task("after", 350, 40, "p"),
      flow("f", "boundary", "after"),
    ]),
  },
] as const;
