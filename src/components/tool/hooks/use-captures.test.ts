// @vitest-environment happy-dom
import { act, renderHook } from "@testing-library/react";
import { describe, expect, test, vi } from "vitest";
import { type Args, asInvoke, fakeInvoke } from "@/test/hooks";
import { useCaptures } from "./use-captures";

/** The captures of the lab "lab" in the app answering `answers`. */
function captures(answers: Parameters<typeof fakeInvoke>[0]) {
  const fake = fakeInvoke(answers);
  const onError = vi.fn();
  const hook = renderHook(() => useCaptures(asInvoke(fake), "lab", onError));
  return { hook, fake, onError };
}

describe("useCaptures", () => {
  test("a capture started on a network is kept with its file (none when Wireshark shows it live)", async () => {
    const { hook, fake } = captures({ capture_start: (args: Args) => ({ file: args?.network === "office" ? "office.pcap" : null }) });
    await act(async () => {
      await hook.result.current.capture("office");
      await hook.result.current.capture("dmz");
    });
    expect(fake).toHaveBeenCalledWith("capture_start", { name: "lab", network: "office" });
    expect(hook.result.current.captures).toEqual({ office: "office.pcap", dmz: null });
  });

  test("a capture that fails to start is reported, and not kept", async () => {
    const { hook, onError } = captures({
      capture_start: () => {
        throw new Error("no tcpdump");
      },
    });
    await act(async () => {
      await hook.result.current.capture("office");
    });
    expect(onError).toHaveBeenCalledWith(String(new Error("no tcpdump")));
    expect(hook.result.current.captures).toEqual({});
  });

  test("stopping a capture forgets it, even when the app fails to stop it", async () => {
    const { hook } = captures({
      capture_start: { file: null },
      capture_stop: () => {
        throw new Error("already gone");
      },
    });
    await act(async () => {
      await hook.result.current.capture("office");
      await hook.result.current.stopCapture("office");
    });
    expect(hook.result.current.captures).toEqual({});
  });
});
