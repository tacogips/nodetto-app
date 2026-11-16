import { describe, expect, test } from "bun:test";
import {
  SYNTAX_KINDS,
  SYNTAX_KIND_LABELS,
  resolveSyntaxKind,
  tokenizeCode,
} from "./index.ts";
describe("syntax", () => {
  test("kinds and aliases", () => {
    expect(SYNTAX_KINDS.length).toBe(28);
    expect(SYNTAX_KINDS[0]).toBe("plain");
    expect(new Set(SYNTAX_KINDS).size).toBe(28);
    for (const kind of SYNTAX_KINDS) {
      expect(SYNTAX_KIND_LABELS[kind]).toBeTruthy();
      expect(resolveSyntaxKind(kind)).toBe(kind);
    }
    for (const [token, kind] of Object.entries({
      ".RS": "rust",
      Dockerfile: "dockerfile",
      tsx: "javascript",
      yml: "yaml",
      "a.proto": "protobuf",
      Gemfile: "ruby",
      unknown: "plain",
    }))
      expect(String(resolveSyntaxKind(token))).toBe(
        token === "unknown" ? "null" : kind,
      );
  });
  test("all kinds preserve lines and highlight representative text", () => {
    for (const kind of SYNTAX_KINDS) {
      const source = 'const value = "hello"; // note\r\n42\rthird';
      const lines = tokenizeCode(source, kind);
      expect(lines.map((line) => line.map((s) => s.text).join(""))).toEqual([
        'const value = "hello"; // note',
        "42",
        "third",
      ]);
      if (kind !== "plain")
        expect(lines.flat().some((s) => s.kind !== "plain")).toBe(true);
    }
  });
  test("carries block comments and strings", () => {
    const lines = tokenizeCode(
      "let x = 1; /* start\nmiddle\nend */ const y = 2",
      "javascript",
    );
    expect(lines[1]?.[0]?.kind).toBe("comment");
    expect(lines[2]?.some((s) => s.kind === "keyword")).toBe(true);
    expect(tokenizeCode('"one\ntwo"', "javascript")[1]?.[0]?.kind).toBe(
      "string",
    );
  });
  test("large input stays linear", () => {
    const start = performance.now();
    expect(
      tokenizeCode("const x = 42;\n".repeat(10000), "javascript"),
    ).toHaveLength(10001);
    expect(performance.now() - start).toBeLessThan(2000);
  });
});

test("reference extensions and file names resolve", () => {
  const aliases: Record<string, string> = {
    javascript: "js jsx mjs cjs ts tsx mts cts",
    java: "java",
    scala: "scala sc",
    lisp: "lisp lsp cl el",
    ruby: "rb rake gemspec Gemfile Rakefile",
    python: "py pyw",
    c: "c h",
    cpp: "cpp cc cxx hpp hh hxx",
    zig: "zig",
    haskell: "hs lhs hsc",
    swift: "swift",
    rust: "rs",
    vue: "vue",
    sql: "sql",
    groovy: "gradle groovy gvy gy gsh",
    xml: "xml svg xsd xsl xslt rss atom opml plist wsdl kml gpx csproj fsproj vbproj props targets resx xaml nuspec",
    properties: "properties",
    protobuf: "proto",
    nix: "nix",
    dockerfile: "Dockerfile Containerfile",
    makefile: "Makefile mk",
    shell: "sh bash zsh ksh env .bashrc .zshrc .profile",
    json: "json jsonc jsonl ndjson jsonlines geojson jsonld webmanifest har",
    markdown: "md markdown",
    css: "css scss sass",
    toml: "toml",
    yaml: "yaml yml",
  };
  for (const [kind, tokens] of Object.entries(aliases))
    for (const token of tokens.split(" "))
      expect(String(resolveSyntaxKind(token))).toBe(kind);
});

test("each language classifies two offsets", () => {
  for (const kind of SYNTAX_KINDS) {
    if (kind === "plain") continue;
    const sample = kind === "markdown" ? "# heading `note`" : '42 "note"';
    const segments = tokenizeCode(sample, kind)[0] ?? [];
    const at = (offset: number) => {
      let end = 0;
      for (const segment of segments) {
        end += segment.text.length;
        if (offset < end) return segment.kind;
      }
      return undefined;
    };
    expect(at(0)).toBe(kind === "markdown" ? "markup" : "number");
    expect(at(kind === "markdown" ? 10 : 3)).toBe("string");
  }
});
