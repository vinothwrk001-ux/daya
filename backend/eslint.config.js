const unusedImports = require("eslint-plugin-unused-imports");

module.exports = [
  {
    files: ["src/**/*.js"],
    plugins: {
      "unused-imports": unusedImports,
    },
    languageOptions: {
      ecmaVersion: 2021,
      sourceType: "commonjs",
    },
    rules: {
      "no-unused-vars": "off",
      "unused-imports/no-unused-imports": "error",
      "unused-imports/no-unused-vars": [
        "warn",
        { vars: "all", varsIgnorePattern: "^_", args: "after-used", argsIgnorePattern: "^_" },
      ],
    },
  },
];
