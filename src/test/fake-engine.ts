import type { Engine, GeneratedFile, Plan } from "@/lib/tool/engine";

/**
 * A stand-in for the engine port (`Engine`), for tests of what the editor does with its answers:
 * the shipped engine itself is `shipped-engine.ts`.
 */

/** A plan for a lab, everything fine unless `p` says otherwise. */
export const planFor = (p: Partial<Plan> = {}): Plan => ({ ok: true, error: null, isoloom_yml: "name: lab\n", problems: [], files: [], skipped: [], addresses: {}, ...p });

/**
 * An engine answering `plan` (a function, to fail like a crash), the lab's own `files`, and
 * `zip` for every bundle (a function, to fail).
 */
export function fakeEngine({ plan = () => JSON.stringify(planFor()), files = [], zip = () => new Uint8Array([1]) }: { plan?: () => string; files?: GeneratedFile[]; zip?: () => Uint8Array } = {}): Engine {
  return {
    default: () => Promise.resolve(),
    plan_json: plan,
    bundle: zip,
    own_files_json: () => JSON.stringify(files),
    bundle_target: zip,
  };
}
