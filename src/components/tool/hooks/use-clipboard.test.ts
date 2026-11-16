// @vitest-environment happy-dom
import { act, renderHook } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import { cable, machine } from "@/test/builders";
import { press, startWith, textField } from "@/test/hooks";
import { useClipboard } from "./use-clipboard";
import { useLab } from "./use-lab";

beforeEach(() => {
  localStorage.clear();
});
afterEach(() => {
  document.body.replaceChildren();
});

/** The lab of web1 and db1 cabled together, both selected, and an unselected cache1, with its clipboard. */
function clipboard() {
  startWith({ name: "lab", nodes: [], edges: [cable("c1", "m1", "m2"), cable("c2", "m2", "m3")] });
  const deleteElements = vi.fn();
  const hook = renderHook(() => {
    const lab = useLab();
    useClipboard(lab, deleteElements);
    return lab;
  });
  act(() => {
    hook.result.current.setNodes([{ ...machine("m1", { name: "web1" }), selected: true }, { ...machine("m2", { name: "db1" }), selected: true }, machine("m3", { name: "cache1" })]);
  });
  const names = () => hook.result.current.nodes.map((n) => (n.type === "note" ? "" : n.data.name));
  return { hook, deleteElements, names };
}

describe("useClipboard", () => {
  test("Ctrl+C then Ctrl+V pastes copies of the selection, with the cables between them, 40 px further each time", () => {
    const { hook, names } = clipboard();
    press("c", { ctrl: true });
    press("v", { ctrl: true });
    press("v", { ctrl: true });
    expect(names()).toEqual(["web1", "db1", "cache1", "web2", "db2", "web3", "db3"]);
    const nodes = hook.result.current.nodes;
    expect(nodes.slice(3).map((n) => n.position)).toEqual([
      { x: 40, y: 40 },
      { x: 40, y: 40 },
      { x: 80, y: 80 },
      { x: 80, y: 80 },
    ]);
    expect(nodes.filter((n) => n.selected).map((n) => n.id)).toEqual([nodes[5].id, nodes[6].id]);
    expect(hook.result.current.edges.slice(2).map((e) => [e.source, e.target])).toEqual([
      [nodes[3].id, nodes[4].id],
      [nodes[5].id, nodes[6].id],
    ]);
  });

  test("Ctrl+X copies the selection and deletes it", () => {
    const { deleteElements } = clipboard();
    press("x", { ctrl: true });
    expect(deleteElements).toHaveBeenCalledWith({ nodes: [{ id: "m1" }, { id: "m2" }] });
  });

  test("Ctrl+D duplicates the selection", () => {
    const { names } = clipboard();
    const event = press("d", { ctrl: true });
    expect(names()).toEqual(["web1", "db1", "cache1", "web2", "db2"]);
    expect(event.defaultPrevented).toBe(true);
  });

  test("in a text field the keys are the field's", () => {
    const { names } = clipboard();
    const field = textField();
    press("c", { ctrl: true, target: field });
    const event = press("d", { ctrl: true, target: field });
    press("v", { ctrl: true });
    expect(names()).toEqual(["web1", "db1", "cache1"]);
    expect(event.defaultPrevented).toBe(false);
  });
});
