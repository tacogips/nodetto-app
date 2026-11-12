import { existsSync, mkdirSync, readFileSync, readdirSync, renameSync, rmSync, symlinkSync, writeFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";

export type Diagnostic = { path: string; code: string; message: string; line: string };
export function parseDiagnostics(output: string): Diagnostic[] {
  return output.split(/\r?\n/).flatMap((line) => {
    const match = /^(.+)\((\d+),(\d+)\): error (TS\d+): (.*)$/.exec(line);
    if (!match) return [];
    const path = match[1]?.replace(/^.*?target\/strict-index\/base-tree-[^/]+\//, "");
    if (path === undefined || match[4] === undefined || match[5] === undefined) return [];
    return [{ path, code: match[4], message: match[5], line }];
  });
}
type GateInput = { baseline: string | null; baselineExit: number | null; output: string; exit: number | null; files: { path: string; exists: boolean; isNew: boolean }[] };
export function evaluateGate(input: GateInput) {
  const current = parseDiagnostics(input.output);
  const baseline = input.baseline === null ? [] : parseDiagnostics(input.baseline);
  const valid = (code: number | null, diagnostics: Diagnostic[]) => code === 0 || (code === 2 && diagnostics.length > 0);
  const errors: string[] = [];
  if (input.baseline === null || !valid(input.baselineExit, baseline)) errors.push("Invalid or missing baseline");
  if (!valid(input.exit, current)) errors.push("Compiler failed or produced no parsable diagnostics");
  const listed = new Set(input.files.map((file) => file.path));
  const extra: Diagnostic[] = [];
  const key = (d: Diagnostic) => JSON.stringify([d.path, d.code, d.message]);
  const counts = new Map<string, number>();
  for (const d of baseline) counts.set(key(d), (counts.get(key(d)) ?? 0) + 1);
  for (const file of input.files) if (!file.exists) errors.push(`Missing listed file: ${file.path}`);
  for (const d of current) {
    const file = input.files.find((item) => item.path === d.path);
    if (!file) continue;
    const remaining = counts.get(key(d)) ?? 0;
    if (file.isNew || remaining === 0) extra.push(d);
    else counts.set(key(d), remaining - 1);
  }
  return { ok: errors.length === 0 && extra.length === 0, errors, extra, ignored: current.filter((d) => !listed.has(d.path)).length };
}
const root = resolve(import.meta.dir, "../..");
function run(args: string[], cwd = root) {
  try {
    const result = Bun.spawnSync(args, { cwd, stdout: "pipe", stderr: "pipe" });
    return { exit: result.exitCode, output: result.stdout.toString() + result.stderr.toString() };
  } catch (error) { return { exit: null, output: String(error) }; }
}
function required(args: string[], flag: string): string {
  const i = args.indexOf(flag);
  const value = i < 0 ? undefined : args[i + 1];
  if (!value || value.startsWith("--")) throw new Error(`Missing ${flag}`);
  return value;
}
function capture(args: string[]) {
  const ref = required(args, "--ref"), out = resolve(root, required(args, "--out"));
  const resolved = run(["git", "rev-parse", "--verify", `${ref}^{commit}`]);
  if (resolved.exit !== 0) throw new Error(resolved.output);
  const sha = resolved.output.trim();
  if (existsSync(out) && existsSync(`${out}.ref`) && readFileSync(`${out}.ref`, "utf8").trim() === sha) { console.log("baseline reused"); return; }
  const dir = join(root, "target/strict-index", `base-tree-${process.pid}-${Date.now()}`);
  mkdirSync(dir, { recursive: true });
  let result: { exit: number | null; output: string };
  try {
    const archive = Bun.spawnSync(["git", "archive", sha], { cwd: root, stdout: "pipe", stderr: "pipe" });
    if (archive.exitCode !== 0) throw new Error(archive.stderr.toString());
    const tar = Bun.spawnSync(["tar", "-x", "-C", dir], { stdin: archive.stdout, stdout: "pipe", stderr: "pipe" });
    if (tar.exitCode !== 0) throw new Error(tar.stderr.toString());
    for (const parent of ["packages", "apps"]) {
      const source = join(root, parent);
      if (!existsSync(source)) continue;
      for (const name of readdirSync(source)) {
        const modules = join(source, name, "node_modules"), dest = join(dir, parent, name, "node_modules");
        if (existsSync(modules) && existsSync(dirname(dest))) symlinkSync(modules, dest, "dir");
      }
    }
    result = run([join(root, "node_modules/.bin/tsc"), "--noEmit", "--pretty", "false", "-p", join(dir, "tsconfig.json"), "--noUncheckedIndexedAccess"]);
  } finally { rmSync(dir, { recursive: true, force: true }); }
  const output = result.output.split(`${dir}/`).join("").split(`${dir.slice(root.length + 1)}/`).join("");
  mkdirSync(dirname(out), { recursive: true });
  const temp = `${out}.${process.pid}-${Date.now()}.tmp`;
  writeFileSync(temp, output); renameSync(temp, out);
  writeFileSync(`${out}.exit`, `${result.exit}\n`); writeFileSync(`${out}.ref`, `${sha}\n`);
  if (!(result.exit === 0 || (result.exit === 2 && parseDiagnostics(output).length > 0))) throw new Error("Baseline compiler failure");
}
function check(args: string[]) {
  const baselinePath = resolve(root, required(args, "--baseline")), log = resolve(root, required(args, "--log"));
  const separator = args.indexOf("--"), paths = separator < 0 ? [] : args.slice(separator + 1);
  if (!paths.length) throw new Error("No listed files");
  let baseline: string | null = null, baselineExit: number | null = null;
  try { baseline = readFileSync(baselinePath, "utf8"); const text = readFileSync(`${baselinePath}.exit`, "utf8").trim(); baselineExit = /^[0-9]+$/.test(text) ? Number(text) : null; } catch { /* evaluated as missing */ }
  const result = run([join(root, "node_modules/.bin/tsc"), "--noEmit", "--pretty", "false", "-p", "tsconfig.json", "--noUncheckedIndexedAccess"]);
  mkdirSync(dirname(log), { recursive: true }); writeFileSync(log, result.output); writeFileSync(`${log}.exit`, `${result.exit}\n`);
  const files = paths.map((path) => ({ path, exists: existsSync(resolve(root, path)), isNew: run(["git", "cat-file", "-e", `ccac2d3:${path}`]).exit !== 0 }));
  const evaluation = evaluateGate({ baseline, baselineExit, output: result.output, exit: result.exit, files });
  console.log(`Listed files: ${paths.join(", ")}\nIgnored diagnostics: ${evaluation.ignored}`);
  for (const error of evaluation.errors) console.error(error);
  for (const diagnostic of evaluation.extra) console.error(diagnostic.line);
  if (!evaluation.ok) process.exitCode = 1;
}
if (import.meta.main) {
  try {
    const [command, ...args] = process.argv.slice(2);
    if (command === "capture-baseline") capture(args);
    else if (command === "check") check(args);
    else throw new Error("Expected capture-baseline or check");
  } catch (error) { console.error(error); process.exitCode = 1; }
}
