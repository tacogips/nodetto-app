import { sequenceParticipantNotation, type Box } from "@nodetto/core";
import type { Element, SequenceParticipantSemantic } from "@nodetto/ir";
import { For, type JSX, Show } from "solid-js";
import { primitiveAttributes } from "./bpmn-primitive.ts";
import { fillPaintStyle, labelStyle, strokeBorderStyle } from "./visual.ts";

export const SEQUENCE_PARTICIPANT_HEAD_HEIGHT = 54;

export function sequenceParticipantViewModel(element: Element, box: Box) {
  return sequenceParticipantNotation(
    element,
    { x: 0, y: 0, width: box.width, height: SEQUENCE_PARTICIPANT_HEAD_HEIGHT },
    { ink: "var(--nodetto-ink)", surface: "var(--nodetto-surface)" },
  );
}

export function SequenceParticipantView(props: {
  readonly element: Element;
  readonly box: Box;
}): JSX.Element {
  const semantic = () =>
    props.element.semantic as Partial<SequenceParticipantSemantic>;
  const model = () => sequenceParticipantViewModel(props.element, props.box);
  return (
    <div
      class="nodetto-sequence-participant"
      style={labelStyle(props.element.visual)}
    >
      <Show
        when={model()}
        fallback={
          <div
            class="nodetto-sequence-participant-head"
            data-smart-paint="box"
            data-smart-text
            style={{
              ...fillPaintStyle(props.element.visual),
              ...strokeBorderStyle(props.element.visual),
            }}
          >
            <span aria-hidden="true">
              {semantic().kind === "actor"
                ? "Actor"
                : semantic().kind === "db"
                  ? "Database"
                  : "Service"}
            </span>
            <strong>{semantic().name ?? "Participant"}</strong>
          </div>
        }
      >
        {(notation) => (
          <div
            class={`nodetto-sequence-participant-head nodetto-sequence-participant-${semantic().kind}`}
          >
            <svg
              role="img"
              aria-label={semantic().name ?? "Participant"}
              width="100%"
              height={SEQUENCE_PARTICIPANT_HEAD_HEIGHT}
            >
              <For each={notation().primitives}>
                {(primitive) => {
                  const attrs = () => primitiveAttributes(primitive).attrs;
                  return primitive.kind === "circle" ? (
                    <circle
                      {...attrs()}
                      data-smart-paint={
                        primitive.role === "participant-head"
                          ? "svg"
                          : undefined
                      }
                    />
                  ) : primitive.kind === "path" ? (
                    <path
                      {...attrs()}
                      data-smart-paint={
                        primitive.role === "participant-cylinder"
                          ? "svg"
                          : undefined
                      }
                    />
                  ) : null;
                }}
              </For>
            </svg>
            <strong
              data-smart-text
              style={{
                position: "absolute",
                left: `${notation().labelBox.x}px`,
                top: `${notation().labelBox.y}px`,
                width: `${notation().labelBox.width}px`,
                height: `${notation().labelBox.height}px`,
                display: "grid",
                "place-items": "center",
              }}
            >
              {semantic().name ?? "Participant"}
            </strong>
          </div>
        )}
      </Show>
      <div class="nodetto-sequence-lifeline" />
    </div>
  );
}
