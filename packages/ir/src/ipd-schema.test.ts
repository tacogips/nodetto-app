import { expect, test } from "bun:test";
import { serializeDocument, parseDocument } from "@nodetto/io";
import { type Document, validateDocument } from "./index.ts";

const doc = (elements: unknown[]): Document =>
  ({
    schemaVersion: 1,
    id: "d",
    title: "",
    pages: [{ id: "p", name: "", kind: "freeform" }],
    elements,
  }) as Document;
const element = (type: string, semantic: object, visual: object = {}) => ({
  id: "a",
  page: "p",
  index: "a0",
  type,
  semantic,
  visual,
});
const issues = (type: string, semantic: object, visual: object = {}) =>
  validateDocument(doc([element(type, semantic, visual)]));

test("new schema fields validate and serialize stably", () => {
  const document = doc([
    element(
      "frame",
      {
        name: "Screen",
        showTitle: true,
        titlePlacement: "outside",
        prototypeStart: true,
        prototypeFlowName: "Start",
        kit: "ios:list-row@1",
      },
      {
        textMeasure: "proportional",
        textTruncate: "ellipsis",
        style: {
          accentColor: "#112233",
          selectedColor: "#ffffff",
          strokeAlign: "inside",
          strokeSides: { top: 0.5, right: 2 },
        },
      },
    ),
    {
      ...element("ui.control", {
        control: "tabs",
        label: "Tabs",
        indicator: "pill",
        leadingIcon: "lucide:bell",
        trailingIcon: "arrow-right",
        iconSize: 24,
        badge: "",
      }),
      id: "b",
      index: "a1",
    },
    {
      ...element("ui.icon", { icon: "lucide:bell", viewBox: 24 }),
      id: "c",
      index: "a2",
    },
  ]);
  expect(validateDocument(document)).toEqual([]);
  const jsonl = serializeDocument(document);
  expect(serializeDocument(parseDocument(jsonl))).toBe(jsonl);
});

test("icon source, names, paths and viewBox are validated", () => {
  for (const semantic of [{}, { icon: "bell", path: "M0 0" }])
    expect(
      issues("ui.icon", semantic).some((i) => i.code === "icon.source"),
    ).toBe(true);
  expect(
    issues("ui.icon", { icon: "Bell" }).some((i) => i.code === "icon.name"),
  ).toBe(true);
  expect(issues("ui.icon", { icon: "lucide:bell" })).toEqual([]);
  expect(
    issues("ui.icon", { path: "M".repeat(8193) }).some(
      (i) => i.code === "icon.path",
    ),
  ).toBe(true);
  expect(issues("ui.icon", { path: "M0 0 L 10 10 Z" })).toEqual([]);
  expect(
    issues("ui.icon", { icon: "bell", viewBox: 0 }).some(
      (i) => i.code === "value.range",
    ),
  ).toBe(true);
});

test("stroke sides, kit, and duplicate flow names are validated", () => {
  expect(
    issues(
      "ui.icon",
      { icon: "bell" },
      { style: { strokeSides: { top: -1 } } },
    ).some((i) => i.path.endsWith("strokeSides.top")),
  ).toBe(true);
  expect(
    issues(
      "ui.icon",
      { icon: "bell" },
      { style: { strokeSides: { middle: 1 } } },
    ).some((i) => i.code === "value.key"),
  ).toBe(true);
  expect(
    issues("frame", { name: "", kit: "list-row" }).some((i) =>
      i.path.endsWith(".kit"),
    ),
  ).toBe(true);
  const frames = [
    element("frame", {
      name: "",
      prototypeStart: true,
      prototypeFlowName: "Flow",
    }),
    {
      ...element("frame", {
        name: "",
        prototypeStart: true,
        prototypeFlowName: "Flow",
      }),
      id: "b",
      index: "a1",
    },
  ];
  expect(
    validateDocument(doc(frames)).filter(
      (i) => i.code === "prototype.flowName.duplicate",
    ),
  ).toHaveLength(1);
});

test("back and swap-overlay prototype actions accept frame targets", () => {
  for (const action of ["back", "swap-overlay"]) {
    const frames = [
      element("frame", { name: "A" }),
      { ...element("frame", { name: "B" }), id: "b", index: "a1" },
      {
        ...element("edge.generic", {
          from: "a",
          to: "b",
          prototype: true,
          prototypeAction: action,
        }),
        id: "c",
        index: "a2",
      },
    ];
    expect(validateDocument(doc(frames))).toEqual([]);
  }
});
