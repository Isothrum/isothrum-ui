#!/usr/bin/env node
// Rebuilds the WebAssembly engine in wasm/ from a checkout of Isoloom (github.com/isoloom/isoloom),
// at the version pinned in wasm/engine.json, and records what was built there (the commit, each
// file's SHA-256). The pin moves only here, with --pin.
//   node scripts/build-engine.mjs <isoloom checkout> [--pin <version>]
// Needs what Isoloom's own build needs: its Rust toolchain with the wasm32-unknown-unknown target,
// wasm-pack, and the wasm-bindgen its Cargo.lock locks. Cargo reads CARGO_BUILD_JOBS and
// CARGO_TARGET_DIR as usual.
import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import { copyFileSync, readFileSync, writeFileSync } from "node:fs";
import { join, resolve } from "node:path";

/** The crate the engine is built from, and the files of its package the editor ships. */
const CRATE = "isoloom-wasm";
const FILES = ["isoloom_wasm.js", "isoloom_wasm.d.ts", "isoloom_wasm_bg.wasm"];

const root = resolve(import.meta.dirname, "..");
const pinFile = join(root, "wasm/engine.json");

function fail(message) {
  console.error(`build-engine: ${message}`);
  process.exit(1);
}

/** The checkout and the version asked for (the recorded pin, unless --pin moves it). */
function readArgs(args, pinned) {
  const at = args.indexOf("--pin");
  const version = at < 0 ? pinned : args[at + 1];
  const rest = at < 0 ? args : [...args.slice(0, at), ...args.slice(at + 2)];
  if (rest.length !== 1 || !version) fail("usage: node scripts/build-engine.mjs <isoloom checkout> [--pin <version>]");
  return { checkout: resolve(rest[0]), version };
}

/** A command's output in the checkout, trimmed. */
function read(checkout, command, args) {
  return execFileSync(command, args, { cwd: checkout, encoding: "utf8", maxBuffer: 64 * 1024 * 1024 }).trim();
}

const { checkout, version } = readArgs(process.argv.slice(2), JSON.parse(readFileSync(pinFile, "utf8")).version);

const metadata = JSON.parse(read(checkout, "cargo", ["metadata", "--no-deps", "--format-version", "1", "--locked"]));
const crate = metadata.packages.find((p) => p.name === CRATE);
if (!crate) fail(`${checkout} has no ${CRATE} crate: is it a checkout of Isoloom?`);
if (crate.version !== version) fail(`the checkout builds ${CRATE} ${crate.version}, the pin is ${version}: check out that version, or move the pin with --pin ${crate.version}`);
// The commit recorded is the source of what's built: nothing uncommitted may be in it.
if (read(checkout, "git", ["status", "--porcelain", "--untracked-files=no"])) fail(`${checkout} has uncommitted changes: the engine is built from a commit`);
const commit = read(checkout, "git", ["rev-parse", "HEAD"]);

// Isoloom's own build of its engine (wasm-pack, set for size), into web/pkg/ of the checkout.
execFileSync("cargo", ["run", "-p", "xtask", "--locked", "-q", "--", "wasm"], { cwd: checkout, stdio: "inherit" });

const files = {};
for (const file of FILES) {
  copyFileSync(join(checkout, "web/pkg", file), join(root, "wasm", file));
  files[file] = createHash("sha256").update(readFileSync(join(root, "wasm", file))).digest("hex");
}
const pin = { crate: CRATE, version, repository: crate.repository, commit, files };
writeFileSync(pinFile, `${JSON.stringify(pin, null, 2)}\n`);
console.log(`engine: ${CRATE} ${version} (${commit.slice(0, 12)}) in wasm/`);
