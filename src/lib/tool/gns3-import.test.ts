import { describe, expect, test } from "vitest";
import { Gns3ImportError, fromGns3 } from "./gns3-import";
import { MACHINE_H, MACHINE_W, nodeName, type LabNode, type MachineData } from "./model";
import { gns3Text } from "@/test/fixtures";

/** A GNS3 node: its id, type and name, at the origin unless `extra` says otherwise. */
const g3 = (node_id: string, node_type: string, name: string = node_id, extra: object = {}) => ({ node_id, node_type, name, x: 0, y: 0, ...extra });
/** A .gns3 project of `nodes` and two-ended `links`. */
const project = (nodes: object[], links: string[][] = [], more: object = {}) =>
  JSON.stringify({ name: "My GNS3 Lab", type: "topology", topology: { nodes, links: links.map((ends) => ({ nodes: ends.map((node_id) => ({ node_id })) })), ...more } });
const open = (nodes: object[], links: string[][] = [], more: object = {}) => fromGns3(project(nodes, links, more), gns3Text);
const names = (nodes: LabNode[]) => nodes.map(nodeName);
/** The machine named `name`'s data. */
const machineData = (nodes: LabNode[], name: string): MachineData | undefined => nodes.find((n) => n.type === "machine" && n.data.name === name)?.data as MachineData | undefined;

/** A Docker node and an Ethernet switch, as GNS3 writes them. */
const docker = (node_id: string, name: string, x = 0, y = 0) => ({ node_id, node_type: "docker", name, x, y, properties: { image: "alpine" } });
const sw = (node_id: string) => ({ node_id, node_type: "ethernet_switch", name: node_id, x: 0, y: 0 });
/** The lab a project named `name` opens as: its nodes, links (by GNS3 id) and drawings. */
const labOf = (nodes: object[], links: string[][] = [], drawings: object[] = [], name?: string) =>
  fromGns3(JSON.stringify({ name, topology: { nodes, links: links.map((ends) => ({ nodes: ends.map((node_id) => ({ node_id })) })), drawings } }), gns3Text).lab;

/** What opening `file` throws (undefined when it opens). */
function refusal(file: string): unknown {
  try {
    fromGns3(file, gns3Text);
  } catch (e) {
    return e;
  }
  return undefined;
}

describe("what isn't a GNS3 project", () => {
  test.each([
    ["a file that isn't JSON", "not json", "not-gns3"],
    ["JSON with no topology", JSON.stringify({ name: "x" }), "no-topology"],
  ])("%s is refused with a Gns3ImportError, code %s", (_, file, code) => {
    const error = refusal(file);
    expect(error).toBeInstanceOf(Gns3ImportError);
    expect(error).toMatchObject({ code });
  });

  test("a project with no nodes opens empty, with a warning", () => {
    expect(open([])).toEqual({ lab: { name: "my-gns3-lab", nodes: [], edges: [] }, warnings: ["no nodes"] });
  });
});

describe("switches become LANs", () => {
  test("a switch is a LAN without the internet, the machines cabled to it on its edge", () => {
    const { lab } = open([g3("s1", "ethernet_switch", "Switch1"), g3("d1", "docker", "web", { x: 100, y: 100, properties: { image: "nginx:latest" } })], [["s1", "d1"]]);
    expect(lab.nodes[0]).toMatchObject({ type: "lan", data: { name: "switch1", cidr: "10.10.1.0/24", internet: false } });
    expect(lab.edges).toEqual([expect.objectContaining({ source: lab.nodes[1].id, target: lab.nodes[0].id, data: { aPort: "eth0", bPort: "" } })]);
  });

  test("switches cabled together are one LAN, named after the first; a NAT on it gives it the internet", () => {
    const { lab } = open([g3("nat", "nat", "NAT1"), g3("s1", "ethernet_switch", "Switch1"), g3("s2", "ethernet_hub", "Switch 2"), g3("s3", "ethernet_switch")], [["s1", "s2"], ["nat", "s1"]]);
    expect(lab.nodes.map((n) => n.type === "lan" && [n.data.name, n.data.cidr, n.data.internet])).toEqual([
      ["switch1", "10.10.1.0/24", true],
      ["s3", "10.10.2.0/24", false],
    ]);
  });

  test("an Open vSwitch container is a switch too", () => {
    expect(open([g3("o", "docker", "OpenvSwitch", { properties: { image: "gns3/openvswitch" } })]).lab.nodes[0].type).toBe("lan");
  });
});

describe("what each node becomes", () => {
  test("Cisco routers become automatic routers, with a warning that their configuration stays behind", () => {
    const { lab, warnings } = open([g3("r1", "dynamips", "R1"), g3("r2", "iou", "R_2")]);
    expect(names(lab.nodes)).toEqual(["r1", "r-2"]);
    expect(machineData(lab.nodes, "r1")).toMatchObject({ kind: "router", icon: "router" });
    expect(warnings).toEqual(["cisco R1 Dynamips", "cisco R_2 IOU"]);
  });

  test("a router appliance becomes an automatic router, silently", () => {
    const { lab, warnings } = open([g3("v", "qemu", "edge", { properties: { hda_disk_image: "vyos.img" } })]);
    expect(machineData(lab.nodes, "edge")).toMatchObject({ kind: "router", icon: "router" });
    expect(warnings).toEqual([]);
  });

  test("a firewall becomes an automatic router with a shield, with a warning", () => {
    const { lab, warnings } = open([g3("f", "qemu", "pfSense", { properties: { hda_disk_image: "pfsense.qcow2" } })]);
    expect(machineData(lab.nodes, "pfsense")).toMatchObject({ kind: "router", icon: "shield" });
    expect(warnings).toEqual(["firewall pfSense"]);
  });

  test("QEMU, VirtualBox and VMware nodes become VMs, the OS guessed, each with its provisioning script", () => {
    const nodes = [
      g3("q", "qemu", "Win10", { properties: { hda_disk_image: "win10.qcow2" } }),
      g3("v", "virtualbox", "srv", { properties: { vmname: "Ubuntu 20.04" } }),
      g3("w", "vmware", "kali linux"),
    ];
    const { lab } = open(nodes);
    expect(lab.nodes.map((n) => n.type === "machine" && [n.data.name, n.data.kind, n.data.os, n.data.provision])).toEqual([
      ["win10", "vm", "windows@10", "provision/win10.ps1"],
      ["srv", "vm", "ubuntu@20.04", "provision/srv.sh"],
      ["kali-linux", "vm", "kali@rolling", "provision/kali-linux.sh"],
    ]);
  });

  test("VPCS becomes a small Alpine container, and a Docker node without an image runs Alpine", () => {
    const { lab } = open([g3("p", "vpcs", "PC1"), g3("d", "docker", "box", { properties: {} })]);
    expect(machineData(lab.nodes, "pc1")).toMatchObject({ kind: "container", icon: "laptop", image: "alpine:3.20" });
    expect(machineData(lab.nodes, "box")).toMatchObject({ kind: "container", icon: "container", image: "alpine:3.20" });
  });

  test("a node with no equivalent is left out, with a warning", () => {
    expect(open([g3("x", "cloud_unknown", "Thing")])).toMatchObject({ lab: { nodes: [] }, warnings: ["skipped Thing cloud_unknown"] });
  });
});

describe("names", () => {
  test("spaces and underscores become dashes, and a taken name gets -2, -3", () => {
    expect(labOf([docker("a", "web"), docker("b", "web"), docker("c", "My_Box 1")]).nodes.map(nodeName)).toEqual(["web", "web-2", "my-box-1"]);
  });

  test("a nameless machine is called machine", () => {
    expect(labOf([docker("a", "")]).nodes.map(nodeName)).toEqual(["machine"]);
  });

  test("the lab is named after the project, or gns3-lab", () => {
    expect([labOf([], [], [], "a_b c").name, labOf([]).name]).toEqual(["a-b-c", "gns3-lab"]);
  });
});

describe("where things go", () => {
  test("positions spread out twice as far as GNS3's", () => {
    expect(labOf([docker("a", "web", 100, 50)]).nodes[0].position).toEqual({ x: 230 - MACHINE_W / 2, y: 130 - MACHINE_H / 2 });
  });

  test("LANs come first, so they are drawn under the machines", () => {
    expect(labOf([docker("a", "web"), sw("s1")]).nodes.map((n) => n.type)).toEqual(["lan", "machine"]);
  });

  test("a LAN drawn over a machine it isn't cabled to is hidden", () => {
    const lan = labOf([sw("s1"), docker("a", "web", 0, 10)]).nodes[0];
    expect(lan.type === "lan" && lan.data.hidden).toBe(true);
  });

  test("text drawings become notes, scaled; empty ones are left out", () => {
    const drawings = [{ x: 10, y: 20, svg: '<svg width="100" height="40"><text>Hello</text></svg>' }, { svg: "<svg></svg>" }];
    expect(labOf([], [], drawings).nodes).toEqual([
      expect.objectContaining({ type: "note", position: { x: 20, y: 40 }, width: 200, height: 80, data: { text: "Hello", shape: "text", color: "yellow" } }),
    ]);
  });
});

describe("links", () => {
  test("a link between two machines is a cable between them, each end on its next free port", () => {
    const lab = labOf([docker("a", "web"), docker("b", "db"), docker("c", "cache")], [["a", "b"], ["a", "c"]]);
    expect(lab.edges.map((e) => e.data)).toEqual([
      { aPort: "eth0", bPort: "eth0" },
      { aPort: "eth1", bPort: "eth0" },
    ]);
  });

  test("a machine linked twice to one LAN gets one cable, and a link with one end none", () => {
    const lab = labOf([sw("s1"), docker("a", "web", 300, 300)], [["s1", "a"], ["a", "s1"], ["a"]]);
    expect(lab.edges).toHaveLength(1);
  });
});
