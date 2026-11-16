// @vitest-environment happy-dom
import { act, renderHook } from "@testing-library/react";
import { beforeEach, describe, expect, test, vi } from "vitest";
import type { Engine } from "@/lib/tool/engine";
import { fakeEngine, planFor } from "@/test/fake-engine";
import { useDownloads } from "./use-downloads";

/** The files the page saved: each link it followed, by name, with the blob behind it. */
let saved: { name: string; blob: Blob }[];

beforeEach(() => {
  saved = [];
  const blobs = new Map<string, Blob>();
  vi.stubGlobal("URL", Object.assign(URL, { createObjectURL: (b: Blob) => (blobs.set(`blob:${String(blobs.size)}`, b), `blob:${String(blobs.size - 1)}`), revokeObjectURL: vi.fn() }));
  vi.spyOn(HTMLAnchorElement.prototype, "click").mockImplementation(function (this: HTMLAnchorElement) {
    const blob = blobs.get(this.getAttribute("href") ?? "");
    if (blob) saved.push({ name: this.download, blob });
  });
});

/** The Export window's downloads for the lab "office". */
const downloads = (engine: Engine | null) => renderHook(() => useDownloads(engine, planFor(), "{}", "office")).result;

describe("useDownloads", () => {
  test("saves the whole lab, one target, or isoloom.yml, each under its name", async () => {
    const result = downloads(fakeEngine());
    act(() => {
      result.current.downloadAll();
      result.current.downloadTarget("cloud-vm/aws");
      result.current.downloadSpec();
    });
    expect(saved.map((s) => [s.name, s.blob.type])).toEqual([
      ["office.zip", "application/zip"],
      ["office-cloud-vm-aws.zip", "application/zip"],
      ["isoloom.yml", "text/yaml"],
    ]);
    expect(await saved[2].blob.text()).toBe("name: lab\n");
  });

  test("a bundle the engine fails to build saves nothing and says why", () => {
    const result = downloads(
      fakeEngine({
        zip: () => {
          throw new Error("too big");
        },
      }),
    );
    act(() => {
      result.current.downloadAll();
    });
    expect(saved).toEqual([]);
    expect(result.current.downloadError).toBe(String(new Error("too big")));
  });

  test("before the engine has loaded, there is nothing to save", () => {
    const result = downloads(null);
    act(() => {
      result.current.downloadAll();
    });
    expect(saved).toEqual([]);
  });
});
