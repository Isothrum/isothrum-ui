// @vitest-environment happy-dom
import { act, renderHook } from "@testing-library/react";
import { describe, expect, test, vi } from "vitest";
import { en } from "@/lib/tool/text/en";
import { asInvoke, commands, fakeInvoke } from "@/test/hooks";
import type { LiveLab } from "./use-desktop";
import { useMachineActions } from "./use-machine-actions";

/** The running lab as the actions see it: reading it again, and its cut links. */
const liveLab = () => ({ refreshStates: vi.fn(() => Promise.resolve()), setLinks: vi.fn() }) as unknown as LiveLab & { refreshStates: ReturnType<typeof vi.fn>; setLinks: ReturnType<typeof vi.fn> };

/** The machine actions of the lab "lab" in the app answering `answers`. */
function actions(answers: Parameters<typeof fakeInvoke>[0]) {
  const fake = fakeInvoke(answers);
  const live = liveLab();
  const setToast = vi.fn();
  const hook = renderHook(() => useMachineActions({ invoke: asInvoke(fake), labName: "lab", live, setToast, t: en }));
  return { hook, fake, live, setToast };
}

describe("useMachineActions", () => {
  test("starting a machine asks the app, then reads the lab again", async () => {
    const { hook, fake, live } = actions({ machine_action: null });
    await act(async () => {
      await hook.result.current.machineAct("web", "start");
    });
    expect(fake).toHaveBeenCalledWith("machine_action", { name: "lab", machine: "web", action: "start" });
    expect(live.refreshStates).toHaveBeenCalled();
    expect(hook.result.current.busy).toBe(false);
  });

  test("a command that fails shows the app's error as a toast, and the controls come back", async () => {
    const { hook, setToast } = actions({
      machine_action: () => {
        throw new Error("no such container");
      },
    });
    await act(async () => {
      await hook.result.current.machineAct("web", "stop");
    });
    expect(setToast).toHaveBeenCalledWith(String(new Error("no such container")));
    expect(hook.result.current.busy).toBe(false);
  });

  test("cutting a link shows the links the app says are cut", async () => {
    const cut = [{ network: "office", machine: "web" }];
    const { hook, fake, live } = actions({ link_action: cut });
    await act(async () => {
      await hook.result.current.linkAct("office", ["web"], "suspend");
    });
    expect(fake).toHaveBeenCalledWith("link_action", { name: "lab", network: "office", machines: ["web"], action: "suspend" });
    expect(live.setLinks).toHaveBeenCalledWith(cut);
  });

  test("opening a machine's screen says what opened; its console says nothing", async () => {
    const { hook, setToast, fake } = actions({ machine_display: "VNC on :5901", machine_console: "" });
    await act(async () => {
      await hook.result.current.machineConsole("web");
      await hook.result.current.machineDisplay("web");
    });
    expect(commands(fake)).toEqual(["machine_console", "machine_display"]);
    expect(setToast.mock.calls).toEqual([[en.machineRun.displayOpened("VNC on :5901")]]);
  });
});
