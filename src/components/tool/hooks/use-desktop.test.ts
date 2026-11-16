// @vitest-environment happy-dom
import { renderHook } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import type { EnvironmentLive } from "@/lib/tool/desktop";
import { setAutoStarts } from "@/lib/tool/storage";
import { asInvoke, commands, elapse, fakeInvoke, settle } from "@/test/hooks";
import { useAutoStart, useDesktopStartup, useDesktopState, useLiveLab, type RunState } from "./use-desktop";

beforeEach(() => {
  vi.useFakeTimers();
  localStorage.clear();
});
afterEach(() => {
  vi.useRealTimers();
});

const live: EnvironmentLive = { machines: { web: { state: "running", health: "" } }, ports: [], probed: true };

/** The desktop app answering the live-lab reads. */
const runningApp = () => fakeInvoke({ environment_live: live, snapshot_list: [], link_list: [{ network: "office", machine: "web" }] });

describe("useLiveLab", () => {
  test("reads the running lab at once, then every 3 seconds", async () => {
    const invoke = runningApp();
    const { result } = renderHook(() => useLiveLab(asInvoke(invoke), "lab", "running"));
    await settle();
    expect(commands(invoke)).toEqual(["environment_live", "snapshot_list", "link_list"]);
    expect(result.current).toMatchObject({ machineStates: { web: "running" }, live, links: [{ network: "office", machine: "web" }] });
    await elapse(3000);
    expect(commands(invoke)).toHaveLength(6);
    expect(invoke).toHaveBeenCalledWith("environment_live", { name: "lab" });
  });

  test("reads nothing while the lab isn't running, and stops reading when it stops", async () => {
    const invoke = runningApp();
    const hook = renderHook(({ run }: { run: RunState }) => useLiveLab(asInvoke(invoke), "lab", run), { initialProps: { run: "stopped" } });
    await elapse(10_000);
    expect(invoke).not.toHaveBeenCalled();
    hook.rerender({ run: "running" });
    await settle();
    hook.rerender({ run: "stopping" });
    const calls = invoke.mock.calls.length;
    await elapse(10_000);
    expect(invoke.mock.calls).toHaveLength(calls);
  });

  test("a read that fails shows no machine states and no live view", async () => {
    const invoke = runningApp();
    const { result } = renderHook(() => useLiveLab(asInvoke(invoke), "lab", "running"));
    await settle();
    invoke.mockImplementation(() => Promise.reject(new Error("docker is gone")));
    await elapse(3000);
    expect(result.current).toMatchObject({ machineStates: {}, live: null });
  });
});

/** The desktop app's window, answering `answers`. */
function inTheApp(answers: Parameters<typeof fakeInvoke>[0]) {
  const invoke = fakeInvoke(answers);
  vi.stubGlobal("__TAURI__", { core: { invoke } });
  return invoke;
}

/** The desktop state, and the startup run on it for the lab `name`. */
function startUp(name = "lab") {
  const setPending = vi.fn();
  const hook = renderHook(() => {
    const state = useDesktopState();
    useDesktopStartup(state, name, setPending);
    return state;
  });
  return { hook, setPending };
}

describe("useDesktopStartup", () => {
  test("on opening, reads the app's info and the newer release, and finds a lab still running", async () => {
    const info = { version: "1.2.0", docker: true, wireshark: false, live_capture: false, labs: "/labs" };
    inTheApp({ desktop_info: info, update_check: { version: "1.3.0" }, environment_status: '{"State":"running"}' });
    const { hook } = startUp();
    await settle();
    expect(hook.result.current).toMatchObject({ info, update: "1.3.0", run: "running" });
  });

  test("a lab not running that is set to start with the app waits to start", async () => {
    inTheApp({ desktop_info: {}, update_check: null, environment_status: "" });
    setAutoStarts("lab", true);
    const { hook, setPending } = startUp();
    await settle();
    expect(setPending).toHaveBeenCalledWith(true);
    expect(hook.result.current).toMatchObject({ run: "stopped", update: null });
  });

  test("a lab not set to start with the app stays stopped, whatever the app fails to answer", async () => {
    inTheApp({ environment_status: "" });
    const { hook, setPending } = startUp();
    await settle();
    expect(setPending).not.toHaveBeenCalled();
    expect(hook.result.current).toMatchObject({ run: "stopped", info: null });
  });

  test("in a browser, there is no app to ask", () => {
    const { hook } = startUp();
    expect(hook.result.current.invoke).toBeNull();
  });
});

describe("useAutoStart", () => {
  test("in the app, says whether the lab starts with it", async () => {
    setAutoStarts("lab", true);
    const { result } = renderHook(() => useAutoStart(asInvoke(fakeInvoke()), "lab"));
    await settle();
    expect(result.current.autoStart).toBe(true);
  });
});
