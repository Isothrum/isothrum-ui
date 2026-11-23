// @vitest-environment happy-dom
import { act, renderHook } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import type { Draft } from "@/lib/tool/model";
import { loadProject, saveProject } from "@/lib/tool/storage";
import { machine } from "@/test/builders";
import { elapse, fakeProjectStore, settle } from "@/test/hooks";
import { useProject } from "./use-project";

beforeEach(() => {
  vi.useFakeTimers();
  localStorage.clear();
});
afterEach(() => {
  vi.useRealTimers();
});

const lab = (...ids: string[]): Draft => ({ name: "lab", nodes: ids.map((id) => machine(id)), edges: [] });

/** The project hook for a signed-in user (unless `signedIn` is false), on `draft`. */
function project(draft: Draft, signedIn = true) {
  return renderHook((props: { draft: Draft; signedIn: boolean }) => useProject({ ...props, yml: "name: lab\n" }), { initialProps: { draft, signedIn } });
}

/** The project hook attached to project p1, its lab `draft` as last saved. */
async function attached(draft: Draft) {
  const hook = project(draft);
  act(() => {
    hook.result.current.opened({ id: "p1", name: "lab" }, draft);
  });
  await settle();
  return hook;
}

describe("useProject's autosave", () => {
  test("saves the attached project 2.5 s after the last change, once", async () => {
    const requests = fakeProjectStore();
    const hook = await attached(lab("a"));
    hook.rerender({ draft: lab("a", "b"), signedIn: true });
    await elapse(1000);
    hook.rerender({ draft: lab("a", "b", "c"), signedIn: true });
    await elapse(2499);
    expect(requests).toEqual([]);
    await elapse(1);
    expect(requests).toEqual([{ method: "PUT", path: "/api/projects/p1", body: { draft: lab("a", "b", "c"), isoloomYml: "name: lab\n" } }]);
    expect(hook.result.current.state).toBe("saved");
  });

  test("saves nothing when the lab is what was saved", async () => {
    const requests = fakeProjectStore();
    const hook = await attached(lab("a"));
    hook.rerender({ draft: lab("a"), signedIn: true });
    await elapse(5000);
    expect(requests).toEqual([]);
  });

  test("saves nothing once signed out, or detached", async () => {
    const requests = fakeProjectStore();
    const hook = await attached(lab("a"));
    hook.rerender({ draft: lab("a", "b"), signedIn: false });
    await elapse(5000);
    act(() => {
      hook.result.current.detach();
    });
    hook.rerender({ draft: lab("a", "b", "c"), signedIn: true });
    await elapse(5000);
    expect(requests).toEqual([]);
    expect(hook.result.current.state).toBe("idle");
    expect(loadProject()).toBeNull();
  });

  test("after a reload, the project this browser was attached to saves from the next change on", async () => {
    const requests = fakeProjectStore();
    saveProject({ id: "p1", name: "lab" });
    const hook = project(lab("a"));
    await settle();
    expect(hook.result.current.project).toEqual({ id: "p1", name: "lab" });
    hook.rerender({ draft: lab("a"), signedIn: true });
    await elapse(5000);
    expect(requests).toEqual([]);
    hook.rerender({ draft: lab("a", "b"), signedIn: true });
    await elapse(2500);
    expect(requests.map((r) => [r.method, r.path])).toEqual([["PUT", "/api/projects/p1"]]);
  });
});

describe("useProject's save", () => {
  test("saving as a new project creates it and attaches the editor to it", async () => {
    const requests = fakeProjectStore();
    const { result } = project(lab("a"));
    await act(async () => {
      await result.current.save(true, "copy");
    });
    expect(requests).toEqual([{ method: "POST", path: "/api/projects", body: { name: "copy", draft: lab("a"), isoloomYml: "name: lab\n" } }]);
    expect(result.current).toMatchObject({ project: { id: "p1", name: "copy" }, state: "saved" });
    expect(loadProject()).toEqual({ id: "p1", name: "copy" });
  });

  test("a save the store refuses leaves the state in error, and gives nothing", async () => {
    fakeProjectStore({ status: 500 });
    const { result } = project(lab("a"));
    let saved: unknown;
    await act(async () => {
      saved = await result.current.save();
    });
    expect(saved).toBeNull();
    expect(result.current.state).toBe("error");
  });
});
