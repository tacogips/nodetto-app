import { expect, test } from "bun:test";
import { CAD_TEST_PAGE, sketch } from "../cad/testing/documents.ts";
import { boardReference, edge, testBoard } from "../cad/testing/pcb.ts";
import { CaptureInputError, prepareCadCapture } from "./cad-request.ts";
import { type CaptureCameraRequest, captureCamera } from "./camera.ts";
import { capturePlateDocument } from "./testing/plate.ts";

const size = { width: 320, height: 240, theme: "dark" } as const;
const plate = capturePlateDocument();

test.each([
  { view: "iso" },
  { view: "top" },
  { view: "bottom" },
  { view: "front" },
  { view: "back" },
  { view: "left" },
  { view: "right" },
  { direction: [0, 1, -0.15] },
  { eye: [100, 200, 300], target: [12, 6, 2] },
  { view: "front", up: [1, 0, 1], zoom: 3, target: [4, 9, 1] },
] satisfies CaptureCameraRequest[])(
  "serializes the requested camera, size and sampling for %j",
  (request) => {
    const { scene, camera, model } = prepareCadCapture(
      plate.elements,
      CAD_TEST_PAGE.id,
      { ...size, camera: request },
    );
    if (!model.bounds) throw new Error("Missing bounds");
    expect(camera).toEqual(
      captureCamera(
        request,
        model.bounds,
        size,
        model.bodies.map((body) => body.bounds),
      ),
    );
    const view = new DataView(scene.buffer, scene.byteOffset, scene.byteLength);
    expect(
      [8, 12, 16, 28].map((offset) => view.getUint32(offset, true)),
    ).toEqual([size.width, size.height, 2, 0]);
    expect(
      Array.from({ length: 13 }, (_, i) => view.getFloat64(40 + i * 8, true)),
    ).toEqual([
      ...camera.right,
      ...camera.up,
      ...camera.forward,
      ...camera.centre,
      camera.mmPerPixel,
    ]);
    expect([...scene.subarray(160, 163)]).toEqual([0x15, 0x19, 0x1b]);
    expect(scene[172]).toBe(115);
    expect(
      prepareCadCapture(plate.elements, CAD_TEST_PAGE.id, {
        ...size,
        camera: request,
      }).scene,
    ).toEqual(scene);
  },
);

test("reports a sketch-only page and rejects a degenerate camera", () => {
  expect(() =>
    prepareCadCapture([sketch("base", "a1")], CAD_TEST_PAGE.id, {
      ...size,
      camera: {},
    }),
  ).toThrow("1 sketches, 0 features failed");
  const run = () =>
    prepareCadCapture(plate.elements, CAD_TEST_PAGE.id, {
      ...size,
      camera: { view: "top", up: [0, 0, 2] },
    });
  expect(run).toThrow(CaptureInputError);
  expect(run).toThrow("must not be parallel");
});

test("prepares CAD capture using the outline on a separate PCB page", () => {
  const board = testBoard(1.6);
  const outline = edge("outline", {
    kind: "rect",
    start: [4, 8],
    end: [44, 38],
  });
  const reference = boardReference();
  const result = prepareCadCapture(
    [reference, board, outline],
    CAD_TEST_PAGE.id,
    {
      ...size,
      camera: { view: "top" },
    },
  );
  expect(result.model.errors).toEqual([]);
  expect(result.model.bodies).toMatchObject([
    {
      id: reference.id,
      reference: true,
      bounds: { min: [0, 0, 0], max: [40, 30, 1.6] },
    },
  ]);
  expect(result.frame).toBe("complete");
});
