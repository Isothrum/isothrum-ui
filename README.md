# @isothrum/editor

The Isothrum lab editor as a reusable React package: a canvas that draws an
infrastructure lab (machines, LANs, switches, routers, cables) and compiles it,
in the browser, to an [Isoloom](https://www.isoloom.com) spec and every target's
files through Isoloom's WebAssembly engine.

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

The engine is loaded at runtime from `/wasm/isoloom_wasm.js`, so the host must
serve `isoloom_wasm.js` and `isoloom_wasm_bg.wasm` from `@isothrum/editor/wasm/` at
the path `/wasm/`.

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

`wasm/` holds Isoloom's engine: the `isoloom-wasm` crate of
[isoloom/isoloom](https://github.com/isoloom/isoloom), compiled to WebAssembly. It
is Isoloom itself, so the editor's model is validated against exactly what Isoloom
accepts. It exports `plan_json`, `bundle`, `bundle_target`, `own_files_json` and
`choices_json`.

The package is written for one version of it, `ENGINE_VERSION` in
`src/lib/tool/engine.ts`. `wasm/engine.json` records the build that is committed
(the crate's version, Isoloom's commit, each file's SHA-256), and `npm run check`
fails when the version isn't the pinned one or a file isn't the one recorded.

One script rebuilds it, from a checkout of Isoloom at the pinned version:

```sh
npm run build:engine -- ../isoloom                  # rebuilds wasm/ and wasm/engine.json
npm run build:engine -- ../isoloom --pin 3.1.0      # moves the pin to another version
```

It runs Isoloom's own build (`cargo run -p xtask -- wasm`), so it needs Isoloom's
Rust toolchain with the `wasm32-unknown-unknown` target, `wasm-pack`, and the
`wasm-bindgen` Isoloom's `Cargo.lock` locks. After `--pin`, set `ENGINE_VERSION` to
the same version.

## Develop

```sh
npm run typecheck   # tsc, strict
npm run test        # vitest (unit + engine against the shipped wasm)
npm run build       # dist/index.js, dist/model.js, dist/types, dist/desktop
```
