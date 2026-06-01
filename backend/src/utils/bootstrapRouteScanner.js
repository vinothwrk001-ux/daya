const fs = require("fs");
const path = require("path");

const DANGEROUS_ROUTE_PATTERNS = [
  "initialize-defaults",
  "bootstrap",
  "first-run",
  "installation",
  "setup-wizard",
  "default-config",
  "system-config/init",
];

function stripJavaScriptComments(source) {
  return String(source || "")
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .replace(/(^|[^:])\/\/.*$/gm, "$1");
}

function assertNoProductionBootstrapRoutes({
  nodeEnv = process.env.NODE_ENV,
  routesDir = path.join(__dirname, "..", "routes"),
} = {}) {
  if (nodeEnv !== "production") return [];

  const findings = [];
  const files = fs.readdirSync(routesDir).filter((file) => file.endsWith(".js"));

  for (const file of files) {
    const filePath = path.join(routesDir, file);
    const source = stripJavaScriptComments(fs.readFileSync(filePath, "utf8"));
    for (const pattern of DANGEROUS_ROUTE_PATTERNS) {
      if (source.includes(pattern)) {
        findings.push({ file: filePath, pattern });
      }
    }
  }

  if (findings.length) {
    const details = findings.map((item) => `${item.file}:${item.pattern}`).join(", ");
    throw new Error(`Production startup blocked: bootstrap/setup route marker detected (${details})`);
  }

  return findings;
}

module.exports = {
  DANGEROUS_ROUTE_PATTERNS,
  stripJavaScriptComments,
  assertNoProductionBootstrapRoutes,
};
