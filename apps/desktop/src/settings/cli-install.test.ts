import { describe, expect, test } from "bun:test";
import { cliActions, type CliStatus } from "./cli-install.ts";

const ready = (managedLink: boolean): CliStatus => ({
  state: "ready",
  link: "/Users/me/.local/bin/nodetto-cli",
  target: "/Applications/Nodetto.app/Contents/MacOS/nodetto-cli",
  pathChange: null,
  managedLink,
});

const onPath = (managed: boolean): CliStatus => ({
  state: "onPath",
  path: "/opt/homebrew/bin/nodetto-cli",
  resolved: "/Applications/Nodetto.app/Contents/MacOS/nodetto-cli",
  managed,
});

describe("cliActions", () => {
  test("installing is allowed only when the installer is ready", () => {
    expect(cliActions(ready(false))).toEqual({
      canInstall: true,
      canUninstall: false,
    });
    expect(cliActions(undefined)).toEqual({
      canInstall: false,
      canUninstall: false,
    });
    expect(cliActions({ state: "unavailable", reason: "App Store" })).toEqual({
      canInstall: false,
      canUninstall: false,
    });
  });

  test("a nodetto-cli already on PATH disables installing", () => {
    expect(cliActions(onPath(false))).toEqual({
      canInstall: false,
      canUninstall: false,
    });
  });

  test("links created by the app can be uninstalled", () => {
    expect(cliActions(onPath(true))).toEqual({
      canInstall: false,
      canUninstall: true,
    });
    expect(cliActions(ready(true))).toEqual({
      canInstall: true,
      canUninstall: true,
    });
  });
});
