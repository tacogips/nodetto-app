import { expect, test } from "bun:test";
import { Buffer } from "node:buffer";
import { readFileSync } from "node:fs";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { InMemoryTransport } from "@modelcontextprotocol/sdk/inMemory.js";
import { CallToolResultSchema } from "@modelcontextprotocol/sdk/types.js";
import { Editor } from "@nodetto/core";
import { parseDocument, serializeDocument } from "@nodetto/io";
import { runCliAsync } from "./cli.ts";
import type { CommandIo, CommandResult } from "./commands.ts";
import { COMMAND_HELP } from "./help.ts";
import { createMcpServer } from "./mcp.ts";
import { MCP_INLINE_MAX_BYTES } from "./mcp-image.ts";

const doc = [
  '{"kind":"document","schemaVersion":1,"id":"doc","title":"Shop"}',
  '{"kind":"page","id":"p1","name":"Schema","pageKind":"erd"}',
  '{"kind":"element","id":"t-users","page":"p1","type":"erd.table","index":"a0","semantic":{"tableName":"users","columns":[{"id":"c-id","name":"id","dataType":"uuid","pk":true}]},"visual":{"x":0,"y":0,"width":280}}',
  "",
].join("\n");
const bpmn = readFileSync(
  new URL(
    "../../../packages/io/src/__fixtures__/bpmn/purchase-request.jsonl",
    import.meta.url,
  ),
  "utf8",
);
const xml = readFileSync(
  new URL(
    "../../../packages/io/src/__fixtures__/bpmn/purchase-request.bpmn",
    import.meta.url,
  ),
  "utf8",
);
const ops = '[{"op":"move","id":"t-users","x":100,"y":200}]';
function output(
  result: Awaited<ReturnType<Client["callTool"]>>,
): CommandResult {
  return result.structuredContent as unknown as CommandResult;
}

function memoryIo() {
  const files = new Map([
    ["doc.jsonl", doc],
    ["before.jsonl", doc],
    ["process.jsonl", bpmn],
    ["process.bpmn", xml],
    ["ops.json", ops],
    ["stale.sql", "-- stale\n"],
    ["unsafe.jsonl", doc.replace('"uuid"', '"uuid;drop"')],
  ]);
  const bytes = new Map<string, Uint8Array>();
  const opened: [string, string | undefined][] = [];
  const io: CommandIo = {
    readText(path) {
      const source = files.get(path);
      if (source === undefined) throw new Error("ENOENT");
      return source;
    },
    writeText: (path, text) => {
      files.set(path, text);
    },
    writeBytes: (path, data) => {
      bytes.set(path, data);
    },
    exists: (path) => files.has(path),
    readStdin: () => {
      throw new Error("MCP must never read transport stdin");
    },
    openDocument: async (path, app) => {
      opened.push([path, app]);
    },
  };
  return { io, files, bytes, opened };
}

async function connect(
  io: CommandIo,
  options: Parameters<typeof createMcpServer>[2] = {},
) {
  const server = createMcpServer(io, "test", options);
  const client = new Client({ name: "test-client", version: "1" });
  const [clientTransport, serverTransport] =
    InMemoryTransport.createLinkedPair();
  await server.connect(serverTransport);
  await client.connect(clientTransport);
  return {
    client,
    close: async () => {
      await client.close();
      await server.close();
    },
  };
}

test("MCP discovers every document command and documents every CLI option", async () => {
  const session = await connect(memoryIo().io);
  try {
    const { tools } = await session.client.listTools();
    expect(tools.map((tool) => tool.name).sort()).toEqual(
      [
        "nodetto_cli",
        "nodetto_help",
        ...Object.keys(COMMAND_HELP)
          .filter((name) => name !== "mcp")
          .map((name) => `nodetto_${name}`),
      ].sort(),
    );
    expect(tools.some((tool) => tool.name === "nodetto_merge")).toBe(true);
    const editDescription =
      tools.find((tool) => tool.name === "nodetto_edit")?.description ?? "";
    for (const term of ["where", "select", "carryMembers"])
      expect(editDescription).toContain(term);
    for (const [command, help] of Object.entries(COMMAND_HELP)) {
      if (command === "mcp") continue;
      expect(
        tools.find((tool) => tool.name === `nodetto_${command}`)?.description,
      ).toBe(help);
    }
    for (const args of [[], ["edit"], ["mcp"]]) {
      const result = await session.client.callTool({
        name: "nodetto_help",
        arguments: { args },
      });
      expect(result.structuredContent).toEqual(
        await runCliAsync(["help", ...args], memoryIo().io, "test"),
      );
    }
  } finally {
    await session.close();
  }
});

const cases: string[][] = [
  ["inspect", "doc.jsonl", "--format", "json", "--ids", "full"],
  ["types", "erd.table", "--format", "json"],
  ["validate", "doc.jsonl"],
  ["diff", "before.jsonl", "doc.jsonl", "--format", "json", "--exit-code"],
  [
    "edit",
    "doc.jsonl",
    "--ops",
    "ops.json",
    "--snapshot",
    "snapshot.jsonl",
    "--format",
    "json",
  ],
  ["arrange", "doc.jsonl", "--mode", "overlaps", "--write"],
  ["format", "doc.jsonl", "--write"],
  ["ddl", "doc.jsonl", "--dialect", "sqlite", "--output", "schema.sql"],
  ["lint", "process.jsonl", "--format", "json"],
  ["bpmn", "export", "process.jsonl", "--output", "export.bpmn"],
  ["open", "doc.jsonl", "--app", "My Nodetto.app"],
  ["export", "doc.jsonl", "--format", "svg"],
];
for (const args of cases) {
  test(`MCP matches CLI results and effects: ${args.join(" ")}`, async () => {
    const direct = memoryIo();
    const remote = memoryIo();
    const expected = await runCliAsync(args, direct.io, "test");
    expect(expected.exitCode).toBe(0);
    const session = await connect(remote.io);
    try {
      const result = await session.client.callTool({
        name: `nodetto_${args[0]}`,
        arguments: { args: args.slice(1) },
      });
      expect(result.structuredContent).toEqual(expected);
      expect(result.isError).toBe(false);
      expect(result.content).toEqual([
        { type: "text", text: JSON.stringify(expected) },
      ]);
      expect(remote.files).toEqual(direct.files);
      expect(remote.bytes).toEqual(direct.bytes);
      expect(remote.opened).toEqual(direct.opened);
    } finally {
      await session.close();
    }
  });
}

test("MCP supplies inline operations, preserves dry-run and snapshots, and stays usable after errors", async () => {
  const memory = memoryIo();
  const session = await connect(memory.io);
  const editArgs = ["doc.jsonl", "--ops", "-", "--snapshot", "snapshot.jsonl"];
  try {
    const missing = await session.client.callTool({
      name: "nodetto_edit",
      arguments: { args: editArgs },
    });
    expect(missing.isError).toBe(true);
    expect(output(missing).stderr).toContain("stdin field");
    const invalid = await session.client.callTool({
      name: "nodetto_edit",
      arguments: { args: editArgs, stdin: "bad json" },
    });
    expect(invalid.isError).toBe(true);
    expect(memory.files.get("doc.jsonl")).toBe(doc);
    const dry = await session.client.callTool({
      name: "nodetto_edit",
      arguments: { args: [...editArgs, "--dry-run"], stdin: ops },
    });
    expect(dry.isError).toBe(false);
    expect(memory.files.get("doc.jsonl")).toBe(doc);
    expect(memory.files.has("snapshot.jsonl")).toBe(false);
    const applied = await session.client.callTool({
      name: "nodetto_edit",
      arguments: { args: editArgs, stdin: ops },
    });
    expect(applied.isError).toBe(false);
    expect(
      parseDocument(memory.files.get("doc.jsonl")!).elements[0]?.visual?.x,
    ).toBe(100);
    expect(memory.files.get("snapshot.jsonl")).toBe(
      memory.files.get("doc.jsonl"),
    );
  } finally {
    await session.close();
  }
});

test("generic MCP tool preserves CLI exit codes, help/version and exception recovery", async () => {
  const memory = memoryIo();
  const session = await connect(memory.io);
  try {
    for (const [args, exitCode] of [
      [["--version"], 0],
      [["--help"], 0],
      [["help", "bpmn"], 0],
      [["ddl", "doc.jsonl", "--check", "stale.sql"], 1],
      [["validate", "missing.jsonl"], 2],
      [["ddl", "unsafe.jsonl", "--strict"], 3],
      [["mcp"], 2],
      [["mcp", "--help"], 0],
    ] as const) {
      const result = await session.client.callTool({
        name: "nodetto_cli",
        arguments: { args: [...args] },
      });
      expect(output(result).exitCode).toBe(exitCode);
      expect(result.isError).toBe(exitCode !== 0);
    }
    const invalid = await session.client.callTool({
      name: "nodetto_cli",
      arguments: { args: "not an array" },
    });
    expect(invalid.isError).toBe(true);
    const unknown = await session.client.callTool({
      name: "missing_tool",
      arguments: { args: [] },
    });
    expect(unknown.isError).toBe(true);
    memory.io.readText = () => {
      throw new Error("unexpected read failure");
    };
    const failure = await session.client.callTool({
      name: "nodetto_edit",
      arguments: { args: ["doc.jsonl", "--ops", "-"], stdin: ops },
    });
    expect(failure.isError).toBe(true);
    expect(
      (
        await session.client.callTool({
          name: "nodetto_cli",
          arguments: { args: ["--version"] },
        })
      ).isError,
    ).toBe(false);
  } finally {
    await session.close();
  }
});

test("MCP supports BPMN import and all four render formats", async () => {
  const memory = memoryIo();
  const session = await connect(memory.io);
  try {
    const imported = await session.client.callTool({
      name: "nodetto_bpmn",
      arguments: {
        args: ["import", "process.bpmn", "--output", "imported.jsonl"],
      },
    });
    expect(imported.isError).toBe(false);
    expect(
      parseDocument(memory.files.get("imported.jsonl")!).pages[0]?.kind,
    ).toBe("bpmn");
    const editor = new Editor();
    const frame = editor.createElement("frame", {
      semantic: { name: "Home", platform: "web" },
      visual: { x: 0, y: 0, width: 500, height: 500 },
    });
    memory.files.set("design.jsonl", serializeDocument(editor.getSnapshot()));
    for (const format of ["svg", "png", "pdf", "html"]) {
      const path = `out.${format}`;
      const result = await session.client.callTool({
        name: "nodetto_export",
        arguments: {
          args:
            format === "html"
              ? [
                  "design.jsonl",
                  "--format",
                  format,
                  "--output",
                  path,
                  "--element",
                  frame,
                ]
              : ["doc.jsonl", "--format", format, "--output", path],
        },
      });
      expect(result.isError).toBe(false);
      if (format === "svg") expect(memory.files.get(path)).toContain("<svg");
      else {
        const data = memory.bytes.get(path)!;
        const signature =
          format === "png"
            ? [137, 80, 78, 71]
            : format === "pdf"
              ? [37, 80, 68, 70]
              : [80, 75, 3, 4];
        expect([...data.slice(0, 4)]).toEqual(signature);
      }
    }
  } finally {
    await session.close();
  }
});

test("MCP preserves edit contention exit code 4 without writing", async () => {
  const memory = memoryIo();
  let reads = 0;
  memory.io.readText = () => doc.replace('"Shop"', `"Shop ${reads++}"`);
  const session = await connect(memory.io);
  try {
    const result = await session.client.callTool({
      name: "nodetto_edit",
      arguments: { args: ["doc.jsonl", "--ops", "-"], stdin: ops },
    });
    expect(output(result).exitCode).toBe(4);
    expect(result.isError).toBe(true);
    expect(memory.files.get("doc.jsonl")).toBe(doc);
  } finally {
    await session.close();
  }
});

test("MCP capture appends opt-in images and read notes while preserving the CLI result", async () => {
  const direct = memoryIo();
  const remote = memoryIo();
  const reads: string[] = [];
  for (const memory of [direct, remote]) {
    Object.assign(memory.io, {
      capture: {
        dir: () => "/mock",
        absolute: (path) => path,
        digest: () => "0000000000000000",
        write(path, bytes) {
          memory.bytes.set(path, bytes);
          return "written";
        },
      } satisfies NonNullable<CommandIo["capture"]>,
    });
  }
  remote.io.readBytes = (path) => {
    reads.push(path);
    if (path === "/mock/large.png")
      return new Uint8Array(MCP_INLINE_MAX_BYTES + 1);
    const bytes = remote.bytes.get(path);
    if (!bytes || path === "/mock/unreadable.png")
      throw new Error("Permission denied");
    return bytes;
  };
  const session = await connect(remote.io);
  try {
    expect(session.client.getInstructions()).toContain("nodetto_capture");
    const notes = {
      ambiguous: "Try --json",
    };
    const scenarios: {
      path: string;
      options: string[];
      mode: "plain" | "image" | keyof typeof notes;
    }[] = [
      { path: "/mock/plain.png", options: [], mode: "plain" },
      { path: "/mock/plan view.png", options: ["--inline"], mode: "image" },
      {
        path: "/mock/json.png",
        options: ["--inline", "--json"],
        mode: "image",
      },
      { path: "/mock/large.png", options: ["--inline"], mode: "image" },
      {
        path: "/mock/unreadable.png",
        options: ["--inline"],
        mode: "image",
      },
      {
        path: "/mock/plan view.png\nother.png",
        options: ["--inline"],
        mode: "ambiguous",
      },
    ];
    for (const { path, options, mode } of scenarios) {
      const args = ["doc.jsonl", "--output", path, ...options];
      const expected = await runCliAsync(
        ["capture", ...args],
        direct.io,
        "test",
      );
      const genericTool = options.includes("--json");
      const response = CallToolResultSchema.parse(
        await session.client.callTool({
          name: genericTool ? "nodetto_cli" : "nodetto_capture",
          arguments: { args: genericTool ? ["capture", ...args] : args },
        }),
      );
      expect(expected.exitCode).toBe(0);
      expect(response.structuredContent).toEqual({ ...expected });
      expect(response.isError).toBe(false);
      const [first, extra] = response.content;
      expect(first).toEqual({ type: "text", text: JSON.stringify(expected) });
      expect(response.content).toHaveLength(mode === "plain" ? 1 : 2);
      if (mode === "image") {
        if (extra?.type !== "image") throw new Error("Expected an image");
        expect(extra.mimeType).toBe("image/png");
        expect(new Uint8Array(Buffer.from(extra.data, "base64"))).toEqual(
          direct.bytes.get(path)!,
        );
      } else if (mode !== "plain") {
        if (extra?.type !== "text") throw new Error("Expected an inline note");
        expect(extra.text).toContain(notes[mode]);
      }
    }
    expect(reads).toEqual([]);
  } finally {
    await session.close();
  }
});

test("MCP inline capture attaches each call's own write", async () => {
  const memory = memoryIo();
  const a = Uint8Array.from({ length: 4096 }, (_, i) => i & 255);
  const b = Uint8Array.from({ length: 4096 }, (_, i) => 255 - (i & 255));
  let signalA = () => {};
  let signalB = () => {};
  const aWritten = new Promise<void>((resolve) => {
    signalA = resolve;
  });
  const bWritten = new Promise<void>((resolve) => {
    signalB = resolve;
  });
  const path = "/mock/shared.png";
  const sharedIo: CommandIo = {
    ...memory.io,
    capture: {
      dir: () => "/mock",
      absolute: (p) => p,
      digest: () => "0".repeat(16),
      write(p, bytes) {
        memory.bytes.set(p, bytes);
        return "written";
      },
    },
    readBytes: (p) => {
      const stored = memory.bytes.get(p);
      if (stored === undefined) throw new Error("ENOENT");
      return stored;
    },
  };
  const result = { exitCode: 0, stdout: `path: ${path}\n`, stderr: "" };
  const runA: typeof runCliAsync = async (_args, io) => {
    io.capture?.write(path, a, true);
    signalA();
    await bWritten;
    return result;
  };
  const runB: typeof runCliAsync = async (_args, io) => {
    await aWritten;
    io.capture?.write(path, b, true);
    signalB();
    return result;
  };
  const first = await connect(sharedIo, { run: runA });
  const second = await connect(sharedIo, { run: runB });
  try {
    const [responseA, responseB] = await Promise.all(
      [first, second].map((session) =>
        session.client.callTool({
          name: "nodetto_capture",
          arguments: { args: ["--inline", "--output", path] },
        }),
      ),
    );
    if (!responseA || !responseB) throw new Error("Missing responses");
    expect(responseA.isError).toBe(false);
    expect(responseB.isError).toBe(false);
    expect(output(responseA)).toEqual(result);
    expect(output(responseB)).toEqual(result);
    expect(memory.bytes.get(path)).toEqual(b);
    const imageA = CallToolResultSchema.parse(responseA).content[1];
    const imageB = CallToolResultSchema.parse(responseB).content[1];
    if (imageA?.type !== "image" || imageB?.type !== "image")
      throw new Error("Missing images");
    const actualA = new Uint8Array(Buffer.from(imageA.data, "base64"));
    const actualB = new Uint8Array(Buffer.from(imageB.data, "base64"));
    expect(actualA).toEqual(a);
    expect(actualB).toEqual(b);

    async function checkWrite(
      bytes: Uint8Array,
      status: "written" | "identical" | "exists" | "throw",
      exitCode: number,
      outputPath = "/mock/front.png",
      stdoutPath = outputPath,
    ) {
      const single: CommandIo = {
        ...memoryIo().io,
        capture: {
          dir: () => "/mock",
          absolute: (p) => p,
          digest: () => "0".repeat(16),
          write() {
            if (status === "throw") throw new Error("write failed");
            return status;
          },
        },
      };
      const fakeResult = {
        exitCode,
        stdout: `path: ${stdoutPath}\n`,
        stderr: "",
      };
      const run: typeof runCliAsync = async (_args, io) => {
        io.capture?.write(outputPath, bytes, true);
        return fakeResult;
      };
      const session = await connect(single, { run });
      try {
        const response = CallToolResultSchema.parse(
          await session.client.callTool({
            name: "nodetto_capture",
            arguments: { args: ["--inline", "--output", outputPath] },
          }),
        );
        if (status !== "throw")
          expect(response.structuredContent).toEqual(fakeResult);
        expect(response.isError).toBe(exitCode !== 0 || status === "throw");
        return response;
      } finally {
        await session.close();
      }
    }
    const exitOne = await checkWrite(a, "written", 1);
    expect(exitOne.content[1]?.type).toBe("image");
    const identical = await checkWrite(a, "identical", 0);
    const identicalImage = identical.content[1];
    if (identicalImage?.type !== "image")
      throw new Error("Missing identical image");
    expect(new Uint8Array(Buffer.from(identicalImage.data, "base64"))).toEqual(
      a,
    );
    expect((await checkWrite(a, "exists", 2)).content).toHaveLength(1);
    const thrown = await checkWrite(a, "throw", 2);
    expect(thrown.content).toHaveLength(1);
    expect(
      (thrown.structuredContent as unknown as CommandResult).exitCode,
    ).toBe(2);
    const exact = await checkWrite(
      new Uint8Array(MCP_INLINE_MAX_BYTES),
      "written",
      0,
    );
    const exactImage = exact.content[1];
    if (exactImage?.type !== "image") throw new Error("Missing boundary image");
    expect(Buffer.from(exactImage.data, "base64").byteLength).toBe(
      MCP_INLINE_MAX_BYTES,
    );
    const oversized = await checkWrite(
      new Uint8Array(MCP_INLINE_MAX_BYTES + 1),
      "written",
      0,
    );
    const note = oversized.content[1];
    if (note?.type !== "text") throw new Error("Missing oversize note");
    expect(note.text).toContain("1048577 bytes exceed 1048576");
    const jpeg = await checkWrite(a, "written", 0, "/mock/front.jpg");
    const jpegImage = jpeg.content[1];
    if (jpegImage?.type !== "image") throw new Error("Missing JPEG image");
    expect(jpegImage.mimeType).toBe("image/jpeg");
    const mismatch = await checkWrite(
      a,
      "written",
      0,
      "/mock/front.png",
      "/mock/other.png",
    );
    expect(mismatch.content[1]).toEqual({
      type: "text",
      text: "Image not inlined: could not read the written path from capture output. Try --json.",
    });
  } finally {
    await first.close();
    await second.close();
  }
});
