import { readFileSync } from "node:fs";
import { describe, expect, test } from "vitest";

// npm refuses a publish with provenance unless package.json's repository is the repository the
// provenance names: the one `publish-npm.yml` runs in.
const manifest = JSON.parse(readFileSync(new URL("../package.json", import.meta.url), "utf8")) as {
  repository?: { type?: string; url?: string };
};

describe("package.json", () => {
  test("names the repository the package is published from", () => {
    expect(manifest.repository).toEqual({
      type: "git",
      url: "git+https://github.com/Isothrum/isothrum-ui.git",
    });
  });
});
