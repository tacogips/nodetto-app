import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { mkdir, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { findIcon, iconNames, searchIcons } from "./icon-registry.ts";
import { renderIconMarkup, renderIconPlaceholder } from "./icon-markup.ts";
import { LUCIDE_SUBSET } from "./lucide-data.generated.ts";

const paint = { stroke: "#111111", strokeWidth: 2, fill: "none", viewBox: 24 };
describe("Lucide registry", () => {
  test("looks up normalized names and loads the expected set", () => {
    expect(findIcon("bell")).toBe(findIcon("lucide:bell"));
    expect(findIcon("bell")?.nodes.length).toBeGreaterThan(0);
    expect(findIcon("Bell")).toBeUndefined();
    expect(findIcon("no-such-icon")).toBeUndefined();
    expect(iconNames().length).toBeGreaterThan(LUCIDE_SUBSET ? 250 : 1000);
  });
  test("keeps generated source ASCII and preserves Unicode tags", () => {
    const source = readFileSync(
      "packages/core/src/icons/lucide-data.generated.ts",
      "utf8",
    );
    // biome-ignore lint/suspicious/noControlCharactersInRegex: assert the complete ASCII range.
    expect(/[^\x00-\x7f]/.test(source)).toBe(false);
    expect(findIcon("party-popper")?.tags).toContain("\u{1F389}");
    expect(searchIcons("party", 5)).toContain("party-popper");
  });
  test("ranks and deduplicates searches", () => {
    expect(searchIcons(" BELL ")[0]).toBe("bell");
    const results = searchIcons("arrow", 0);
    expect(new Set(results).size).toBe(results.length);
    expect(results.indexOf("arrow-down")).toBeLessThan(
      results.indexOf("a-arrow-down"),
    );
  });
  test("renders centered escaped markup and placeholders", () => {
    const markup = renderIconMarkup(
      findIcon("search")!,
      { x: 0, y: 0, width: 48, height: 48 },
      paint,
    );
    expect(markup).toContain("scale(2)");
    expect(markup).toContain('stroke="#111111"');
    expect(markup).toContain('stroke-linecap="round"');
    const custom = renderIconMarkup(
      { path: 'M0 0L24 24"' },
      { x: 0, y: 0, width: 48, height: 24 },
      paint,
    );
    expect(custom).toContain("translate(12 0)");
    expect(custom.match(/<path/g)?.length).toBe(1);
    expect(custom).toContain("&quot;");
    expect(
      renderIconPlaceholder({ x: 0, y: 0, width: 24, height: 24 }, "red"),
    ).toContain("stroke-dasharray");
  });
  test("preserves upstream filled geometry", () => {
    const icon = findIcon("brain-circuit")!;
    expect(icon.nodes.some((node) => node.attrs.fill === "currentColor")).toBe(
      true,
    );
    expect(
      renderIconMarkup(icon, { x: 0, y: 0, width: 24, height: 24 }, paint),
    ).toContain('fill="#111111"');
  });
  test("generator rejects unsupported fill with icon name", async () => {
    const dir = "tmp/ipd-s772/ipd-03-icon-data/attempt-2/invalid-fixture";
    await mkdir(join(dir, "icons"), { recursive: true });
    await writeFile(join(dir, "package.json"), '{"version":"test"}');
    await writeFile(
      join(dir, "icons", "invalid-fill.svg"),
      '<svg viewBox="0 0 24 24"><path fill="red" d="M0 0" /></svg>',
    );
    const proc = Bun.spawnSync(["bun", "scripts/vendor-lucide.ts", dir], {
      stdout: "pipe",
      stderr: "pipe",
    });
    expect(proc.exitCode).not.toBe(0);
    expect(proc.stderr.toString()).toContain("invalid-fill: invalid fill red");
  });
});
