// UML use-case diagram payload validation and endpoint policy.

import { describe, expect, test } from "bun:test";
import { connectorEndpointIssues } from "../connector-policy.ts";
import { getElementTypeDefinition } from "../registry.ts";
import { GEO_KINDS } from "../semantics.ts";
import { codes, expectValid, validate } from "./test-helpers.ts";

describe("usecase.node", () => {
  test("accepts every kind and an empty name", () => {
    expectValid("usecase.node", { name: "Visitor", kind: "actor" });
    expectValid("usecase.node", { name: "Browse menu", kind: "usecase" });
    expectValid("usecase.node", { name: "", kind: "system" });
  });

  test("rejects an unknown kind and a missing name", () => {
    expect(
      codes(validate("usecase.node", { name: "X", kind: "role" })),
    ).toEqual(["value.enum"]);
    expect(validate("usecase.node", { kind: "actor" }).length).toBe(1);
  });

  test("declares name and kind key order and detaches", () => {
    const definition = getElementTypeDefinition("usecase.node");
    expect(definition?.category).toBe("node");
    expect(definition?.keyOrder.keys).toEqual(["name", "kind"]);
    expect(definition?.onReferenceDeleted).toBe("detach");
  });
});

describe("usecase.relationship", () => {
  test("accepts each kind with optional label and routing", () => {
    for (const kind of ["association", "include", "extend", "generalization"])
      expectValid("usecase.relationship", { from: "a", to: "b", kind });
    expectValid("usecase.relationship", {
      from: "a",
      to: "b",
      kind: "extend",
      label: "",
      routing: "orthogonal",
    });
  });

  test("rejects an unknown kind", () => {
    expect(
      codes(
        validate("usecase.relationship", {
          from: "a",
          to: "b",
          kind: "uses",
        }),
      ),
    ).toEqual(["value.enum"]);
  });

  test("references both ends and cascades on delete", () => {
    const definition = getElementTypeDefinition("usecase.relationship");
    expect(definition?.category).toBe("edge");
    expect(definition?.onReferenceDeleted).toBe("cascade");
    expect(
      definition
        ?.references({ from: "a", to: "b", kind: "include" })
        .map((ref) => ref.id),
    ).toEqual(["a", "b"]);
    expect(definition?.keyOrder.keys.slice(0, 5)).toEqual([
      "from",
      "to",
      "kind",
      "label",
      "routing",
    ]);
  });

  test("endpoints must be use-case nodes on the same page", () => {
    const types: Record<string, string> = {
      actor: "usecase.node",
      note: "text.note",
    };
    const issues = connectorEndpointIssues(
      "usecase.relationship",
      { from: "actor", to: "note", kind: "association" },
      "p1",
      (id) => (types[id] ? { type: types[id], page: "p1" } : undefined),
    );
    expect(issues).toEqual([
      {
        code: "connector.endpointType",
        field: "to",
        message:
          "Target endpoint must connect to a use-case actor, use case or system.",
      },
    ]);
  });
});

test("geo kinds include the UML package", () => {
  expect(GEO_KINDS).toContain("package");
  expectValid("shape.geo", { geo: "package", label: "Billing" });
});
