# Installing Nodetto

## macOS

Signed and notarized builds are published as GitHub releases and through the
`tacogips/tap` Homebrew tap:

```bash
brew install --cask tacogips/tap/nodetto
```

The cask installs the local-only `Nodetto.app` and links the bundled
`nodetto-cli` command. With the DMG instead, open **Settings > Command line**
and choose **Install nodetto-cli**: it links `~/.local/bin/nodetto-cli` to the
copy inside the app, so app updates update the command, and adds
`~/.local/bin` to your login shell's PATH when it is missing (`~/.zprofile`,
`~/.bash_profile`, or `~/.config/fish/conf.d/nodetto.fish`; the panel shows
the file and line first). Install is disabled, and the panel shows the path,
when your shell already finds a `nodetto-cli` (for example the Homebrew link),
and while the app runs from the disk image. **Uninstall** removes only the
link. The App Store build cannot install outside its sandbox. The desktop client does not create a cloud session or
show cloud/account controls; cloud workspaces belong to the hosted web edition.
Open a document from a terminal with `nodetto-cli open path/to/file.jsonl`
(or `open -a nodetto path/to/file.jsonl` on macOS);
Finder "Open With" also lists nodetto for `.jsonl`, `.mmd`, `.mermaid`, `.bpmn`,
`.drawio` and `.dio` files without becoming their default application. KiCad
`.kicad_sch` and `.net` files, Gerber and drill files and Gerber ZIPs are not
associated; open them from the Open dialog. A path passed while the app
is running opens in the existing window (after the usual unsaved-changes
prompt).

## Linux

The `Linux desktop and CLI` GitHub Actions workflow builds x86_64 Linux `.deb`
and AppImage packages, each including `nodetto-cli`, plus a standalone CLI tarball.
It uses Ubuntu 22.04 and WebKitGTK 4.1. The CLI needs no Node.js or Bun runtime.
Install the Debian package with `sudo apt install ./Nodetto_VERSION_amd64.deb`,
or run the AppImage after making it executable. For the standalone CLI, extract
its tarball and place `nodetto-cli` in a directory on your PATH.

Run the workflow manually with an empty `release_tag` for build artifacts only.
Set `release_tag` to an existing release such as `v0.4.0` to build that exact
source tag and attach Linux downloads to its release. The workflow also runs on
future version tags. It preserves existing release notes and macOS assets and
never overwrites an existing download. CLI unit/parity tests and package-content
checks run before publication.
