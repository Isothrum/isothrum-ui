import type { IssueText } from "@/lib/tool/issues";
import type { Gns3Text } from "@/lib/tool/gns3-parts";
import type { Compiled } from "./builders";

/**
 * Fixed values the editor model's tests compare with: stand-in text whose words carry what the
 * code put in them, and results more than one test expects.
 */

/** The canvas's findings in plain words, so tests can read them. */
export const issueText: IssueText = {
  vlanBlocks: (vlan, block, other, sw) => `${vlan}: ${block} vs ${other} on ${sw}`,
  areaBlock: (lan, block, switches) => `area ${lan}: ${block} vs ${switches}`,
  noName: { machine: "unnamed machine", lan: "unnamed lan", switch: "unnamed switch" },
  sameName: { machine: (n) => `two machines ${n}`, lan: (n) => `two lans ${n}`, switch: (n) => `two switches ${n}` },
  badPort: (m, entry) => `${m}: port ${entry}`,
};

/** GNS3 import's messages in plain words, each naming what the code passed it. */
export const gns3Text: Gns3Text = {
  notGns3: "not gns3",
  noTopology: "no topology",
  cisco: (node, kind) => `cisco ${node} ${kind}`,
  firewall: (node) => `firewall ${node}`,
  noEquivalent: (node, type) => `skipped ${node} ${type}`,
  noNodes: "no nodes",
};

/** The networks the VLANs of a switch named sw1 become: `switchNode("sw1")`'s, and the VLAN example's. */
export const sw1Networks: Compiled["networks"] = {
  vlan10: { cidr: "10.10.10.0/24", internet: true, switch: "sw1", vlan: 10 },
  vlan20: { cidr: "10.10.20.0/24", internet: true, switch: "sw1", vlan: 20 },
};
