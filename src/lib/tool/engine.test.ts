import { describe, expect, test } from "vitest";
import { ownFiles, planOf } from "./engine";
import { fakeEngine } from "@/test/fake-engine";

const failed = (e: string) => `engine failed: ${e}`;

describe("planOf", () => {
  test("reads the engine's plan", () => {
    const plan = { ok: true, error: null, isoloom_yml: "name: lab\n", problems: [], files: [], skipped: [], addresses: { web: [["office", "10.10.1.10"]] } };
    expect(planOf(fakeEngine({ plan: () => JSON.stringify(plan) }), "{}", failed)).toEqual(plan);
  });

  test("gives no isoloom.yml when the engine leaves it out", () => {
    const plan = { ok: false, error: "bad", problems: ["x"], files: [], skipped: [], addresses: {} };
    expect(planOf(fakeEngine({ plan: () => JSON.stringify(plan) }), "{}", failed).isoloom_yml).toBeNull();
  });

  test("turns an engine crash into a failed plan, in the editor's words", () => {
    const crash = fakeEngine({
      plan: () => {
        throw new Error("unreachable");
      },
    });
    expect(planOf(crash, "{}", failed)).toEqual({ ok: false, error: "engine failed: Error: unreachable", isoloom_yml: null, problems: [], files: [], skipped: [], addresses: {} });
  });
});

test("ownFiles reads the lab's own files from the engine", () => {
  const files = [{ path: "provision/db.sh", contents: "#!/bin/sh\n" }];
  expect(ownFiles(fakeEngine({ files }), "{}")).toEqual(files);
});
