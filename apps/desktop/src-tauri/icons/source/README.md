# Nodetto application icon

The editable source is `nodetto-icon.svg`: a continuous N-shaped connector,
ivory on a deep teal tile, with an accent node marking the next idea.
The optical inset and transparent margins are intentional for the macOS Dock.

From the repository root, regenerate with:

```sh
bun run tauri icon src-tauri/icons/source/nodetto-icon.svg --output src-tauri/icons
```

Commit the desktop PNGs, `icon.icns`, and `icon.ico`. The Tauri command also
generates mobile and Appx assets; those are not currently consumed by this app.
