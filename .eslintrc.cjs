/* eslint-env node */
require("@rushstack/eslint-patch/modern-module-resolution");

module.exports = {
  root: true,
  env: {
    browser: true,
    node: true,
  },
  plugins: ["@typescript-eslint", "unused-imports"],
  extends: [
    "plugin:vue/vue3-essential",
    "eslint:recommended",
    "@vue/eslint-config-prettier",
    "plugin:@typescript-eslint/eslint-recommended",
  ],
  parserOptions: {
    parser: require.resolve("@typescript-eslint/parser"),
    extraFileExtensions: [".vue"],
    ecmaFeatures: {
      jsx: true,
    },
    ecmaVersion: "latest",
  },
  parser: "vue-eslint-parser",
  rules: {
    "no-unused-vars": "off",
    "no-redeclare": 1,
    "no-prototype-builtins": 1,
    "no-useless-escape": 1,
    "no-restricted-globals": 1,
    "prefer-const": 1,
    "no-case-declarations": 1,
    "unused-imports/no-unused-imports": "warn",
    "unused-imports/no-unused-vars": [
      "warn",
      {
        vars: "all",
        varsIgnorePattern: "^_",
        args: "after-used",
        argsIgnorePattern: "^_",
      },
    ],
    "prettier/prettier": [
      "warn",
      {
        endOfLine: "auto",
      },
    ],
  },
};
