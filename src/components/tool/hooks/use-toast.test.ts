// @vitest-environment happy-dom
import { act, renderHook } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import { elapse } from "@/test/hooks";
import { useToast } from "./use-toast";

beforeEach(() => {
  vi.useFakeTimers();
});
afterEach(() => {
  vi.useRealTimers();
});

/** The toast hook, showing `message`. */
function showing(message: string) {
  const hook = renderHook(() => useToast());
  act(() => {
    hook.result.current[1](message);
  });
  return hook;
}

describe("useToast", () => {
  test("shows a message for 4 seconds, then clears it", async () => {
    const { result } = showing("saved");
    await elapse(3999);
    expect(result.current[0]).toBe("saved");
    await elapse(1);
    expect(result.current[0]).toBeNull();
  });

  test("shows a long message 60 ms a character", async () => {
    const long = "x".repeat(100);
    const { result } = showing(long);
    await elapse(5999);
    expect(result.current[0]).toBe(long);
    await elapse(1);
    expect(result.current[0]).toBeNull();
  });

  test("a new message gets its own time, from when it is shown", async () => {
    const { result } = showing("first");
    await elapse(3000);
    act(() => {
      result.current[1]("second");
    });
    await elapse(3999);
    expect(result.current[0]).toBe("second");
    await elapse(1);
    expect(result.current[0]).toBeNull();
  });
});
