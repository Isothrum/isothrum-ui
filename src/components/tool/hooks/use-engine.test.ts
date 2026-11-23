// @vitest-environment happy-dom
import { renderHook, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, test, vi } from "vitest";
import { loadEngine } from "@/lib/tool/engine";
import { en } from "@/lib/tool/text/en";
import { fakeEngine, planFor } from "@/test/fake-engine";
import { useEngine, usePlan } from "./use-engine";

vi.mock("@/lib/tool/engine", async (importOriginal) => ({ ...(await importOriginal<typeof import("@/lib/tool/engine")>()), loadEngine: vi.fn() }));

beforeEach(() => {
  vi.mocked(loadEngine).mockReset();
});

describe("useEngine", () => {
  test("gives the engine once it has loaded", async () => {
    const engine = fakeEngine();
    vi.mocked(loadEngine).mockResolvedValue(engine);
    const { result } = renderHook(() => useEngine());
    expect(result.current).toEqual({ engine: null, error: null });
    await waitFor(() => {
      expect(result.current).toEqual({ engine, error: null });
    });
  });

  test("says why the engine didn't load", async () => {
    vi.mocked(loadEngine).mockRejectedValue(new Error("no wasm"));
    const { result } = renderHook(() => useEngine());
    await waitFor(() => {
      expect(result.current).toEqual({ engine: null, error: String(new Error("no wasm")) });
    });
  });
});

describe("usePlan", () => {
  test("is no plan before the engine, then the engine's plan of the lab", () => {
    const plan = planFor({ problems: ["x"] });
    expect(renderHook(() => usePlan(null, "{}", en)).result.current).toBeNull();
    expect(renderHook(() => usePlan(fakeEngine({ plan: () => JSON.stringify(plan) }), "{}", en)).result.current).toEqual(plan);
  });

  test("an engine crash is a failed plan in the editor's words, not a crash of the canvas", () => {
    const crash = fakeEngine({
      plan: () => {
        throw new Error("unreachable");
      },
    });
    expect(renderHook(() => usePlan(crash, "{}", en)).result.current).toMatchObject({ ok: false, error: en.engineFailed(String(new Error("unreachable"))) });
  });
});
