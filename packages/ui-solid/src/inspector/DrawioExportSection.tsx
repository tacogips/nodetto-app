import type { Editor } from "@nodetto/core";
import { exportDrawio } from "@nodetto/io/drawio";
import type { PageId } from "@nodetto/ir";
import { createMemo, createSignal, For, type JSX, Show } from "solid-js";
import { createEditorSignals } from "../adapter.ts";

function fileStem(value: string): string {
  return (
    value
      .normalize("NFKD")
      .replace(/[^a-zA-Z0-9_-]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .toLowerCase() || "diagram"
  );
}

/** Download an editable draw.io file of every page or only the current one. */
export function DrawioExportSection(props: {
  readonly editor: Editor;
  readonly pageId: PageId;
}): JSX.Element {
  const signals = createEditorSignals(props.editor);
  const [allPages, setAllPages] = createSignal(true);
  const [status, setStatus] = createSignal("");
  const report = createMemo(() => {
    signals.rev();
    return exportDrawio(
      props.editor.getSnapshot(),
      allPages() ? {} : { pageIds: [props.pageId] },
    );
  });
  const download = (): void => {
    const snapshot = props.editor.getSnapshot();
    const name = allPages()
      ? snapshot.title
      : (props.editor.store.getPage(props.pageId)?.name ?? snapshot.title);
    const url = URL.createObjectURL(
      new Blob([report().xml], { type: "application/xml;charset=utf-8" }),
    );
    const link = document.createElement("a");
    link.href = url;
    link.download = `${fileStem(name)}.drawio`;
    document.body.append(link);
    try {
      link.click();
      setStatus("draw.io download requested.");
    } finally {
      link.remove();
      setTimeout(() => URL.revokeObjectURL(url), 1000);
    }
  };

  return (
    <section class="nodetto-inspector-section">
      <label>
        <input
          type="checkbox"
          checked={allPages()}
          onChange={(event) => setAllPages(event.currentTarget.checked)}
        />
        Include every page
      </label>
      <button type="button" onClick={download}>
        Download .drawio
      </button>
      <Show when={report().warnings.length > 0}>
        <ul>
          <For each={report().warnings}>
            {(warning) => (
              <li>
                {warning.elementId
                  ? `${warning.elementId}: ${warning.message}`
                  : warning.message}
              </li>
            )}
          </For>
        </ul>
      </Show>
      <p role="status">{status()}</p>
    </section>
  );
}

export default DrawioExportSection;
