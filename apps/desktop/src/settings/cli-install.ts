// Bridge to the Rust installer for the bundled nodetto-cli.
//
// Rust decides everything (what is on the login shell's PATH, whether the app
// runs from a disk image, which startup file to edit); this module only
// carries the result to Settings and maps it to the actions it allows.

import { invoke, isTauri } from "@tauri-apps/api/core";

/** A startup-file line that puts `~/.local/bin` on PATH. */
export interface PathChange {
  readonly file: string;
  readonly line: string;
}

export type CliStatus =
  | { readonly state: "unavailable"; readonly reason: string }
  | {
      /** A nodetto-cli is already on PATH; installing is disabled. */
      readonly state: "onPath";
      readonly path: string;
      readonly resolved: string | null;
      /** True when it is the link this app created. */
      readonly managed: boolean;
    }
  | {
      readonly state: "ready";
      readonly link: string;
      readonly target: string;
      readonly pathChange: PathChange | null;
      /** A link from an earlier install exists but is not on PATH. */
      readonly managedLink: boolean;
    };

export interface CliInstallResult {
  readonly status: CliStatus;
  /** Run in an already open terminal when the PATH change is new. */
  readonly currentTerminal: string | null;
}

export interface CliInstaller {
  status(): Promise<CliStatus>;
  install(): Promise<CliInstallResult>;
  uninstall(): Promise<CliStatus>;
}

/** Undefined outside Tauri, where there is no host to install into. */
export function createCliInstaller(): CliInstaller | undefined {
  if (!isTauri()) return undefined;
  return {
    status: () => invoke<CliStatus>("cli_install_status"),
    install: () => invoke<CliInstallResult>("cli_install"),
    uninstall: () => invoke<CliStatus>("cli_uninstall"),
  };
}

export interface CliActions {
  readonly canInstall: boolean;
  readonly canUninstall: boolean;
}

export function cliActions(status: CliStatus | undefined): CliActions {
  if (status?.state === "ready")
    return { canInstall: true, canUninstall: status.managedLink };
  if (status?.state === "onPath")
    return { canInstall: false, canUninstall: status.managed };
  return { canInstall: false, canUninstall: false };
}
