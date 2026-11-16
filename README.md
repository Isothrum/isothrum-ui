# @isothrum/editor

The Isothrum lab editor as a reusable React package: a canvas that draws an
infrastructure lab (machines, LANs, switches, routers, cables) and compiles it,
in the browser, to an [Isoloom](https://www.isoloom.com) spec and every target's
files through the Isothrum WebAssembly engine.

It is the single source of the editor shared by the Isothrum desktop app and
[isothrum.com](https://www.isothrum.com). The website's content, branding,
accounts, project store and MCP server are **not** here: the package exposes the
editor and the ports a host wires those features into.

Apache-2.0.

## Install

```sh
npm install @isothrum/editor
```

Peer dependencies (the host provides them, so React stays a single instance):
`react`, `react-dom`, `@xyflow/react`, `next-themes`.

## Use

### The editor

```tsx
import { LabCanvas } from "@isothrum/editor";
import { ThemeProvider } from "next-themes";

export function App() {
  return (
    <ThemeProvider attribute="class">
      <LabCanvas lang="en" />
    </ThemeProvider>
  );
}
```

`LabCanvas` props:

| Prop | Type | Default | Meaning |
|---|---|---|---|
| `lang` | `string` | — | editor language; one of `en`, `fr`, `es`, `de` (anything else falls back to `en`) |
| `accounts` | `boolean` | `false` | show the accounts UI (sign in, save to projects); requires `auth` |
| `auth` | `AuthClient \| null` | `null` | the host's auth client (see below); only used when `accounts` is `true` |
| `brandMark` | `BrandMark` | Isothrum mark | the product mark on the empty canvas |

The engine is loaded at runtime from `/wasm/isothrum_wasm.js`, so the host must
serve the two files in `@isothrum/editor/wasm/` at the path `/wasm/`.

### Styles

The editor is styled with Tailwind CSS v4 and the shadcn/Base UI token set. A host
that already owns these tokens needs nothing; otherwise import the shipped sheets:

```css
@import "@isothrum/editor/styles/globals.css";
@import "@isothrum/editor/styles/theme.css";
```

### Accounts (optional)

When `accounts` is `true`, pass an `auth` object implementing the small
`AuthClient` port (a `useSession` hook, `signOut`, and `signIn.oauth2`). Any auth
library fits; the website adapts Better Auth to it. Without it, the editor runs
fully — it just never offers sign-in or saved projects.

### The lab model, without React

Hosts that work with labs outside the canvas (for example a server building or
reading topologies) import the pure logic from the `model` entry, which has no
React and is safe on a server:

```ts
import { draftFromTopology, toTopology, exampleLab } from "@isothrum/editor/model";
```

## The desktop bundle

The package also ships a prebuilt, offline, static build of the editor under
`dist/desktop/` (page, script, styles, fonts and the engine). A Tauri/Electron
host copies that folder and serves it. It is produced by
`scripts/build-desktop-editor.mjs`, run at pack time.

## The WebAssembly engine

`wasm/isothrum_wasm.js` and `wasm/isothrum_wasm_bg.wasm` are built from the
`isothrum-wasm` crate in [isoloom/isothrum](https://github.com/isoloom/isothrum):

```sh
# in the isothrum repo
cargo xtask wasm            # builds web/pkg/
# then copy web/pkg/isothrum_wasm.js and _bg.wasm into this package's wasm/
```

The engine is Isoloom itself compiled to WebAssembly, so the editor's model is
validated against exactly what Isoloom accepts.

## Develop

```sh
npm run typecheck   # tsc, strict
npm run lint        # ESLint: typescript-eslint strict type-checked, SonarJS, React hooks
npm run test        # vitest (unit + engine against the shipped wasm)
npm run build       # dist/index.js, dist/model.js, dist/types, dist/desktop
npm run check       # all four: what CI runs
```

CI runs the check and nothing else: `ci.yml` on pull requests into `dev`, `gate.yml` before `main`
and before a release (`publish-npm.yml` publishes nothing unless it passes), each on Linux, macOS
and Windows.

## Tests

Where tests live and how they are named, so each behaviour has one obvious place:

- **One test file per module, next to it, named after it**: `src/lib/tool/cables.ts` is tested in
  `src/lib/tool/cables.test.ts`, `src/components/tool/hooks/use-toast.ts` in `use-toast.test.ts`. A test file tests one module and a module has at most one test
  file; a test of what a function does lives with that function, even when it goes through
  another module to get there.
- **Checks against Isoloom itself** (the engine shipped in `wasm/`) live in the test file of the
  module whose values they check, in a `describe` that says so ("…, as Isoloom has them"): the OS
  list in `os.test.ts`, link conditions in `conditions.test.ts`, ports in `ports.test.ts`.
- **Shared helpers live in `src/test/`, named for what they give**, and no test file imports
  another test file:
  - `builders.ts`: nodes, cables and labs built from only what a test is about (`machine`, `lan`,
    `cable`, `compile`…);
  - `fixtures.ts`: fixed values tests compare with (stand-in text, expected networks);
  - `arbitraries.ts`: fast-check generators of what the editor draws, for property tests;
  - `shipped-engine.ts`: the shipped engine loaded in Node, and what it says of a topology;
  - `fake-engine.ts`: a stand-in for the engine port, for what the editor does with its answers;
  - `hooks.ts`: fakes and drivers for the hooks' tests (the desktop app's `invoke`, the project
    store, keys, the fake clock).
- **Names**: `describe` names the function (or the subject); each `test` says, in a sentence, the
  behaviour it proves. Several cases of one behaviour are one `test.each` table, not one test each.
- **Assert values, codes and types, not message text.** An error the code throws has a class and a
  `code`; the words a user reads live in `src/lib/tool/text/` and are tested there.
- **Hooks are tested through `renderHook`** (`@testing-library/react`) in a DOM: a hook's test file
  starts with `// @vitest-environment happy-dom` (the rest of the suite runs in Node). They prove
  what a user or a contract sees (what the canvas shows, what the desktop app or the store is
  asked), not how the hook keeps its state.
- **No network and no waiting**: `fetch`, storage and the desktop app are faked (`vi.stubGlobal`,
  `fakeInvoke`), and time is the fake clock (`vi.useFakeTimers()`, `elapse(ms)`): no test sleeps.
