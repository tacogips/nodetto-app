import { afterEach, beforeEach, expect, spyOn, test } from "bun:test";
import * as fs from "node:fs";
import {
  chmodSync,
  lstatSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  readdirSync,
  readlinkSync,
  rmSync,
  symlinkSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { join, sep } from "node:path";
import { captureDirectory, captureIo } from "./capture-io.ts";
import { localIo } from "./local-io.ts";

let folder: string;
beforeEach(() => {
  folder = mkdtempSync(join(tmpdir(), "capture-io-"));
});
afterEach(() => {
  rmSync(folder, { recursive: true, force: true });
});

test("capture writes exclusively and replaces a regular file on request", () => {
  const image = join(folder, "image.png");
  const before = Buffer.from([0, 128, 255]);
  const after = Buffer.from([0, 129, 255]);
  expect(captureIo.write(image, before, false)).toBe("written");
  expect(readFileSync(image)).toEqual(before);
  expect(captureIo.write(image, before, false)).toBe("identical");
  expect(captureIo.write(image, after, false)).toBe("exists");
  expect(captureIo.write(image, after.subarray(1), false)).toBe("exists");
  expect(readFileSync(image)).toEqual(before);
  expect(captureIo.write(folder, before, false)).toBe("exists");
  expect(() => captureIo.write(folder, before, true)).toThrow("regular file");

  expect(captureIo.write(image, after, true)).toBe("written");
  expect(readFileSync(image)).toEqual(after);
  const missing = join(folder, "new.png");
  expect(captureIo.write(missing, before, true)).toBe("written");
  expect(readFileSync(missing)).toEqual(before);
  expect(() =>
    captureIo.write(join(folder, "absent/a.png"), before, false),
  ).toThrow();
});

test.skipIf(process.platform === "win32")(
  "capture refuses links, including dangling links, in both write modes",
  () => {
    const target = join(folder, "target.png");
    const missing = join(folder, "missing.png");
    const original = Buffer.from("original");
    writeFileSync(target, original);
    for (const [name, destination] of [
      ["link.png", target],
      ["dangling.png", missing],
    ] as const) {
      const link = join(folder, name);
      symlinkSync(destination, link);
      expect(captureIo.write(link, original, false)).toBe("exists");
      expect(() => captureIo.write(link, original, true)).toThrow(
        "the output path is a symbolic link",
      );
      expect(readlinkSync(link)).toBe(destination);
    }
    expect(readFileSync(target)).toEqual(original);
    expect(() => lstatSync(missing)).toThrow();
  },
);

test.skipIf(process.geteuid === undefined || process.geteuid() === 0)(
  "capture leaves no file in an unwritable directory",
  () => {
    chmodSync(folder, 0o500);
    try {
      const bytes = Buffer.from("capture");
      expect(() =>
        captureIo.write(join(folder, "new.png"), bytes, false),
      ).toThrow();
      expect(readdirSync(folder)).toEqual([]);
    } finally {
      chmodSync(folder, 0o700);
    }
  },
);

test("capture removes a partly written file and returns the write error", () => {
  const image = join(folder, "image.png");
  const failure = new Error("injected write failure");
  const write = spyOn(fs, "writeFileSync").mockImplementation((descriptor) => {
    expect(typeof descriptor).toBe("number");
    if (typeof descriptor !== "number")
      throw new Error("expected a descriptor");
    fs.writeSync(descriptor, "cap");
    expect(() => lstatSync(image)).toThrow(
      expect.objectContaining({ code: "ENOENT" }),
    );
    const entries = readdirSync(folder);
    expect(entries).toHaveLength(1);
    expect(entries[0]?.startsWith(".nodetto-")).toBe(true);
    expect(readFileSync(join(folder, entries[0] ?? ""), "utf8")).toBe("cap");
    throw failure;
  });
  try {
    expect(() => captureIo.write(image, Buffer.from("capture"), false)).toThrow(
      failure,
    );
    expect(write).toHaveBeenCalledTimes(1);
    expect(readdirSync(folder)).toEqual([]);
  } finally {
    write.mockRestore();
  }
});

test("a failed new capture keeps a concurrent forced replacement", () => {
  const image = join(folder, "image.png");
  const replacement = Buffer.from("replacement");
  const failure = new Error("injected write failure");
  const originalWrite = fs.writeFileSync;
  let first = true;
  const write = spyOn(fs, "writeFileSync").mockImplementation((...args) => {
    if (first) {
      first = false;
      const descriptor = args[0];
      if (typeof descriptor !== "number")
        throw new Error("expected a descriptor");
      fs.writeSync(descriptor, "cap");
      expect(captureIo.write(image, replacement, true)).toBe("written");
      throw failure;
    }
    return originalWrite(...args);
  });
  try {
    expect(() => captureIo.write(image, Buffer.from("capture"), false)).toThrow(
      failure,
    );
    expect(readFileSync(image)).toEqual(replacement);
    expect(readdirSync(folder)).toEqual(["image.png"]);
  } finally {
    write.mockRestore();
  }
});

test("a failed publish keeps a concurrent forced replacement", () => {
  const image = join(folder, "image.png");
  const replacement = Buffer.from("replacement");
  const failure = Object.assign(new Error("not supported"), {
    code: "ENOTSUP",
  });
  const originalLink = fs.linkSync;
  let first = true;
  const link = spyOn(fs, "linkSync").mockImplementation((...args) => {
    if (first) {
      first = false;
      expect(captureIo.write(image, replacement, true)).toBe("written");
      throw failure;
    }
    return originalLink(...args);
  });
  try {
    expect(() => captureIo.write(image, Buffer.from("capture"), false)).toThrow(
      failure,
    );
    expect(link).toHaveBeenCalled();
    expect(readFileSync(image)).toEqual(replacement);
    expect(readdirSync(folder)).toEqual(["image.png"]);
  } finally {
    link.mockRestore();
  }
});

test("a new capture accepts a near-limit basename", () => {
  const name = `${"a".repeat(251)}.png`;
  const image = join(folder, name);
  const bytes = Buffer.from("capture");
  try {
    writeFileSync(image, bytes);
    rmSync(image);
  } catch (error) {
    if (
      error instanceof Error &&
      "code" in error &&
      error.code === "ENAMETOOLONG"
    )
      return;
    throw error;
  }
  expect(captureIo.write(image, bytes, false)).toBe("written");
  expect(readFileSync(image)).toEqual(bytes);
  expect(readdirSync(folder)).toEqual([name]);
});

test("capture directory has a per-user name and is reused", () => {
  const owner = process.geteuid?.();
  const directory = captureDirectory(folder);
  expect(directory).toBe(
    join(
      folder,
      owner === undefined ? "nodetto-capture" : `nodetto-capture-${owner}`,
    ),
  );
  expect(captureDirectory(folder)).toBe(directory);
  const entry = lstatSync(directory);
  expect(entry.isDirectory()).toBe(true);
  if (owner !== undefined) {
    expect(entry.uid).toBe(owner);
    expect(entry.mode & 0o777).toBe(0o700);
  }
});

test("capture directory rejects an ordinary file", () => {
  const path = captureDirectory(folder);
  rmSync(path, { recursive: true });
  writeFileSync(path, "original");
  expect(() => captureDirectory(folder)).toThrow(
    /^Cannot use the capture directory .*: it is not a directory\.$/,
  );
  expect(readFileSync(path, "utf8")).toBe("original");
});

test.skipIf(process.geteuid === undefined)(
  "capture directory rejects links, writable directories, and unexpected owners",
  () => {
    const owner = lstatSync(folder).uid;
    const path = captureDirectory(folder, owner);
    rmSync(path, { recursive: true });
    const realDirectory = join(folder, "real");
    mkdirSync(realDirectory);
    symlinkSync(realDirectory, path);
    expect(() => captureDirectory(folder, owner)).toThrow(
      "it is not a directory",
    );
    rmSync(path);

    mkdirSync(path);
    chmodSync(path, 0o777);
    expect(() => captureDirectory(folder, owner)).toThrow(
      "it is writable by other users",
    );
    const other = owner === 0 ? 1 : owner - 1;
    mkdirSync(join(folder, `nodetto-capture-${other}`), { mode: 0o700 });
    expect(() => captureDirectory(folder, other)).toThrow(
      /^Cannot use the capture directory .*: it belongs to another user\.$/,
    );
  },
);

test("Bun command IO exposes absolute paths and the native digest vector", () => {
  const io = localIo().capture;
  expect(io).toBe(captureIo);
  expect(io?.absolute("a.png")).toBe(join(process.cwd(), "a.png"));
  const relative = ["nested", "..", ".", "a.png"].join(sep);
  const expected =
    process.platform === "win32"
      ? join(process.cwd(), "a.png")
      : `${join(process.cwd(), "nested")}/../a.png`;
  expect(io?.absolute(relative)).toBe(expected);
  expect(io?.digest(Uint8Array.of(99, 97, 98, 99, 99).subarray(1, 4))).toBe(
    "e71fa2190541574b",
  );
});

test.skipIf(process.platform === "win32")(
  "capture preserves parent traversal after a directory symlink",
  () => {
    const physical = join(folder, "physical");
    const nested = join(physical, "nested");
    const output = join(physical, "output");
    mkdirSync(nested, { recursive: true });
    mkdirSync(output);
    symlinkSync(nested, join(folder, "shortcut"));
    const image = `${folder}/shortcut/../output/image.png`;
    const printed = captureIo.absolute(image);
    expect(printed).toBe(image);
    expect(captureIo.write(image, Buffer.from("capture"), false)).toBe(
      "written",
    );
    expect(readFileSync(printed, "utf8")).toBe("capture");
    expect(captureIo.write(image, Buffer.from("updated"), true)).toBe(
      "written",
    );
    expect(readFileSync(join(output, "image.png"), "utf8")).toBe("updated");
    expect(readdirSync(output)).toEqual(["image.png"]);
  },
);
