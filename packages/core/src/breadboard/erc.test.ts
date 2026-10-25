import { describe, expect, test } from "bun:test";
import { lintBreadboardPage } from "./erc.ts";
import { buildBreadboardDocument } from "./test-builder.ts";

const PAGE = "breadboard-page";
const rules = (document: ReturnType<typeof buildBreadboardDocument>) =>
  lintBreadboardPage(document, PAGE).map((item) => item.ruleId);

describe("breadboard ERC rules 1-8", () => {
  test("pin-not-in-hole reports staged pins but accepts a pin in a hole", () => {
    const staged = buildBreadboardDocument({
      parts: [
        {
          id: "r",
          type: "breadboard.resistor",
          reference: "R1",
          pin1: { x: 700, y: 700 },
        },
      ],
    });
    expect(rules(staged)).toContain("pin-not-in-hole");
    const placed = buildBreadboardDocument({
      parts: [
        {
          id: "r",
          type: "breadboard.resistor",
          reference: "R1",
          pin1: { x: 20, y: 50 },
          semantic: { span: 0 },
        },
      ],
    });
    expect(rules(placed)).not.toContain("pin-not-in-hole");
  });

  test("shorted-part reports both pins on one net only", () => {
    const shorted = buildBreadboardDocument({
      parts: [
        {
          id: "r",
          type: "breadboard.resistor",
          reference: "R1",
          pin1: { x: 20, y: 50 },
          rotation: 90,
          semantic: { span: 4 },
        },
      ],
    });
    expect(rules(shorted)).toContain("shorted-part");
    const separate = buildBreadboardDocument({
      parts: [
        {
          id: "r",
          type: "breadboard.resistor",
          reference: "R1",
          pin1: { x: 20, y: 50 },
          semantic: { span: 4 },
        },
      ],
    });
    expect(rules(separate)).not.toContain("shorted-part");
  });

  test("rail-short reports a wire joining opposite rails", () => {
    const shorted = buildBreadboardDocument({
      wires: [
        {
          id: "w",
          points: [
            { x: 20, y: 20 },
            { x: 20, y: 10 },
          ],
        },
      ],
    });
    expect(
      lintBreadboardPage(shorted, PAGE).find(
        (item) => item.ruleId === "rail-short",
      )?.elementId,
    ).toBe("w");
    expect(
      lintBreadboardPage(shorted, PAGE).find(
        (item) => item.ruleId === "rail-short",
      )?.elementIds,
    ).toEqual(["w"]);
    const safe = buildBreadboardDocument({
      wires: [
        {
          id: "w",
          points: [
            { x: 20, y: 20 },
            { x: 25, y: 10 },
          ],
        },
      ],
    });
    expect(rules(safe)).not.toContain("rail-short");
  });

  test("reversed-polarity is reported only when supply reach is determinable", () => {
    const reversed = buildBreadboardDocument({
      parts: [
        {
          id: "led",
          type: "breadboard.led",
          reference: "D1",
          pin1: { x: 20, y: 10 },
          rotation: 90,
        },
        {
          id: "battery",
          type: "breadboard.battery",
          reference: "BT1",
          pin1: { x: 100, y: 100 },
        },
      ],
      wires: [
        {
          id: "neg",
          points: [
            { x: 20, y: 10 },
            { x: 30, y: 10 },
          ],
        },
      ],
    });
    const floating = buildBreadboardDocument({
      parts: [
        {
          id: "led",
          type: "breadboard.led",
          reference: "D1",
          pin1: { x: 700, y: 700 },
        },
      ],
    });
    expect(rules(reversed)).toContain("reversed-polarity");
    expect(rules(floating)).not.toContain("reversed-polarity");

    const resistorWires = [
      {
        id: "m",
        points: [
          { x: 20, y: 10 },
          { x: 20, y: 60 },
        ],
      },
      {
        id: "p",
        points: [
          { x: 40, y: 60 },
          { x: 40, y: 20 },
        ],
      },
    ];
    const reversedThroughResistor = buildBreadboardDocument({
      parts: [
        {
          id: "r",
          type: "breadboard.resistor",
          reference: "R1",
          pin1: { x: 20, y: 50 },
          semantic: { span: 1 },
        },
        {
          id: "led",
          type: "breadboard.led",
          reference: "D1",
          pin1: { x: 30, y: 50 },
          rotation: 0,
        },
      ],
      wires: resistorWires,
    });
    const forwardThroughResistor = buildBreadboardDocument({
      parts: [
        {
          id: "r",
          type: "breadboard.resistor",
          reference: "R1",
          pin1: { x: 20, y: 50 },
          semantic: { span: 1 },
        },
        {
          id: "led",
          type: "breadboard.led",
          reference: "D1",
          pin1: { x: 40, y: 50 },
          rotation: 180,
        },
      ],
      wires: resistorWires,
    });
    expect(
      lintBreadboardPage(reversedThroughResistor, PAGE).some(
        (item) =>
          item.ruleId === "reversed-polarity" && item.elementId === "led",
      ),
    ).toBe(true);
    expect(
      lintBreadboardPage(forwardThroughResistor, PAGE).some(
        (item) =>
          item.ruleId === "reversed-polarity" && item.elementId === "led",
      ),
    ).toBe(false);
  });

  test("closed button paths participate in polarity and series checks", () => {
    const buttonWires = [
      {
        id: "plus",
        points: [
          { x: 20, y: 20 },
          { x: 500, y: 500 },
        ],
      },
      {
        id: "switch-led",
        points: [
          { x: 520, y: 500 },
          { x: 700, y: 700 },
        ],
      },
    ];
    const forwardThroughButton = buildBreadboardDocument({
      parts: [
        {
          id: "switch",
          type: "breadboard.button",
          reference: "SW1",
          pin1: { x: 500, y: 500 },
        },
        {
          id: "led",
          type: "breadboard.led",
          reference: "D1",
          pin1: { x: 700, y: 700 },
        },
      ],
      wires: [
        ...buttonWires,
        {
          id: "minus",
          points: [
            { x: 710, y: 700 },
            { x: 20, y: 10 },
          ],
        },
      ],
    });
    const reversedThroughButton = buildBreadboardDocument({
      parts: [
        {
          id: "switch",
          type: "breadboard.button",
          reference: "SW1",
          pin1: { x: 500, y: 500 },
        },
        {
          id: "led",
          type: "breadboard.led",
          reference: "D1",
          pin1: { x: 700, y: 700 },
        },
      ],
      wires: [
        buttonWires[0],
        {
          id: "switch-cathode",
          points: [
            { x: 520, y: 500 },
            { x: 710, y: 700 },
          ],
        },
        {
          id: "anode-minus",
          points: [
            { x: 700, y: 700 },
            { x: 20, y: 10 },
          ],
        },
      ],
    });
    const buttonAndResistor = buildBreadboardDocument({
      parts: [
        {
          id: "switch",
          type: "breadboard.button",
          reference: "SW1",
          pin1: { x: 500, y: 500 },
        },
        {
          id: "led",
          type: "breadboard.led",
          reference: "D1",
          pin1: { x: 700, y: 700 },
        },
        {
          id: "resistor",
          type: "breadboard.resistor",
          reference: "R1",
          pin1: { x: 730, y: 700 },
          semantic: { span: 1 },
        },
      ],
      wires: [
        ...buttonWires,
        {
          id: "led-resistor",
          points: [
            { x: 710, y: 700 },
            { x: 730, y: 700 },
          ],
        },
        {
          id: "resistor-minus",
          points: [
            { x: 740, y: 700 },
            { x: 20, y: 10 },
          ],
        },
      ],
    });

    expect(rules(forwardThroughButton)).toContain("led-no-series-resistor");
    expect(
      lintBreadboardPage(reversedThroughButton, PAGE).some(
        (item) =>
          item.ruleId === "reversed-polarity" && item.elementId === "led",
      ),
    ).toBe(true);
    expect(rules(buttonAndResistor)).not.toContain("led-no-series-resistor");
  });

  test("led-no-series-resistor distinguishes a direct supply path", () => {
    const direct = buildBreadboardDocument({
      parts: [
        {
          id: "led",
          type: "breadboard.led",
          reference: "D1",
          pin1: { x: 700, y: 700 },
        },
      ],
      wires: [
        {
          id: "plus",
          points: [
            { x: 20, y: 20 },
            { x: 700, y: 700 },
          ],
        },
        {
          id: "minus",
          points: [
            { x: 710, y: 700 },
            { x: 20, y: 10 },
          ],
        },
      ],
    });
    expect(rules(direct)).toContain("led-no-series-resistor");
    const withResistor = buildBreadboardDocument({
      parts: [
        {
          id: "r",
          type: "breadboard.resistor",
          reference: "R1",
          pin1: { x: 20, y: 50 },
          semantic: { span: 1 },
        },
        {
          id: "led",
          type: "breadboard.led",
          reference: "D1",
          pin1: { x: 30, y: 50 },
        },
      ],
      wires: [
        {
          id: "plus",
          points: [
            { x: 20, y: 20 },
            { x: 20, y: 50 },
          ],
        },
        {
          id: "minus",
          points: [
            { x: 40, y: 50 },
            { x: 20, y: 10 },
          ],
        },
      ],
    });
    expect(rules(withResistor)).not.toContain("led-no-series-resistor");
  });

  test("zero-ohm LED paths find series LEDs and stop at series resistors", () => {
    const seriesLeds = buildBreadboardDocument({
      parts: [
        {
          id: "led1",
          type: "breadboard.led",
          reference: "D1",
          pin1: { x: 700, y: 700 },
        },
        {
          id: "led2",
          type: "breadboard.led",
          reference: "D2",
          pin1: { x: 800, y: 700 },
        },
      ],
      wires: [
        {
          id: "plus",
          points: [
            { x: 20, y: 20 },
            { x: 800, y: 700 },
          ],
        },
        {
          id: "between-leds",
          points: [
            { x: 810, y: 700 },
            { x: 700, y: 700 },
          ],
        },
        {
          id: "minus",
          points: [
            { x: 710, y: 700 },
            { x: 20, y: 10 },
          ],
        },
      ],
    });
    const seriesLedsAndResistor = buildBreadboardDocument({
      parts: [
        {
          id: "led1",
          type: "breadboard.led",
          reference: "D1",
          pin1: { x: 700, y: 700 },
        },
        {
          id: "led2",
          type: "breadboard.led",
          reference: "D2",
          pin1: { x: 800, y: 700 },
        },
        {
          id: "resistor",
          type: "breadboard.resistor",
          reference: "R1",
          pin1: { x: 820, y: 700 },
          semantic: { span: 1 },
        },
      ],
      wires: [
        {
          id: "plus",
          points: [
            { x: 20, y: 20 },
            { x: 800, y: 700 },
          ],
        },
        {
          id: "between-leds",
          points: [
            { x: 810, y: 700 },
            { x: 700, y: 700 },
          ],
        },
        {
          id: "led-resistor",
          points: [
            { x: 710, y: 700 },
            { x: 820, y: 700 },
          ],
        },
        {
          id: "resistor-minus",
          points: [
            { x: 830, y: 700 },
            { x: 20, y: 10 },
          ],
        },
      ],
    });

    expect(
      lintBreadboardPage(seriesLeds, PAGE)
        .filter((item) => item.ruleId === "led-no-series-resistor")
        .map((item) => item.elementId),
    ).toEqual(["led1", "led2"]);
    expect(
      lintBreadboardPage(seriesLedsAndResistor, PAGE).filter(
        (item) => item.ruleId === "led-no-series-resistor",
      ),
    ).toHaveLength(0);
    const reversed = buildBreadboardDocument({
      parts: [
        {
          id: "led",
          type: "breadboard.led",
          reference: "D1",
          pin1: { x: 700, y: 700 },
        },
      ],
      wires: [
        {
          id: "plus",
          points: [
            { x: 20, y: 20 },
            { x: 710, y: 700 },
          ],
        },
        {
          id: "minus",
          points: [
            { x: 700, y: 700 },
            { x: 20, y: 10 },
          ],
        },
      ],
    });
    expect(rules(reversed)).toContain("reversed-polarity");
    expect(rules(reversed)).not.toContain("led-no-series-resistor");
    const shortedSupply = buildBreadboardDocument({
      parts: [
        {
          id: "battery",
          type: "breadboard.battery",
          reference: "BT1",
          pin1: { x: 700, y: 700 },
        },
        {
          id: "led",
          type: "breadboard.led",
          reference: "D1",
          pin1: { x: 720, y: 700 },
        },
      ],
      wires: [
        {
          id: "battery-short",
          points: [
            { x: 700, y: 700 },
            { x: 700, y: 690 },
          ],
        },
        {
          id: "battery-led",
          points: [
            { x: 700, y: 700 },
            { x: 720, y: 700 },
          ],
        },
        {
          id: "led-minus",
          points: [
            { x: 730, y: 700 },
            { x: 20, y: 10 },
          ],
        },
      ],
    });
    expect(rules(shortedSupply)).not.toContain("led-no-series-resistor");
  });

  test("unconnected-pin reports isolated pins and skips off-board pins already reported", () => {
    const isolated = buildBreadboardDocument({
      parts: [
        {
          id: "r",
          type: "breadboard.resistor",
          reference: "R1",
          pin1: { x: 20, y: 50 },
          semantic: { span: 0 },
        },
      ],
    });
    expect(
      lintBreadboardPage(isolated, PAGE).filter(
        (item) => item.ruleId === "unconnected-pin",
      ),
    ).toHaveLength(2);
    const staged = buildBreadboardDocument({
      parts: [
        {
          id: "r",
          type: "breadboard.resistor",
          reference: "R1",
          pin1: { x: 700, y: 700 },
        },
      ],
    });
    expect(rules(staged)).not.toContain("unconnected-pin");
  });

  test("duplicate-reference reports only the later exact duplicate", () => {
    const duplicate = buildBreadboardDocument({
      parts: [
        {
          id: "r1",
          type: "breadboard.resistor",
          reference: "R1",
          pin1: { x: 20, y: 50 },
        },
        {
          id: "r2",
          type: "breadboard.resistor",
          reference: "R1",
          pin1: { x: 40, y: 50 },
        },
      ],
    });
    expect(
      lintBreadboardPage(duplicate, PAGE)
        .filter((item) => item.ruleId === "duplicate-reference")
        .map((item) => item.elementId),
    ).toEqual(["r2"]);
    const unique = buildBreadboardDocument({
      parts: [
        {
          id: "r1",
          type: "breadboard.resistor",
          reference: "R1",
          pin1: { x: 20, y: 50 },
        },
        {
          id: "r2",
          type: "breadboard.resistor",
          reference: "R2",
          pin1: { x: 40, y: 50 },
        },
      ],
    });
    expect(rules(unique)).not.toContain("duplicate-reference");
  });

  test("wire-end-off-hole reports each bad endpoint and accepts hole endpoints", () => {
    const bad = buildBreadboardDocument({
      wires: [
        {
          id: "w",
          points: [
            { x: 5, y: 5 },
            { x: 20, y: 50 },
          ],
        },
      ],
    });
    expect(
      lintBreadboardPage(bad, PAGE)
        .filter((item) => item.ruleId === "wire-end-off-hole")
        .map((item) => item.message),
    ).toHaveLength(1);
    const good = buildBreadboardDocument({
      wires: [
        {
          id: "w",
          points: [
            { x: 20, y: 20 },
            { x: 20, y: 50 },
          ],
        },
      ],
    });
    expect(rules(good)).not.toContain("wire-end-off-hole");
  });

  test("a wire endpoint can support an off-board part pin", () => {
    const document = buildBreadboardDocument({
      parts: [
        {
          id: "r",
          type: "breadboard.resistor",
          reference: "R1",
          pin1: { x: 700, y: 700 },
        },
      ],
      wires: [
        {
          id: "w",
          points: [
            { x: 600, y: 700 },
            { x: 700, y: 700 },
          ],
        },
      ],
    });
    const findings = lintBreadboardPage(document, PAGE);
    expect(
      findings.some(
        (item) => item.ruleId === "pin-not-in-hole" && item.pin === 1,
      ),
    ).toBe(false);
    expect(
      findings.some(
        (item) =>
          item.ruleId === "wire-end-off-hole" &&
          item.message.includes("last end"),
      ),
    ).toBe(false);
  });

  test("mini boards have no positive or negative rail short", () => {
    const document = buildBreadboardDocument({
      boards: [{ id: "mini", size: "mini" }],
      wires: [
        {
          id: "w",
          points: [
            { x: 20, y: 20 },
            { x: 20, y: 10 },
          ],
        },
      ],
    });
    expect(rules(document)).not.toContain("rail-short");
  });

  test("forward LED polarity across battery supplies is accepted", () => {
    const document = buildBreadboardDocument({
      parts: [
        {
          id: "battery",
          type: "breadboard.battery",
          reference: "BT1",
          pin1: { x: 700, y: 700 },
        },
        {
          id: "led",
          type: "breadboard.led",
          reference: "D1",
          pin1: { x: 700, y: 700 },
        },
      ],
      wires: [
        {
          id: "return",
          points: [
            { x: 710, y: 700 },
            { x: 700, y: 690 },
          ],
        },
      ],
    });
    expect(rules(document)).not.toContain("reversed-polarity");
  });

  test("a two pin part on separate terminal columns is not shorted", () => {
    const document = buildBreadboardDocument({
      parts: [
        {
          id: "c",
          type: "breadboard.capacitor",
          reference: "C1",
          pin1: { x: 20, y: 50 },
          semantic: { span: 4 },
        },
      ],
    });
    expect(rules(document)).not.toContain("shorted-part");
  });

  test("pins shared by a second part are not unconnected", () => {
    const document = buildBreadboardDocument({
      parts: [
        {
          id: "r1",
          type: "breadboard.resistor",
          reference: "R1",
          pin1: { x: 20, y: 50 },
        },
        {
          id: "r2",
          type: "breadboard.resistor",
          reference: "R2",
          pin1: { x: 20, y: 90 },
        },
      ],
    });
    expect(rules(document)).not.toContain("unconnected-pin");
  });

  test("reference duplicate comparison is an exact string match", () => {
    const document = buildBreadboardDocument({
      parts: [
        {
          id: "upper",
          type: "breadboard.resistor",
          reference: "R1",
          pin1: { x: 20, y: 50 },
        },
        {
          id: "lower",
          type: "breadboard.resistor",
          reference: "r1",
          pin1: { x: 40, y: 50 },
        },
      ],
    });
    expect(rules(document)).not.toContain("duplicate-reference");
  });

  test("a wire endpoint touching an off-board part pin is valid", () => {
    const document = buildBreadboardDocument({
      parts: [
        {
          id: "battery",
          type: "breadboard.battery",
          reference: "BT1",
          pin1: { x: 700, y: 700 },
        },
      ],
      wires: [
        {
          id: "w",
          points: [
            { x: 20, y: 20 },
            { x: 700, y: 700 },
          ],
        },
      ],
    });
    expect(
      lintBreadboardPage(document, PAGE).filter(
        (item) => item.ruleId === "wire-end-off-hole",
      ),
    ).toHaveLength(0);
  });

  test("reports the last endpoint in empty page space", () => {
    const document = buildBreadboardDocument({
      wires: [
        {
          id: "w",
          points: [
            { x: 20, y: 20 },
            { x: 505, y: 505 },
          ],
        },
      ],
    });
    expect(
      lintBreadboardPage(document, PAGE).find(
        (item) => item.ruleId === "wire-end-off-hole",
      )?.message,
    ).toContain("last end");
  });

  test("sorts findings deterministically by element and rule order", () => {
    const document = buildBreadboardDocument({
      parts: [
        {
          id: "r",
          type: "breadboard.resistor",
          reference: "R1",
          pin1: { x: 700, y: 700 },
          rotation: 90,
        },
      ],
    });
    expect(lintBreadboardPage(document, PAGE)).toEqual(
      lintBreadboardPage(document, PAGE),
    );
    const findings = lintBreadboardPage(document, PAGE);
    expect(findings.length).toBeGreaterThanOrEqual(2);
    expect(findings.every((item) => item.elementId === "r")).toBe(true);

    const ordered = buildBreadboardDocument({
      parts: [
        {
          id: "r0",
          type: "breadboard.resistor",
          reference: "R1",
          pin1: { x: 20, y: 50 },
        },
        {
          id: "r",
          type: "breadboard.resistor",
          reference: "R1",
          pin1: { x: 700, y: 700 },
        },
      ],
    });
    expect(
      lintBreadboardPage(ordered, PAGE)
        .filter((item) => item.elementId === "r")
        .map((item) => [item.ruleId, item.pin]),
    ).toEqual([
      ["pin-not-in-hole", 1],
      ["pin-not-in-hole", 2],
      ["duplicate-reference", undefined],
    ]);
  });
});
