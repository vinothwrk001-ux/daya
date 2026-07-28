module.exports = {
  env: {
    node: true,
    commonjs: true,
    es2021: true,
  },
  parserOptions: {
    ecmaVersion: 12,
  },
  plugins: ["unused-imports"],
  rules: {
    "unused-imports/no-unused-imports": "error",
    "unused-imports/no-unused-vars": [
      "warn",
      { vars: "all", varsIgnorePattern: "^_", args: "after-used", argsIgnorePattern: "^_" },
    ],
  },
};
