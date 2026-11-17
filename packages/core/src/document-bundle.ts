// Document bundle: one ZIP holding a JSONL document and the raster
// attachments it references, so a document with images travels as one file.
//
// Layout (version 1):
//   manifest.json   {"format":"nodetto-bundle","version":1,"document":"document.jsonl"}
//   document.jsonl  the document; image sources are bundle-relative paths
//   artifacts/...   the referenced image bytes
//
// Encoding is deterministic (stored entries, fixed timestamps, sorted
// attachments), so packing the same document twice gives the same bytes.
// Decoding also accepts a hand-made ZIP that holds exactly one `.jsonl`
// next to its attachments, e.g. `zip -r doc.zip doc.jsonl artifacts/`.

import {
  isZip,
  parseDocumentResult,
  readZip,
  serializeDocument,
} from "@nodetto/io";
import {
  decodeRasterDataUrl,
  type Document,
  type ImageSemantic,
  isRasterAttachmentPath,
  isRasterDataUrl,
} from "@nodetto/ir";
import { encodeStoredZip, type ZipEntry } from "./zip.ts";

/** File extension of a document bundle, without the dot. */
export const DOCUMENT_BUNDLE_EXTENSION = "nodetto";
export const DOCUMENT_BUNDLE_FORMAT = "nodetto-bundle";
export const DOCUMENT_BUNDLE_VERSION = 1;
const MANIFEST_PATH = "manifest.json";
const DOCUMENT_PATH = "document.jsonl";
/** Paths the stored-ZIP writer accepts verbatim. */
const PORTABLE_PATH = /^[a-zA-Z0-9_./-]+$/;

export class DocumentBundleError extends Error {
  override readonly name = "DocumentBundleError";
}

export interface DocumentBundleManifest {
  readonly format: typeof DOCUMENT_BUNDLE_FORMAT;
  readonly version: number;
  readonly document: string;
}

export interface EncodedDocumentBundle {
  readonly bytes: Uint8Array;
  /** Bundle-relative attachment paths, sorted. */
  readonly attachments: readonly string[];
}

/** True when `path` names a document bundle by its extension. */
export function isDocumentBundlePath(path: string): boolean {
  return path.toLowerCase().endsWith(`.${DOCUMENT_BUNDLE_EXTENSION}`);
}

/**
 * Pack `document` with every raster attachment it references.
 * `readAttachment` returns the bytes of a document-relative attachment, or
 * `undefined` when it is unavailable; any missing attachment fails the whole
 * bundle so a recipient never gets a document with silently lost images.
 * Embedded data-URL images move out to attachment files as well.
 */
export function encodeDocumentBundle(
  document: Document,
  readAttachment: (src: string) => Uint8Array | undefined,
): EncodedDocumentBundle {
  const files = new Map<string, Uint8Array>();
  const renamed = new Map<string, string>();
  const missing: string[] = [];
  let generated = 0;
  const freshPath = (extension: string): string => {
    let path: string;
    do path = `artifacts/bundle-${++generated}.${extension}`;
    while (files.has(path));
    return path;
  };
  const extensionOf = (src: string): string =>
    (/\.([a-z0-9]+)$/i.exec(src)?.[1] ?? "png").toLowerCase();

  // Keep-as-is paths first, so a generated name can never shadow one.
  const images = document.elements.filter(
    (element) => element.type === "image.raster",
  );
  for (const element of images) {
    const src = (element.semantic as ImageSemantic).src;
    if (
      isRasterAttachmentPath(src) &&
      PORTABLE_PATH.test(src) &&
      !files.has(src)
    ) {
      const bytes = readAttachment(src);
      if (bytes === undefined) missing.push(src);
      else files.set(src, bytes);
      renamed.set(src, src);
    }
  }
  for (const element of images) {
    const src = (element.semantic as ImageSemantic).src;
    if (renamed.has(src)) continue;
    if (isRasterDataUrl(src)) {
      const { bytes, extension } = decodeRasterDataUrl(src);
      const path = freshPath(extension);
      files.set(path, bytes);
      renamed.set(src, path);
    } else if (isRasterAttachmentPath(src)) {
      const bytes = readAttachment(src);
      if (bytes === undefined) {
        missing.push(src);
        renamed.set(src, src);
        continue;
      }
      const path = freshPath(extensionOf(src));
      files.set(path, bytes);
      renamed.set(src, path);
    }
  }
  if (missing.length > 0)
    throw new DocumentBundleError(
      `Missing attachment${missing.length === 1 ? "" : "s"}: ${missing.join(", ")}`,
    );

  const bundled: Document = {
    ...document,
    elements: document.elements.map((element) => {
      if (element.type !== "image.raster") return element;
      const image = element.semantic as ImageSemantic;
      const src = renamed.get(image.src);
      return src === undefined || src === image.src
        ? element
        : { ...element, semantic: { ...image, src } };
    }),
  };
  const manifest: DocumentBundleManifest = {
    format: DOCUMENT_BUNDLE_FORMAT,
    version: DOCUMENT_BUNDLE_VERSION,
    document: DOCUMENT_PATH,
  };
  const encoder = new TextEncoder();
  const attachments = [...files.keys()].sort();
  const entries: ZipEntry[] = [
    {
      path: MANIFEST_PATH,
      contents: encoder.encode(`${JSON.stringify(manifest)}\n`),
    },
    {
      path: DOCUMENT_PATH,
      contents: encoder.encode(serializeDocument(bundled)),
    },
    ...attachments.map((path) => ({
      path,
      contents: files.get(path) as Uint8Array,
    })),
  ];
  return { bytes: encodeStoredZip(entries, "Document bundle"), attachments };
}

export interface DecodedDocumentBundle {
  readonly document: Document;
  /** Referenced attachments by their document-relative `src`. */
  readonly attachments: ReadonlyMap<string, Uint8Array>;
  /** Referenced attachments the archive does not hold. */
  readonly missing: readonly string[];
}

function directoryOf(path: string): string {
  const slash = path.lastIndexOf("/");
  return slash < 0 ? "" : path.slice(0, slash + 1);
}

function manifestDocument(text: string): string {
  let value: unknown;
  try {
    value = JSON.parse(text);
  } catch {
    throw new DocumentBundleError("manifest.json is not valid JSON");
  }
  const manifest = value as Partial<DocumentBundleManifest> | null;
  if (manifest?.format !== DOCUMENT_BUNDLE_FORMAT)
    throw new DocumentBundleError("manifest.json is not a nodetto bundle");
  if (
    typeof manifest.version !== "number" ||
    manifest.version > DOCUMENT_BUNDLE_VERSION
  )
    throw new DocumentBundleError(
      `bundle version ${String(manifest.version)} is newer than this app supports`,
    );
  if (
    typeof manifest.document !== "string" ||
    !manifest.document.endsWith(".jsonl")
  )
    throw new DocumentBundleError("manifest.json names no document");
  return manifest.document;
}

/** True when a ZIP looks like a document bundle rather than other files. */
export function looksLikeDocumentBundle(bytes: Uint8Array): boolean {
  if (!isZip(bytes)) return false;
  try {
    const entries = readZip(bytes);
    return (
      entries.some((entry) => entry.path === MANIFEST_PATH) ||
      entries.filter((entry) => entry.path.endsWith(".jsonl")).length === 1
    );
  } catch {
    return false;
  }
}

/** Unpack a bundle (or a hand-made ZIP with exactly one `.jsonl`). */
export function decodeDocumentBundle(bytes: Uint8Array): DecodedDocumentBundle {
  if (!isZip(bytes)) throw new DocumentBundleError("not a ZIP archive");
  const entries = new Map(
    readZip(bytes).map((entry) => [entry.path, entry.contents]),
  );
  const decoder = new TextDecoder();
  const manifest = entries.get(MANIFEST_PATH);
  let documentPath: string;
  if (manifest !== undefined) {
    documentPath = manifestDocument(decoder.decode(manifest));
  } else {
    const candidates = [...entries.keys()].filter(
      (path) => path.endsWith(".jsonl") && !path.startsWith("__MACOSX/"),
    );
    if (candidates.length !== 1)
      throw new DocumentBundleError(
        candidates.length === 0
          ? "the archive holds no .jsonl document"
          : "the archive holds more than one .jsonl document",
      );
    documentPath = candidates[0] as string;
  }
  const text = entries.get(documentPath);
  if (text === undefined)
    throw new DocumentBundleError(`the archive has no ${documentPath}`);
  const parsed = parseDocumentResult(decoder.decode(text));
  if (!parsed.ok)
    throw new DocumentBundleError(
      `${documentPath} is not a valid document: ${parsed.issues
        .filter((issue) => issue.severity === "error")
        .map((issue) => `${issue.path}: ${issue.message}`)
        .join("; ")}`,
    );
  const root = directoryOf(documentPath);
  const attachments = new Map<string, Uint8Array>();
  const missing: string[] = [];
  for (const element of parsed.document.elements) {
    if (element.type !== "image.raster") continue;
    const src = (element.semantic as ImageSemantic).src;
    // Only validated relative paths are looked up, so nothing in the
    // archive can name a file outside the document's directory.
    if (!isRasterAttachmentPath(src) || attachments.has(src)) continue;
    const contents = entries.get(`${root}${src}`);
    if (contents === undefined) {
      if (!missing.includes(src)) missing.push(src);
    } else attachments.set(src, contents);
  }
  return { document: parsed.document, attachments, missing };
}
