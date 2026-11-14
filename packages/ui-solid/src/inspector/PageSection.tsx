// Page section: shown when nothing is selected; name, IDs and page settings.

import type { Editor } from "@nodetto/core";
import { PAGE_KINDS, type Page, type PageKind, shortPageId } from "@nodetto/ir";
import { type JSX, lazy, Suspense } from "solid-js";
import {
  Field,
  Section,
  SelectInput,
  type SelectOption,
  TextInput,
} from "./controls.tsx";

const PageGuidesSection = lazy(() => import("./PageGuidesSection.tsx"));

const PAGE_KIND_OPTIONS: readonly SelectOption[] = PAGE_KINDS.map((kind) => ({
  value: kind,
  label: kind.charAt(0).toUpperCase() + kind.slice(1),
}));

export interface PageSectionProps {
  readonly editor: Editor;
  readonly page: Page;
}

export function PageSection(props: PageSectionProps): JSX.Element {
  return (
    <Section
      title="Page"
      help="Select an element to edit its content and style."
    >
      <Field label="Name">
        <TextInput
          label="Page name"
          value={props.page.name}
          onCommit={(name) => props.editor.renamePage(props.page.id, name)}
        />
      </Field>
      <Field label="Page ID">
        <input
          class="nodetto-input nodetto-readonly-value"
          aria-label="Short page ID"
          readOnly
          value={shortPageId(props.page.id)}
          onFocus={(event) => event.currentTarget.select()}
          title="Stable short ID. Use with CLI --page."
        />
      </Field>
      <details class="nodetto-inspector-details">
        <summary>Page settings</summary>
        <Field label="Full page ID">
          <input
            class="nodetto-input nodetto-readonly-value"
            aria-label="Full page ID"
            readOnly
            value={props.page.id}
            onFocus={(event) => event.currentTarget.select()}
          />
        </Field>
        <Field label="Diagram format">
          <SelectInput
            label="Page diagram format"
            value={props.page.kind}
            options={PAGE_KIND_OPTIONS}
            onCommit={(kind) =>
              props.editor.setPageKind(props.page.id, kind as PageKind)
            }
          />
        </Field>
        <Suspense>
          <PageGuidesSection editor={props.editor} page={props.page} />
        </Suspense>
        <Field label="SQL import format">
          <SelectInput
            label="Page SQL input dialect"
            value={props.page.sqlDialect ?? "postgresql"}
            options={[
              { value: "postgresql", label: "PostgreSQL" },
              { value: "mysql", label: "MySQL" },
              { value: "sqlite", label: "SQLite" },
            ]}
            onCommit={(value) =>
              props.editor.setPageSqlDialect(
                props.page.id,
                value as NonNullable<Page["sqlDialect"]>,
              )
            }
          />
        </Field>
      </details>
    </Section>
  );
}
