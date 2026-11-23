import { createSignal, For, Show, type JSX } from "solid-js";
import type {
  CaptureCameraRequest,
  CaptureTheme,
  CaptureView,
} from "@nodetto/core";
import type { Camera3d } from "./cad/camera3d.ts";
import { captureRequestFromCamera } from "./cad/capture-camera.ts";

export function CadImageExportSection(props: {
  captureCadImage: (options: {
    camera: CaptureCameraRequest;
    format: "png" | "jpg";
    theme: CaptureTheme;
    width: number;
    height: number;
  }) => Promise<void>;
  cadCurrentView?: () => Camera3d | undefined;
  canvasMode?: "light" | "dark";
}): JSX.Element {
  const current = props.cadCurrentView?.();
  const [view, setView] = createSignal<string>(current ? "current" : "iso");
  const [format, setFormat] = createSignal<"png" | "jpg">("png");
  const [size, setSize] = createSignal("1024x768");
  const [busy, setBusy] = createSignal(false);
  const [error, setError] = createSignal("");
  const views: readonly [CaptureView, string][] = [
    ["iso", "Isometric"],
    ["front", "Front"],
    ["back", "Back"],
    ["left", "Left"],
    ["right", "Right"],
    ["top", "Top"],
    ["bottom", "Bottom"],
  ];
  const run = async () => {
    if (busy()) return;
    setBusy(true);
    setError("");
    try {
      const [width, height] = size().split("x").map(Number);
      const camera =
        view() === "current" && current
          ? captureRequestFromCamera(current)
          : { view: view() as CaptureView };
      await props.captureCadImage({
        camera,
        format: format(),
        theme: props.canvasMode ?? "light",
        width: width ?? 1024,
        height: height ?? 768,
      });
    } catch (e) {
      setError(e instanceof Error ? e.message : "Export failed.");
    } finally {
      setBusy(false);
    }
  };
  return (
    <section class="nodetto-inspector-section">
      <label>
        View
        <select
          aria-label="CAD image view"
          value={view()}
          onChange={(e) => setView(e.currentTarget.value)}
        >
          <Show when={current}>
            <option value="current">Current view</option>
          </Show>
          <For each={views}>
            {([value, label]) => <option value={value}>{label}</option>}
          </For>
        </select>
      </label>
      <p>Orthographic projection</p>
      <label>
        Format
        <select
          aria-label="CAD image format"
          value={format()}
          onChange={(e) =>
            setFormat(e.currentTarget.value === "jpg" ? "jpg" : "png")
          }
        >
          <option value="png">PNG</option>
          <option value="jpg">JPG</option>
        </select>
      </label>
      <label>
        Size
        <select
          aria-label="CAD image size"
          value={size()}
          onChange={(e) => setSize(e.currentTarget.value)}
        >
          <option value="1024x768">1024 x 768</option>
          <option value="1600x1200">1600 x 1200</option>
          <option value="2048x1536">2048 x 1536</option>
        </select>
      </label>
      <button
        type="button"
        class="nodetto-export-primary"
        disabled={busy()}
        onClick={() => void run()}
      >
        Export
      </button>
      <Show when={error()}>
        <p role="alert">{error()}</p>
      </Show>
    </section>
  );
}
