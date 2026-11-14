import { expect, test } from "bun:test";
import { parseDocument } from "@nodetto/io";
import { runCli, type CommandIo } from "./commands.ts";

const doc =
  '{"kind":"document","schemaVersion":1,"id":"doc","title":"Test"}\n{"kind":"page","id":"p1","name":"Main","pageKind":"freeform"}\n';
function ioFor(ops: unknown[]): CommandIo & { files: Map<string, string> } {
  const files = new Map([
    ["doc", doc],
    ["ops", JSON.stringify(ops)],
  ]);
  return {
    files,
    readText: (path) => {
      const value = files.get(path);
      if (value === undefined) throw new Error("ENOENT");
      return value;
    },
    writeText: (path, value) => {
      files.set(path, value);
    },
  };
}
test("kit shape discovery lists components and properties", () => {
  const io = ioFor([]);
  expect(runCli(["shapes"], io, "test").stdout).toContain("ios:nav-bar");
  const details = runCli(["shapes", "ios:tab-bar"], io, "test");
  expect(details.exitCode).toBe(0);
  for (const field of ["items", "active", "activeColor"])
    expect(details.stdout).toContain(field);
});
test("kit insertion and property update through edit", () => {
  const io = ioFor([
    { op: "add", page: "p1", shape: "frame:iphone", ref: "s" },
    { op: "add", page: "p1", shape: "ios:nav-bar", parent: "@s", ref: "nav" },
    { op: "update", id: "@nav", props: { title: "Inbox" } },
  ]);
  const result = runCli(["edit", "doc", "--ops", "ops"], io, "test");
  expect(result.stderr).toBe("");
  expect(result.exitCode).toBe(0);
  const document = parseDocument(io.files.get("doc") ?? "");
  expect(
    document.elements.some(
      (e) =>
        e.type === "text.note" &&
        (e.semantic as { text?: string }).text === "Inbox",
    ),
  ).toBe(true);
});
test("properties on a non-kit element fail", () => {
  const io = ioFor([
    { op: "add", page: "p1", shape: "flowchart:process", ref: "r" },
    { op: "update", id: "@r", props: { title: "A" } },
  ]);
  expect(runCli(["edit", "doc", "--ops", "ops"], io, "test").exitCode).toBe(2);
});

test("status bar added to an iPhone starts at its top and fills its width", () => {
  const io = ioFor([
    {
      op: "add",
      page: "p1",
      shape: "frame:iphone",
      ref: "phone",
      visual: { x: 50, y: 100 },
    },
    { op: "add", page: "p1", shape: "ios:status-bar", parent: "@phone" },
  ]);
  const result = runCli(["edit", "doc", "--ops", "ops"], io, "test");
  expect(result.exitCode).toBe(0);
  expect(result.stderr).toBe("");
  const document = parseDocument(io.files.get("doc") ?? "");
  const definition = document.elements.find(
    (element) =>
      element.type === "frame" &&
      (element.semantic as { kit?: string }).kit === "ios:status-bar@1" &&
      (element.semantic as { component?: boolean }).component,
  );
  expect(definition).toBeDefined();
  const instance = document.elements.find(
    (element) =>
      element.type === "frame" &&
      (element.semantic as { instanceOf?: string }).instanceOf ===
        definition?.id,
  );
  expect(instance?.page).toBe("p1");
  expect(instance?.visual).toMatchObject({ x: 50, y: 100, width: 390 });
});

test("tab items reflow, show a badge and preserve custom colors across updates", () => {
  const io = ioFor([
    {
      op: "add",
      page: "p1",
      shape: "ios:tab-bar",
      ref: "tabs",
      props: {
        items: [
          { label: "One", icon: "house" },
          { label: "Two", icon: "bell", badge: 3 },
          { label: "Three", icon: "search" },
        ],
        active: 1,
        activeColor: "#123456",
        inactiveColor: "#654321",
      },
    },
    { op: "update", id: "@tabs", props: { active: 2 } },
  ]);
  const result = runCli(["edit", "doc", "--ops", "ops"], io, "test");
  expect(result.exitCode).toBe(0);
  expect(result.stderr).toBe("");
  const document = parseDocument(io.files.get("doc") ?? "");
  const child = (key: string) =>
    document.elements.find(
      (element) => element.page === "p1" && element.visual.componentKey === key,
    );
  expect(child("item4")?.visual.hidden).toBe(true);
  expect(child("item1")?.visual.width).toBe(130);
  expect(child("item3")?.visual.x).toBe((child("item1")?.visual.x ?? 0) + 260);
  expect((child("item2Badge")?.semantic as { text?: string }).text).toBe("3");
  expect(child("item2Badge")?.visual.hidden).not.toBe(true);
  expect(child("item2BadgeBackground")?.visual.hidden).not.toBe(true);
  expect(child("item2BadgeBackground")?.visual.style?.fill).toBe("#ff3b30");
  expect(child("item3Icon")?.visual.style?.stroke).toBe("#123456");
  expect(child("item2Icon")?.visual.style?.stroke).toBe("#654321");
});
