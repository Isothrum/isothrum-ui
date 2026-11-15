import { createHash } from "node:crypto";
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, test } from "vitest";
import { ENGINE_VERSION } from "./engine";

/**
 * The engine committed in `wasm/` is the pinned one: `wasm/engine.json`, written by
 * `scripts/build-engine.mjs`, says which version of Isoloom's engine was built, from which
 * commit, and each file's SHA-256. An engine copied in by hand, or built from another version,
 * fails here.
 */

interface Pin {
  crate: string;
  version: string;
  repository: string;
  commit: string;
  files: Record<string, string>;
}

const dir = join(process.cwd(), "wasm");
const pin = JSON.parse(readFileSync(join(dir, "engine.json"), "utf8")) as Pin;
const sha256 = (file: string) => createHash("sha256").update(readFileSync(join(dir, file))).digest("hex");

describe("the engine in wasm/ is the pinned one", () => {
  test("it is Isoloom's engine, at the version the package is written for", () => {
    expect(pin.crate).toBe("isoloom-wasm");
    expect(pin.version).toBe(ENGINE_VERSION);
  });

  test("it was built from a commit of Isoloom", () => {
    expect(pin.repository).toBe("https://github.com/isoloom/isoloom");
    expect(pin.commit).toMatch(/^[0-9a-f]{40}$/);
  });

  test("wasm/ holds the files of that build, and nothing else", () => {
    expect(readdirSync(dir).sort()).toEqual([...Object.keys(pin.files), "engine.json"].sort());
  });

  test("each file is the one that was built", () => {
    expect(Object.fromEntries(Object.keys(pin.files).map((file) => [file, sha256(file)]))).toEqual(pin.files);
  });

  test("the package ships the engine's files under their names", () => {
    const pkg = JSON.parse(readFileSync(join(process.cwd(), "package.json"), "utf8")) as { exports: Record<string, unknown> };
    for (const file of ["isoloom_wasm.js", "isoloom_wasm_bg.wasm", "engine.json"]) expect(pkg.exports).toHaveProperty([`./wasm/${file}`]);
  });
});
