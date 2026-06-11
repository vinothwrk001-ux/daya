const { logger } = require("../../utils/logger");
const assert = require("assert");
const inventoryService = require("../inventory.service");
const { Product } = require("../../models/Product");
const { InventoryLedger } = require("../../models/InventoryLedger");

function createChainableLatestEntry(entry) {
  return {
    sort() {
      return this;
    },
    select() {
      return this;
    },
    lean() {
      return Promise.resolve(entry || null);
    },
  };
}

async function run() {
  const originalProductFindById = Product.findById;
  const originalLedgerFindOne = InventoryLedger.findOne;
  const originalLedgerCreate = InventoryLedger.create;

  const ledgerEntries = [];
  const products = new Map();

  function registerProduct(product) {
    const doc = {
      ...product,
      async save() {
        products.set(String(this._id), this);
        return this;
      },
    };
    products.set(String(doc._id), doc);
    return doc;
  }

  Product.findById = async (id) => products.get(String(id)) || null;
  InventoryLedger.findOne = ({ productId, variantId }) => {
    const latest = [...ledgerEntries]
      .reverse()
      .find((entry) => String(entry.productId) === String(productId) && String(entry.variantId) === String(variantId));
    return createChainableLatestEntry(latest);
  };
  InventoryLedger.create = async (payload) => {
    ledgerEntries.push({ _id: `ledger_${ledgerEntries.length + 1}`, createdAt: new Date(), ...payload });
    return ledgerEntries[ledgerEntries.length - 1];
  };

  try {
    const product = registerProduct({
      _id: "product_1",
      name: "Warehouse Tee",
      SKU: "TEE-001",
      stock: 15,
      lowStockThreshold: 3,
      variants: [
        {
          variantId: "tee-black-m",
          title: "Black / M",
          sku: "TEE-BLK-M",
          stock: 15,
          reservedStock: 0,
          threshold: 3,
          price: 799,
          attributes: { color: "Black", size: "M" },
          isActive: true,
          isDefault: true,
        },
      ],
    });

    const initial = await inventoryService.getAvailableStock(product._id, "tee-black-m");
    assert.equal(initial.available, 15, "initial available stock should match stock");

    await inventoryService.reserveStock(product._id, "tee-black-m", 4, "order_1", "user_1");
    assert.equal(product.variants[0].reservedStock, 4, "reserve should increase reserved stock");
    assert.equal(product.variants[0].stock, 15, "reserve should not reduce actual stock");

    const afterReserve = await inventoryService.getAvailableStock(product._id, "tee-black-m");
    assert.equal(afterReserve.available, 11, "available stock should subtract reserved stock");

    await inventoryService.deductStock(product._id, "tee-black-m", 4, "shipment_1", "order_1", "user_1");
    assert.equal(product.variants[0].stock, 11, "shipment should deduct actual stock");
    assert.equal(product.variants[0].reservedStock, 0, "shipment should release reserved stock");
    assert.equal(product.stock, 11, "product aggregate stock should remain backward compatible");

    await inventoryService.restoreStock(product._id, "tee-black-m", 2, "return_1", "order_1", "user_1");
    assert.equal(product.variants[0].stock, 13, "return should restore stock");
    assert.equal(product.stock, 13, "aggregate stock should reflect restored variant stock");

    let blockedAdjustment = false;
    await inventoryService.reserveStock(product._id, "tee-black-m", 5, "order_2", "user_1");
    try {
      await inventoryService.adjustStock(product._id, "tee-black-m", -10, "Damage", "", "user_1");
    } catch (error) {
      blockedAdjustment = error.code === "RESERVED_CONFLICT";
    }
    assert.equal(blockedAdjustment, true, "manual adjustment should not reduce stock below reserved quantity");

    assert.equal(
      ledgerEntries.some((entry) => entry.transactionType === "RESERVED"),
      true,
      "ledger should capture reservations"
    );
    assert.equal(
      ledgerEntries.some((entry) => entry.transactionType === "SALE"),
      true,
      "ledger should capture shipments as sales"
    );
    assert.equal(
      ledgerEntries.some((entry) => entry.transactionType === "RETURN"),
      true,
      "ledger should capture returns"
    );

    logger.info("script_output", { value: "Inventory domain checks passed." });
  } finally {
    Product.findById = originalProductFindById;
    InventoryLedger.findOne = originalLedgerFindOne;
    InventoryLedger.create = originalLedgerCreate;
  }
}

run().catch((error) => {
  logger.error("script_error", { error: error });
  process.exit(1);
});
