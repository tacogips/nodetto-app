export function pcbExportEnabled(
  pageKind: string | undefined,
  hasHandler: boolean,
): boolean {
  return pageKind === "pcb" && hasHandler;
}
