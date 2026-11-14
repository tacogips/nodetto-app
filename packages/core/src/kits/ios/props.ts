import type { Element, ElementId, FrameSemantic, Visual } from "@nodetto/ir";
import type { Command } from "../../commands.ts";
import type { Editor } from "../../editor.ts";
import type { Store } from "../../store.ts";
import { measureTextNote } from "../../text-layout.ts";
import { findKitComponent } from "./index.ts";
import type { KitComponent, KitProp } from "./types.ts";

export function kitComponentOf(
  store: Store,
  instanceId: ElementId,
): KitComponent | undefined {
  const instance = store.get(instanceId);
  if (!instance || instance.type !== "frame") return undefined;
  const sourceId = (instance.semantic as FrameSemantic).instanceOf;
  const source = sourceId ? store.get(sourceId) : undefined;
  if (!source || source.type !== "frame") return undefined;
  const kit = (source.semantic as FrameSemantic).kit;
  return kit?.endsWith("@1") ? findKitComponent(kit.slice(0, -2)) : undefined;
}

export function kitProps(kitId: string): readonly KitProp[] {
  const kit = findKitComponent(kitId);
  if (!kit) throw new Error(`unknown kit component "${kitId}"`);
  return kit.props;
}

export function applyKitProps(
  editor: Editor,
  instanceId: ElementId,
  props: Readonly<Record<string, unknown>> | undefined,
): void {
  if (!props || Object.keys(props).length === 0) return;
  const kit = kitComponentOf(editor.store, instanceId);
  if (!kit) throw new Error("properties require a kit instance");
  const instance = editor.store.get(instanceId);
  if (!instance) return;
  const byKey = new Map<string, Element>();
  const visited = new Set<ElementId>();
  const visit = (element: Element): void => {
    if (visited.has(element.id)) return;
    visited.add(element.id);
    if (element.visual.componentKey)
      byKey.set(element.visual.componentKey, element);
    if (element.type === "frame")
      for (const id of (element.semantic as FrameSemantic).memberIds ?? []) {
        const child = editor.store.get(id);
        if (child) visit(child);
      }
  };
  visit(instance);
  const semantic = new Map<ElementId, Record<string, unknown>>();
  const visuals = new Map<ElementId, Visual>();
  const keepMembers = new Set<ElementId>();
  const set = (key: string, field: string, value: unknown): void => {
    const child = byKey.get(key);
    if (!child) return;
    if (
      field === "hidden" ||
      field === "fill" ||
      field === "stroke" ||
      field === "color"
    ) {
      const visual = visuals.get(child.id) ?? child.visual;
      visuals.set(
        child.id,
        field === "hidden"
          ? { ...visual, hidden: !value }
          : { ...visual, style: { ...visual.style, [field]: value } },
      );
    } else {
      const next = semantic.get(child.id) ?? { ...(child.semantic as object) };
      next[
        field === "icon" && child.type === "ui.control" ? "leadingIcon" : field
      ] = value;
      semantic.set(child.id, next);
    }
  };
  const names = kit.props.map((p) => p.name);
  if (kit.slots) names.push("items");
  for (const [name, value] of Object.entries(props)) {
    if (name === "items" && kit.slots) continue;
    const prop = kit.props.find((p) => p.name === name);
    if (!prop)
      throw new Error(
        `unknown property "${name}" for ${kit.id}; properties: ${names.join(", ")}`,
      );
    const valid =
      prop.type === "boolean"
        ? typeof value === "boolean"
        : prop.type === "integer"
          ? typeof value === "number" && Number.isInteger(value)
          : typeof value === "string";
    if (!valid || (prop.values && !prop.values.includes(value as string)))
      throw new Error(`invalid property "${name}" for ${kit.id}`);
    for (const target of prop.targets) set(target.key, target.field, value);
    for (const effect of prop.effects ?? []) {
      if (effect.kind === "variant") {
        const selector =
          effect.selector === "non-empty"
            ? String(value !== "")
            : String(value);
        const visible = effect.cases[selector] ?? [];
        for (const key of effect.keys)
          set(key, "hidden", visible.includes(key));
        continue;
      }
      const child = byKey.get(effect.key);
      if (!child) continue;
      const visual = visuals.get(child.id) ?? child.visual;
      if (effect.kind === "geometry") {
        const matches =
          effect.condition === "non-empty"
            ? value !== ""
            : value === effect.equals;
        visuals.set(child.id, {
          ...visual,
          ...(effect.width && {
            width: matches ? effect.width.whenTrue : effect.width.whenFalse,
          }),
          ...(effect.height && {
            height: matches ? effect.height.whenTrue : effect.height.whenFalse,
          }),
        });
      } else if (effect.kind === "style") {
        const style = effect.cases?.[String(value)];
        const sideActive =
          !effect.whenStrokeSide ||
          !!visual.style?.strokeSides?.[effect.whenStrokeSide];
        const fromValue =
          effect.valueField && sideActive && typeof value === "string"
            ? { [effect.valueField]: value }
            : {};
        if (style || Object.keys(fromValue).length)
          visuals.set(child.id, {
            ...visual,
            style: { ...visual.style, ...style, ...fromValue },
          });
      } else {
        const selection = effect.cases[String(value)];
        if (selection) {
          const { strokeFrom, ...style } = selection;
          const source = strokeFrom ? byKey.get(strokeFrom) : undefined;
          const stroke = source
            ? (visuals.get(source.id) ?? source.visual).style?.stroke
            : undefined;
          visuals.set(child.id, {
            ...visual,
            style: {
              ...visual.style,
              ...style,
              ...(stroke !== undefined && { stroke }),
            },
          });
        }
      }
    }
  }
  if (
    props["style"] !== undefined &&
    (kit.id === "ios:status-bar" || kit.id === "ios:home-indicator")
  ) {
    const color = props["style"] === "light" ? "#ffffff" : "#000000";
    if (kit.id === "ios:status-bar") {
      set("time", "color", color);
      for (const key of ["signal", "wifi", "battery"])
        set(key, "stroke", color);
    } else set("indicator", "fill", color);
  }
  if (kit.id === "ios:nav-bar" && props["large"] !== undefined) {
    set("largeTitle", "hidden", props["large"]);
    visuals.set(instance.id, {
      ...(visuals.get(instance.id) ?? instance.visual),
      height: props["large"] ? 96 : 44,
    });
  }
  if (kit.slots) {
    const { prefix, count: max } = kit.slots;
    for (let i = 1; i <= max; i++) {
      const key = `${prefix}${i}Badge`;
      const badge = props[key];
      if (badge !== undefined) {
        set(key, "hidden", badge !== "");
        set(`${key}Background`, "hidden", badge !== "");
      }
    }
    const items = props["items"];
    if (items !== undefined) {
      if (!Array.isArray(items) || items.length < 1 || items.length > max)
        throw new Error(`invalid property "items" for ${kit.id}`);
      items.forEach((item, index) => {
        if (
          !item ||
          typeof item !== "object" ||
          typeof item.label !== "string" ||
          (item.icon !== undefined && typeof item.icon !== "string") ||
          (item.badge !== undefined &&
            typeof item.badge !== "string" &&
            typeof item.badge !== "number")
        )
          throw new Error(`invalid property "items" for ${kit.id}`);
        const key = `${prefix}${index + 1}`;
        set(`${key}Label`, "text", item.label);
        if (item.icon !== undefined) set(`${key}Icon`, "icon", item.icon);
        if (item.badge !== undefined)
          set(`${key}Badge`, "text", String(item.badge));
        const showBadge = item.badge !== undefined && item.badge !== "";
        set(`${key}Badge`, "hidden", showBadge);
        set(`${key}BadgeBackground`, "hidden", showBadge);
      });
    }
    const count =
      items !== undefined ? (items as unknown[]).length : props["count"];
    if (count !== undefined) {
      if (
        typeof count !== "number" ||
        !Number.isInteger(count) ||
        count < 1 ||
        count > max
      )
        throw new Error(`invalid property "count" for ${kit.id}`);
      const width = instance.visual.width ?? kit.width;
      const left = instance.visual.x ?? 0;
      for (let i = 1; i <= max; i++) {
        const key = `${prefix}${i}`;
        set(key, "hidden", i <= count);
        const slot = byKey.get(key);
        if (slot && i <= count) {
          const start = Math.round(((i - 1) * width) / count);
          const end = Math.round((i * width) / count);
          if (kit.id === "ios:tab-bar") {
            const oldX = slot.visual.x ?? 0;
            const oldWidth = slot.visual.width ?? 0;
            const slotY = slot.visual.y ?? 0;
            for (const suffix of [
              "Icon",
              "Label",
              "Indicator",
              "Badge",
              "BadgeBackground",
            ]) {
              const child = byKey.get(`${key}${suffix}`);
              if (!child) continue;
              const box = (x: number, slotWidth: number) => {
                const center = x + Math.floor(slotWidth / 2);
                if (suffix === "Icon")
                  return { x: center - (child.visual.width ?? 0) / 2 };
                if (suffix === "Label" || suffix === "Indicator") {
                  const width = slotWidth - (slotWidth % 2);
                  return { x: center - width / 2, width };
                }
                return { x: center + 8, y: slotY + 3 };
              };
              const oldBox = box(oldX, oldWidth);
              if (
                Object.entries(oldBox).some(
                  ([field, value]) =>
                    Math.abs(
                      (((child.visual as Record<string, unknown>)[
                        field
                      ] as number) ?? 0) - value,
                    ) > 1,
                )
              )
                continue;
              visuals.set(child.id, {
                ...(visuals.get(child.id) ?? child.visual),
                ...box(left + start, end - start),
              });
              keepMembers.add(child.id);
            }
          }
          visuals.set(slot.id, {
            ...(visuals.get(slot.id) ?? slot.visual),
            x: left + start,
            width: end - start,
          });
        }
      }
    }
    const selected =
      Array.from({ length: max }, (_, i) => i).find((i) => {
        const indicator = byKey.get(`${prefix}${i + 1}Indicator`);
        return indicator && !indicator.visual.hidden;
      }) ?? 0;
    const active = props["active"] ?? selected;
    if (
      typeof active !== "number" ||
      !Number.isInteger(active) ||
      active < 0 ||
      active >= max
    )
      throw new Error(`invalid property "active" for ${kit.id}`);
    if (
      props["active"] !== undefined ||
      props["activeColor"] !== undefined ||
      props["inactiveColor"] !== undefined
    ) {
      const selectedLabel = byKey.get(`${prefix}${selected + 1}Label`);
      const otherLabel = byKey.get(`${prefix}${selected === 0 ? 2 : 1}Label`);
      const activeColor =
        props["activeColor"] ??
        selectedLabel?.visual.style?.color ??
        kit.props.find((p) => p.name === "activeColor")?.default;
      const inactiveColor =
        props["inactiveColor"] ??
        otherLabel?.visual.style?.color ??
        kit.props.find((p) => p.name === "inactiveColor")?.default;
      for (let i = 1; i <= max; i++) {
        const key = `${prefix}${i}`;
        set(`${key}Indicator`, "hidden", i === active + 1);
        const color = i === active + 1 ? activeColor : inactiveColor;
        if (typeof color === "string") {
          set(`${key}Icon`, "stroke", color);
          set(`${key}Label`, "color", color);
          if (kit.id === "ios:top-tabs" && i === active + 1)
            set(`${key}Indicator`, "fill", color);
        }
      }
    }
  }
  const textKey =
    kit.id === "ios:chip"
      ? "label"
      : kit.id === "ios:badge"
        ? "count"
        : undefined;
  if (textKey && typeof props[textKey] === "string") {
    const label = byKey.get(textKey);
    if (label) {
      const sized = {
        ...label,
        semantic: { ...(label.semantic as object), text: props[textKey] },
      };
      visuals.set(label.id, {
        ...(visuals.get(label.id) ?? label.visual),
        width:
          Math.ceil(
            Math.max(
              measureTextNote(sized, "auto-width").width,
              measureTextNote(
                {
                  ...sized,
                  visual: { ...sized.visual, textMeasure: undefined },
                },
                "auto-width",
              ).width,
            ),
          ) + 1,
      });
    }
  }
  const commands: Command[] = [];
  for (const [id, value] of semantic)
    commands.push({ type: "updateSemantic", id, semantic: value });
  for (const [id, visual] of visuals)
    commands.push({ type: "replaceVisual", id, visual });
  if (commands.length)
    editor.apply(commands, keepMembers.size ? { keepMembers } : {});
}
