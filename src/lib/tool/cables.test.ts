import type { Connection } from "@xyflow/react";
import { describe, expect, test } from "vitest";
import { type LabIndex, canConnect, machineEnds, migrateEdges, networkOfCable, newCable, nextPort, onLanEdge, reconnected } from "./cables";
import { autoRouter, cable, lan, machine, realRouter, switchNode } from "@/test/builders";

const index: LabIndex = { lanIds: new Set(["office", "dmz"]), switchIds: new Set(["sw1", "sw2"]), routerIds: new Set(["frr"]) };
const link = (source: string, target: string, sourceHandle: string | null = null, targetHandle: string | null = null): Connection => ({ source, target, sourceHandle, targetHandle });
/** Every machine's first port is eth0. */
const fromZero = () => 0;

describe("canConnect", () => {
  test("joins a machine to a machine, a LAN or a port, and two switches", () => {
    expect([canConnect(link("a", "b"), index, []), canConnect(link("a", "office"), index, []), canConnect(link("sw1", "sw2"), index, [])]).toEqual([true, true, true]);
  });

  test("never joins a node to itself, a LAN to a LAN or a switch to a LAN", () => {
    expect([canConnect(link("a", "a"), index, []), canConnect(link("office", "dmz"), index, []), canConnect(link("sw1", "office"), index, [])]).toEqual([false, false, false]);
  });

  test("a switch or router port takes one cable, unless that cable is the one moving", () => {
    const edges = [cable("c1", "a", "sw1", { targetHandle: "p1" }), cable("c2", "frr", "b", { sourceHandle: "eth0" })];
    expect(canConnect(link("x", "sw1", null, "p1"), index, edges)).toBe(false);
    expect(canConnect(link("frr", "y", "eth0"), index, edges)).toBe(false);
    expect(canConnect(link("x", "sw1", null, "p1"), index, edges, "c1")).toBe(true);
  });
});

test("onLanEdge is true of an appliance on a LAN's border only", () => {
  const office = lan("office");
  const nodes = [office, autoRouter("r", { x: 340, y: 50 }), machine("web", {}, { x: 340, y: 50 })];
  expect([onLanEdge("r", nodes, [office]), onLanEdge("web", nodes, [office]), onLanEdge("nope", nodes, [office])]).toEqual([true, false, false]);
});

describe("newCable", () => {
  const edges = [cable("c1", "a", "b", { aPort: "eth0", bPort: "eth0" })];

  test("labels a machine's end with its next free port", () => {
    expect(newCable(link("a", "b"), index, edges, fromZero).data).toEqual({ aPort: "eth1", bPort: "eth1" });
  });

  test("labels a LAN's end with nothing, a switch's with the port, a router's with its port", () => {
    expect(newCable(link("office", "sw1", null, "p3"), index, [], fromZero).data).toEqual({ aPort: "", bPort: "3" });
    expect(newCable(link("frr", "a", "eth2"), index, edges, fromZero).data).toEqual({ aPort: "eth2", bPort: "eth1" });
  });

  test("gives a machine's first port from where it is told to start", () => {
    expect(newCable(link("r", "a"), index, [], (n) => (n === "r" ? 1 : 0)).data).toEqual({ aPort: "eth1", bPort: "eth0" });
  });

  test("plugs into the handles of the connection, under a new id", () => {
    const c = newCable(link("a", "sw1", "bottom", "p2"), index, [], fromZero);
    expect(c).toMatchObject({ type: "cable", source: "a", sourceHandle: "bottom", target: "sw1", targetHandle: "p2" });
    expect(c.id).toMatch(/^c-/);
  });
});

describe("reconnected", () => {
  const old = cable("c1", "a", "b", { aPort: "eth3", bPort: "eth0" });
  const edges = [old, cable("c2", "d", "x", { aPort: "eth0", bPort: "eth0" })];

  test("an end that stays on its machine keeps its port", () => {
    const moved = reconnected(edges, old, link("a", "d", "bottom"), index, fromZero);
    expect(moved[0]).toMatchObject({ source: "a", sourceHandle: "bottom", target: "d", data: { aPort: "eth3", bPort: "eth1" } });
  });

  test("an end moved onto a switch or a LAN takes its label there", () => {
    const moved = reconnected(edges, old, link("a", "sw1", null, "p4"), index, fromZero);
    expect(moved[0].data).toEqual({ aPort: "eth3", bPort: "4" });
  });

  test("leaves the other cables as they are", () => {
    expect(reconnected(edges, old, link("a", "office"), index, fromZero)[1]).toBe(edges[1]);
  });
});

describe("migrateEdges", () => {
  const nodes = [machine("web"), autoRouter("r"), realRouter("frr"), lan("office"), switchNode("sw1")];

  test("moves a machine's cable onto its top, or its bottom when it was there", () => {
    const edges = migrateEdges([cable("c1", "web", "office", { sourceHandle: "left", targetHandle: "right" }), cable("c2", "office", "web", { targetHandle: "bottom" })], nodes);
    expect(edges.map((e) => [e.sourceHandle, e.targetHandle])).toEqual([
      ["top", "right"],
      [null, "bottom"],
    ]);
  });

  test("moves an appliance's cable onto its single port", () => {
    expect(migrateEdges([cable("c", "r", "office", { sourceHandle: "right" })], nodes)[0].sourceHandle).toBe("port");
  });

  test("keeps a real router's port, and gives a cable on none the first free one", () => {
    const edges = migrateEdges([cable("c1", "frr", "office", { sourceHandle: "eth0" }), cable("c2", "sw1", "frr", { sourceHandle: "p1", targetHandle: "top" })], nodes);
    expect(edges.map((e) => [e.sourceHandle, e.targetHandle])).toEqual([
      ["eth0", null],
      ["p1", "eth1"],
    ]);
  });
});

describe("nextPort", () => {
  const edges = [cable("c1", "web", "db", { aPort: "eth0", bPort: "eth0" }), cable("c2", "fw", "web", { aPort: "eth0", bPort: "eth1" })];

  test("gives the first eth<n> no cable of the machine uses, at either end", () => {
    expect(nextPort("web", edges)).toBe("eth2");
    expect(nextPort("db", edges)).toBe("eth1");
    expect(nextPort("new", edges)).toBe("eth0");
  });

  test("starts from the port it is given (eth0 taken on a LAN's edge)", () => {
    expect(nextPort("new", edges, 1)).toBe("eth1");
  });
});

describe("networkOfCable", () => {
  const nodes = [lan("office"), switchNode("sw1"), machine("a"), machine("b"), machine("c"), machine("x", { name: "" })];
  const edges = [
    cable("toLan", "office", "a"),
    cable("access", "a", "sw1", { targetHandle: "p3" }),
    cable("trunk", "sw1", "b", { sourceHandle: "trunk" }),
    cable("free", "c", "sw1", { targetHandle: "p6" }),
    cable("ab", "a", "b"),
    cable("toNameless", "a", "x"),
    cable("bc", "b", "c"),
  ];
  const net = (id: string) => networkOfCable(id, nodes, edges);

  test("a cable to a LAN is that LAN", () => {
    expect(net("toLan")).toBe("office");
  });

  test("a cable on a switch's access port is its VLAN; on a trunk or a free port, no one network", () => {
    expect([net("access"), net("trunk"), net("free")]).toEqual(["vlan20", null, null]);
  });

  test("cables between named machines are links numbered in order", () => {
    expect([net("ab"), net("bc")]).toEqual(["link-0", "link-1"]);
  });

  test("a cable to a nameless machine, or an unknown cable, is no network", () => {
    expect([net("toNameless"), net("nope")]).toEqual([null, null]);
  });
});

test("machineEnds names the ends of a cable that are machines", () => {
  expect(machineEnds(cable("c", "web", "office"), [machine("web"), lan("office")])).toEqual(["web"]);
});
