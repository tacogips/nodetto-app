import {
  CAD_MESH_DATA_MAX_CHARS,
  CAD_OPERATIONS,
  type CadXY,
  isOnCadGrid,
} from "../cad.ts";
import {
  checkArray,
  checkBoolean,
  checkEnum,
  checkNumber,
  checkObject,
  checkString,
} from "../checks.ts";
import { error, type ValidationIssue } from "../issues.ts";
import {
  type ElementReference,
  type ElementTypeDefinition,
  read,
  refFields,
} from "./definition.ts";

const BASE_PLANES = ["xy", "yz", "zx"] as const;
const FACE_ROLES = ["start", "end", "side"] as const;
const MAX_COORDINATE = 10_000;
const OPTIONAL = { optional: true } as const;

const CAD_SHAPE = { category: "node", keepsExternalReferences: true } as const;
const MESH_DATA = /^nmesh1:[A-Za-z0-9+/]+={0,2}$/;

function checkLength(
  out: ValidationIssue[],
  value: unknown,
  path: string,
): value is number {
  if (!checkNumber(out, value, path) || typeof value !== "number") return false;
  if (isOnCadGrid(value)) return true;
  out.push(error("cad.grid", path, "expected a length on the 1 nm grid"));
  return false;
}

function checkCoordinate(
  out: ValidationIssue[],
  value: unknown,
  path: string,
): boolean {
  if (!checkLength(out, value, path)) return false;
  if (Math.abs(value) <= MAX_COORDINATE) return true;
  out.push(
    error("cad.coordinate", path, "expected a coordinate within ±10000 mm"),
  );
  return false;
}

function checkPoint(
  out: ValidationIssue[],
  value: unknown,
  path: string,
): value is CadXY {
  if (!checkArray(out, value, path)) return false;
  if (value.length !== 2) {
    out.push(error("cad.point", path, "expected exactly two coordinates"));
    return false;
  }
  const x = checkCoordinate(out, value[0], `${path}[0]`);
  const y = checkCoordinate(out, value[1], `${path}[1]`);
  return x && y;
}

function samePoint(left: CadXY, right: CadXY): boolean {
  return left[0] === right[0] && left[1] === right[1];
}

function checkPlane(
  out: ValidationIssue[],
  value: unknown,
  path: string,
): void {
  if (!checkObject(out, value, path)) return;
  const { base, offset, face } = value;
  if (base !== undefined && face === undefined) {
    checkEnum(out, base, `${path}.base`, BASE_PLANES);
    if (offset !== undefined) checkCoordinate(out, offset, `${path}.offset`);
  } else if (base === undefined && face !== undefined && offset === undefined) {
    const facePath = `${path}.face`;
    if (!checkObject(out, face, facePath)) return;
    checkEnum(out, face["role"], `${facePath}.role`, FACE_ROLES);
    checkString(out, face["feature"], `${facePath}.feature`, OPTIONAL);
    checkString(out, face["entity"], `${facePath}.entity`, OPTIONAL);
  } else {
    out.push(error("cad.plane", path, "expected one base plane or face plane"));
  }
}

const SKETCH: ElementTypeDefinition = {
  ...CAD_SHAPE,
  type: "cad.sketch",
  onReferenceDeleted: "detach",
  keyOrder: {
    keys: ["name", "plane"],
    children: {
      plane: {
        keys: ["base", "offset", "face"],
        children: { face: { keys: ["feature", "role", "entity"] } },
      },
    },
  },
  references(semantic) {
    const face = read(read(semantic, "plane"), "face");
    return refFields(face, ["feature", "entity"]).map(({ field, id }) => ({
      field: `plane.face.${field}`,
      id,
    }));
  },
  validateSemantic(semantic, path) {
    const out: ValidationIssue[] = [];
    if (checkObject(out, semantic, path)) {
      checkString(out, semantic["name"], `${path}.name`, { allowEmpty: true });
      checkPlane(out, semantic["plane"], `${path}.plane`);
    }
    return out;
  },
};

function sketchEntity(
  type: "cad.line" | "cad.arc" | "cad.circle",
  geometryKeys: readonly string[],
  validateGeometry: (
    out: ValidationIssue[],
    semantic: Record<string, unknown>,
    path: string,
  ) => void,
): ElementTypeDefinition {
  return {
    ...CAD_SHAPE,
    type,
    onReferenceDeleted: "cascade",
    keyOrder: { keys: ["sketch", ...geometryKeys, "construction"] },
    references: (semantic) => refFields(semantic, ["sketch"]),
    validateSemantic(semantic, path) {
      const out: ValidationIssue[] = [];
      if (checkObject(out, semantic, path)) {
        checkString(out, semantic["sketch"], `${path}.sketch`, OPTIONAL);
        validateGeometry(out, semantic, path);
        checkBoolean(
          out,
          semantic["construction"],
          `${path}.construction`,
          OPTIONAL,
        );
      }
      return out;
    },
  };
}

const LINE = sketchEntity("cad.line", ["a", "b"], (out, semantic, path) => {
  checkPoint(out, semantic["a"], `${path}.a`);
  checkPoint(out, semantic["b"], `${path}.b`);
});

const ARC = sketchEntity("cad.arc", ["a", "m", "b"], (out, semantic, path) => {
  const { a, m, b } = semantic;
  const startValid = checkPoint(out, a, `${path}.a`);
  const midValid = checkPoint(out, m, `${path}.m`);
  const endValid = checkPoint(out, b, `${path}.b`);
  if (
    startValid &&
    midValid &&
    endValid &&
    (samePoint(a, m) || samePoint(a, b) || samePoint(m, b))
  ) {
    out.push(
      error("cad.arc.points", path, "arc points must be pairwise distinct"),
    );
  }
});

const CIRCLE = sketchEntity("cad.circle", ["c", "r"], (out, semantic, path) => {
  checkPoint(out, semantic["c"], `${path}.c`);
  const radius = semantic["r"];
  if (checkLength(out, radius, `${path}.r`) && radius <= 0) {
    out.push(error("cad.radius", `${path}.r`, "radius must be positive"));
  }
});

function checkIds(out: ValidationIssue[], value: unknown, path: string): void {
  if (value === undefined || !checkArray(out, value, path)) return;
  for (const [index, id] of value.entries()) {
    checkString(out, id, `${path}[${index}]`);
  }
}

const EXTRUDE: ElementTypeDefinition = {
  ...CAD_SHAPE,
  type: "cad.extrude",
  onReferenceDeleted: "detach",
  keyOrder: {
    keys: [
      "name",
      "sketch",
      "loops",
      "distance",
      "symmetric",
      "op",
      "bodies",
      "suppressed",
    ],
  },
  references(semantic) {
    const refs: ElementReference[] = [...refFields(semantic, ["sketch"])];
    for (const field of ["loops", "bodies"]) {
      const ids = read(semantic, field);
      if (!Array.isArray(ids)) continue;
      for (const [index, id] of ids.entries()) {
        if (typeof id === "string" && id.length > 0) {
          refs.push({ field: `${field}[${index}]`, id });
        }
      }
    }
    return refs;
  },
  validateSemantic(semantic, path) {
    const out: ValidationIssue[] = [];
    if (!checkObject(out, semantic, path)) return out;
    const { name, sketch, loops, distance, symmetric, op, bodies, suppressed } =
      semantic;
    checkString(out, name, `${path}.name`, { allowEmpty: true });
    checkString(out, sketch, `${path}.sketch`, OPTIONAL);
    checkIds(out, loops, `${path}.loops`);
    if (checkLength(out, distance, `${path}.distance`) && distance === 0) {
      out.push(
        error("cad.distance", `${path}.distance`, "distance must be nonzero"),
      );
    }
    checkBoolean(out, symmetric, `${path}.symmetric`, OPTIONAL);
    checkEnum(out, op, `${path}.op`, CAD_OPERATIONS);
    checkIds(out, bodies, `${path}.bodies`);
    checkBoolean(out, suppressed, `${path}.suppressed`, OPTIONAL);
    return out;
  },
};

const MESH: ElementTypeDefinition = {
  ...CAD_SHAPE,
  type: "cad.mesh",
  onReferenceDeleted: "cascade",
  keyOrder: { keys: ["name", "data", "suppressed"] },
  references: () => [],
  validateSemantic(semantic, path) {
    const out: ValidationIssue[] = [];
    if (!checkObject(out, semantic, path)) return out;
    const { name, data, suppressed } = semantic;
    checkString(out, name, `${path}.name`, { allowEmpty: true });
    if (
      typeof data !== "string" ||
      data.length > CAD_MESH_DATA_MAX_CHARS ||
      !MESH_DATA.test(data)
    ) {
      out.push(
        error("cad.mesh.invalid", `${path}.data`, "expected inline NMESH data"),
      );
    }
    checkBoolean(out, suppressed, `${path}.suppressed`, OPTIONAL);
    return out;
  },
};

export const CAD_DEFINITIONS: readonly ElementTypeDefinition[] = [
  SKETCH,
  LINE,
  ARC,
  CIRCLE,
  EXTRUDE,
  MESH,
];
