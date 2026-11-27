# Changelog

All notable changes to `@isothrum/editor` are recorded here. The format follows
[Keep a Changelog](https://keepachangelog.com/en/1.1.0/), and the project
follows [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

## [1.1.0] — 2026-11-27

### Changed

- **Errors carry codes.** Importing a file that isn't a GNS3 project throws a
  `Gns3ImportError` (`code: "not-gns3" | "no-topology"`), and the projects API a
  `ProjectsApiError`. The editor picks its message by the code, so the words stay
  in the text layer (#8).
- **Links point at the Isothrum organization**, where isothrum-desktop,
  isothrum-ui and isothrum-website moved (#1).

### Development

- **CI runs the check.** `ci.yml` runs `npm run check` on pull requests into `dev`
  on Linux, macOS and Windows. `gate.yml` runs the same check before `main` and
  before a publish. `publish-npm.yml` waits on it, and its actions are pinned to
  commit SHAs (#5).
- **ESLint is part of the check**, with typescript-eslint strict type-checked,
  SonarJS and React hooks rules (#7).
- **Tests:**
  - One test file per module, named after it (#6).
  - Every editing hook has its tests, with fake timers (#9, #10).
  - Duplicate tests are merged into tables and weak ones rewritten (#11).
  - Tests assert error codes, not message text (#8).

## [1.0.0] — 2026-10-18

The first release.

[Unreleased]: https://github.com/Isothrum/isothrum-ui/compare/v1.1.0...HEAD
[1.1.0]: https://github.com/Isothrum/isothrum-ui/compare/v1.0.0...v1.1.0
[1.0.0]: https://github.com/Isothrum/isothrum-ui/releases/tag/v1.0.0
