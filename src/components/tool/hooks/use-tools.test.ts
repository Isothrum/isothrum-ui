// @vitest-environment happy-dom
import { act, renderHook } from "@testing-library/react";
import { afterEach, describe, expect, test } from "vitest";
import { LAN_TOOL, NOTE_TOOL, SWITCH_TOOL } from "@/lib/tool/blocks";
import { PRESETS } from "@/lib/tool/presets";
import { press, textField } from "@/test/hooks";
import { useToolKeys, useTools } from "./use-tools";

afterEach(() => {
  document.body.replaceChildren();
});

/** The tools, with their keys on. */
function tools() {
  return renderHook(() => {
    const t = useTools();
    useToolKeys(t);
    return t;
  });
}

describe("useTools", () => {
  test("picking a tool selects it, in select mode; picking it again puts it down", () => {
    const { result } = tools();
    act(() => {
      result.current.setModeOnly("hand");
    });
    act(() => {
      result.current.pick("web");
    });
    expect(result.current).toMatchObject({ activeTool: "web", mode: "select" });
    act(() => {
      result.current.pick("web");
    });
    expect(result.current.activeTool).toBeNull();
  });

  test.each([
    ["s", SWITCH_TOOL],
    ["L", LAN_TOOL],
    ["t", NOTE_TOOL],
    ["1", PRESETS[0].id],
    ["0", PRESETS[9].id],
  ])("key %s picks %s, and puts it down pressed again", (key, tool) => {
    const { result } = tools();
    press(key);
    expect(result.current.activeTool).toBe(tool);
    press(key);
    expect(result.current.activeTool).toBeNull();
  });

  test("H is the hand, V selecting, Escape puts the tool down", () => {
    const { result } = tools();
    press("l");
    press("h");
    expect(result.current).toMatchObject({ mode: "hand", activeTool: null });
    press("v");
    expect(result.current.mode).toBe("select");
    press("l");
    press("Escape");
    expect(result.current.activeTool).toBeNull();
  });

  test("keys with Ctrl, or typed in a text field, pick nothing", () => {
    const { result } = tools();
    press("s", { ctrl: true });
    press("s", { target: textField() });
    expect(result.current.activeTool).toBeNull();
  });
});
