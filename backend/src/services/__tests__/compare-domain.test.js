const test = require("node:test");
const assert = require("node:assert/strict");
const { CompareItem } = require("../../models/CompareItem");
const compareService = require("../compare.service");

test("compare list model enforces per-user product uniqueness", () => {
  const indexes = CompareItem.schema.indexes();
  assert.ok(CompareItem.schema.path("userId"));
  assert.ok(CompareItem.schema.path("productId"));
  assert.ok(
    indexes.some(([fields, options]) => fields.userId === 1 && fields.productId === 1 && options.unique === true)
  );
});

test("compare service exposes a four item comparison limit", () => {
  assert.equal(compareService.MAX_COMPARE_ITEMS, 4);
});
