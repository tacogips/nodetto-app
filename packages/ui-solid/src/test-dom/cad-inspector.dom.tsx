import assert from "node:assert/strict";
import {
  type CadEngineInput,
  type CadEngineResult,
  Editor,
} from "@nodetto/core";
import { render } from "solid-js/web";
import { isPlainObject } from "@nodetto/ir";
import { scanCadPage } from "../../../core/src/cad/history.ts";
import {
  cadElement,
  plateWithHoles,
} from "../../../core/src/cad/testing/documents.ts";
import {
  boardReference,
  PCB_TEST_PAGE,
  testBoard,
} from "../../../core/src/cad/testing/pcb.ts";
import {
  earlierExtrudeBodies,
  targetSelectionWork,
} from "../cad/extrude-targets.ts";
import { NodettoCanvas } from "../Canvas.tsx";
import { Inspector } from "../Inspector.tsx";
import { Layers } from "../Layers.tsx";
import { Tool } from "../tools.ts";
import { preloadCadUi } from "../cad-ui.tsx";

await preloadCadUi();

globalThis.getComputedStyle = window.getComputedStyle.bind(window);

function key(target: HTMLElement, value: string): void {
  target.dispatchEvent(
    new KeyboardEvent("keydown", {
      key: value,
      bubbles: true,
      cancelable: true,
    }),
  );
}

function change(
  control: HTMLInputElement | HTMLSelectElement,
  value: string,
): void {
  control.value = value;
  control.dispatchEvent(new Event("change", { bubbles: true }));
}

function countTargetQueries(n: number): number {
  const editor = new Editor({ document: plateWithHoles(1) });
  editor.setCurrentPage("cad");
  const bodies = Array.from({ length: n - 1 }, (_, i) =>
    cadElement(`extra-${i}`, "cad.extrude", "a2", {
      sketch: "base",
      name: `extra-${i}`,
      distance: 5,
      op: "new",
    }),
  );
  for (const body of bodies)
    editor.apply([{ type: "createElement", element: body }]);
  const cut = editor.store.get("ex2");
  assert.ok(cut);
  assert.ok(isPlainObject(cut.semantic));
  const listed = earlierExtrudeBodies(
    editor.store.getPageElements("cad"),
    cut,
  ).map((body) => body.id);
  assert.equal(listed.length, n);
  editor.apply([
    {
      type: "updateSemantic",
      id: cut.id,
      semantic: { ...cut.semantic, bodies: [...listed].reverse() },
    },
  ]);
  editor.selection.set([cut.id]);
  const root = document.createElement("main");
  document.body.append(root);
  const dispose = render(() => <Inspector editor={editor} simple />, root);
  const switches = root.querySelectorAll<HTMLInputElement>(
    '[aria-label="Target bodies"] input[role="switch"]',
  );
  assert.equal(switches.length, n);
  Object.assign(targetSelectionWork, { builds: 0, visits: 0, queries: 0 });
  const first = switches[0];
  assert.ok(first);
  first.click();
  assert.equal(targetSelectionWork.builds, 1);
  assert.ok(targetSelectionWork.queries > 0);
  const semantic = editor.store.get(cut.id)?.semantic;
  assert.ok(isPlainObject(semantic));
  assert.deepEqual(semantic.bodies, listed.slice(1));
  const queries = targetSelectionWork.queries;
  dispose();
  root.remove();
  return queries;
}

for (const theme of ["light", "dark"] as const) {
  document.documentElement.dataset.nodettoTheme = theme;
  const smallQueries = countTargetQueries(16);
  assert.equal(countTargetQueries(32), 2 * smallQueries);
  const model = plateWithHoles(1);
  const editor = new Editor({
    document: {
      ...model,
      pages: [
        ...model.pages,
        { id: "drawing", kind: "freeform", name: "Drawing" },
      ],
    },
  });
  editor.setCurrentPage("cad");
  const root = document.createElement("main");
  document.body.append(root);
  const requests: {
    input: CadEngineInput;
    complete: (result: CadEngineResult) => void;
  }[] = [];
  const dispose = render(
    () => (
      <>
        <Layers editor={editor} simple />
        <NodettoCanvas
          editor={editor}
          tool={Tool.Select}
          canvasBackground={{ diagram: theme, pcb: theme }}
          snap={{ grid: false, objects: false }}
          showGrid={false}
          createCadRenderer={() => null}
          cadEngine={{
            evaluate: (input) =>
              new Promise((complete) => requests.push({ input, complete })),
            dispose: () => {},
          }}
        />
        <Inspector editor={editor} simple />
      </>
    ),
    root,
  );
  const find = <T extends HTMLElement>(selector: string) => {
    const item = root.querySelector<T>(selector);
    assert.ok(item, selector);
    return item;
  };
  const names = () => [
    ...root.querySelectorAll<HTMLButtonElement>(".nodetto-layer-name"),
  ];
  const rowName = (text: string) => {
    const button = names().find((item) => item.title.startsWith(`${text} (`));
    assert.ok(button, text);
    return button;
  };
  const input = (label: string) =>
    find<HTMLInputElement>(`input[aria-label="${label}"]`);
  const respond = async (
    properties: Omit<CadEngineResult, "revision" | "bodies">,
  ) => {
    const request = requests.at(-1);
    assert.ok(request);
    request.complete({
      revision: request.input.revision,
      bodies: [],
      ...properties,
    });
    await Promise.resolve();
  };

  assert.match(names()[0]?.title ?? "", /^base /);
  const hole = rowName("Circle 3 mm");
  assert.equal(
    hole.closest<HTMLElement>(".nodetto-layer-row")?.style.paddingLeft,
    "22px",
  );
  hole.click();
  key(hole, "F2");
  assert.equal(root.querySelector('[aria-label="Rename layer"]'), null);
  const radius = input("Radius (mm)");
  assert.equal(
    radius.closest("[role=tabpanel]")?.hasAttribute("hidden"),
    false,
  );
  const undoSize = editor.history.undoSize;
  const requestCount = requests.length;
  change(radius, "6.0000004");
  assert.equal(radius.value, "6");
  assert.equal(editor.history.undoSize, undoSize + 1);
  assert.equal(requests.length, requestCount + 1);
  assert.ok(
    requests
      .at(-1)
      ?.input.elements.some(
        ({ id, semantic }) =>
          id === "hole-0" && JSON.stringify(semantic).includes('"r":6'),
      ),
  );
  change(radius, "0");
  assert.equal(radius.value, "6");
  assert.match(root.textContent ?? "", /radius must be positive/);
  assert.equal(editor.history.undoSize, undoSize + 1);
  change(radius, "6.0");
  assert.equal(editor.history.undoSize, undoSize + 1);
  editor.undo();
  assert.equal(radius.value, "3");
  editor.redo();
  assert.equal(radius.value, "6");

  rowName("ex2").click();
  await respond({
    status: [
      ["ex1", { ok: true }],
      ["ex2", { ok: false, code: "cad.result.empty" }],
    ],
  });
  assert.equal(
    rowName("ex2").querySelector(".nodetto-layer-cad-status")?.textContent,
    "cad.result.empty",
  );
  assert.equal(rowName("ex1").querySelector(".nodetto-layer-cad-status"), null);
  assert.equal(
    find('output[aria-label="CAD status"]').textContent,
    "cad.result.empty",
  );
  assert.equal(input("CAD name").value, "ex2");
  key(rowName("ex2"), "F2");
  const rename = input("Rename layer");
  rename.value = "  Relief  ";
  key(rename, "Enter");
  assert.equal(input("CAD name").value, "Relief");
  assert.equal(editor.store.get("ex2")?.visual.layerName, undefined);
  assert.equal(rowName("Relief").textContent?.includes("Relief"), true);
  const operation = find<HTMLSelectElement>('select[aria-label="Operation"]');
  const group = find('[aria-label="Target bodies"]');
  assert.match(group.textContent ?? "", /ex1/);
  assert.doesNotMatch(group.textContent ?? "", /Relief/);
  change(operation, "new");
  assert.equal(root.querySelector('[aria-label="Target bodies"]'), null);
  assert.ok(!Object.hasOwn(editor.store.get("ex2")?.semantic ?? {}, "bodies"));
  editor.undo();
  assert.equal(operation.value, "cut");
  assert.ok(
    find<HTMLInputElement>('[aria-label="Target bodies"] input').checked,
  );

  const fields = (id: string) => {
    const value = editor.store.get(id)?.semantic;
    assert.ok(isPlainObject(value));
    return value;
  };
  // Base-plane edits are separate history entries and preserve the offset.
  rowName("base").click();
  const baseElement = editor.store.get("base");
  assert.ok(baseElement);
  editor.apply([
    {
      type: "updateSemantic",
      id: "base",
      semantic: { name: "base", plane: { base: "xy", offset: 5 } },
    },
  ]);
  const plane = find<HTMLSelectElement>('select[aria-label="Base plane"]');
  change(plane, "yz");
  assert.deepEqual(fields("base").plane, {
    base: "yz",
    offset: 5,
  });
  change(plane, "zx");
  assert.deepEqual(fields("base").plane, {
    base: "zx",
    offset: 5,
  });
  assert.ok(editor.undo());
  assert.deepEqual(fields("base").plane, {
    base: "yz",
    offset: 5,
  });
  assert.ok(editor.undo());
  assert.deepEqual(fields("base").plane, {
    base: "xy",
    offset: 5,
  });
  editor.apply([
    { type: "updateVisual", id: "base", visual: { locked: true } },
  ]);
  assert.equal(plane.disabled, true);
  editor.setReadOnly(true);
  assert.equal(plane.disabled, true);
  editor.setReadOnly(false);
  editor.apply([
    { type: "updateVisual", id: "base", visual: { locked: false } },
  ]);
  editor.apply([
    { type: "updateSemantic", id: "base", semantic: baseElement.semantic },
  ]);

  const second = cadElement("second", "cad.extrude", "a2V", {
    sketch: "base",
    name: "second",
    distance: 5,
    op: "new",
  });
  editor.apply([{ type: "createElement", element: second }]);
  const originalCut = editor.store.get("ex2");
  assert.ok(originalCut);
  editor.apply([
    {
      type: "updateSemantic",
      id: "ex2",
      semantic: { ...fields("ex2"), bodies: ["ex1", "second"] },
    },
  ]);
  rowName("Relief").click();
  const currentOperation = find<HTMLSelectElement>(
    'select[aria-label="Operation"]',
  );
  const valid = () =>
    assert.equal(
      scanCadPage(editor.store.getPageElements("cad")).status.get("ex2")?.ok,
      true,
    );
  change(currentOperation, "add");
  assert.deepEqual(fields("ex2").bodies, ["ex1"]);
  valid();
  const secondLabel = [...root.querySelectorAll("label")].find(
    (label) => label.textContent === "second",
  );
  assert.ok(secondLabel);
  const secondSwitch = secondLabel.querySelector<HTMLInputElement>(
    'input[role="switch"]',
  );
  assert.ok(secondSwitch);
  secondSwitch.click();
  assert.deepEqual(fields("ex2").bodies, ["second"]);
  valid();
  const beforeUncheck = editor.history.undoSize;
  secondSwitch.click();
  assert.equal(secondSwitch.checked, true);
  assert.equal(editor.history.undoSize, beforeUncheck);
  assert.ok(editor.undo());
  assert.deepEqual(fields("ex2").bodies, ["ex1"]);
  valid();
  assert.ok(editor.undo());
  assert.deepEqual(fields("ex2").bodies, ["ex1", "second"]);
  valid();
  editor.apply([
    { type: "updateSemantic", id: "ex2", semantic: originalCut.semantic },
    { type: "deleteElements", ids: ["second"] },
  ]);

  await respond({ status: [], failure: "cad.kernel.failed" });
  assert.equal(
    find('output[aria-label="CAD status"]').textContent,
    "cad.kernel.failed",
  );
  assert.equal(
    rowName("ex1").querySelector(".nodetto-layer-cad-status")?.textContent,
    "cad.kernel.failed",
  );

  const feature = rowName("Relief");
  assert.equal(feature.getAttribute("draggable"), "true");
  assert.notEqual(rowName("Circle 6 mm").getAttribute("draggable"), "true");
  const dataTransfer = new window.DataTransfer();
  const dragStart = new MouseEvent("dragstart", { bubbles: true });
  Object.defineProperty(dragStart, "dataTransfer", { value: dataTransfer });
  feature.dispatchEvent(dragStart);
  assert.equal(
    dataTransfer.getData("application/x-nodetto-cad-feature"),
    "ex2",
  );
  const anchor = rowName("base");
  const drop = new MouseEvent("drop", {
    clientY: -1,
    bubbles: true,
    cancelable: true,
  });
  Object.defineProperty(drop, "dataTransfer", { value: dataTransfer });
  anchor.closest(".nodetto-layer-row")?.dispatchEvent(drop);
  assert.ok(drop.defaultPrevented);
  assert.match(names()[0]?.title ?? "", /^Relief /);
  editor.undo();
  assert.match(names()[0]?.title ?? "", /^base /);

  rowName("Circle 6 mm").click();
  key(rowName("Circle 6 mm"), "Delete");
  assert.equal(editor.store.get("hole-0"), undefined);
  editor.undo();
  assert.ok(editor.store.has("hole-0"));
  rowName("Relief").click();
  key(find(".nodetto-cad-viewport"), "Escape");
  assert.equal(editor.selection.size, 0);

  editor.setCurrentPage("drawing");
  await respond({ status: [["ex2", { ok: false, code: "cad.limit" }]] });
  editor.setCurrentPage("cad");
  rowName("Relief").click();
  assert.equal(root.querySelector('output[aria-label="CAD status"]'), null);
  assert.equal(root.querySelector(".nodetto-layer-cad-status"), null);

  const secondPage = {
    ...PCB_TEST_PAGE,
    id: "expansion",
    name: "Expansion board",
    order: "A",
  };
  const secondBoard = {
    ...testBoard(2),
    id: "expansion-board",
    page: secondPage.id,
  };
  const reference = {
    ...boardReference(),
    semantic: { name: "", board: "board" },
  };
  editor.apply([
    { type: "createPage", page: PCB_TEST_PAGE },
    { type: "createPage", page: secondPage },
    { type: "createElement", element: testBoard() },
    { type: "createElement", element: secondBoard },
    { type: "createElement", element: reference },
  ]);
  rowName("PCB board").click();
  const boards = find<HTMLSelectElement>('select[aria-label="PCB board"]');
  const thickness = input("Thickness (mm)");
  assert.equal(boards.value, "board");
  assert.deepEqual(
    [...boards.options].map(({ textContent }) => textContent),
    ["Circuit", "Expansion board"],
  );
  const beforeBoardEdit = editor.history.undoSize;
  change(boards, secondBoard.id);
  assert.equal(editor.history.undoSize, beforeBoardEdit + 1);
  assert.equal(boards.value, secondBoard.id);
  assert.deepEqual(editor.store.get(reference.id)?.semantic, {
    name: "",
    board: secondBoard.id,
  });
  change(thickness, "0");
  assert.equal(thickness.value, "");
  assert.match(root.textContent ?? "", /thickness greater than 0/);
  change(thickness, "2.5");
  assert.equal(thickness.value, "2.5");
  change(thickness, "");
  assert.deepEqual(editor.store.get(reference.id)?.semantic, {
    name: "",
    board: secondBoard.id,
  });
  assert.equal(editor.history.undoSize, beforeBoardEdit + 3);
  assert.ok(editor.undo());
  assert.equal(thickness.value, "2.5");
  editor.apply([{ type: "deletePage", id: secondPage.id }]);
  assert.equal(boards.value, "");
  assert.equal(boards.selectedOptions[0]?.textContent, "Choose a board");
  assert.equal(boards.disabled, false);
  change(boards, "board");
  assert.equal(boards.value, "board");
  dispose();
  root.remove();
  console.log(`ok ${theme}`);
}
