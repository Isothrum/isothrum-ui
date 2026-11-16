// @vitest-environment happy-dom
import { act, renderHook } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import { exampleLab } from "@/lib/tool/examples";
import { en } from "@/lib/tool/text/en";
import { autoRouter, cable, lan } from "@/test/builders";
import { elapse, startWith } from "@/test/hooks";
import { useFitWhenDrawn, useLabActions } from "./use-lab-actions";
import { useLab } from "./use-lab";

beforeEach(() => {
  vi.useFakeTimers();
  localStorage.clear();
});
afterEach(() => {
  vi.useRealTimers();
});

/** The lab's actions, with what they fit and toast. */
function actions() {
  const fit = vi.fn();
  const setToast = vi.fn();
  const hook = renderHook(() => {
    const lab = useLab();
    return { lab, actions: useLabActions(lab, fit, setToast, en) };
  });
  return { hook, fit, setToast };
}

/** A file named `name` holding `text`. */
const file = (text: string, name = "lab.gns3") => new File([text], name);

const gns3 = JSON.stringify({ name: "net", topology: { nodes: [{ node_id: "s", node_type: "ethernet_switch", name: "s1", x: 0, y: 0 }, { node_id: "d", node_type: "docker", name: "web", x: 0, y: 0, properties: { image: "nginx" } }], links: [] } });

describe("useFitWhenDrawn", () => {
  test("fits the view once the new lab is drawn, 120 ms later", async () => {
    const fitView = vi.fn();
    const { result } = renderHook(() => useFitWhenDrawn(fitView));
    result.current();
    await elapse(119);
    expect(fitView).not.toHaveBeenCalled();
    await elapse(1);
    expect(fitView).toHaveBeenCalledWith({ padding: 0.4, maxZoom: 1 });
  });
});

describe("useLabActions", () => {
  test("a GNS3 project opens as the lab, says what it brought, and fits", async () => {
    const { hook, fit, setToast } = actions();
    await act(async () => {
      await hook.result.current.actions.importGns3(file(gns3));
    });
    expect(hook.result.current.lab.labName).toBe("net");
    expect(setToast).toHaveBeenCalledWith([en.toasts.gns3Opened("net", 1, 1), en.toasts.undoBringsBack].join(" "));
    expect(fit).toHaveBeenCalled();
  });

  test.each([
    ["isn't JSON", "{", en.gns3.notGns3],
    ["has no topology", "{}", en.gns3.noTopology],
  ])("a file that %s says so, in the editor's words, and leaves the lab", async (_, text, said) => {
    startWith({ name: "mine", nodes: [], edges: [] });
    const { hook, setToast } = actions();
    await act(async () => {
      await hook.result.current.actions.importGns3(file(text));
    });
    expect(setToast).toHaveBeenCalledWith(said);
    expect(hook.result.current.lab.labName).toBe("mine");
  });

  test("a file that can't be read says the project couldn't be read", async () => {
    const { hook, setToast } = actions();
    const unreadable = { text: () => Promise.reject(new Error("gone")) } as unknown as File;
    await act(async () => {
      await hook.result.current.actions.importGns3(unreadable);
    });
    expect(setToast).toHaveBeenCalledWith(en.toasts.gns3Unreadable);
  });

  test("an automatic router made one you configure moves its cables onto its ports", () => {
    startWith({ name: "lab", nodes: [lan("office"), autoRouter("r")], edges: [cable("c", "r", "office", { sourceHandle: "port" })] });
    const { hook } = actions();
    act(() => {
      hook.result.current.actions.updateMachine("r", { kind: "container", image: "frrouting/frr:v8.5.2" });
    });
    expect(hook.result.current.lab.edges[0].sourceHandle).toBe("eth0");
  });

  test("a cable's fields change on that cable only", () => {
    startWith({ name: "lab", nodes: [], edges: [cable("a", "x", "y"), cable("b", "x", "y")] });
    const { hook } = actions();
    act(() => {
      hook.result.current.actions.updateCable("a", { tc: { delay: 5 } });
    });
    expect(hook.result.current.lab.edges.map((e) => e.data?.tc)).toEqual([{ delay: 5 }, undefined]);
  });

  test("an example replaces the lab and fits; clearing empties it", () => {
    const { hook, fit } = actions();
    act(() => {
      hook.result.current.actions.loadExample();
    });
    expect(hook.result.current.lab.nodes.map((n) => n.id)).toEqual(exampleLab().nodes.map((n) => n.id));
    expect(fit).toHaveBeenCalled();
    act(() => {
      hook.result.current.actions.clearLab();
    });
    expect(hook.result.current.lab).toMatchObject({ nodes: [], edges: [] });
  });
});
