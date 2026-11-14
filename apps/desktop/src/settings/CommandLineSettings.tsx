import {
  createResource,
  createSignal,
  type JSX,
  Match,
  Show,
  Switch,
} from "solid-js";
import {
  cliActions,
  type CliInstaller,
  type CliStatus,
} from "./cli-install.ts";

interface Notice {
  readonly kind: "done" | "error";
  readonly text: string;
  readonly command?: string;
}

function errorText(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

export function CommandLineSettings(props: {
  readonly installer: CliInstaller;
}): JSX.Element {
  const [status, { mutate, refetch }] = createResource<CliStatus>(() =>
    props.installer.status(),
  );
  const [busy, setBusy] = createSignal(false);
  const [notice, setNotice] = createSignal<Notice>();
  // Reading `latest` rethrows a failed check, so read it only when resolved.
  const current = () =>
    status.state === "ready" || status.state === "refreshing"
      ? status.latest
      : undefined;
  const actions = () => cliActions(current());
  const run = async (work: () => Promise<Notice>) => {
    setBusy(true);
    setNotice(undefined);
    try {
      setNotice(await work());
    } catch (error) {
      setNotice({ kind: "error", text: errorText(error) });
    } finally {
      setBusy(false);
    }
  };
  const install = () =>
    run(async () => {
      const result = await props.installer.install();
      mutate(result.status);
      return result.currentTerminal
        ? {
            kind: "done",
            text: "Installed. New terminals find nodetto-cli; in a terminal that is already open, run:",
            command: result.currentTerminal,
          }
        : { kind: "done", text: "Installed. Terminals find nodetto-cli now." };
    });
  const uninstall = () =>
    run(async () => {
      mutate(await props.installer.uninstall());
      return {
        kind: "done",
        text: "Removed the nodetto-cli link. The PATH entry for ~/.local/bin was kept because other tools may use it.",
      };
    });
  return (
    <div class="app-settings-cli">
      <p>
        Make the nodetto-cli bundled with this app available in terminals. It is
        linked, not copied, so updating the app updates the command.
      </p>
      <Show
        when={current()}
        fallback={
          <p role="status">
            {status.error
              ? `Could not check your PATH: ${errorText(status.error)}`
              : "Checking your PATH..."}
          </p>
        }
      >
        {(resolved) => <StatusDetails status={resolved()} />}
      </Show>
      <div class="app-settings-cli-actions">
        <button
          type="button"
          disabled={busy() || !actions().canInstall}
          onClick={install}
        >
          Install nodetto-cli
        </button>
        <Show when={actions().canUninstall}>
          <button type="button" disabled={busy()} onClick={uninstall}>
            Uninstall
          </button>
        </Show>
        <button
          type="button"
          disabled={busy() || status.loading}
          onClick={() => {
            setNotice(undefined);
            void refetch();
          }}
        >
          Check again
        </button>
      </div>
      <Show when={notice()}>
        {(current) => (
          <div
            class="app-settings-cli-notice"
            role={current().kind === "error" ? "alert" : "status"}
          >
            <p>{current().text}</p>
            <Show when={current().command}>
              {(command) => <code>{command()}</code>}
            </Show>
          </div>
        )}
      </Show>
    </div>
  );
}

type StatusOf<S extends CliStatus["state"]> = Extract<CliStatus, { state: S }>;

function narrow<S extends CliStatus["state"]>(
  status: CliStatus,
  state: S,
): StatusOf<S> | undefined {
  return status.state === state ? (status as StatusOf<S>) : undefined;
}

function StatusDetails(props: { readonly status: CliStatus }): JSX.Element {
  return (
    <Switch>
      <Match when={narrow(props.status, "unavailable")}>
        {(current) => <p>{current().reason}</p>}
      </Match>
      <Match when={narrow(props.status, "onPath")}>
        {(current) => (
          <>
            <p>nodetto-cli is already on your PATH:</p>
            <code>{current().path}</code>
            <Show
              when={current().resolved && current().resolved !== current().path}
            >
              <p class="app-settings-cli-detail">
                Links to <code>{current().resolved}</code>
              </p>
            </Show>
            <p class="app-settings-cli-detail">
              {current().managed
                ? "It was installed by Nodetto."
                : "Install is unavailable while another nodetto-cli is on PATH."}
            </p>
          </>
        )}
      </Match>
      <Match when={narrow(props.status, "ready")}>
        {(current) => (
          <>
            <p>Installing creates a link:</p>
            <code>{current().link}</code>
            <p class="app-settings-cli-detail">
              Links to <code>{current().target}</code>
            </p>
            <Show
              when={current().pathChange}
              fallback={
                <p class="app-settings-cli-detail">
                  ~/.local/bin is already on your PATH.
                </p>
              }
            >
              {(change) => (
                <>
                  <p>
                    ~/.local/bin is not on your PATH, so this line is added to{" "}
                    <code>{change().file}</code>:
                  </p>
                  <code>{change().line}</code>
                </>
              )}
            </Show>
          </>
        )}
      </Match>
    </Switch>
  );
}
