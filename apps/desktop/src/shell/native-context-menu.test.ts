import { expect, test } from "bun:test";
import {
  installNativeContextMenuGuard,
  keepsNativeContextMenu,
} from "./native-context-menu.ts";

const element = (inText: boolean) => ({
  closest: (selector: string) =>
    inText && selector.includes("input") ? {} : null,
});

test("chrome loses the native menu so its Reload cannot drop the document", () => {
  expect(keepsNativeContextMenu(element(false), "")).toBe(false);
  expect(keepsNativeContextMenu(null, "")).toBe(false);
  expect(keepsNativeContextMenu({}, "  ")).toBe(false);
});

test("text fields and selected text keep the native menu for copy and paste", () => {
  expect(keepsNativeContextMenu(element(true), "")).toBe(true);
  expect(keepsNativeContextMenu(element(false), "Page 2")).toBe(true);
});

test("the guard prevents the menu once and leaves handled events alone", () => {
  let listener: ((event: MouseEvent) => void) | undefined;
  let selection = "";
  const host = {
    addEventListener: (_: string, handler: (event: MouseEvent) => void) => {
      listener = handler;
    },
    removeEventListener: () => {
      listener = undefined;
    },
    getSelection: () => ({ toString: () => selection }),
  } as unknown as Window;
  const dispose = installNativeContextMenuGuard(host);
  const fire = (target: unknown, defaultPrevented = false) => {
    let prevented = false;
    listener?.({
      target,
      defaultPrevented,
      preventDefault: () => {
        prevented = true;
      },
    } as unknown as MouseEvent);
    return prevented;
  };
  expect(fire(element(false))).toBe(true);
  expect(fire(element(true))).toBe(false);
  expect(fire(element(false), true)).toBe(false);
  selection = "copy me";
  expect(fire(element(false))).toBe(false);
  dispose();
  expect(listener).toBeUndefined();
});
