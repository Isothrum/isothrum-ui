import { afterEach } from "vitest";

// A hook test (in a DOM) unmounts what it rendered after each test, so no hook keeps listening
// to the window into the next one. (Testing Library does this itself only with vitest's globals.)
if (typeof document !== "undefined") {
  const { cleanup } = await import("@testing-library/react");
  afterEach(() => {
    cleanup();
  });
}
