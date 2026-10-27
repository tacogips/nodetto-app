// Connector sections: generic edges (including prototype screen transitions)
// and UML associations.

import { screenFrame } from "@nodetto/core";
import { ARROWHEADS, UML_ASSOCIATION_KINDS } from "@nodetto/ir";
import { type JSX, lazy, Show, Suspense } from "solid-js";
import { Switch } from "../Switch.tsx";
import {
  Field,
  NumberInput,
  Section,
  SelectInput,
  type SelectOption,
  TextInput,
} from "./controls.tsx";
import { withOptionalString } from "./edits.ts";
import {
  type ElementSectionProps,
  record,
  stringOf,
} from "./semantic-fields.ts";
import { writeSemantic } from "./write.ts";

const ConnectorRoutingFields = lazy(
  () => import("./ConnectorRoutingFields.tsx"),
);

const ARROWHEAD_LABELS: Record<(typeof ARROWHEADS)[number], string> = {
  none: "None",
  arrow: "Arrow",
  triangle: "Triangle",
  dot: "Dot",
  open: "Open arrow",
  diamond: "Diamond",
  "diamond-open": "Open diamond",
  circle: "Circle",
  bar: "Bar",
  "crow-foot": "Crow's foot",
};

const ARROWHEAD_OPTIONS: readonly SelectOption[] = ARROWHEADS.map((head) => ({
  value: head,
  label: ARROWHEAD_LABELS[head],
}));

const ASSOCIATION_OPTIONS: readonly SelectOption[] = UML_ASSOCIATION_KINDS.map(
  (kind) => ({
    value: kind,
    label:
      kind === "assoc"
        ? "Association"
        : kind === "aggregate"
          ? "Aggregation"
          : kind === "compose"
            ? "Composition"
            : "Inheritance",
  }),
);

export function EdgeSection(props: ElementSectionProps): JSX.Element {
  const semantic = () => record(props.element.semantic);
  const arrowheads = () => record(semantic()["arrowheads"]);
  const setArrowhead = (end: "start" | "end", value: string): void => {
    writeSemantic(props.editor, props.element.id, {
      ...semantic(),
      arrowheads: { ...arrowheads(), [end]: value },
    });
  };
  return (
    <Section
      title={
        semantic()["prototype"] === true ? "Screen transition" : "Connector"
      }
    >
      <label>
        <Switch
          aria-label="Screen transition"
          checked={semantic()["prototype"] === true}
          disabled={
            semantic()["prototype"] !== true &&
            !screenFrame(props.editor, stringOf(semantic(), "to"))
          }
          onChange={(event) =>
            writeSemantic(props.editor, props.element.id, {
              ...semantic(),
              ...(event.currentTarget.checked
                ? {
                    to:
                      screenFrame(props.editor, stringOf(semantic(), "to")) ??
                      semantic()["to"],
                  }
                : {}),
              prototype: event.currentTarget.checked,
            })
          }
        />
        Screen transition
      </label>
      <Show when={semantic()["prototype"] === true}>
        <Field label="Action">
          <SelectInput
            label="Prototype action"
            value={stringOf(semantic(), "prototypeAction") || "navigate"}
            options={[
              { value: "navigate", label: "Navigate to screen" },
              { value: "change-to", label: "Change component variant" },
              { value: "open-overlay", label: "Open overlay" },
              { value: "close-overlay", label: "Close overlay" },
            ]}
            onCommit={(prototypeAction) =>
              writeSemantic(props.editor, props.element.id, {
                ...semantic(),
                prototypeAction,
              })
            }
          />
        </Field>
        <Show when={semantic()["prototypeAction"] === "open-overlay"}>
          <Field label="Position">
            <SelectInput
              label="Overlay position"
              value={
                stringOf(semantic(), "prototypeOverlayPosition") || "center"
              }
              options={[
                { value: "center", label: "Centered" },
                { value: "top-left", label: "Top left" },
                { value: "bottom-center", label: "Bottom center" },
                { value: "manual", label: "Manual" },
              ]}
              onCommit={(prototypeOverlayPosition) =>
                writeSemantic(props.editor, props.element.id, {
                  ...semantic(),
                  prototypeOverlayPosition,
                })
              }
            />
          </Field>
          <Show when={semantic()["prototypeOverlayPosition"] === "manual"}>
            <Field label="Overlay X">
              <NumberInput
                label="Overlay X position"
                value={
                  typeof semantic()["prototypeOverlayX"] === "number"
                    ? (semantic()["prototypeOverlayX"] as number)
                    : 0
                }
                onCommit={(prototypeOverlayX) =>
                  writeSemantic(props.editor, props.element.id, {
                    ...semantic(),
                    prototypeOverlayX,
                  })
                }
              />
            </Field>
            <Field label="Overlay Y">
              <NumberInput
                label="Overlay Y position"
                value={
                  typeof semantic()["prototypeOverlayY"] === "number"
                    ? (semantic()["prototypeOverlayY"] as number)
                    : 0
                }
                onCommit={(prototypeOverlayY) =>
                  writeSemantic(props.editor, props.element.id, {
                    ...semantic(),
                    prototypeOverlayY,
                  })
                }
              />
            </Field>
          </Show>
          <label>
            <Switch
              checked={semantic()["prototypeOverlayBackdrop"] === true}
              onChange={(event) =>
                writeSemantic(props.editor, props.element.id, {
                  ...semantic(),
                  prototypeOverlayBackdrop: event.currentTarget.checked,
                })
              }
            />
            Dim background
          </label>
          <label>
            <Switch
              checked={semantic()["prototypeOverlayDismiss"] === true}
              onChange={(event) =>
                writeSemantic(props.editor, props.element.id, {
                  ...semantic(),
                  prototypeOverlayDismiss: event.currentTarget.checked,
                })
              }
            />
            Close when clicking outside
          </label>
        </Show>
        <Field label="Trigger">
          <SelectInput
            label="Prototype trigger"
            value={stringOf(semantic(), "prototypeTrigger") || "click"}
            options={[
              { value: "click", label: "Click / tap" },
              { value: "hover", label: "While hovering" },
              { value: "press", label: "Pointer down" },
              { value: "after-delay", label: "After delay" },
            ]}
            onCommit={(prototypeTrigger) =>
              writeSemantic(props.editor, props.element.id, {
                ...semantic(),
                prototypeTrigger,
                ...(prototypeTrigger === "after-delay" &&
                typeof semantic()["prototypeDelay"] !== "number"
                  ? { prototypeDelay: 1000 }
                  : {}),
              })
            }
          />
        </Field>
        <Show when={semantic()["prototypeTrigger"] === "after-delay"}>
          <Field label="Delay (ms)">
            <NumberInput
              label="Prototype trigger delay"
              min={100}
              value={
                typeof semantic()["prototypeDelay"] === "number"
                  ? (semantic()["prototypeDelay"] as number)
                  : 1000
              }
              onCommit={(value) =>
                writeSemantic(props.editor, props.element.id, {
                  ...semantic(),
                  prototypeDelay: Math.min(60_000, value),
                })
              }
            />
          </Field>
        </Show>
        <Field label="Animation">
          <SelectInput
            label="Prototype transition"
            value={stringOf(semantic(), "prototypeTransition") || "instant"}
            options={[
              { value: "instant", label: "Instant" },
              { value: "fade", label: "Fade in" },
              { value: "slide-left", label: "Slide in from right" },
              { value: "slide-right", label: "Slide in from left" },
              { value: "slide-up", label: "Slide in from bottom" },
              { value: "slide-down", label: "Slide in from top" },
              { value: "smart", label: "Smart animate layers" },
            ]}
            onCommit={(prototypeTransition) =>
              writeSemantic(props.editor, props.element.id, {
                ...semantic(),
                prototypeTransition,
              })
            }
          />
        </Field>
        <Field label="Duration (ms)">
          <NumberInput
            label="Prototype duration"
            min={0}
            value={
              typeof semantic()["prototypeDuration"] === "number"
                ? (semantic()["prototypeDuration"] as number)
                : 250
            }
            onCommit={(value) =>
              writeSemantic(props.editor, props.element.id, {
                ...semantic(),
                prototypeDuration: Math.min(5000, value),
              })
            }
          />
        </Field>
      </Show>
      <Field label="Label">
        <TextInput
          label="Label"
          value={stringOf(semantic(), "label")}
          onCommit={(label) =>
            writeSemantic(
              props.editor,
              props.element.id,
              withOptionalString(semantic(), "label", label),
            )
          }
        />
      </Field>
      <Suspense>
        <ConnectorRoutingFields
          semantic={semantic()}
          write={(next) => writeSemantic(props.editor, props.element.id, next)}
        />
      </Suspense>
      <Field label="Start">
        <SelectInput
          label="Start arrowhead"
          value={stringOf(arrowheads(), "start") || "none"}
          options={ARROWHEAD_OPTIONS}
          onCommit={(value) => setArrowhead("start", value)}
        />
      </Field>
      <Field label="End">
        <SelectInput
          label="End arrowhead"
          value={stringOf(arrowheads(), "end") || "arrow"}
          options={ARROWHEAD_OPTIONS}
          onCommit={(value) => setArrowhead("end", value)}
        />
      </Field>
    </Section>
  );
}

export function AssociationSection(props: ElementSectionProps): JSX.Element {
  const semantic = () => record(props.element.semantic);
  const cardinalities = () => record(semantic()["cardinalities"]);
  const setCardinality = (end: "from" | "to", value: string): void => {
    const next = withOptionalString(cardinalities(), end, value);
    const { cardinalities: _dropped, ...rest } = semantic();
    writeSemantic(
      props.editor,
      props.element.id,
      Object.keys(next).length === 0 ? rest : { ...rest, cardinalities: next },
    );
  };
  return (
    <Section title="Association">
      <Field label="Kind">
        <SelectInput
          label="Association kind"
          value={stringOf(semantic(), "kind") || "assoc"}
          options={ASSOCIATION_OPTIONS}
          onCommit={(kind) =>
            writeSemantic(props.editor, props.element.id, {
              ...semantic(),
              kind,
            })
          }
        />
      </Field>
      <Field label="Label">
        <TextInput
          label="Label"
          value={stringOf(semantic(), "label")}
          onCommit={(label) =>
            writeSemantic(
              props.editor,
              props.element.id,
              withOptionalString(semantic(), "label", label),
            )
          }
        />
      </Field>
      <Suspense>
        <ConnectorRoutingFields
          semantic={semantic()}
          write={(next) => writeSemantic(props.editor, props.element.id, next)}
        />
      </Suspense>
      <Field label="From">
        <TextInput
          label="From cardinality"
          placeholder="e.g. 1"
          value={stringOf(cardinalities(), "from")}
          onCommit={(value) => setCardinality("from", value)}
        />
      </Field>
      <Field label="To">
        <TextInput
          label="To cardinality"
          placeholder="e.g. 0..*"
          value={stringOf(cardinalities(), "to")}
          onCommit={(value) => setCardinality("to", value)}
        />
      </Field>
    </Section>
  );
}
