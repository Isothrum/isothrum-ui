// @vitest-environment happy-dom
import { act, renderHook } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import type { LabNode } from "@/lib/tool/model";
import { machine } from "@/test/builders";
import { elapse, press, settle, textField } from "@/test/hooks";
import { useHistory } from "./use-history";
import { useLab } from "./use-lab";

beforeEach(() => {
  vi.useFakeTimers();
  localStorage.clear();
});
afterEach(() => {
  vi.useRealTimers();
  document.body.replaceChildren();
});

/** The editor's lab with its history, on a blank canvas. */
function editing() {
  const hook = renderHook(() => {
    const lab = useLab();
    return { lab, history: useHistory(lab) };
  });
  const names = () => hook.result.current.lab.nodes.map((n) => n.id);
  /** Puts `nodes` on the canvas, as an edit does. */
  const draw = async (nodes: LabNode[]) => {
    act(() => {
      hook.result.current.lab.setNodes(nodes);
    });
    await settle();
  };
  const step = async (back: boolean) => {
    act(() => {
      hook.result.current.history.step(back);
    });
    await settle();
  };
  return { hook, names, draw, undo: () => step(true), redo: () => step(false) };
}

describe("useHistory", () => {
  test("undo brings back the lab before the last change, redo the change", async () => {
    const lab = editing();
    await lab.draw([machine("a")]);
    await elapse(1000);
    await lab.draw([machine("a"), machine("b")]);
    await lab.undo();
    expect(lab.names()).toEqual(["a"]);
    await lab.redo();
    expect(lab.names()).toEqual(["a", "b"]);
  });

  test("changes less than 700 ms apart (a drag, typing a name) are undone as one", async () => {
    const lab = editing();
    await lab.draw([machine("a", {}, { x: 0, y: 0 })]);
    await elapse(1000);
    await lab.draw([machine("a", {}, { x: 10, y: 0 })]);
    await elapse(300);
    await lab.draw([machine("a", {}, { x: 20, y: 0 })]);
    await lab.undo();
    expect(lab.hook.result.current.lab.nodes[0].position).toEqual({ x: 0, y: 0 });
  });

  test("says what can be undone and redone; a new change after an undo can't be redone past", async () => {
    const lab = editing();
    expect(lab.hook.result.current.history).toMatchObject({ canUndo: false, canRedo: false });
    await lab.draw([machine("a")]);
    expect(lab.hook.result.current.history).toMatchObject({ canUndo: true, canRedo: false });
    await lab.undo();
    await elapse(1000);
    await lab.draw([machine("c")]);
    expect(lab.hook.result.current.history.canRedo).toBe(false);
  });

  test("selecting is no change to undo", async () => {
    const lab = editing();
    await lab.draw([machine("a")]);
    await elapse(1000);
    await lab.draw([{ ...machine("a"), selected: true }]);
    await lab.undo();
    expect(lab.names()).toEqual([]);
  });

  test("Ctrl+Z undoes, Ctrl+Shift+Z and Ctrl+Y redo", async () => {
    const lab = editing();
    await lab.draw([machine("a")]);
    press("z", { ctrl: true });
    await settle();
    expect(lab.names()).toEqual([]);
    press("z", { ctrl: true, shift: true });
    await settle();
    expect(lab.names()).toEqual(["a"]);
    press("z", { ctrl: true });
    press("y", { ctrl: true });
    await settle();
    expect(lab.names()).toEqual(["a"]);
  });

  test("in a text field, Ctrl+Z is the field's own undo", async () => {
    const lab = editing();
    await lab.draw([machine("a")]);
    const event = press("z", { ctrl: true, target: textField() });
    await settle();
    expect(lab.names()).toEqual(["a"]);
    expect(event.defaultPrevented).toBe(false);
  });
});
