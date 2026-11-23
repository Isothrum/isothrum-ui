// @vitest-environment happy-dom
import { act, renderHook } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import type { Plan } from "@/lib/tool/engine";
import { en } from "@/lib/tool/text/en";
import { fakeEngine, planFor } from "@/test/fake-engine";
import { commands, fakeInvoke, settle } from "@/test/hooks";
import { useCaptures } from "./use-captures";
import { useAutoStart, useDesktopState, useLiveLab, useRunPanel } from "./use-desktop";
import { useLabRun } from "./use-lab-run";

beforeEach(() => {
  vi.useFakeTimers();
  localStorage.clear();
});
afterEach(() => {
  vi.useRealTimers();
});

const files = [{ path: "provision/web.sh", contents: "#!/bin/sh\n" }];

/** The desktop app, answering `answers` on top of the running lab's reads. */
function inTheApp(answers: Parameters<typeof fakeInvoke>[0]) {
  const invoke = fakeInvoke({ environment_live: null, snapshot_list: [], link_list: [], ...answers });
  vi.stubGlobal("__TAURI__", { core: { invoke } });
  return invoke;
}

/** The desktop side of the editor, as the editor puts it together, running the lab "lab" with `plan`. */
function desktopSide(plan: Plan | null = planFor()) {
  return renderHook(
    ({ plan }: { plan: Plan | null }) => {
      const state = useDesktopState();
      const panel = useRunPanel();
      const autoStart = useAutoStart(state.invoke, "lab");
      const live = useLiveLab(state.invoke, "lab", state.run);
      const captures = useCaptures(state.invoke, "lab", vi.fn());
      const run = useLabRun({ state, panel, autoStart, live, captures, lab: { labName: "lab", topology: "{}", plan, engine: fakeEngine({ files }), hasVms: false }, t: en });
      return { state, panel, autoStart, live, captures, run };
    },
    { initialProps: { plan } },
  );
}

describe("useLabRun", () => {
  test("Run starts the lab from the engine's spec and the lab's own files, and shows the app's log", async () => {
    const invoke = inTheApp({ environment_up: "started" });
    const { result } = desktopSide();
    await act(async () => {
      await result.current.run.runLab();
    });
    expect(invoke).toHaveBeenCalledWith("environment_up", { name: "lab", yaml: "name: lab\n", files });
    expect(result.current.state.run).toBe("running");
    expect(result.current.panel).toMatchObject({ runOpen: true, runLog: "started" });
  });

  test("a lab that fails to start is stopped, the app's error in the log", async () => {
    inTheApp({
      environment_up: () => {
        throw new Error("docker is not running");
      },
    });
    const { result } = desktopSide();
    await act(async () => {
      await result.current.run.runLab();
    });
    expect(result.current.state.run).toBe("stopped");
    expect(result.current.panel.runLog).toBe(String(new Error("docker is not running")));
  });

  test("Run does nothing before the engine has a spec for the lab", async () => {
    const invoke = inTheApp({});
    const { result } = desktopSide(planFor({ ok: false, isoloom_yml: null }));
    await act(async () => {
      await result.current.run.runLab();
    });
    expect(commands(invoke)).not.toContain("environment_up");
    expect(result.current.state.run).toBe("stopped");
  });

  test("Stop takes the lab down and forgets its captures and cut links", async () => {
    const invoke = inTheApp({ environment_up: "", environment_down: "stopped", capture_start: { file: "office.pcap" }, link_list: [{ network: "office", machine: "web" }] });
    const { result } = desktopSide();
    await act(async () => {
      await result.current.run.runLab();
      await result.current.captures.capture("office");
    });
    await act(async () => {
      await result.current.run.stopLab();
    });
    expect(invoke).toHaveBeenCalledWith("environment_down", { name: "lab" });
    expect(result.current).toMatchObject({ state: { run: "stopped" }, captures: { captures: {} }, live: { links: [], live: null }, panel: { runLog: "stopped" } });
  });

  test("a lab set to start with the app starts once the engine has its spec", async () => {
    const invoke = inTheApp({ environment_up: "" });
    const hook = desktopSide(null);
    act(() => {
      hook.result.current.autoStart.setAutoStartPending(true);
    });
    await settle();
    expect(commands(invoke)).not.toContain("environment_up");
    hook.rerender({ plan: planFor() });
    await settle();
    await settle();
    expect(commands(invoke).filter((c) => c === "environment_up")).toHaveLength(1);
    expect(hook.result.current.autoStart.autoStartPending).toBe(false);
  });
});
