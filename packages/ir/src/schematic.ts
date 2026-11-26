import type { BreadboardNetlistNet } from "./breadboard.ts";
import type { SchematicPartType } from "./semantics/schematic.ts";

export interface SchematicNetlistComponent {
  readonly elementId: string;
  readonly type: SchematicPartType;
  readonly reference: string;
  readonly value: string;
  readonly partName: string;
  readonly description: string;
  readonly footprint: "";
  readonly pins: readonly { readonly number: number; readonly name: string }[];
}
export interface SchematicNetlist {
  readonly pageId: string;
  readonly pageName: string;
  readonly documentTitle: string;
  readonly components: readonly SchematicNetlistComponent[];
  readonly nets: readonly BreadboardNetlistNet[];
}
