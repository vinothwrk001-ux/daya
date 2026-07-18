const assert = require("assert");
const { buildOrderExportRows } = require("../export.service");

const orders = [
  {
    _id: "order_1",
    orderNumber: "ORD001",
    subtotal: 1598,
    totalAmount: 1598,
    userId: { name: "Alice Johnson", email: "alice@example.com" },
    paymentStatus: "Paid",
    status: "Packed",
    shippingStatus: "SHIPPED",
    createdAt: new Date("2026-07-01T10:00:00.000Z"),
    items: [
      {
        productId: "prod_1",
        productName: "Oversized Tee",
        name: "Oversized Tee",
        quantity: 2,
        price: 799,
      },
      {
        productId: "prod_2",
        productName: "Hoodie",
        name: "Hoodie",
        quantity: 1,
        price: 1499,
      },
    ],
  },
];

const rows = buildOrderExportRows(orders);

assert.ok(rows.length >= 2, "expected one detail row per product plus summary rows");
assert.equal(rows[0]["Order ID"], "ORD001", "should include the order number in export rows");
assert.equal(rows[0]["Product ID"], "prod_1", "should include the product id for each exported product line");
assert.equal(rows[0]["Quantity"], 2, "should include the quantity for each exported product line");
assert.equal(rows[0]["Subtotal"], 1598, "should include the line subtotal for each exported product line");
assert.equal(rows[rows.length - 1]["Order ID"], "Total Orders", "should append a summary section");
assert.equal(rows[rows.length - 1]["Product ID"], 1, "summary should include order count");
