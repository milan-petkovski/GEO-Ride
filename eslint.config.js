import js from "@eslint/js";
import globals from "globals";

export default [
  js.configs.recommended,
  {
    languageOptions: {
      ecmaVersion: 2026,
      sourceType: "module",
      globals: {
        ...globals.browser,
        ...globals.es2021,
        mapboxgl: "readonly",
        Paho: "readonly",
        THREE: "readonly"
      }
    },
    rules: {
      "no-unused-vars": ["warn", { "argsIgnorePattern": "^_", "varsIgnorePattern": "^_", "caughtErrorsIgnorePattern": "^_" }],
      "no-unreachable": "error",
      "no-console": "off",
      "no-empty": ["warn", { "allowEmptyCatch": true }]
    }
  }
];
