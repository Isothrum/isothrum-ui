// @vitest-environment happy-dom
import { act, renderHook, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import { saveProject } from "@/lib/tool/storage";
import { en } from "@/lib/tool/text/en";
import { machine } from "@/test/builders";
import { fakeProjectStore, press, settle, startWith } from "@/test/hooks";
import { useLab } from "./use-lab";
import { useProjects } from "./use-projects";

beforeEach(() => {
  localStorage.clear();
  startWith({ name: "lab", nodes: [machine("web")], edges: [] });
});
afterEach(() => {
  window.history.replaceState(null, "", "/");
});

/** The projects, accounts on, signed in unless `signedIn` is false. */
async function projects(signedIn = true) {
  const setToast = vi.fn();
  const hook = renderHook(() => {
    const lab = useLab();
    return { lab, projects: useProjects({ accounts: true, lab, design: "sketch", setDesign: vi.fn(), plan: null, setToast, fitWhenDrawn: vi.fn(), t: en }) };
  });
  act(() => {
    hook.result.current.projects.setSignedInNow(signedIn);
  });
  await settle();
  return { hook, setToast };
}

describe("useProjects", () => {
  test("Ctrl+S saves the attached project; Ctrl+Shift+S saves it as a new one, under the name asked", async () => {
    const requests = fakeProjectStore();
    saveProject({ id: "p1", name: "lab" });
    vi.stubGlobal("prompt", vi.fn(() => " lab copy "));
    await projects();
    press("s", { ctrl: true });
    await settle();
    press("s", { ctrl: true, shift: true });
    await settle();
    expect(requests.map((r) => [r.method, r.path, (r.body as { name?: string }).name])).toEqual([
      ["PUT", "/api/projects/p1", undefined],
      ["POST", "/api/projects", "lab copy"],
    ]);
  });

  test("signed out, Ctrl+S is the browser's", async () => {
    const requests = fakeProjectStore();
    await projects(false);
    const event = press("s", { ctrl: true });
    await settle();
    expect(requests).toEqual([]);
    expect(event.defaultPrevented).toBe(false);
  });

  test("a link to a project opens it once signed in, attached to it, and leaves the address clean", async () => {
    const draft = { name: "office", nodes: [machine("db")], edges: [] };
    vi.stubGlobal("fetch", vi.fn(() => Promise.resolve(new Response(JSON.stringify({ id: "p7", name: "Office", draft })))));
    window.history.replaceState(null, "", "/en#project=p7");
    const { hook, setToast } = await projects();
    await waitFor(() => {
      expect(hook.result.current.lab.labName).toBe("office");
    });
    expect(hook.result.current.projects.proj.project).toEqual({ id: "p7", name: "Office" });
    expect(setToast).toHaveBeenCalledWith(en.projects.opened("Office"));
    expect(window.location.hash).toBe("");
  });
});
