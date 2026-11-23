// Deferred entry points of the 3D CAD interface.
//
// The viewport, the feature inspector and the 3D image export section are
// only needed on a `cad3d` page. Loading them on first use keeps their code
// (renderer, sketch tools, mesh I/O) out of the startup bundle of documents
// that never open such a page.
import { type Component, type JSX, createSignal } from "solid-js";
import { Dynamic } from "solid-js/web";
import type { CadImageExportSection as ImageSection } from "./CadImageExportSection.tsx";
import type { CadViewportProps } from "./cad/CadViewport.tsx";
import type { CadSection as FeatureSection } from "./inspector/CadSection.tsx";

interface Deferred<P> {
  (props: P): JSX.Element;
  preload(): Promise<void>;
}

/**
 * A component that renders nothing until its module has loaded and renders
 * synchronously afterwards, unlike `lazy`, whose first render always
 * suspends. A failed load is retried on the next mount.
 */
function deferred<P extends object>(
  load: () => Promise<Component<P>>,
): Deferred<P> {
  const [component, setComponent] = createSignal<Component<P>>();
  let pending: Promise<void> | undefined;
  const preload = (): Promise<void> => {
    pending ??= load().then(
      (loaded) => {
        setComponent(() => loaded);
      },
      (error: unknown) => {
        pending = undefined;
        console.error("Could not load the 3D CAD interface.", error);
      },
    );
    return pending;
  };
  const view = (props: P): JSX.Element => {
    void preload();
    return <Dynamic component={component()} {...props} />;
  };
  return Object.assign(view, { preload });
}

export const CadViewport = deferred<CadViewportProps>(() =>
  import("./cad/CadViewport.tsx").then((module) => module.CadViewport),
);

export const CadSection = deferred<Parameters<typeof FeatureSection>[0]>(() =>
  import("./inspector/CadSection.tsx").then((module) => module.CadSection),
);

export const CadImageExportSection = deferred<
  Parameters<typeof ImageSection>[0]
>(() =>
  import("./CadImageExportSection.tsx").then(
    (module) => module.CadImageExportSection,
  ),
);

/** Load every deferred CAD component; later mounts are synchronous. */
export async function preloadCadUi(): Promise<void> {
  await Promise.all([
    CadViewport.preload(),
    CadSection.preload(),
    CadImageExportSection.preload(),
  ]);
}
