const { logger } = require("../../utils/logger");
const assert = require("assert");
const {
  __test: {
    normalizeSnapshot,
    layoutsToRows,
    resolveSlotRect,
    normalizeBuilderConfig,
    assertNoVisualCollisions,
  },
} = require("../homepage-layout.service");

async function runTest(name, fn) {
  try {
    await fn();
    logger.info("script_output", { value: `PASS ${name}` });
  } catch (error) {
    logger.error("script_error", { error: `FAIL ${name}` });
    logger.error("script_error", { error: error });
    process.exitCode = 1;
  }
}

runTest("normalizes visual layouts and keeps rows compatible", () => {
  const snapshot = normalizeSnapshot({
    name: "Visual Home",
    slug: "visual-home",
    builder: {
      gridSize: 20,
      canvas: {
        desktop: { width: 1200, height: 2200 },
      },
    },
    layouts: [
      {
        id: "slot-1",
        assignedContainerId: "507f1f77bcf86cd799439011",
        desktop: { colSpan: 6, height: 320 },
        tablet: { colSpan: 3, height: 280 },
        mobile: { colSpan: 1, height: 240 },
      },
      {
        id: "slot-2",
        assignedContainerId: "507f1f77bcf86cd799439012",
        desktop: { colSpan: 6, height: 320 },
        tablet: { colSpan: 3, height: 280 },
        mobile: { colSpan: 1, height: 240 },
      },
    ],
  });

  assert.strictEqual(snapshot.layouts.length, 2);
  assert.strictEqual(snapshot.layouts[0].desktop.colSpan, 6);
  const rows = layoutsToRows(snapshot.layouts, snapshot.builder, "desktop");
  assert.strictEqual(rows.length, 1);
  assert.strictEqual(rows[0].columns.length, 2);
  assert.strictEqual(rows[0].columns[0].containers[0].containerId, "507f1f77bcf86cd799439011");
});

runTest("resolves responsive grid slot config", () => {
  const builder = normalizeBuilderConfig();
  const snapshot = normalizeSnapshot({
    layouts: [
      {
        id: "slot-1",
        assignedContainerId: "507f1f77bcf86cd799439011",
        desktop: { colSpan: 4, height: 320 },
        tablet: { colSpan: 2, height: 300 },
        mobile: { colSpan: 1, height: 280 },
      },
    ],
  });

  const rect = resolveSlotRect(snapshot.layouts[0], builder, "mobile");
  assert.strictEqual(rect.width, 1);
  assert.strictEqual(rect.height, 280);
});

runTest("detects invalid spans and duplicate assignments", () => {
  const snapshot = normalizeSnapshot({
    layouts: [
      {
        id: "slot-1",
        assignedContainerId: "507f1f77bcf86cd799439011",
        desktop: { colSpan: 6, height: 320 },
      },
      {
        id: "slot-2",
        assignedContainerId: "507f1f77bcf86cd799439011",
        desktop: { colSpan: 6, height: 320 },
      },
    ],
  });

  assert.throws(() => assertNoVisualCollisions(snapshot.layouts, snapshot.builder), /DUPLICATE_LAYOUT_ASSIGNMENT|assigned/i);
});

process.on("beforeExit", () => {
  if (!process.exitCode) {
    logger.info("script_output", { value: "All homepage layout visual tests passed." });
  }
});
