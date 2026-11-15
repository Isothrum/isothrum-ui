import type { Addresses } from "./router-ports";

/**
 * The version of Isoloom's engine (`isoloom-wasm`) the package ships in `wasm/` and is written
 * for: `wasm/engine.json` records the build, and the tests fail when the two differ.
 */
export const ENGINE_VERSION = "3.0.0";

/**
 * The engine's JavaScript surface, from `wasm/isoloom_wasm.js` (Isoloom's `isoloom-wasm` crate,
 * built by `scripts/build-engine.mjs`). Everything runs in the browser: nothing is sent to a
 * server. Each function but `plan_json` throws an `Error` saying why when it can't do its work.
 */
export interface Engine {
  default: () => Promise<unknown>;
  /** A `Plan` as JSON; a topology that gives none is a plan with `error`. */
  plan_json: (topology: string) => string;
  /** The lab's zip: `isoloom.yml`, the lab's own files and every target's. */
  bundle: (topology: string) => Uint8Array;
  /** The lab's own files (provisioning starters, appliance configurations), as JSON. */
  own_files_json: (topology: string) => string;
  /** One target's zip (`docker`, `cloud-vm/aws`…): `isoloom.yml`, the lab's own files and that folder. */
  bundle_target: (topology: string, targetDir: string) => Uint8Array;
  /** Isoloom's own lists (its OSes, network appliances and port protocols), as JSON. */
  choices_json: () => string;
}

export interface GeneratedFile {
  path: string;
  contents: string;
}

/** What the engine makes of a lab: isoloom.yml and every target's files, or what is wrong. */
export interface Plan {
  ok: boolean;
  error: string | null;
  isoloom_yml: string | null;
  problems: string[];
  files: GeneratedFile[];
  skipped: string[];
  addresses: Addresses;
}

/** Served from `public/wasm/`; loaded at runtime, not bundled. */
const ENGINE_URL: string = "/wasm/isoloom_wasm.js";

/** Loads and starts the engine. */
export async function loadEngine(): Promise<Engine> {
  const m = (await import(/* webpackIgnore: true */ /* turbopackIgnore: true */ ENGINE_URL)) as Engine;
  await m.default();
  return m;
}

/** The plan as the engine writes it: isoloom.yml may be left out when there is none. */
type RawPlan = Omit<Plan, "isoloom_yml"> & { isoloom_yml?: string | null };

/** The engine's plan for a topology; an engine crash becomes a plan with `error` (from `failed`). */
export function planOf(engine: Engine, topology: string, failed: (error: string) => string): Plan {
  try {
    const raw = JSON.parse(engine.plan_json(topology)) as RawPlan;
    return { ...raw, isoloom_yml: raw.isoloom_yml ?? null };
  } catch (e) {
    return { ok: false, error: failed(String(e)), isoloom_yml: null, problems: [], files: [], skipped: [], addresses: {} };
  }
}

/** The lab's own files (provisioning starters, appliance configurations). */
export function ownFiles(engine: Engine, topology: string): GeneratedFile[] {
  return JSON.parse(engine.own_files_json(topology)) as GeneratedFile[];
}
