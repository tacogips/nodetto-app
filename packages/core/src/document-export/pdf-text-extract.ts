const unsupported = (message: string): never => {
  throw new Error(`unsupported PDF structure: ${message}`);
};
interface PdfObject {
  body: string;
  stream?: Uint8Array;
}
export async function extractPdfText(
  bytes: Uint8Array,
): Promise<{ pages: string[] }> {
  const source = Array.from(bytes, (b) => String.fromCharCode(b)).join("");
  const objects = new Map<number, PdfObject>();
  const header = /(\d+)\s+\d+\s+obj\b/g;
  while (true) {
    const match = header.exec(source);
    if (!match) break;
    const start = header.lastIndex;
    const end = source.indexOf("endobj", start);
    if (end < 0) unsupported("unterminated object");
    let body = source.slice(start, end);
    let stream: Uint8Array | undefined;
    const marker = /\bstream\r?\n/.exec(body);
    if (marker) {
      const dict = body.slice(0, marker.index);
      const length =
        /\/Length\s+(\d+)\b(?!\s+\d+\s+R)/.exec(dict) ??
        unsupported("stream length");
      const streamStart = start + marker.index + marker[0].length;
      stream = bytes.slice(streamStart, streamStart + Number(length[1]));
      const streamEnd = source.indexOf(
        "endstream",
        streamStart + stream.length,
      );
      if (streamEnd < 0) unsupported("unterminated stream");
      const objectEnd = source.indexOf("endobj", streamEnd + 9);
      if (objectEnd < 0) unsupported("unterminated object");
      body = dict;
      header.lastIndex = objectEnd + 6;
    } else header.lastIndex = end + 6;
    objects.set(Number(match[1]), { body, stream });
  }
  const object = (id: number): PdfObject =>
    objects.get(id) ?? unsupported(`missing object ${id}`);
  const streamText = async (id: number): Promise<string> => {
    const obj = object(id);
    if (!obj.stream) return unsupported("missing stream");
    let data: Uint8Array = obj.stream;
    if (/\/FlateDecode\b/.test(obj.body)) {
      const input = new Blob([new Uint8Array(data)])
        .stream()
        .pipeThrough(new DecompressionStream("deflate"));
      data = new Uint8Array(await new Response(input).arrayBuffer());
    } else if (/\/Filter\b/.test(obj.body)) unsupported("stream filter");
    return new TextDecoder().decode(data);
  };
  const maps = new Map<number, Map<number, string>>();
  for (const [id, obj] of objects) {
    if (!/\/Subtype\s*\/Type3\b/.test(obj.body)) continue;
    const ref =
      /\/ToUnicode\s+(\d+)\s+\d+\s+R/.exec(obj.body) ??
      unsupported("missing ToUnicode");
    const cmap = await streamText(Number(ref[1]));
    const map = new Map<number, string>();
    for (const block of cmap.matchAll(
      /\d+\s+beginbfchar\b([\s\S]*?)endbfchar/g,
    )) {
      for (const item of block[1].matchAll(
        /<([0-9A-Fa-f]{2})>\s*<([0-9A-Fa-f]+)>/g,
      )) {
        if (item[2].length % 4) unsupported("invalid Unicode mapping");
        let value = "";
        for (let i = 0; i < item[2].length; i += 4)
          value += String.fromCharCode(
            Number.parseInt(item[2].slice(i, i + 4), 16),
          );
        map.set(Number.parseInt(item[1], 16), value);
      }
    }
    maps.set(id, map);
  }
  const catalog = [...objects.values()].find((o) =>
    /\/Type\s*\/Catalog\b/.test(o.body),
  );
  const root =
    (catalog && /\/Pages\s+(\d+)\s+\d+\s+R/.exec(catalog.body)) ??
    unsupported("missing page tree");
  const pages: string[] = [];
  const seen = new Set<number>();
  const walk = async (id: number, inherited: string): Promise<void> => {
    if (seen.has(id)) unsupported("cyclic page tree");
    seen.add(id);
    const body = object(id).body;
    const resourcesRef = /\/Resources\s+(\d+)\s+\d+\s+R/.exec(body);
    const resources = resourcesRef
      ? object(Number(resourcesRef[1])).body
      : /\/Resources\s*<</.test(body)
        ? body
        : inherited;
    if (/\/Type\s*\/Pages\b/.test(body)) {
      const kids =
        /\/Kids\s*\[([^\]]*)\]/.exec(body) ?? unsupported("missing page kids");
      for (const kid of kids[1].matchAll(/(\d+)\s+\d+\s+R/g))
        await walk(Number(kid[1]), resources);
      return;
    }
    if (!/\/Type\s*\/Page\b/.test(body)) unsupported("page node");
    const fontRef = /\/Font\s+(\d+)\s+\d+\s+R/.exec(resources);
    const fontSource = fontRef ? object(Number(fontRef[1])).body : resources;
    const names = new Map<string, Map<number, string>>();
    for (const item of fontSource.matchAll(
      /\/([^\s/<>\[\]]+)\s+(\d+)\s+\d+\s+R/g,
    )) {
      const map = maps.get(Number(item[2]));
      if (map) names.set(item[1], map);
    }
    const contents = /\/Contents\s*(\[[^\]]*\]|\d+\s+\d+\s+R)/.exec(body);
    if (!contents) {
      pages.push("");
      return;
    }
    const refs = [...contents[1].matchAll(/(\d+)\s+\d+\s+R/g)];
    const runs: string[] = [];
    for (const ref of refs) {
      const content = await streamText(Number(ref[1]));
      for (const block of content.matchAll(/\bBT\b([\s\S]*?)\bET\b/g)) {
        let font: Map<number, string> | undefined;
        let run = "";
        let hasText = false;
        for (const token of block[1].matchAll(
          /\/([^\s/]+)\s+[+-]?(?:\d+\.?\d*|\.\d+)\s+Tf|<([0-9A-Fa-f]*)>\s*Tj/g,
        )) {
          if (token[1]) font = names.get(token[1]);
          else {
            if (token[2].length % 2) unsupported("unmapped text");
            const currentFont = font ?? unsupported("unmapped text");
            hasText = true;
            for (let i = 0; i < token[2].length; i += 2)
              run +=
                currentFont.get(
                  Number.parseInt(token[2].slice(i, i + 2), 16),
                ) ?? unsupported("unmapped code");
          }
        }
        if (hasText) runs.push(run);
      }
    }
    pages.push(runs.join("\n"));
  };
  await walk(Number(root[1]), "");
  return { pages };
}
