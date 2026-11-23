import { act } from "@testing-library/react";
import { vi } from "vitest";
import type { Invoke } from "@/lib/tool/desktop";
import type { Draft } from "@/lib/tool/model";
import { saveDraft } from "@/lib/tool/storage";

/**
 * Fakes and drivers for the hooks' tests (run in a DOM: `// @vitest-environment happy-dom`): the
 * desktop app's commands, the keyboard, and the lab a test starts from.
 */

/** A desktop command's arguments. */
export type Args = Record<string, unknown> | undefined;

/**
 * The desktop app's `invoke`, answering each command from `answers`: a value, or a function of
 * the command's arguments (throw to fail it). A command it has no answer for fails, as an unknown
 * command does. Its calls are recorded: `invoke.mock.calls`.
 */
export function fakeInvoke(answers: Record<string, unknown> = {}) {
  return vi.fn((command: string, args?: Record<string, unknown>): Promise<unknown> => {
    if (!(command in answers)) return Promise.reject(new Error(`no command ${command}`));
    const answer = answers[command];
    try {
      return Promise.resolve(typeof answer === "function" ? (answer as (a: Args) => unknown)(args) : answer);
    } catch (e) {
      return Promise.reject(e instanceof Error ? e : new Error(String(e)));
    }
  });
}

/** `fakeInvoke` as the hooks take it. */
export const asInvoke = (fake: ReturnType<typeof fakeInvoke>): Invoke => fake as unknown as Invoke;

/** The commands `fake` was called with, in order. */
export const commands = (fake: ReturnType<typeof fakeInvoke>): string[] => fake.mock.calls.map(([command]) => command);

/** Presses `key` on the window (Ctrl with `ctrl`, Shift with `shift`), from `target` (the page by default). */
export function press(key: string, { ctrl = false, shift = false, target }: { ctrl?: boolean; shift?: boolean; target?: Element } = {}): KeyboardEvent {
  const event = new KeyboardEvent("keydown", { key, ctrlKey: ctrl, shiftKey: shift, bubbles: true, cancelable: true });
  act(() => {
    (target ?? window).dispatchEvent(event);
  });
  return event;
}

/** A text field on the page, to press keys in. */
export function textField(): HTMLInputElement {
  const input = document.createElement("input");
  document.body.append(input);
  return input;
}

/** Starts the editor on `draft`: the lab this browser kept last. */
export function startWith(draft: Draft): void {
  saveDraft(draft);
}

/** Lets pending promises and microtasks run (what a fake clock doesn't advance). */
export async function settle(): Promise<void> {
  await act(async () => {
    await Promise.resolve();
  });
}

/** Moves the fake clock by `ms`, running the timers due and what they start. */
export async function elapse(ms: number): Promise<void> {
  await act(async () => {
    await vi.advanceTimersByTimeAsync(ms);
  });
}

/** A request the fake project store got: its method, path and body. */
export interface StoreRequest {
  method: string;
  path: string;
  body: unknown;
}

/**
 * The site's project store, faked on `fetch`: it answers each save with the project
 * (`{ id: "p1", name }`, the name sent or "lab"), or fails every request with `status`.
 * `requests` lists what it got.
 */
export function fakeProjectStore({ status = 200 }: { status?: number } = {}) {
  const requests: StoreRequest[] = [];
  vi.stubGlobal(
    "fetch",
    vi.fn((path: string, init?: RequestInit) => {
      const body: unknown = typeof init?.body === "string" ? JSON.parse(init.body) : undefined;
      requests.push({ method: init?.method ?? "GET", path, body });
      const name = (body as { name?: string } | undefined)?.name ?? "lab";
      const answer = status === 200 ? { id: "p1", name, updatedAt: "" } : { error: "refused" };
      return Promise.resolve(new Response(JSON.stringify(answer), { status, headers: { "content-type": "application/json" } }));
    }),
  );
  return requests;
}
