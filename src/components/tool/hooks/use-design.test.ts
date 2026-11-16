// @vitest-environment happy-dom
import { act, renderHook } from "@testing-library/react";
import { beforeEach, describe, expect, test, vi } from "vitest";
import { loadDesign, saveDesign } from "@/lib/tool/storage";
import { settle } from "@/test/hooks";
import { useDesign } from "./use-design";

beforeEach(() => {
  localStorage.clear();
});

describe("useDesign", () => {
  test("the site opens in the sketch, the desktop app in business", () => {
    expect(renderHook(() => useDesign()).result.current.design).toBe("sketch");
    vi.stubGlobal("__TAURI__", { core: { invoke: vi.fn() } });
    expect(renderHook(() => useDesign()).result.current.design).toBe("business");
  });

  test("the look chosen last in this browser wins, and a choice is kept", async () => {
    saveDesign("business");
    const { result } = renderHook(() => useDesign());
    await settle();
    expect(result.current.design).toBe("business");
    act(() => {
      result.current.chooseDesign("sketch");
    });
    expect([result.current.design, loadDesign()]).toEqual(["sketch", "sketch"]);
  });
});
