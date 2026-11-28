import {
  existsSync,
  mkdirSync,
  readFileSync,
  readdirSync,
  writeFileSync,
} from "node:fs";
import { join, resolve } from "node:path";

const root = resolve(import.meta.dir, "../..");
const formal = join(root, "formal");
const modules: Record<string, string> = {
  Fractional: "fractional",
  ZOrder: "z-order",
  Nmesh: "nmesh",
  Tsv: "tsv",
  Rotate: "rotate",
  Undo: "undo",
  Merge: "merge",
  Overlap: "overlap",
  CadEnclosure: "cad-enclosure",
};
const checkOpens: Record<string, readonly string[]> = {
  ZOrder: ["Nodetto.Fractional"],
};
/** Case groups per module from the vector table in design section 7. */
const requiredCases: Record<string, readonly string[]> = {
  Fractional: ["isFractionalKey", "keyBetween", "keyAfter"],
  ZOrder: ["targetOrder", "relativeOrder", "reorderCommands"],
  Nmesh: ["encodeNmesh", "decodeNmesh", "toInline", "fromInline"],
  Tsv: ["parseTsv", "serializeTsv", "roundTrip"],
  Rotate: ["rotate"],
  Undo: ["history", "applyCommands"],
  Merge: ["mergeValue", "mergeById"],
  Overlap: ["overlappingPairs"],
  CadEnclosure: ["pageAccepts", "computeShellSpec", "computePcbEnclosureDims"],
};
type Statement = {
  module: string;
  name: string;
  binders: string;
  conclusion: string;
  open: boolean;
};

function parseStatements(): Statement[] {
  const design = readFileSync(
    join(root, "design-docs/specs/design-formal-verification.md"),
    "utf8",
  );
  const parts = design.split(/^## 6\./m);
  const section = parts[1]?.split(/^## 7\./m)[0];
  if (!section || parts[0] === undefined) throw new Error("missing section 6");
  const firstLine = parts[0].split("\n").length;
  const statements: Statement[] = [];
  const blocks: { module: string; open: boolean; body: string }[] = [];
  const lines = section.split("\n");
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i] ?? "";
    if (!line.startsWith("```")) continue;
    const at = `design line ${firstLine + i}`;
    let end = i + 1;
    while (end < lines.length && !/^```\s*$/.test(lines[end] ?? "")) {
      if ((lines[end] ?? "").startsWith("```lean Nodetto."))
        throw new Error(
          `unclosed fence at ${at} before theorem fence at design line ${firstLine + end}`,
        );
      end++;
    }
    if (line.startsWith("```lean Nodetto.")) {
      const opener = /^```lean Nodetto\.(\w+)( open)?\s*$/.exec(line);
      const module = opener?.[1];
      if (!module || !Object.hasOwn(modules, module))
        throw new Error(`malformed theorem fence at ${at}: ${line}`);
      if (end >= lines.length)
        throw new Error(`unterminated theorem fence at ${at}`);
      blocks.push({
        module,
        open: Boolean(opener?.[2]),
        body: lines.slice(i + 1, end).join("\n"),
      });
    }
    i = end;
  }
  for (const block of blocks) {
    const { module, body } = block;
    for (const chunk of body.trim().split(/\n\s*\n/)) {
      const head = /^theorem\s+(\w+)\b([\s\S]*)$/.exec(chunk.trim());
      if (!head?.[1] || head[2] === undefined)
        throw new Error(`malformed statement in ${module}`);
      const rest = head[2].trim();
      let pos = 0;
      while (pos < rest.length && "({[".includes(rest[pos] ?? "")) {
        const stack: string[] = [];
        do {
          const c = rest[pos++];
          if (!c) throw new Error(`unbalanced binders in ${head[1]}`);
          if ("({[".includes(c)) stack.push(c);
          else if (")}]".includes(c)) {
            const opening = stack.pop();
            if (!opening || "({[".indexOf(opening) !== ")}]".indexOf(c))
              throw new Error(`unbalanced binders in ${head[1]}`);
          }
        } while (stack.length);
        while (/\s/.test(rest[pos] ?? "") && pos < rest.length) pos++;
      }
      if (rest[pos] !== ":")
        throw new Error(`missing conclusion in ${head[1]}`);
      const conclusion = rest.slice(pos + 1).trim();
      if (!conclusion) throw new Error(`empty conclusion in ${head[1]}`);
      statements.push({
        module,
        name: head[1],
        binders: rest.slice(0, pos).trim(),
        conclusion,
        open: block.open,
      });
    }
  }
  if (!statements.length) throw new Error("no statements found");
  return statements;
}

function leanFiles(path: string): string[] {
  if (!existsSync(path)) return [];
  const entries = readdirSync(path, { withFileTypes: true });
  return entries.flatMap((entry) => {
    if (entry.name === ".lake") return [];
    const child = join(path, entry.name);
    return entry.isDirectory()
      ? leanFiles(child)
      : entry.isFile() && entry.name.endsWith(".lean")
        ? [child]
        : [];
  });
}
function moduleFiles(module: string): string[] {
  const file = join(formal, "Nodetto", `${module}.lean`);
  return [
    ...(existsSync(file) ? [file] : []),
    ...leanFiles(join(formal, "Nodetto", module)),
  ];
}
function run(args: string[]): { code: number; output: string; stderr: string } {
  const result = Bun.spawnSync(args, {
    cwd: formal,
    stdout: "pipe",
    stderr: "pipe",
  });
  return {
    code: result.exitCode ?? 1,
    output: result.stdout.toString(),
    stderr: result.stderr.toString(),
  };
}
function usage(): never {
  throw new Error(
    "usage: audit [--list | --module <M> (--vectors | --theorem <name>...)]",
  );
}
function main(): number {
  let module: string | undefined;
  let list = false;
  let vectors = false;
  const names: string[] = [];
  const args = process.argv.slice(2);
  for (let i = 0; i < args.length; i++) {
    const arg = args[i];
    if (arg === "--list" && !list) list = true;
    else if (arg === "--vectors" && !vectors) vectors = true;
    else if (arg === "--module" && !module) {
      const value = args[++i];
      if (!value || value.startsWith("--")) usage();
      module = value;
    } else if (arg === "--theorem") {
      let count = 0;
      while (args[i + 1] && !args[i + 1]?.startsWith("--")) {
        const value = args[++i];
        if (value) names.push(value);
        count++;
      }
      if (!count) usage();
    } else usage();
  }
  if (
    (list && (module || vectors || names.length)) ||
    (!module && (vectors || names.length)) ||
    (vectors && names.length) ||
    (module && !vectors && !names.length)
  )
    usage();
  const statements = parseStatements();
  if (module && !Object.hasOwn(modules, module))
    throw new Error(`unknown module ${module}`);
  for (const name of names)
    if (!statements.some((s) => s.module === module && s.name === name))
      throw new Error(`unknown statement ${name}`);
  if (list) {
    for (const s of statements)
      console.log(`${s.module} ${s.open ? "open" : "required"} ${s.name}`);
    console.log(
      `required ${statements.filter((s) => !s.open).length}, open ${statements.filter((s) => s.open).length}`,
    );
    return 0;
  }
  let failures = 0;
  const check = (label: string, error?: string) => {
    console.log(`${label}: ${error ? `FAILED: ${error}` : "ok"}`);
    if (error) failures++;
  };
  const files = module ? moduleFiles(module) : leanFiles(formal);
  const forbidden =
    /\b(sorry|admit|axiom|native_decide|unsafe|partial|opaque|implemented_by|extern|skipKernelTC)\b|#exit/g;
  for (const file of files) {
    const content = readFileSync(file, "utf8");
    const bad = content.match(forbidden);
    const heartbeat = [...content.matchAll(/maxHeartbeats\s+(\d+)/g)].some(
      (m) => Number(m[1]) === 0 || Number(m[1]) > 400000,
    );
    if (bad || heartbeat)
      check(
        `scan ${file}`,
        `forbidden token or heartbeat limit: ${bad?.join(", ") ?? "maxHeartbeats"}`,
      );
  }
  check("token scan");
  let build = run([
    "mise",
    "exec",
    "--",
    "lake",
    "build",
    module ? `Nodetto.${module}` : "Nodetto",
  ]);
  for (
    let retry = 1;
    retry <= 3 && build.code && /lock/i.test(build.output + build.stderr);
    retry++
  ) {
    console.log(
      `build lock failure; retry ${retry}: ${build.output}${build.stderr}`,
    );
    build = run([
      "mise",
      "exec",
      "--",
      "lake",
      "build",
      module ? `Nodetto.${module}` : "Nodetto",
    ]);
  }
  check("build", build.code ? `${build.output}${build.stderr}` : undefined);
  const selectedModules = module ? [module] : Object.keys(modules);
  const auditDir = join(formal, ".lake/audit");
  mkdirSync(auditDir, { recursive: true });
  for (const mod of selectedModules) {
    if (!vectors) {
      let chosen = statements.filter(
        (s) => s.module === mod && (!module || names.includes(s.name)),
      );
      if (!module) {
        const sources = moduleFiles(mod)
          .map((f) => readFileSync(f, "utf8"))
          .join("\n");
        const docsPath = join(root, "docs/formal.md");
        const docs = existsSync(docsPath) ? readFileSync(docsPath, "utf8") : "";
        const openSection =
          /^## Open\s*\n([\s\S]*?)(?=^## |$(?![\s\S]))/m.exec(docs)?.[1] ?? "";
        chosen = chosen.filter((s) => {
          if (!s.open || new RegExp(`\\btheorem\\s+${s.name}\\b`).test(sources))
            return true;
          if (!new RegExp(`\\b${s.name}\\b`).test(openSection))
            check(`open ${mod}.${s.name}`, "missing from Open section");
          else check(`open ${mod}.${s.name}`, undefined);
          return false;
        });
      }
      if (chosen.length) {
        const lines = [
          `import Nodetto.${mod}`,
          `namespace Nodetto.${mod}`,
          ...(checkOpens[mod] ?? []).map((ns) => `open ${ns}`),
        ];
        for (const s of chosen)
          lines.push(
            `example : ${s.binders ? `∀ ${s.binders}, ` : ""}${s.conclusion} := @${s.name}`,
          );
        lines.push(
          `end Nodetto.${mod}`,
          ...chosen.map((s) => `#print axioms Nodetto.${mod}.${s.name}`),
        );
        const path = join(auditDir, `Check${mod}.lean`);
        writeFileSync(path, `${lines.join("\n")}\n`);
        const result = run([
          "mise",
          "exec",
          "--",
          "lake",
          "env",
          "lean",
          `.lake/audit/Check${mod}.lean`,
        ]);
        const lists = [
          ...result.output.matchAll(/depends on axioms:\s*\[([^\]]*)\]/g),
        ];
        const invalid = lists.flatMap((m) =>
          (m[1] ?? "")
            .split(",")
            .map((v) => v.trim())
            .filter(
              (v) =>
                v && !["propext", "Classical.choice", "Quot.sound"].includes(v),
            ),
        );
        const reports =
          lists.length +
          [...result.output.matchAll(/does not depend on any axioms/g)].length;
        check(
          `statements ${mod}`,
          result.code || invalid.length || reports !== chosen.length
            ? `${result.output}${result.stderr} invalid axioms: ${invalid.join(", ")}; reports ${reports}/${chosen.length}`
            : undefined,
        );
      }
    }
    if (vectors || !module) {
      const file = modules[mod];
      if (!file) throw new Error(`unknown module ${mod}`);
      const result = run([
        "mise",
        "exec",
        "--",
        "lake",
        "exe",
        `vectors-${file}`,
      ]);
      writeFileSync(join(auditDir, `${file}.json`), result.output);
      try {
        if (result.code) throw new Error(result.stderr);
        if (
          result.output !==
          readFileSync(join(formal, "vectors", `${file}.json`), "utf8")
        )
          throw new Error("vectors differ");
        const parsed: unknown = JSON.parse(result.output);
        if (
          !parsed ||
          typeof parsed !== "object" ||
          !("cases" in parsed) ||
          !Array.isArray(parsed.cases) ||
          parsed.cases.length < 200
        )
          throw new Error("fewer than 200 cases");
        const counts = new Map<string, number>();
        for (const item of parsed.cases as unknown[]) {
          if (
            !item ||
            typeof item !== "object" ||
            !("fn" in item) ||
            typeof item.fn !== "string"
          )
            throw new Error("invalid case function");
          counts.set(item.fn, (counts.get(item.fn) ?? 0) + 1);
        }
        for (const [fn, count] of counts)
          if (fn !== "fixture" && count < 20)
            throw new Error(`${fn}: fewer than 20 cases`);
        for (const fn of requiredCases[mod] ?? [])
          if ((counts.get(fn) ?? 0) < 20)
            throw new Error(
              `${fn}: fewer than 20 cases (${counts.get(fn) ?? 0})`,
            );
        check(`vectors ${mod}`);
      } catch (error) {
        check(`vectors ${mod}`, String(error));
      }
    }
  }
  console.log(failures ? `audit: FAILED (${failures})` : "audit: ok");
  return failures ? 1 : 0;
}
try {
  process.exitCode = main();
} catch (error) {
  console.error(String(error));
  process.exitCode = 1;
}
