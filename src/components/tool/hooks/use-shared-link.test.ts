// @vitest-environment happy-dom
import { act, renderHook, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import { encodeLab } from "@/lib/tool/draft";
import type { Draft } from "@/lib/tool/model";
import { en } from "@/lib/tool/text/en";
import { machine } from "@/test/builders";
import { startWith } from "@/test/hooks";
import { useLab } from "./use-lab";
import { copyShareLink, useSharedLink } from "./use-shared-link";

beforeEach(() => {
  localStorage.clear();
  startWith({ name: "mine", nodes: [], edges: [] });
});
afterEach(() => {
  window.history.replaceState(null, "", "/");
});

const shared: Draft = { name: "shared", design: "business", nodes: [machine("web")], edges: [] };

/** The editor with shared links on, its address `hash`. */
function arriving(hash: string) {
  window.history.replaceState(null, "", `/en${hash}`);
  const setDesign = vi.fn();
  const setToast = vi.fn();
  const fit = vi.fn();
  const hook = renderHook(() => {
    const lab = useLab();
    useSharedLink({ lab, setDesign, setToast, fitWhenDrawn: fit, t: en });
    return lab;
  });
  return { hook, setDesign, setToast, fit };
}

describe("useSharedLink", () => {
  test("a link to a lab opens it, in its look, says so, fits, and leaves the address clean", async () => {
    const { hook, setDesign, setToast, fit } = arriving(`#lab=${await encodeLab(shared)}`);
    await waitFor(() => {
      expect(hook.result.current.labName).toBe("shared");
    });
    expect(hook.result.current.nodes.map((n) => n.id)).toEqual(["web"]);
    expect(setDesign).toHaveBeenCalledWith("business");
    expect(setToast).toHaveBeenCalledWith(en.toasts.openedShared("shared"));
    expect(fit).toHaveBeenCalled();
    expect(window.location.hash).toBe("");
  });

  test("a damaged link says so, and leaves the lab", async () => {
    const { hook, setToast } = arriving("#lab=AAAA");
    await waitFor(() => {
      expect(setToast).toHaveBeenCalledWith(en.toasts.brokenLink);
    });
    expect(hook.result.current.labName).toBe("mine");
  });

  test("a link pasted into a tab already on the editor opens too", async () => {
    const { hook } = arriving("");
    const code = await encodeLab(shared);
    act(() => {
      window.history.replaceState(null, "", `/en#lab=${code}`);
      window.dispatchEvent(new HashChangeEvent("hashchange"));
    });
    await waitFor(() => {
      expect(hook.result.current.labName).toBe("shared");
    });
  });
});

describe("copyShareLink", () => {
  test("copies a link to this lab, in the page's language, and says so", async () => {
    const writeText = vi.fn(() => Promise.resolve());
    vi.stubGlobal("navigator", { clipboard: { writeText } });
    const setToast = vi.fn();
    await copyShareLink(shared, "fr", setToast, en);
    expect(writeText).toHaveBeenCalledWith(`${window.location.origin}/fr#lab=${await encodeLab(shared)}`);
    expect(setToast).toHaveBeenCalledWith(en.toasts.linkCopied);
  });

  test("shows the link to copy by hand when the clipboard is refused", async () => {
    vi.stubGlobal("navigator", { clipboard: { writeText: () => Promise.reject(new Error("denied")) } });
    const prompt = vi.fn();
    vi.stubGlobal("prompt", prompt);
    await copyShareLink(shared, "en", vi.fn(), en);
    expect(prompt).toHaveBeenCalledWith(en.toasts.copyPrompt, expect.stringContaining("#lab="));
  });
});
