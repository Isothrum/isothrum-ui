import type { NoteShape } from "./model";
import { DEFAULT_OS } from "./os";

/** Pieces of a GNS3 import that read one thing: an OS from an image name, a note from a drawing. */

/** The editor's words for what a GNS3 import can't carry over (see the editor's text). */
export interface Gns3Text {
  notGns3: string;
  noTopology: string;
  cisco: (node: string, kind: string) => string;
  firewall: (node: string) => string;
  noEquivalent: (node: string, type: string) => string;
  noNodes: string;
}

export interface G3Drawing {
  x?: number;
  y?: number;
  svg?: string;
}

function windowsOs(t: string): string {
  if (t.includes("11")) return "windows@11";
  if (t.includes("10") && !t.includes("server")) return "windows@10";
  if (t.includes("2016")) return "windows-server@2016";
  if (t.includes("2019")) return "windows-server@2019";
  if (t.includes("2025")) return "windows-server@2025";
  return "windows-server@2022";
}

/** The OS of the first version `t` mentions, or `otherwise`. */
function versionIn(t: string, versions: [mention: string, os: string][], otherwise: string): string {
  return versions.find(([mention]) => t.includes(mention))?.[1] ?? otherwise;
}

/** Linux distributions by a word in the image's name, each with its version guess. */
const DISTROS: [word: string, os: (t: string) => string][] = [
  ["kali", () => "kali@rolling"],
  ["ubuntu", (t) => versionIn(t, [["20.04", "ubuntu@20.04"], ["24", "ubuntu@24.04"]], "ubuntu@22.04")],
  ["rocky", () => "rocky@9"],
  ["alma", () => "alma@9"],
  ["centos", () => "centos@7"],
  ["fedora", () => "fedora@42"],
  ["alpine", () => "alpine@3.19"],
  ["debian", (t) => versionIn(t, [["11", "debian@11"], ["13", "debian@13"]], DEFAULT_OS)],
];

/** The Isoloom OS a VM's image or name suggests (Debian 12 when nothing does). */
export function guessOs(text: string): string {
  const t = text.toLowerCase();
  if (t.includes("win")) return windowsOs(t);
  const distro = DISTROS.find(([word]) => t.includes(word));
  return distro ? distro[1](t) : DEFAULT_OS;
}

/** An SVG fragment's text: its tags left out, its entities decoded. */
function plainText(fragment: string): string {
  let text = "";
  let inTag = false;
  for (const c of fragment) {
    if (c === "<") inTag = true;
    else if (inTag) inTag = c !== ">";
    else text += c;
  }
  return text.replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&amp;/g, "&").trim();
}

/** The text in an SVG drawing's <text> elements, one line each. */
function svgText(svg: string): string {
  const lines: string[] = [];
  let at = svg.indexOf("<text");
  while (at !== -1) {
    const start = svg.indexOf(">", at) + 1;
    const end = svg.indexOf("</text>", start);
    if (start === 0 || end === -1) break;
    lines.push(plainText(svg.slice(start, end)));
    at = svg.indexOf("<text", end);
  }
  return lines.filter(Boolean).join("\n");
}

/** The text of an SVG drawing, and its shape and size (scaled by `scale`). */
export function drawingNote(d: G3Drawing, scale: number): { text: string; shape: NoteShape; w: number; h: number } | null {
  const svg = d.svg ?? "";
  const text = svgText(svg);
  let shape: NoteShape = "text";
  if (svg.includes("<ellipse")) shape = "ellipse";
  else if (svg.includes("<rect")) shape = "rect";
  if (!text && shape === "text") return null;
  const w = Number(/width="([\d.]+)"/.exec(svg)?.[1] ?? 0);
  const h = Number(/height="([\d.]+)"/.exec(svg)?.[1] ?? 0);
  return { text, shape, w: Math.max(120, Math.min(600, w * scale)) || 200, h: Math.max(50, Math.min(400, h * scale)) || 90 };
}
