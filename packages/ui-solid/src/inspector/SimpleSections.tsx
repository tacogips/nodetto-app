// The small semantic sections: one or two fields per type, plus the group
// and page sections. Each control commits one whole-payload `updateSemantic`.
//
// Each section lives in its own module; this file is the stable entry point
// that re-exports them.

export {
  AssociationSection,
  EdgeSection,
} from "./ConnectorSections.tsx";
export { FrameSection } from "./FrameSection.tsx";
export { GroupSection } from "./GroupSection.tsx";
export { PageSection, type PageSectionProps } from "./PageSection.tsx";
export type { ElementSectionProps } from "./semantic-fields.ts";
export {
  SequenceMessageSection,
  SequenceParticipantSection,
} from "./SequenceSections.tsx";
export {
  GeoSection,
  NodeSection,
  TextNoteSection,
} from "./ShapeSections.tsx";
