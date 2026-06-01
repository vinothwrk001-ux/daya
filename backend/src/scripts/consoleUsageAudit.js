const fs = require("fs");
const path = require("path");

const ROOT = path.resolve(__dirname, "../../..");
const TARGETS = [
  path.join(ROOT, "frontend", "src"),
  path.join(ROOT, "backend", "src"),
];
const APPROVED_FILES = new Set([
  path.normalize(path.join(ROOT, "frontend", "src", "services", "logger", "logger.js")),
]);
const CONSOLE_PATTERN = /\b(?:window\.)?console\.(log|error|warn|info|debug|trace|groupCollapsed|groupEnd)\b/;
const FILE_PATTERN = /\.(js|jsx|ts|tsx)$/;

function walk(dir, files = []) {
  if (!fs.existsSync(dir)) return files;
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      if (!["node_modules", "dist", "coverage"].includes(entry.name)) walk(fullPath, files);
    } else if (FILE_PATTERN.test(entry.name)) {
      files.push(fullPath);
    }
  }
  return files;
}

function scanFile(filePath) {
  if (APPROVED_FILES.has(path.normalize(filePath))) return [];
  const content = fs.readFileSync(filePath, "utf8");
  return content
    .split(/\r?\n/)
    .map((line, index) => ({ line, lineNumber: index + 1 }))
    .filter(({ line }) => CONSOLE_PATTERN.test(line))
    .map(({ line, lineNumber }) => ({
      filePath,
      lineNumber,
      line: line.trim(),
    }));
}

const findings = TARGETS.flatMap((target) => walk(target)).flatMap(scanFile);

if (findings.length) {
  process.stderr.write("Console usage audit failed:\n");
  for (const finding of findings) {
    process.stderr.write(
      `${path.relative(ROOT, finding.filePath)}:${finding.lineNumber} ${finding.line}\n`
    );
  }
  process.exit(1);
}

process.stdout.write("Console usage audit passed.\n");
