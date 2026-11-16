import js from "@eslint/js";
import reactHooks from "eslint-plugin-react-hooks";
import sonarjs from "eslint-plugin-sonarjs";
import tseslint from "typescript-eslint";

// The check's lint (`npm run lint`): typescript-eslint's strict type-checked rules, SonarJS and
// the React hooks rules, on the package's code and its tests.
export default tseslint.config(
  { ignores: ["dist/", "out-desktop/", "wasm/", "node_modules/"] },
  js.configs.recommended,
  tseslint.configs.strictTypeChecked,
  sonarjs.configs.recommended,
  reactHooks.configs.flat.recommended,
  {
    languageOptions: { parserOptions: { projectService: true, tsconfigRootDir: import.meta.dirname } },
    rules: {
      // Lab addressing is the editor's subject: private blocks and addresses are its data, not configuration.
      "sonarjs/no-hardcoded-ip": "off",
    },
  },
  {
    // The build scripts and configs run in Node and aren't in the TypeScript project.
    files: ["**/*.mjs", "**/*.mts"],
    extends: [tseslint.configs.disableTypeChecked],
    languageOptions: { globals: { console: "readonly", process: "readonly" } },
  },
);
