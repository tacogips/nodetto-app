import { Buffer } from "node:buffer";
import { closeSync, constants, fstatSync, openSync, readSync } from "node:fs";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import type { ContentBlock } from "@modelcontextprotocol/sdk/types.js";
import { z } from "zod";
import { runCliAsync } from "./cli.ts";
import { type CommandIo, type CommandResult, fail } from "./commands.ts";
import { COMMAND_HELP, OVERVIEW } from "./help.ts";
import {
  capturedImage,
  MCP_INLINE_MAX_BYTES,
  wantsInlineImage,
} from "./mcp-image.ts";

const inputSchema = {
  args: z
    .array(z.string())
    .describe(
      "CLI argument tokens, without shell quoting or the executable name. For a command-specific tool, omit the command name too. All CLI options are supported.",
    ),
  stdin: z
    .string()
    .optional()
    .describe(
      'Input text for commands reading stdin, such as edit with "--ops -". Never reads the MCP transport stream.',
    ),
};
const outputSchema = {
  exitCode: z.number().int(),
  stdout: z.string(),
  stderr: z.string(),
};

function inlineContent(
  image: NonNullable<ReturnType<typeof capturedImage>>,
  readBytes: (path: string) => Uint8Array | number | undefined,
): ContentBlock {
  try {
    const data = readBytes(image.path);
    if (data === undefined)
      throw new Error("This host cannot read image files.");
    const size = typeof data === "number" ? data : data.byteLength;
    if (typeof data === "number" || size > MCP_INLINE_MAX_BYTES) {
      return {
        type: "text",
        text: `Image not inlined: ${size} bytes exceed ${MCP_INLINE_MAX_BYTES}. Open the path instead, or capture with a smaller --size or --format jpg.`,
      };
    }
    return {
      type: "image",
      data: Buffer.from(data.buffer, data.byteOffset, data.byteLength).toString(
        "base64",
      ),
      mimeType: image.mimeType,
    };
  } catch (cause) {
    return {
      type: "text",
      text: `Image not inlined: ${cause instanceof Error ? cause.message : String(cause)}`,
    };
  }
}

/** Use the CLI itself so new options and operations are available immediately. */
export function createMcpServer(
  io: CommandIo,
  version: string,
  readInlineBytes = (path: string): Uint8Array | number | undefined =>
    io.readBytes?.(path),
): McpServer {
  const server = new McpServer(
    { name: "nodetto-cli", version },
    {
      instructions:
        "Use nodetto_help for CLI usage. Tools operate on local files with the server process's permissions; relative paths use its working directory. Pass each argument as a separate array item. Results preserve CLI stdout, stderr and exitCode (including check/drift and strict warnings). Use stdin for edit --ops -. Export writes binary files through --output. To look at a page, call nodetto_capture: it writes a PNG or JPG and returns its path; add --inline to also receive the image in the result.",
    },
  );
  const execute = async (args: string[], stdin?: string) => {
    let result: CommandResult;
    let writtenPath: string | undefined;
    const capture = wantsInlineImage(args) ? io.capture : undefined;
    try {
      if (
        args[0] === "mcp" &&
        !args.includes("--help") &&
        !args.includes("-h")
      ) {
        result = fail(
          "The MCP server is already running. Use a document command or help mcp.",
        );
      } else {
        result = await runCliAsync(
          args,
          {
            ...io,
            ...(capture && {
              capture: {
                ...capture,
                write(path, bytes, replace) {
                  const status = capture.write(path, bytes, replace);
                  if (status !== "exists") writtenPath = capture.absolute(path);
                  return status;
                },
              },
            }),
            readStdin: () => {
              if (stdin === undefined)
                throw new Error(
                  "Supply the MCP tool's stdin field when using --ops -.",
                );
              return stdin;
            },
          },
          version,
        );
      }
    } catch (cause) {
      result = fail(
        `nodetto-cli: ${cause instanceof Error ? cause.message : String(cause)}`,
      );
    }
    const structuredContent = { ...result };
    const content: ContentBlock[] = [
      { type: "text", text: JSON.stringify(structuredContent) },
    ];
    if (
      writtenPath !== undefined &&
      (result.exitCode === 0 || result.exitCode === 1)
    ) {
      const image = capturedImage(result.stdout);
      if (image?.path === writtenPath) {
        content.push(inlineContent(image, readInlineBytes));
      } else {
        content.push({
          type: "text",
          text: "Image not inlined: could not read the written path from capture output. Try --json.",
        });
      }
    }
    return {
      content,
      structuredContent,
      isError: result.exitCode !== 0,
    };
  };

  server.registerTool(
    "nodetto_cli",
    {
      description: `Run any nodetto CLI command, including help and --version. All CLI arguments and options are passed unchanged.\n\n${OVERVIEW}`,
      inputSchema,
      outputSchema,
    },
    ({ args, stdin }) => execute(args, stdin),
  );

  for (const [command, help] of Object.entries(COMMAND_HELP)) {
    if (command === "mcp") continue;
    server.registerTool(
      `nodetto_${command}`,
      {
        description: help,
        inputSchema,
        outputSchema,
      },
      ({ args, stdin }) => execute([command, ...args], stdin),
    );
  }
  server.registerTool(
    "nodetto_help",
    {
      description:
        'Get the CLI overview, or detailed help for the command named in args. Pass [] for the overview or, for example, ["edit"].',
      inputSchema,
      outputSchema,
      annotations: { readOnlyHint: true },
    },
    ({ args, stdin }) => execute(["help", ...args], stdin),
  );
  return server;
}

/** Bound filesystem reads even if the capture changes before it is inlined. */
function readLocalInlineBytes(path: string): Uint8Array | number {
  const file = openSync(
    path,
    constants.O_RDONLY |
      (constants.O_NOFOLLOW ?? 0) |
      (constants.O_NONBLOCK ?? 0),
  );
  try {
    const entry = fstatSync(file);
    if (!entry.isFile()) throw new Error("The capture is not a regular file.");
    if (entry.size > MCP_INLINE_MAX_BYTES) return entry.size;
    const bytes = Buffer.allocUnsafe(entry.size);
    let length = 0;
    while (length < bytes.length) {
      const read = readSync(file, bytes, length, bytes.length - length, null);
      if (read === 0) break;
      length += read;
    }
    if (fstatSync(file).size !== entry.size || length !== entry.size) {
      throw new Error("The capture size changed while reading it.");
    }
    return bytes;
  } finally {
    closeSync(file);
  }
}

export async function serveMcp(io: CommandIo, version: string): Promise<void> {
  await createMcpServer(io, version, readLocalInlineBytes).connect(
    new StdioServerTransport(),
  );
}
