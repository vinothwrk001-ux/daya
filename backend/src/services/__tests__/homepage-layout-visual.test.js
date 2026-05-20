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
    console.log(`PASS ${name}`);
  } catch (error) {
    console.error(`FAIL ${name}`);
    console.error(error);
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
        containerId: "507f1f77bcf86cd799439011",
        x: 0,
        y: 0,
        width: 600,
        height: 320,
      },
      {
        id: "slot-2",
        containerId: "507f1f77bcf86cd799439012",
        x: 600,
        y: 0,
        width: 600,
        height: 320,
      },
    ],
  });

  assert.strictEqual(snapshot.layouts.length, 2);
  const rows = layoutsToRows(snapshot.layouts, snapshot.builder, "desktop");
  assert.strictEqual(rows.length, 1);
  assert.strictEqual(rows[0].columns.length, 2);
  assert.strictEqual(rows[0].columns[0].containers[0].containerId, "507f1f77bcf86cd799439011");
});

runTest("resolves responsive slot rect overrides", () => {
  const builder = normalizeBuilderConfig();
  const snapshot = normalizeSnapshot({
    layouts: [
      {
        id: "slot-1",
        containerId: "507f1f77bcf86cd799439011",
        x: 0,
        y: 0,
        width: 500,
        height: 320,
        mobileConfig: {
          x: 0,
          y: 40,
          width: 390,
          height: 280,
        },
      },
    ],
  });

  const rect = resolveSlotRect(snapshot.layouts[0], builder, "mobile");
  assert.strictEqual(rect.y, 40);
  assert.strictEqual(rect.width, 390);
  assert.strictEqual(rect.height, 280);
});

runTest("detects collisions per device", () => {
  const snapshot = normalizeSnapshot({
    layouts: [
      {
        id: "slot-1",
        containerId: "507f1f77bcf86cd799439011",
        x: 0,
        y: 0,
        width: 600,
        height: 320,
      },
      {
        id: "slot-2",
        containerId: "507f1f77bcf86cd799439012",
        x: 580,
        y: 0,
        width: 600,
        height: 320,
      },
    ],
  });

  assert.throws(() => assertNoVisualCollisions(snapshot.layouts, snapshot.builder), /LAYOUT_COLLISION|collision/i);
});

process.on("beforeExit", () => {
  if (!process.exitCode) {
    console.log("All homepage layout visual tests passed.");
  }
});
