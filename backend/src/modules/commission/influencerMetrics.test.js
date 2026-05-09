"use strict";

const { test } = require("node:test");
const assert = require("node:assert");
const { roundMoney } = require("../shared/helpers");

function conversionRate(orders, clicks) {
  const totalClicks = Number(clicks) || 0;
  const totalOrders = Number(orders) || 0;
  if (totalClicks <= 0) return 0;
  return roundMoney((totalOrders / totalClicks) * 100);
}

test("conversion rate is zero when there are no clicks", () => {
  assert.strictEqual(conversionRate(5, 0), 0);
});

test("conversion rate matches orders over clicks", () => {
  assert.strictEqual(conversionRate(1, 4), 25);
  assert.strictEqual(conversionRate(3, 10), 30);
});
