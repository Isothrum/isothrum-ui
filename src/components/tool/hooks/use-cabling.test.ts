// @vitest-environment happy-dom
import { act, renderHook } from "@testing-library/react";
import { beforeEach, describe, expect, test } from "vitest";
import type { LabNode } from "@/lib/tool/model";
import { autoRouter, cable, lan, machine } from "@/test/builders";
import { startWith } from "@/test/hooks";
import { useCabling, useLabIndex } from "./use-cabling";
import { useLab } from "./use-lab";

beforeEach(() => {
  localStorage.clear();
});

const link = (source: string, target: string) => ({ source, target, sourceHandle: null, targetHandle: null });

/** Cabling on the office LAN, web and db away from it, and router r (cabled to web by c1) not yet placed. */
function cabling() {
  const away = { x: 2000, y: 2000 };
  startWith({ name: "lab", nodes: [lan("office"), machine("web", {}, away), machine("db", {}, away), autoRouter("r", away)], edges: [cable("c1", "r", "web", { sourceHandle: "port" })] });
  const hook = renderHook(() => {
    const lab = useLab();
    return { lab, cabling: useCabling(lab, useLabIndex(lab.nodes)) };
  });
  const edges = () => hook.result.current.lab.edges;
  return { hook, edges };
}

describe("useCabling", () => {
  test("a cable drawn between two machines joins them on their next free ports", () => {
    const { hook, edges } = cabling();
    act(() => {
      hook.result.current.cabling.onConnect(link("web", "db"));
    });
    expect(edges().at(-1)).toMatchObject({ source: "web", target: "db", data: { aPort: "eth1", bPort: "eth0" } });
  });

  test("a cable from a node to itself is not drawn", () => {
    const { hook, edges } = cabling();
    act(() => {
      hook.result.current.cabling.onConnect(link("web", "web"));
    });
    expect(edges()).toHaveLength(1);
  });

  test("a cable dropped nowhere is unplugged; one moved onto another machine stays, moved", () => {
    const { hook, edges } = cabling();
    const c1 = edges()[0];
    act(() => {
      hook.result.current.cabling.onReconnectStart(null, c1);
      hook.result.current.cabling.onReconnect(c1, { source: "r", sourceHandle: "port", target: "db", targetHandle: null });
      hook.result.current.cabling.onReconnectEnd();
    });
    expect(edges().map((e) => [e.id, e.target])).toEqual([["c1", "db"]]);
    act(() => {
      hook.result.current.cabling.onReconnectStart(null, edges()[0]);
      hook.result.current.cabling.onReconnectEnd();
    });
    expect(edges()).toEqual([]);
  });

  test("a router dragged near a LAN's border lands on it", () => {
    const { hook } = cabling();
    act(() => {
      hook.result.current.cabling.onNodesChange([{ type: "position", id: "r", position: { x: 330, y: 100 } }]);
    });
    const r = hook.result.current.lab.nodes.find((n: LabNode) => n.id === "r");
    expect(r?.position).toEqual({ x: 340, y: 100 });
  });
});
