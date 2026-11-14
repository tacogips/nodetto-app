import { IOS_BAR_COMPONENTS } from "./bars.ts";
import { IOS_CONTENT_COMPONENTS } from "./content.ts";
import type { KitComponent } from "./types.ts";

export const IOS_KIT: readonly KitComponent[] = [
  ...IOS_BAR_COMPONENTS,
  ...IOS_CONTENT_COMPONENTS,
];
export function findKitComponent(id: string): KitComponent | undefined {
  return IOS_KIT.find((component) => component.id === id);
}
export { insertKitComponent } from "./insert.ts";
export { applyKitProps, kitComponentOf, kitProps } from "./props.ts";
export type {
  KitComponent,
  KitProp,
  KitPropTarget,
  KitPropType,
} from "./types.ts";
