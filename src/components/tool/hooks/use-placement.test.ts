// @vitest-environment happy-dom
import { act, renderHook } from "@testing-library/react";
import type { DragEvent, MouseEvent } from "react";
import { beforeEach, describe, expect, test, vi } from "vitest";
import { LAN_TOOL } from "@/lib/tool/blocks";
import { PRESETS } from "@/lib/tool/presets";
import { machine } from "@/test/builders";
import { startWith } from "@/test/hooks";
import { useLab } from "./use-lab";
import { PRESET_MIME, usePlacement } from "./use-placement";
import { useTools } from "./use-tools";

beforeEach(() => {
  localStorage.clear();
});

/** Placement on a canvas whose screen is the flow (no pan, no zoom), on a lab of one machine. */
function placement() {
  startWith({ name: "lab", nodes: [machine("old")], edges: [] });
  const closeMenus = vi.fn();
  const importGns3 = vi.fn();
  const hook = renderHook(() => {
    const lab = useLab();
    const tools = useTools();
    const placing = usePlacement({ lab, lans: [], tools, presets: PRESETS, canvasRef: { current: null }, screenToFlowPosition: (p) => p, closeMenus, importGns3 });
    return { lab, tools, placing };
  });
  return { hook, closeMenus, importGns3 };
}

const click = (x: number, y: number) => ({ clientX: x, clientY: y }) as MouseEvent;

/** A drop at (x, y) of `files`, or of the toolbar device `preset`. */
const drop = (x: number, y: number, { files = [], preset = "" }: { files?: File[]; preset?: string }) =>
  ({ clientX: x, clientY: y, preventDefault: vi.fn(), dataTransfer: { files, getData: (type: string) => (type === PRESET_MIME ? preset : "") } }) as unknown as DragEvent;

describe("usePlacement", () => {
  test("a click with the LAN tool draws a LAN there, selected, under the machines, and puts the tool down", () => {
    const { hook, closeMenus } = placement();
    act(() => {
      hook.result.current.tools.pick(LAN_TOOL);
    });
    act(() => {
      hook.result.current.placing.onPaneClick(click(500, 400));
    });
    const [first] = hook.result.current.lab.nodes;
    expect(first).toMatchObject({ type: "lan", selected: true });
    expect(hook.result.current.tools.activeTool).toBeNull();
    expect(closeMenus).toHaveBeenCalled();
  });

  test("a click without a tool places nothing", () => {
    const { hook } = placement();
    act(() => {
      hook.result.current.placing.onPaneClick(click(500, 400));
    });
    expect(hook.result.current.lab.nodes.map((n) => n.id)).toEqual(["old"]);
  });

  test("a device dropped from the toolbar lands where it is dropped, selected", () => {
    const { hook } = placement();
    act(() => {
      hook.result.current.placing.onDrop(drop(160, 158, { preset: "web" }));
    });
    expect(hook.result.current.lab.nodes.at(-1)).toMatchObject({ position: { x: 100, y: 100 }, selected: true, data: { name: "web1" } });
  });

  test("a .gns3 file dropped on the canvas is opened", () => {
    const { hook, importGns3 } = placement();
    const project = new File(["{}"], "net.gns3");
    act(() => {
      hook.result.current.placing.onDrop(drop(0, 0, { files: [new File([""], "notes.txt"), project] }));
    });
    expect(importGns3).toHaveBeenCalledWith(project);
  });
});
