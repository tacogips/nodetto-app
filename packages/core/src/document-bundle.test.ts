import { expect, test } from "bun:test";
import { readZip } from "@nodetto/io";
import { encodeRasterDataUrl, type ImageSemantic } from "@nodetto/ir";
import {
  decodeDocumentBundle,
  DocumentBundleError,
  encodeDocumentBundle,
  isDocumentBundlePath,
  looksLikeDocumentBundle,
} from "./document-bundle.ts";
import { Editor } from "./editor.ts";
import { encodeStoredZip } from "./zip.ts";

// Smallest valid PNG / GIF signatures are enough: bundles copy bytes as-is.
const PNG_A = Uint8Array.from([137, 80, 78, 71, 13, 10, 26, 10, 1, 2, 3]);
const PNG_B = Uint8Array.from([137, 80, 78, 71, 13, 10, 26, 10, 9, 8, 7]);
const GIF = Uint8Array.from([71, 73, 70, 56, 57, 97, 0, 0]);

test("a bundle round-trips the document and its referenced attachments", () => {
  const editor = new Editor();
  editor.createElement("image.raster", {
    semantic: { src: "artifacts/a.png", alt: "A" },
  });
  editor.createElement("image.raster", {
    semantic: { src: "artifacts/a.png", alt: "A again" },
  });
  editor.createElement("image.raster", {
    semantic: { src: "pictures/b.png", alt: "B" },
  });
  const files = new Map([
    ["artifacts/a.png", PNG_A],
    ["pictures/b.png", PNG_B],
    ["artifacts/unused.png", GIF],
  ]);
  const reads: string[] = [];
  const encoded = encodeDocumentBundle(editor.getSnapshot(), (src) => {
    reads.push(src);
    return files.get(src);
  });
  expect(encoded.attachments).toEqual(["artifacts/a.png", "pictures/b.png"]);
  // Each attachment is read once, whatever order the elements come in.
  expect(reads.sort()).toEqual(["artifacts/a.png", "pictures/b.png"]);
  expect(readZip(encoded.bytes).map((entry) => entry.path)).toEqual([
    "manifest.json",
    "document.jsonl",
    "artifacts/a.png",
    "pictures/b.png",
  ]);
  expect(looksLikeDocumentBundle(encoded.bytes)).toBe(true);

  const decoded = decodeDocumentBundle(encoded.bytes);
  expect(decoded.document).toEqual(editor.getSnapshot());
  expect(decoded.missing).toEqual([]);
  // Decoding follows the elements, whose order follows their random ids.
  expect([...decoded.attachments.keys()].sort()).toEqual([
    "artifacts/a.png",
    "pictures/b.png",
  ]);
  expect(decoded.attachments.get("pictures/b.png")).toEqual(PNG_B);
});

test("bundling is deterministic", () => {
  const editor = new Editor();
  editor.createElement("image.raster", {
    semantic: { src: "artifacts/a.png", alt: "A" },
  });
  const read = () => PNG_A;
  const first = encodeDocumentBundle(editor.getSnapshot(), read).bytes;
  const second = encodeDocumentBundle(editor.getSnapshot(), read).bytes;
  expect(second).toEqual(first);
});

test("embedded and non-portable images move to generated attachment files", () => {
  const editor = new Editor();
  editor.createElement("image.raster", {
    semantic: { src: encodeRasterDataUrl(GIF), alt: "Inline" },
  });
  editor.createElement("image.raster", {
    semantic: { src: "画像/図.png", alt: "Unicode" },
  });
  const encoded = encodeDocumentBundle(editor.getSnapshot(), (src) =>
    src === "画像/図.png" ? PNG_A : undefined,
  );
  expect(encoded.attachments).toHaveLength(2);
  const decoded = decodeDocumentBundle(encoded.bytes);
  const byAlt = new Map(
    decoded.document.elements
      .filter((element) => element.type === "image.raster")
      .map((element) => {
        const image = element.semantic as ImageSemantic;
        return [image.alt, image.src] as const;
      }),
  );
  const inline = byAlt.get("Inline") ?? "";
  const unicode = byAlt.get("Unicode") ?? "";
  expect(inline).toMatch(/^artifacts\/bundle-\d\.gif$/);
  expect(unicode).toMatch(/^artifacts\/bundle-\d\.png$/);
  expect(decoded.attachments.get(inline)).toEqual(GIF);
  expect(decoded.attachments.get(unicode)).toEqual(PNG_A);
});

test("a missing attachment fails the bundle instead of dropping the image", () => {
  const editor = new Editor();
  editor.createElement("image.raster", {
    semantic: { src: "artifacts/gone.png", alt: "Gone" },
  });
  expect(() =>
    encodeDocumentBundle(editor.getSnapshot(), () => undefined),
  ).toThrow(new DocumentBundleError("Missing attachment: artifacts/gone.png"));
});

test("a hand-made ZIP with one JSONL in a folder decodes relative to it", () => {
  const editor = new Editor();
  editor.createElement("image.raster", {
    semantic: { src: "artifacts/a.png", alt: "A" },
  });
  editor.createElement("image.raster", {
    semantic: { src: "artifacts/b.png", alt: "B" },
  });
  const bundle = decodeDocumentBundle(
    encodeDocumentBundle(editor.getSnapshot(), (src) =>
      src.endsWith("a.png") ? PNG_A : PNG_B,
    ).bytes,
  );
  const text = readZip(
    encodeDocumentBundle(bundle.document, (src) => bundle.attachments.get(src))
      .bytes,
  ).find((entry) => entry.path === "document.jsonl")?.contents;
  if (!text) throw new Error("no document");
  const manual = encodeStoredZip(
    [
      { path: "shared/design.jsonl", contents: text },
      { path: "shared/artifacts/a.png", contents: PNG_A },
    ],
    "test",
  );
  expect(looksLikeDocumentBundle(manual)).toBe(true);
  const decoded = decodeDocumentBundle(manual);
  expect(decoded.document).toEqual(editor.getSnapshot());
  expect([...decoded.attachments.keys()]).toEqual(["artifacts/a.png"]);
  expect(decoded.missing).toEqual(["artifacts/b.png"]);
});

test("archives that are not bundles are refused with a reason", () => {
  const gerber = encodeStoredZip(
    [{ path: "board.gtl", contents: new TextEncoder().encode("G04*") }],
    "test",
  );
  expect(looksLikeDocumentBundle(gerber)).toBe(false);
  expect(() => decodeDocumentBundle(gerber)).toThrow(
    "the archive holds no .jsonl document",
  );
  const future = encodeStoredZip(
    [
      {
        path: "manifest.json",
        contents: new TextEncoder().encode(
          JSON.stringify({
            format: "nodetto-bundle",
            version: 99,
            document: "document.jsonl",
          }),
        ),
      },
    ],
    "test",
  );
  expect(() => decodeDocumentBundle(future)).toThrow("newer than this app");
  expect(isDocumentBundlePath("Design.NODETTO")).toBe(true);
  expect(isDocumentBundlePath("design.jsonl")).toBe(false);
});
