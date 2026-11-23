const binaryHeaderLength = 84;
const binaryFacetLength = 50;

export interface StlMesh {
  readonly positions: Float64Array | Float32Array;
  readonly triangles: Uint32Array;
}

export interface StlLimits {
  readonly maxBytes?: number;
  readonly maxTriangles?: number;
}

export class StlError extends Error {
  constructor(
    readonly code: string,
    message = code,
  ) {
    super(message);
    this.name = "StlError";
  }
}

function identityTriangles(count: number): Uint32Array {
  const triangles = new Uint32Array(count * 3);
  for (let index = 0; index < triangles.length; index++)
    triangles[index] = index;
  return triangles;
}

function readBinary(view: DataView, count: number): StlMesh {
  const positions = new Float32Array(count * 9);
  for (let facet = 0; facet < count; facet++) {
    const offset = binaryHeaderLength + facet * binaryFacetLength;
    for (let field = 0; field < 12; field++) {
      const value = view.getFloat32(offset + field * 4, true);
      if (!Number.isFinite(value)) throw new StlError("stl.number");
      if (field >= 3) positions[facet * 9 + field - 3] = value;
    }
  }
  return { positions, triangles: identityTriangles(count) };
}

function isWhitespace(byte: number): boolean {
  return byte === 32 || (byte >= 9 && byte <= 13);
}

const decimal = /^[+-]?(?:[0-9]+(?:\.[0-9]*)?|\.[0-9]+)(?:[eE][+-]?[0-9]+)?$/;

class AsciiScanner {
  private offset = 0;

  constructor(private readonly bytes: Uint8Array) {
    if (bytes[0] === 0xef && bytes[1] === 0xbb && bytes[2] === 0xbf) {
      this.offset = 3;
    }
  }

  next(): string {
    let byte = this.bytes[this.offset] as number;
    while (isWhitespace(byte)) byte = this.bytes[++this.offset] as number;
    let token = "";
    while (this.offset < this.bytes.length && !isWhitespace(byte)) {
      if (token.length === 128 || byte < 33 || byte > 126) {
        throw new StlError("stl.syntax");
      }
      token += String.fromCharCode(byte);
      byte = this.bytes[++this.offset] as number;
    }
    return token;
  }

  expect(keyword: string): void {
    const token = this.next();
    if (token === "") throw new StlError("stl.truncated");
    if (token.toLowerCase() !== keyword) throw new StlError("stl.syntax");
  }

  skipName(): void {
    // The name occupies the rest of the line and is never materialized.
    while (this.offset < this.bytes.length) {
      const byte = this.bytes[this.offset++] as number;
      if (byte === 10 || byte === 13) break;
      if (byte < 32 && byte !== 9) throw new StlError("stl.syntax");
    }
  }

  number(): number {
    const token = this.next();
    if (token === "") throw new StlError("stl.truncated");
    const value = Number(token);
    if (!decimal.test(token) || !Number.isFinite(value)) {
      throw new StlError("stl.number");
    }
    return value;
  }
}

function scanAscii(
  bytes: Uint8Array,
  maxTriangles: number,
  positions?: Float64Array,
): number {
  const scanner = new AsciiScanner(bytes);
  scanner.expect("solid");
  scanner.skipName();
  let count = 0;
  for (;;) {
    const token = scanner.next().toLowerCase();
    if (token === "endsolid") break;
    if (token === "") throw new StlError("stl.truncated");
    if (token !== "facet") throw new StlError("stl.syntax");
    if (count === maxTriangles) throw new StlError("stl.count");
    scanner.expect("normal");
    scanner.number();
    scanner.number();
    scanner.number();
    scanner.expect("outer");
    scanner.expect("loop");
    for (let vertex = 0; vertex < 3; vertex++) {
      scanner.expect("vertex");
      for (let axis = 0; axis < 3; axis++) {
        const value = scanner.number();
        if (positions) positions[count * 9 + vertex * 3 + axis] = value;
      }
    }
    scanner.expect("endloop");
    scanner.expect("endfacet");
    count++;
  }
  scanner.skipName();
  if (scanner.next() !== "") throw new StlError("stl.syntax");
  return count;
}

export function readStl(bytes: Uint8Array, limits: StlLimits = {}): StlMesh {
  const { maxBytes = 64 * 1024 * 1024, maxTriangles = 2_000_000 } = limits;
  if (
    !Number.isSafeInteger(maxBytes) ||
    maxBytes < 0 ||
    bytes.length > maxBytes
  ) {
    throw new StlError("stl.size");
  }
  if (!Number.isSafeInteger(maxTriangles) || maxTriangles < 0) {
    throw new StlError("stl.count");
  }
  if (bytes.length >= binaryHeaderLength) {
    const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
    const count = view.getUint32(80, true);
    if (binaryHeaderLength + binaryFacetLength * count === bytes.length) {
      if (count > maxTriangles) throw new StlError("stl.count");
      return readBinary(view, count);
    }
  }

  // Validate and count first so an incomplete facet cannot cause an allocation.
  const count = scanAscii(bytes, maxTriangles);
  const positions = new Float64Array(count * 9);
  if (count > 0) scanAscii(bytes, maxTriangles, positions);
  return { positions, triangles: identityTriangles(count) };
}
