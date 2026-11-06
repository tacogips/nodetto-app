import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { connectorArrangeDocument } from "../__fixtures__/connector-arrange.ts";
import { compare, compareFile, nativeTest } from "./harness.ts";

nativeTest(
  "connector fixture matches the native CLI",
  () => {
    const dir = mkdtempSync(join(tmpdir(), "nodetto-arrange-"));
    try {
      const path = join(dir, "fixture.jsonl");
      const seed = connectorArrangeDocument();
      compareFile(
        ["arrange", path, "--page", "States", "--mode", "layered", "--write"],
        path,
        seed,
      );
      const layered = readFileSync(path, "utf8");
      compareFile(
        ["arrange", path, "--page", "States", "--mode", "route", "--write"],
        path,
        layered,
      );
      compare(["lint", path, "--metrics", "--format", "json"]);
      const arranged = readFileSync(path, "utf8");
      compareFile(["lint", path, "--fix"], path, arranged);
      writeFileSync(path, seed);
      compare(["export", path, "--page", "Architecture", "--format", "svg"]);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  },
  60000,
);
