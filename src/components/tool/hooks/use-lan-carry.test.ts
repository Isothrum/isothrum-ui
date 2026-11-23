// @vitest-environment happy-dom
import { act, renderHook } from "@testing-library/react";
import { beforeEach, describe, expect, test } from "vitest";
import { lan, machine } from "@/test/builders";
import { startWith } from "@/test/hooks";
import { useLab } from "./use-lab";
import { useLanCarry } from "./use-lan-carry";

beforeEach(() => {
  localStorage.clear();
});

describe("useLanCarry", () => {
  test("dragging a LAN carries the machines inside it, not the others", () => {
    const office = lan("office");
    startWith({ name: "lab", nodes: [office, machine("in", {}, { x: 140, y: 92 }), machine("out", {}, { x: 2000, y: 2000 })], edges: [] });
    const { result } = renderHook(() => {
      const lab = useLab();
      return { lab, carry: useLanCarry(lab) };
    });
    act(() => {
      result.current.carry.onNodeDragStart(null, office);
      result.current.carry.onNodeDrag(null, { ...office, position: { x: 50, y: 20 } });
    });
    act(() => {
      result.current.carry.onNodeDragStop();
      result.current.carry.onNodeDrag(null, { ...office, position: { x: 500, y: 500 } });
    });
    expect(Object.fromEntries(result.current.lab.nodes.map((n) => [n.id, n.position]))).toMatchObject({ in: { x: 190, y: 112 }, out: { x: 2000, y: 2000 } });
  });
});
