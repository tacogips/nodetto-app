// Desktop entry point.
//
// Starts with an empty untitled document, wires the document session to
// the host filesystem, and mounts the Solid app. Explicit file-open requests
// are handled by the launch backend.
//
// The packaged desktop client owns local files only. Cloud sessions are supplied
// by the separately hosted web entry point, never by this application.

import { createDefaultRegistry, Editor } from "@nodetto/core";
import { render } from "solid-js/web";
import { App } from "./App.tsx";
import { createExportBackend, createFileBackend } from "./file/backend.ts";
import { createLaunchBackend } from "./file/launch.ts";
import { installCloseGuard } from "./file/close.ts";
import { DocumentSession } from "./file/session.ts";
import {
  applyTheme,
  resolveTheme,
  SYSTEM_DARK_QUERY,
} from "./settings/appearance.ts";
import { createCliInstaller } from "./settings/cli-install.ts";
import { loadEditorPreferences } from "./settings/preferences.ts";
import "./style.css";
import "./inspector.css";

const root = document.querySelector<HTMLElement>("#app");
if (!root) {
  throw new Error("Missing #app root element");
}

const editor = new Editor({ registry: createDefaultRegistry() });

const backend = createFileBackend();
const session = new DocumentSession({ editor, backend });
// Exports share the dialog and atomic-write commands but not the session:
// an export never changes which file is open.
const exportBackend = createExportBackend();

// The native window waits for writes before closing, including Cmd/Ctrl+Q.
void installCloseGuard(session).catch((error) => {
  console.error("Could not install document close guard", error);
});

try {
  let storage: Storage | undefined;
  try {
    storage = window.localStorage;
  } catch {
    storage = undefined;
  }
  const preferences = loadEditorPreferences(storage);
  const systemDark = window.matchMedia?.(SYSTEM_DARK_QUERY).matches ?? false;
  applyTheme(
    document.documentElement,
    resolveTheme(preferences.theme, systemDark),
  );
} catch {
  // Rendering must continue if the environment blocks appearance detection.
}

render(
  () => (
    <App
      editor={editor}
      session={session}
      filesAvailable={backend.available}
      exportBackend={exportBackend}
      launchBackend={createLaunchBackend()}
      cliInstaller={createCliInstaller()}
    />
  ),
  root,
);
