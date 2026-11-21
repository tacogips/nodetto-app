import type { CadDisplayBody } from "@nodetto/core";
import type { ElementId } from "@nodetto/ir";
import { type Camera3d, viewProjection } from "./camera3d.ts";
import type { CadTheme, Rgb } from "./theme.ts";

type Highlight = { bodyId: ElementId; faceName?: string };
type Mesh = { positions: Float32Array; indices: Uint32Array };

export interface CadRenderer {
  setBodies(bodies: readonly CadDisplayBody[]): void;
  setTheme(theme: CadTheme): void;
  setHighlight(pick: Highlight | null): void;
  setOverlay(lines: Float32Array | null, mesh: Mesh | null): void;
  setGridVisible?(visible: boolean): void;
  setSketchLines?(
    lines: Float32Array,
    highlighted: Float32Array,
    drawing: boolean,
  ): void;
  setSketchGrid?(lines: Float32Array | null): void;
  draw(camera: Camera3d, widthPx: number, heightPx: number): void;
  readonly diagnostics: {
    readonly programsLinked: boolean;
    readonly renderer: string;
  };
  dispose(): void;
}

const VERTEX = `#version 300 es
layout(location = 0) in vec3 position;
uniform mat4 projection;
out vec3 viewPosition;
void main() {
  gl_Position = projection * vec4(position, 1.0);
  // The projection scales each view axis but does not mix them.
  vec3 right = normalize(vec3(projection[0][0], projection[1][0], projection[2][0]));
  vec3 up = normalize(vec3(projection[0][1], projection[1][1], projection[2][1]));
  vec3 back = normalize(-vec3(projection[0][2], projection[1][2], projection[2][2]));
  viewPosition = vec3(dot(position, right), dot(position, up), dot(position, back));
}`;

const FACE_FRAGMENT = `#version 300 es
precision highp float;
uniform vec4 color;
in vec3 viewPosition;
out vec4 pixel;
void main() {
  vec3 normal = cross(dFdx(viewPosition), dFdy(viewPosition));
  float lengthSquared = dot(normal, normal);
  // Display rounding can reverse a sliver. Lighting is two-sided, and
  // degenerate derivatives never enter the normalisation.
  float facing = lengthSquared > 0.0 ? abs(normal.z) * inversesqrt(lengthSquared) : 0.0;
  pixel = vec4(color.rgb * (0.72 + 0.28 * facing), color.a);
}`;

const LINE_FRAGMENT = `#version 300 es
precision highp float;
uniform vec4 color;
out vec4 pixel;
void main() { pixel = color; }
`;

interface Program {
  readonly id: WebGLProgram;
  readonly projection: WebGLUniformLocation | null;
  readonly color: WebGLUniformLocation | null;
}

function link(gl: WebGL2RenderingContext, fragment: string): Program | null {
  const id = gl.createProgram();
  if (!id) return null;
  for (const [kind, source] of [
    [gl.VERTEX_SHADER, VERTEX],
    [gl.FRAGMENT_SHADER, fragment],
  ] as const) {
    const shader = gl.createShader(kind);
    if (!shader) {
      gl.deleteProgram(id);
      return null;
    }
    gl.shaderSource(shader, source);
    gl.compileShader(shader);
    const compiled = gl.getShaderParameter(shader, gl.COMPILE_STATUS);
    if (compiled) gl.attachShader(id, shader);
    gl.deleteShader(shader);
    if (!compiled) {
      gl.deleteProgram(id);
      return null;
    }
  }
  gl.linkProgram(id);
  if (!gl.getProgramParameter(id, gl.LINK_STATUS)) {
    gl.deleteProgram(id);
    return null;
  }
  return {
    id,
    projection: gl.getUniformLocation(id, "projection"),
    color: gl.getUniformLocation(id, "color"),
  };
}

type Range = { offset: number; count: number };

function groupFaces(body: CadDisplayBody): {
  indices: Uint32Array;
  ranges: ReadonlyMap<string, Range>;
} {
  const counts = new Uint32Array(body.faceNames.length);
  for (const face of body.triFace) counts[face] += 3;
  const cursors = new Uint32Array(counts.length);
  const ranges = new Map<string, Range>();
  let offset = 0;
  for (const [face, name] of body.faceNames.entries()) {
    const count = counts[face];
    cursors[face] = offset;
    ranges.set(name, { offset, count });
    offset += count;
  }

  const indices = new Uint32Array(body.indices.length);
  for (let tri = 0; tri < body.triFace.length; tri++) {
    const face = body.triFace[tri];
    const target = cursors[face];
    indices[target] = body.indices[tri * 3];
    indices[target + 1] = body.indices[tri * 3 + 1];
    indices[target + 2] = body.indices[tri * 3 + 2];
    cursors[face] += 3;
  }
  return { indices, ranges };
}

interface Geometry {
  readonly vao: WebGLVertexArrayObject | null;
  readonly positions: WebGLBuffer | null;
  readonly indices: WebGLBuffer | null;
  readonly count: number;
}

function gridLines(): Float32Array {
  const lines: number[] = [];
  const extent = 100;
  for (let mm = -extent; mm <= extent; mm += 10) {
    lines.push(-extent, mm, 0, extent, mm, 0, mm, -extent, 0, mm, extent, 0);
  }
  return new Float32Array(lines);
}

export function createWebgl2Renderer(
  canvas: HTMLCanvasElement,
): CadRenderer | null {
  const context = canvas.getContext("webgl2", { alpha: false });
  if (!context) return null;
  const gl = context;

  const faces = link(gl, FACE_FRAGMENT);
  const lines = link(gl, LINE_FRAGMENT);
  if (!faces || !lines) {
    if (faces) gl.deleteProgram(faces.id);
    if (lines) gl.deleteProgram(lines.id);
    return null;
  }

  function upload(positions: Float32Array, indices?: Uint32Array): Geometry {
    const vao = gl.createVertexArray();
    const vertices = gl.createBuffer();
    gl.bindVertexArray(vao);
    gl.bindBuffer(gl.ARRAY_BUFFER, vertices);
    gl.bufferData(gl.ARRAY_BUFFER, positions, gl.STATIC_DRAW);
    gl.enableVertexAttribArray(0);
    gl.vertexAttribPointer(0, 3, gl.FLOAT, false, 0, 0);
    const elements = indices ? gl.createBuffer() : null;
    if (indices) {
      gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, elements);
      gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, indices, gl.STATIC_DRAW);
    }
    gl.bindVertexArray(null);
    return {
      vao,
      positions: vertices,
      indices: elements,
      count: indices?.length ?? positions.length / 3,
    };
  }

  function release(geometry: Geometry | null): void {
    if (!geometry) return;
    gl.deleteVertexArray(geometry.vao);
    gl.deleteBuffer(geometry.positions);
    gl.deleteBuffer(geometry.indices);
  }

  let bodies: {
    id: ElementId;
    reference: boolean;
    mesh: Geometry;
    edges: Geometry;
    ranges: ReadonlyMap<string, Range>;
  }[] = [];
  let overlayLines: Geometry | null = null;
  let overlayMesh: Geometry | null = null;
  let sketchGrid: Geometry | null = null;
  let sketchLines: Geometry | null = null;
  let sketchHighlight: Geometry | null = null;
  let drawingSketch = false;
  let theme: CadTheme | undefined;
  let highlight: Highlight | null = null;
  let showGrid = true;
  const grid = upload(gridLines());
  gl.disable(gl.CULL_FACE);
  const debug = gl.getExtension("WEBGL_debug_renderer_info");
  const renderer = String(
    gl.getParameter(debug?.UNMASKED_RENDERER_WEBGL ?? gl.RENDERER),
  );

  function color(program: Program, rgb: Rgb, opacity = 1): void {
    gl.uniform4f(
      program.color,
      rgb[0] / 255,
      rgb[1] / 255,
      rgb[2] / 255,
      opacity,
    );
  }

  function segments(geometry: Geometry): void {
    gl.bindVertexArray(geometry.vao);
    gl.drawArrays(gl.LINES, 0, geometry.count);
  }

  function triangles(geometry: Geometry, offset: number, count: number): void {
    if (count === 0) return;
    gl.bindVertexArray(geometry.vao);
    gl.drawElements(
      gl.TRIANGLES,
      count,
      gl.UNSIGNED_INT,
      offset * Uint32Array.BYTES_PER_ELEMENT,
    );
  }

  function clearBodies(): void {
    for (const body of bodies) {
      release(body.mesh);
      release(body.edges);
    }
    bodies = [];
  }

  function clearOverlay(): void {
    release(overlayLines);
    release(overlayMesh);
    overlayLines = overlayMesh = null;
  }

  return {
    diagnostics: { programsLinked: true, renderer },
    setBodies(next) {
      clearBodies();
      bodies = next.map((body) => {
        const { indices, ranges } = groupFaces(body);
        return {
          id: body.id,
          reference: body.reference,
          mesh: upload(body.positions, indices),
          edges: upload(body.edges),
          ranges,
        };
      });
      bodies.sort((a, b) => Number(a.reference) - Number(b.reference));
    },
    setTheme(next) {
      theme = next;
    },
    setHighlight(pick) {
      highlight = pick;
    },
    setOverlay(nextLines, nextMesh) {
      clearOverlay();
      if (nextLines) overlayLines = upload(nextLines);
      if (nextMesh) overlayMesh = upload(nextMesh.positions, nextMesh.indices);
    },
    setGridVisible(visible) {
      showGrid = visible;
    },
    setSketchLines(nextLines, highlighted, drawing) {
      release(sketchLines);
      release(sketchHighlight);
      sketchLines = nextLines.length ? upload(nextLines) : null;
      sketchHighlight = highlighted.length ? upload(highlighted) : null;
      drawingSketch = drawing;
    },
    setSketchGrid(next) {
      release(sketchGrid);
      sketchGrid = next?.length ? upload(next) : null;
    },
    draw(camera, widthPx, heightPx) {
      if (!theme || widthPx <= 0 || heightPx <= 0) return;
      if (canvas.width !== widthPx) canvas.width = widthPx;
      if (canvas.height !== heightPx) canvas.height = heightPx;
      const projection = viewProjection(camera, widthPx / heightPx);
      gl.viewport(0, 0, widthPx, heightPx);
      const [r, g, b] = theme.background;
      gl.clearColor(r / 255, g / 255, b / 255, 1);
      gl.depthMask(true);
      gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);
      gl.enable(gl.DEPTH_TEST);
      gl.depthFunc(gl.LEQUAL);
      gl.enable(gl.BLEND);
      gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA);

      gl.useProgram(faces.id);
      gl.uniformMatrix4fv(faces.projection, false, projection);
      gl.enable(gl.POLYGON_OFFSET_FILL);
      gl.polygonOffset(1, 1);
      for (const { id, mesh, reference, ranges } of bodies) {
        const selected = highlight?.bodyId === id ? highlight : null;
        const opacity = reference ? 0.45 : 1;
        const range =
          selected?.faceName === undefined
            ? undefined
            : ranges.get(selected.faceName);
        color(
          faces,
          selected && !selected.faceName ? theme.highlight : theme.body,
          opacity,
        );
        triangles(mesh, 0, range?.offset ?? mesh.count);
        if (range) {
          triangles(
            mesh,
            range.offset + range.count,
            mesh.count - range.offset - range.count,
          );
          color(faces, theme.highlight, opacity);
          triangles(mesh, range.offset, range.count);
        }
      }
      if (overlayMesh) {
        // Show the tool volume even where an inward extrusion is inside the body.
        gl.disable(gl.DEPTH_TEST);
        gl.depthMask(false);
        color(faces, theme.highlight, 0.25);
        triangles(overlayMesh, 0, overlayMesh.count);
        gl.enable(gl.DEPTH_TEST);
      }
      gl.disable(gl.POLYGON_OFFSET_FILL);

      gl.useProgram(lines.id);
      gl.uniformMatrix4fv(lines.projection, false, projection);
      // Edges claim depth before the coplanar grid. The grid blends gently
      // so it stays behind the solid contours at intersections.
      gl.depthMask(true);
      for (const body of bodies) {
        const selected = highlight?.bodyId === body.id && !highlight.faceName;
        color(
          lines,
          selected ? theme.highlight : theme.line,
          body.reference ? 0.55 : 1,
        );
        segments(body.edges);
      }
      if (showGrid) {
        gl.depthMask(false);
        color(lines, theme.grid, 0.6);
        segments(sketchGrid ?? grid);
      }
      gl.depthMask(false);
      if (sketchLines) {
        color(lines, theme.line);
        segments(sketchLines);
      }
      if (drawingSketch) gl.disable(gl.DEPTH_TEST);
      if (sketchHighlight) {
        color(lines, theme.highlight);
        segments(sketchHighlight);
      }
      if (overlayLines) {
        gl.disable(gl.DEPTH_TEST);
        color(lines, theme.highlight);
        segments(overlayLines);
      }
      if (drawingSketch || overlayLines) gl.enable(gl.DEPTH_TEST);
      gl.depthMask(true);
      gl.bindVertexArray(null);
    },
    dispose() {
      clearBodies();
      clearOverlay();
      release(sketchGrid);
      release(sketchLines);
      release(sketchHighlight);
      release(grid);
      gl.deleteProgram(faces.id);
      gl.deleteProgram(lines.id);
    },
  };
}
