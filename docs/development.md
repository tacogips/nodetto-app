# Development

## Layout

```text
packages/
  ir/        Diagram IR: types, element type registry, validation, migrations
  core/      Editor core (no framework dependencies)
  io/        JSONL persistence, Mermaid/D2/BPMN/draw.io/KiCad adapters,
             breadboard BOM and netlist formatters
  collab/    Yjs client binding (sync server is private)
  ui-solid/  Solid renderer
apps/
  desktop/   Tauri 2 desktop client
```

`ir` and `io` implement the Diagram IR and the deterministic JSONL file
format; see [`packages/ir/README.md`](../packages/ir/README.md) and
[`packages/io/README.md`](../packages/io/README.md). `core` implements the
editor engine - store, commands, camera, selection, history, ShapeUtil
registry and hit testing - and `ui-solid` renders it to SVG and DOM; the
desktop client wires the two together, see
[`apps/desktop/README.md`](../apps/desktop/README.md) for the canvas layout and
the manual gesture checklist. `collab` is still a scaffold.

## Setup

```bash
mise install
bun install
mise run dev
```

## Common Tasks

```bash
mise run check
mise run test        # typecheck + bun test + cargo test
mise run build
mise run tauri-build
mise run lint
```

Frontend unit tests run under `bun test` and live next to their sources as
`packages/*/src/**/*.test.ts`. Pointer and keyboard gestures need a real
pointer, so they are covered by the manual checklist in
[`apps/desktop/README.md`](../apps/desktop/README.md) instead.

mise installs Bun, Rust, and rust-analyzer. Install the native Tauri system
libraries required by your operating system separately.

## Releasing (macOS)

Maintainers release with `mise run release-macos-dmg-local v<version>` after
tagging and pushing `v<version>`; the tag must match the versions in
`apps/desktop/src-tauri/tauri.conf.json` and `apps/cli/package.json`. The
script reads `APPLE_SIGNING_IDENTITY`, `APPLE_ID`, `APPLE_PASSWORD` and
`APPLE_TEAM_ID` from the environment, notarizes and staples the DMG, and
uploads the DMG, a version-free `Nodetto_aarch64.dmg` copy and a zipped app.
The copy keeps
`https://github.com/tacogips/nodetto-app/releases/latest/download/Nodetto_aarch64.dmg`
on the newest release. `mise run bundle-macos` builds the same
bundle locally.

## Mac App Store installation and packaging

`mise run release-macos-app-store-local build` creates a sandboxed app and native CLI
`.pkg` using the local Apple Distribution and Mac Installer Distribution
identities. Inject `APPLE_TEAM_ID` and `NODETTO_APP_STORE_PROFILE_BASE64` through
kinko. The profile must match this app and the installed signing certificate.
Never commit provisioning profiles, API keys, or generated signing material.

Both App Store and direct-download builds include
`Nodetto.app/Contents/MacOS/nodetto-cli`. Homebrew creates the command link
automatically. The App Store installs the executable inside the app bundle;
it does not modify your shell's PATH. Invoke it by its full path, or add:

```bash
export PATH="/Applications/Nodetto.app/Contents/MacOS:$PATH"
```

The App Store CLI is an independent sandboxed entrypoint. Before working on a
project, grant its folder through the native picker:

```bash
nodetto-cli authorize /path/to/project
nodetto-cli --cwd /path/to/project mcp
```

Select the folder containing your JSONL documents, assets and export files.
`--cwd` selects the working directory explicitly; absolute file paths also work.
Access persists across CLI runs using security-scoped bookmarks. Restart an
already-running MCP server after authorizing a folder. MCP clients can also
request the picker with `nodetto_authorize` and `args: ["/path/to/project"]`.
The direct-download/Homebrew CLI has ordinary terminal file access and does
not need this grant. No build uses JIT or executable-memory exceptions.
The Store CLI is never launched as a child of the sandboxed GUI. The GUI
continues to use native file selection and its own persistent bookmarks.

The `upload` mode additionally uses the `APP_STORE_CONNECT_API_KEY_ID`,
`APP_STORE_CONNECT_API_PRIVATE_KEY`, `APP_STORE_CONNECT_ISSUER_ID`, and
`APP_STORE_CONNECT_API_KEY_TYPE` kinko entries. It validates the signed package
before uploading through Apple's API authentication. Private keys are decoded
only into a protected temporary directory and removed when the command exits.

## Shared native services

`crates/native` contains file-write, attachment and security-bookmark mechanisms
used by both desktop and CLI. Host adapters own dialogs, transport and sandbox
identity. Diagram behavior stays in the shared TypeScript packages; Boa hosts
that code for the CLI. See [native host boundaries](../design-docs/specs/native-hosts.md).
