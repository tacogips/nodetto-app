import type { Editor } from "@nodetto/core";
import {
  decodeRasterDataUrl,
  encodeRasterDataUrl,
  isRasterAttachmentPath,
  isRasterDataUrl,
  type Document,
  type ImageSemantic,
} from "@nodetto/ir";
import type { FileBackend } from "./backend.ts";

export interface PreparedAttachments {
  readonly document: Document;
  readonly changes: readonly {
    readonly id: string;
    readonly before: string;
    readonly after: string;
  }[];
  readonly resolved: ReadonlyMap<string, string>;
  readonly copied: readonly { readonly from: string; readonly to: string }[];
}
function directoryOf(path: string): string {
  const separator = Math.max(path.lastIndexOf("/"), path.lastIndexOf("\\"));
  return separator < 0 ? "" : path.slice(0, separator);
}

export async function prepareDocumentAttachments(
  editor: Editor,
  document: Document,
  backend: FileBackend,
  destination: string,
  sourcePath: string | null,
): Promise<PreparedAttachments> {
  const sources = new Map<string, string>();
  const resolved = new Map<string, string>();
  const changes: { id: string; before: string; after: string }[] = [];
  const copied: { from: string; to: string }[] = [];
  const elements = [];
  const read = async (
    path: string,
    src: string,
  ): Promise<string | undefined> => {
    try {
      if (!backend.readAttachment) return undefined;
      return encodeRasterDataUrl(await backend.readAttachment(path, src));
    } catch {
      return undefined;
    }
  };
  for (const element of document.elements) {
    if (element.type !== "image.raster") {
      elements.push(element);
      continue;
    }
    const image = element.semantic as ImageSemantic;
    const embedded = isRasterDataUrl(image.src);
    if (
      (!embedded &&
        sourcePath !== null &&
        directoryOf(sourcePath) === directoryOf(destination)) ||
      (embedded && !backend.storeAttachment)
    ) {
      elements.push(element);
      continue;
    }
    let reference = sources.get(image.src);
    if (reference === undefined) {
      let data = embedded ? image.src : editor.assets.resolve(image.src);
      if (!embedded && sourcePath !== null) {
        // Invalid cached or read bytes count as unavailable for Save As.
        try {
          if (data) decodeRasterDataUrl(data);
        } catch {
          data = undefined;
        }
        if (!data) data = await read(sourcePath, image.src);
        const destinationData = await read(destination, image.src);
        if (destinationData) {
          const destinationBytes = decodeRasterDataUrl(destinationData).bytes;
          const sourceBytes = data
            ? decodeRasterDataUrl(data).bytes
            : undefined;
          if (
            !sourceBytes ||
            (sourceBytes.length === destinationBytes.length &&
              sourceBytes.every(
                (byte, index) => byte === destinationBytes[index],
              ))
          ) {
            sources.set(image.src, image.src);
            resolved.set(image.src, destinationData);
            elements.push(element);
            continue;
          }
        }
      }
      if (!data)
        throw new Error(
          `Missing attachment: ${image.src}. Restore the file before saving a copy.`,
        );
      if (!backend.storeAttachment)
        throw new Error("This file backend cannot save document attachments.");
      const { bytes, extension } = decodeRasterDataUrl(data);
      reference = await backend.storeAttachment(destination, extension, bytes);
      if (!isRasterAttachmentPath(reference))
        throw new Error("File backend returned an invalid attachment path.");
      sources.set(image.src, reference);
      resolved.set(reference, data);
      if (!embedded && sourcePath !== null)
        copied.push({ from: image.src, to: reference });
    }
    if (reference !== image.src)
      changes.push({ id: element.id, before: image.src, after: reference });
    elements.push({ ...element, semantic: { ...image, src: reference } });
  }
  return { document: { ...document, elements }, changes, resolved, copied };
}

/** Missing assets never discard a valid document; callers surface these messages. */
export async function hydrateDocumentAttachments(
  editor: Editor,
  backend: FileBackend,
  documentPath: string,
  isCurrent: () => boolean,
): Promise<readonly string[]> {
  const paths = new Set(
    editor.getSnapshot().elements.flatMap((element) => {
      if (element.type !== "image.raster") return [];
      const source = (element.semantic as ImageSemantic).src;
      return isRasterAttachmentPath(source) && !editor.assets.resolve(source)
        ? [source]
        : [];
    }),
  );
  const errors: string[] = [];
  for (const path of paths) {
    if (!isCurrent()) break;
    try {
      if (!backend.readAttachment)
        throw new Error("This file backend cannot read attachments.");
      const data = encodeRasterDataUrl(
        await backend.readAttachment(documentPath, path),
      );
      if (isCurrent()) editor.assets.set(path, data);
    } catch (error) {
      if (isCurrent())
        errors.push(
          `${path}: ${error instanceof Error ? error.message : String(error)}`,
        );
    }
  }
  return errors;
}
