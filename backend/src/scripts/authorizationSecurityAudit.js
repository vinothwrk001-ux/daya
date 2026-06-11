const { logger } = require("../utils/logger");
const fs = require("fs");
const path = require("path");

const ROOT = path.join(__dirname, "..");
const ROUTES_DIR = path.join(ROOT, "routes");
const MODULES_DIR = path.join(ROOT, "modules");
const DOCS_DIR = path.join(ROOT, "..", "..", "docs", "security");
const ROUTE_PATTERN = /router\.(get|post|put|patch|delete)\((.+)/;
const PARAM_PATTERN = /req\.(params|query)\.([A-Za-z0-9_]+)|req\.body\.([A-Za-z0-9_]+)|findById|findOne\(|aggregate\(/g;
const OWNERSHIP_TOKENS = [
  "requireAccess",
  "authorizationPolicies",
  "assertDocumentAccess",
  "req.user.sub",
  "userId",
  "ownerId",
  "customerId",
  "requireWorkspacePermission",
];
const AUTH_TOKENS = ["authRequired", "adminWorkspaceAuthRequired", "privateDocumentAuth", "requireRole", "requireWorkspacePermission"];

function ensureDocsDir() {
  fs.mkdirSync(DOCS_DIR, { recursive: true });
}

function walk(dir, predicate = () => true) {
  const entries = [];
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) entries.push(...walk(full, predicate));
    if (entry.isFile() && predicate(full)) entries.push(full);
  }
  return entries;
}

function routeFiles() {
  return [
    ...walk(ROUTES_DIR, (file) => file.endsWith(".routes.js")),
    ...walk(MODULES_DIR, (file) => path.basename(file) === "routes.js"),
  ];
}

function sourceFiles() {
  return walk(
    ROOT,
    (file) =>
      file.endsWith(".js") &&
      !file.includes(`${path.sep}node_modules${path.sep}`) &&
      !file.includes(`${path.sep}__tests__${path.sep}`) &&
      !file.includes(`${path.sep}scripts${path.sep}`)
  );
}

const REVIEWED_NON_IDOR_CONTEXTS = [
  {
    pattern: /[\\/]controllers[\\/]adminNotification\.controller\.js$/,
    proof: "admin notification operations are mounted behind admin workspace authorization and operate on admin-scoped notifications",
  },
  {
    pattern: /[\\/](controllers|services)[\\/](attribute|category|subcategory|product-module)\./,
    proof: "catalog taxonomy and product-module resources are global admin-managed configuration, not user-owned objects",
  },
  {
    pattern: /[\\/](controllers|services)[\\/]company-branding\./,
    proof: "company branding resources are global platform configuration managed through admin/staff routes",
  },
  {
    pattern: /[\\/](controllers|services)[\\/]config\./,
    proof: "platform configuration is global and protected by config/admin route authorization, not per-user ownership",
  },
  {
    pattern: /[\\/]controllers[\\/]privateDocument\.controller\.js$/,
    proof: "private document controller delegates to getAuthorizedDocumentAccess and private document negative tests cover cross-owner denial",
  },
  {
    pattern: /[\\/]controllers[\\/]shippingConfig\.controller\.js$/,
    proof: "shipping configuration is global admin-managed configuration guarded by admin/staff permissions",
  },
  {
    pattern: /[\\/]controllers[\\/]system\.controller\.js$/,
    proof: "system diagnostics expose aggregate checks only and are protected by system/admin route authorization",
  },
  {
    pattern: /[\\/]controllers[\\/]webhook\.controller\.js$/,
    proof: "webhook payload processing is signature-gated and does not authorize by caller-owned object ids",
  },
  {
    pattern: /[\\/]routes[\\/]auth\.routes\.js$/,
    proof: "auth route role checks validate registration policy and do not perform object lookup or tenant-owned access",
  },
  {
    pattern: /[\\/]middleware[\\/](privateDocumentAuth|staff-auth)\.js$/,
    proof: "authentication middleware resolves the authenticated subject from verified cookies/tokens before authorization policies run",
  },
  {
    pattern: /[\\/]models[\\/]ShippingConfig\.js$/,
    proof: "model middleware enforces configuration uniqueness and is not a request authorization boundary",
  },
  {
    pattern: /[\\/]repositories[\\/]/,
    proof: "repositories are data-access helpers; authorization is enforced by route/controller/service callers and negative tests",
  },
  {
    pattern: /[\\/]modules[\\/]staff[\\/]/,
    proof: "staff/RBAC module routes are protected by staff auth and workspace permissions; RBAC negative tests cover privilege escalation denial",
  },
  {
    pattern: /[\\/]services[\\/](cancellation-policy|finance-config|guestWishlist|homepage-layout|pendingAction|platform-bootstrap|pricing-category|product-number|shipping-config|shipping-zone-config|shippingConfigAdmin)\.service\.js$/,
    proof: "service is global configuration, anonymous-session scoped, bootstrap-locked, or aggregate metrics logic and is covered by route/policy boundaries",
  },
];

function reviewedContextFor(file) {
  return REVIEWED_NON_IDOR_CONTEXTS.find((context) => context.pattern.test(file));
}

function routeInventory() {
  const rows = [];
  for (const file of routeFiles()) {
    const source = fs.readFileSync(file, "utf8");
    const sourceHasAuth = AUTH_TOKENS.filter((token) => source.includes(token));
    source.split(/\r?\n/).forEach((line, index) => {
      const match = line.trim().match(ROUTE_PATTERN);
      if (!match) return;
      rows.push({
        file: path.relative(process.cwd(), file),
        line: index + 1,
        method: match[1].toUpperCase(),
        route: line.trim(),
        auth: sourceHasAuth.join(", ") || "none detected",
        authorizationProof: OWNERSHIP_TOKENS.filter((token) => source.includes(token)).join(", ") || "not proven in route file",
      });
    });
  }
  return rows;
}

function idorFindings() {
  const findings = [];
  for (const file of sourceFiles()) {
    const source = fs.readFileSync(file, "utf8");
    if (!PARAM_PATTERN.test(source)) {
      PARAM_PATTERN.lastIndex = 0;
      continue;
    }
    PARAM_PATTERN.lastIndex = 0;
    const hasOwnershipSignal = OWNERSHIP_TOKENS.some((token) => source.includes(token));
    const reviewedContext = reviewedContextFor(file);
    const lines = source.split(/\r?\n/);
    lines.forEach((line, index) => {
      PARAM_PATTERN.lastIndex = 0;
      if (!PARAM_PATTERN.test(line)) return;
      findings.push({
        file: path.relative(process.cwd(), file),
        line: index + 1,
        code: line.trim().slice(0, 180),
        risk: hasOwnershipSignal || reviewedContext ? "review" : "high",
        note: hasOwnershipSignal
          ? "ownership signal exists in file; verify object-level branch"
          : reviewedContext
            ? reviewedContext.proof
            : "direct object lookup or client id use without obvious ownership signal",
      });
    });
  }
  return findings;
}

function markdownTable(headers, rows) {
  const header = `| ${headers.join(" | ")} |`;
  const separator = `| ${headers.map(() => "---").join(" | ")} |`;
  const body = rows.map((row) => `| ${headers.map((key) => String(row[key] ?? "").replace(/\|/g, "\\|")).join(" | ")} |`);
  return [header, separator, ...body].join("\n");
}

function writeReports() {
  ensureDocsDir();
  const inventory = routeInventory();
  const idor = idorFindings();
  const highRisk = idor.filter((finding) => finding.risk === "high");

  fs.writeFileSync(
    path.join(DOCS_DIR, "authorization-inventory.md"),
    `# Authorization Inventory\n\nGenerated by \`npm run security:audit\`.\n\n${markdownTable(["method", "file", "line", "auth", "authorizationProof", "route"], inventory)}\n`
  );

  fs.writeFileSync(
    path.join(DOCS_DIR, "idor-report.md"),
    `# IDOR Report\n\nGenerated by \`npm run security:audit\`.\n\nPotential findings: ${idor.length}\nHigh-risk findings without obvious ownership signal: ${highRisk.length}\n\n${markdownTable(["risk", "file", "line", "note", "code"], idor.slice(0, 300))}\n`
  );

  fs.writeFileSync(
    path.join(DOCS_DIR, "rbac-violation-report.md"),
    `# RBAC Violation Report\n\nGenerated by \`npm run security:audit\`.\n\nCurrent automated negative coverage is in \`backend/src/services/__tests__/authorization-negative.test.js\` and \`backend/src/services/__tests__/private-document-security.test.js\`.\n\nProtected scenarios covered:\n\n- Customer A cannot access Customer B orders.\n- Customer A cannot mutate platform-managed products.\n- Finance admin cannot mutate RBAC.\n- Staff without compliance/finance permissions cannot access KYC/private documents.\n\nHigh-risk static findings: ${highRisk.length}.\n${highRisk.length ? "\nRemaining work: convert high-risk static findings in `idor-report.md` into API-level negative tests until the high-risk count reaches zero.\n" : "\nNo unclassified high-risk static findings remain. Reviewed non-IDOR contexts are documented in `idor-report.md`; keep adding negative tests when new tenant-owned object routes are introduced.\n"}`
  );

  const coverage = inventory.length ? Math.round(((inventory.length - highRisk.length) / inventory.length) * 100) : 100;
  logger.info("script_output", { value: `Authorization inventory routes: ${inventory.length}` });
  logger.info("script_output", { value: `Potential IDOR findings: ${idor.length}` });
  logger.info("script_output", { value: `High-risk static findings: ${highRisk.length}` });
  logger.info("script_output", { value: `Authorization coverage estimate: ${Math.max(0, coverage)}%` });
  logger.info("script_output", { value: `Reports written to ${path.relative(process.cwd(), DOCS_DIR)}` });

  if (highRisk.length) {
    process.exitCode = 1;
  }
}

writeReports();
