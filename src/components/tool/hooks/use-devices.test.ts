// @vitest-environment happy-dom
import { act, renderHook } from "@testing-library/react";
import { beforeEach, describe, expect, test, vi } from "vitest";
import { loadBlockChoices, loadDevices, saveDevices } from "@/lib/tool/storage";
import { deviceFrom } from "@/lib/tool/presets";
import { en } from "@/lib/tool/text/en";
import { machine } from "@/test/builders";
import { settle } from "@/test/hooks";
import { useDevices } from "./use-devices";
import { useTools } from "./use-tools";

beforeEach(() => {
  localStorage.clear();
});

/** The devices and the tools, as the toolbar uses them. */
function devices() {
  const setToast = vi.fn();
  const hook = renderHook(() => {
    const tools = useTools();
    return { tools, devices: useDevices(tools, setToast, en) };
  });
  return { hook, setToast };
}

describe("useDevices", () => {
  test("the devices saved in this browser come back at the end of the toolbar", async () => {
    const saved = deviceFrom(machine("m", { name: "gateway" }).data);
    saveDevices([saved]);
    const { hook } = devices();
    await settle();
    expect(hook.result.current.devices.presets.at(-1)).toEqual(saved);
  });

  test("saving a machine keeps it as a device, replacing one of the same name, and says so", () => {
    const { hook, setToast } = devices();
    act(() => {
      hook.result.current.devices.saveDevice(machine("a", { name: "gateway", image: "alpine" }).data);
    });
    act(() => {
      hook.result.current.devices.saveDevice(machine("b", { name: "gateway", image: "nginx" }).data);
    });
    expect(loadDevices().map((d) => [d.label, d.data.image])).toEqual([["gateway", "nginx"]]);
    expect(setToast).toHaveBeenLastCalledWith(en.toasts.savedDevice("gateway"));
  });

  test("forgetting the device being placed puts it down", () => {
    const { hook } = devices();
    act(() => {
      hook.result.current.devices.saveDevice(machine("a", { name: "gateway" }).data);
    });
    const id = loadDevices()[0].id;
    act(() => {
      hook.result.current.tools.pick(id);
    });
    act(() => {
      hook.result.current.devices.forgetDevice(id);
    });
    expect(loadDevices()).toEqual([]);
    expect(hook.result.current.tools.activeTool).toBeNull();
  });

  test("picking from a block picks the device, and the block remembers it", () => {
    const { hook } = devices();
    act(() => {
      hook.result.current.devices.pickFromBlock("router", "router-frr");
    });
    expect(hook.result.current.tools.activeTool).toBe("router-frr");
    expect(hook.result.current.devices.blockChoice).toEqual({ router: "router-frr" });
    expect(loadBlockChoices()).toEqual({ router: "router-frr" });
  });
});
