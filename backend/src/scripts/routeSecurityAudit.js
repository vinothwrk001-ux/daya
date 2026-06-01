const fs = require("fs");
const path = require("path");

const ROUTES_DIR = path.join(__dirname, "..", "routes");
const MODULES_DIR = path.join(__dirname, "..", "modules");
const PUBLIC_ROUTE_ALLOWLIST = [
  "auth.routes.js",
  "attribute.routes.js",
  "category.routes.js",
  "subcategory.routes.js",
  "homepage-container.routes.js",
  "homepage-layout.routes.js",
  "public.routes.js",
  "webhook.routes.js",
  "product-module.routes.js",
  "routes.js:tracking",
];
const PARENT_PROTECTED_ROUTE_ALLOWLIST = new Set([
  path.join("modules", "adminInfluencerCommerce", "routes.js"),
  path.join("modules", "influencerCommerce", "routes.js"),
]);

function routeFiles() {
  const direct = fs.readdirSync(ROUTES_DIR).filter((file) => file.endsWith(".routes.js")).map((file) => path.join(ROUTES_DIR, file));
  const moduleRoutes = [];
  for (const moduleName of fs.readdirSync(MODULES_DIR)) {
    const candidate = path.join(MODULES_DIR, moduleName, "routes.js");
    if (fs.existsSync(candidate)) moduleRoutes.push(candidate);
  }
  return [...direct, ...moduleRoutes];
}

function routeLines(source) {
  return source.split(/\r?\n/).map((line, index) => ({ line: line.trim(), lineNumber: index + 1 }))
    .filter((entry) => /^router\.(get|post|put|patch|delete)\(/.test(entry.line));
}

function hasProtection(source, line) {
  const protectedTokens = ["authRequired", "adminWorkspaceAuthRequired", "notificationAuthRequired", "requireRole", "requireWorkspacePermission", "requireVendorPermission", "StaffProtectedRoute", "router.use(authRequired", "router.use(adminWorkspaceAuthRequired"];
  return protectedTokens.some((token) => line.includes(token) || source.includes(token));
}

const findings = [];
for (const filePath of routeFiles()) {
  const filename = path.basename(filePath);
  const source = fs.readFileSync(filePath, "utf8");
  const relative = path.relative(path.join(__dirname, ".."), filePath);
  const publicKey = filename === "routes.js" ? `${filename}:${path.basename(path.dirname(filePath))}` : filename;
  if (PUBLIC_ROUTE_ALLOWLIST.includes(publicKey) || PUBLIC_ROUTE_ALLOWLIST.includes(filename) || PARENT_PROTECTED_ROUTE_ALLOWLIST.has(relative)) continue;
  for (const entry of routeLines(source)) {
    if (!hasProtection(source, entry.line)) {
      findings.push({ file: path.relative(process.cwd(), filePath), line: entry.lineNumber, route: entry.line });
    }
  }
}

if (findings.length) {
  console.error("Route security audit found routes that need manual review:");
  for (const finding of findings) console.error(`${finding.file}:${finding.line} ${finding.route}`);
  process.exitCode = 1;
} else {
  console.log("Route security audit passed: protected route files use auth/permission middleware or are allowlisted public routes.");
}
