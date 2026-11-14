import type { Page, PageId } from "@nodetto/ir";
export type CopyShapesOption = {
  readonly key: string;
  readonly label: string;
  readonly pageId: PageId | null;
  readonly disabled: boolean;
};
export function copyShapesOptions(
  pages: readonly Page[],
  targetId: PageId,
): CopyShapesOption[] {
  const index = pages.findIndex((page) => page.id === targetId);
  if (index < 0) return [];
  const prev = pages[index - 1];
  const next = pages[index + 1];
  return [
    {
      key: "prev",
      label: `Previous page (${prev?.name ?? "none"})`,
      pageId: prev?.id ?? null,
      disabled: !prev,
    },
    {
      key: "next",
      label: `Next page (${next?.name ?? "none"})`,
      pageId: next?.id ?? null,
      disabled: !next,
    },
    ...pages
      .filter((page) => page.id !== targetId)
      .map((page) => ({
        key: page.id,
        label: page.name,
        pageId: page.id,
        disabled: false,
      })),
  ];
}
export function defaultCopyShapesOption(
  options: readonly CopyShapesOption[],
): CopyShapesOption | null {
  return (
    options.find((option) => option.key === "prev" && !option.disabled) ??
    options.find((option) => !option.disabled) ??
    null
  );
}
