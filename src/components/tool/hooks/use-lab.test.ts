// @vitest-environment happy-dom
import { act, renderHook } from "@testing-library/react";
import { beforeEach, describe, expect, test } from "vitest";
import { loadDraft } from "@/lib/tool/storage";
import { machine } from "@/test/builders";
import { startWith } from "@/test/hooks";
import { replaceLab, useDraftSaving, useLab } from "./use-lab";

beforeEach(() => {
  localStorage.clear();
});

describe("useLab", () => {
  test("opens on the lab this browser kept, or a blank one named my-lab", () => {
    expect(renderHook(() => useLab()).result.current).toMatchObject({ labName: "my-lab", nodes: [], edges: [] });
    startWith({ name: "office", nodes: [machine("web")], edges: [] });
    expect(renderHook(() => useLab()).result.current).toMatchObject({ labName: "office", nodes: [{ id: "web" }] });
  });

  test("keeps every change in this browser, a replaced lab too", () => {
    const { result } = renderHook(() => {
      const lab = useLab();
      useDraftSaving(lab);
      return lab;
    });
    act(() => {
      result.current.setNodes([machine("web")]);
    });
    expect(loadDraft()?.nodes.map((n) => n.id)).toEqual(["web"]);
    act(() => {
      replaceLab(result.current, { name: "other", nodes: [], edges: [] });
    });
    expect(loadDraft()).toMatchObject({ name: "other", nodes: [] });
  });
});
