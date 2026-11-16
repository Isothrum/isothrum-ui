import { readFileSync } from "node:fs";
import { join } from "node:path";
import { pathToFileURL } from "node:url";

/**
 * The engine the package ships (`wasm/`), loaded in Node for the tests: Isoloom itself, so the
 * editor's model is checked against what Isoloom accepts, not against a copy of its rules.
 */

/** The engine's functions the tests call. */
export interface TestEngine {
  plan_json(topology: string): string;
  choices_json(): string;
}

type EngineModule = TestEngine & { initSync(options: { module: Buffer }): unknown };

function isEngineModule(mod: unknown): mod is EngineModule {
  if (typeof mod !== "object" || mod === null) return false;
  return ["initSync", "plan_json", "choices_json"].every((name) => typeof (mod as Record<string, unknown>)[name] === "function");
}

let loading: Promise<TestEngine> | null = null;

/** The shipped engine, started once for the test file. */
export function shippedEngine(): Promise<TestEngine> {
  loading ??= (async () => {
    const dir = join(process.cwd(), "wasm");
    const mod: unknown = await import(pathToFileURL(join(dir, "isothrum_wasm.js")).href);
    if (!isEngineModule(mod)) throw new Error("wasm/isothrum_wasm.js is not the Isothrum engine with choices_json");
    mod.initSync({ module: readFileSync(join(dir, "isothrum_wasm_bg.wasm")) });
    return mod;
  })();
  return loading;
}

/** What Isoloom's engine says of a topology: its problems, or the error that stopped it. */
export interface Verdict {
  ok: boolean;
  error: string | null;
  problems: string[];
  isoloom_yml: string | null;
}

/** The engine's verdict on `topology`. */
export async function verdict(topology: unknown): Promise<Verdict> {
  return JSON.parse((await shippedEngine()).plan_json(JSON.stringify(topology))) as Verdict;
}

/** The lists Isoloom offers: its OSes, network appliances and port protocols. */
export interface Choices {
  os: string[];
  appliances: string[];
  protocols: string[];
}

/** The engine's lists, to compare with the editor's. */
export const engineChoices = async (): Promise<Choices> => JSON.parse((await shippedEngine()).choices_json()) as Choices;

/** A topology of one container on LAN `lan`, with `tc` on the LAN and `services` on the machine. */
export const oneContainerTopology = (tc?: unknown, services: unknown[] = []) => ({
  name: "parity",
  networks: { lan: { cidr: "10.10.1.0/24", ...(tc ? { tc } : {}) } },
  nodes: { a: { kind: { container: { image: "alpine:3.20" } }, services, networks: { lan: null } } },
});
