const { AppError } = require("../utils/AppError");
const { Product } = require("../models/Product");
const { InventoryLedger } = require("../models/InventoryLedger");

const LEGACY_VARIANT_ID = "__default__";
const DEFAULT_THRESHOLD = 10;
function toNumber(value, fallback = 0) {
  const normalized = Number(value);
  return Number.isFinite(normalized) ? normalized : fallback;
}

function toPlainAttributes(attributes = {}) {
  if (attributes instanceof Map) {
    return Object.fromEntries(attributes.entries());
  }

  if (attributes && typeof attributes === "object") {
    return { ...attributes };
  }

  return {};
}

function normalizeVariantId(variantId = "") {
  return String(variantId || "").trim();
}

function isLegacyVariantId(variantId = "") {
  const normalized = normalizeVariantId(variantId);
  return !normalized || normalized === LEGACY_VARIANT_ID;
}

function getVariantList(product) {
  return Array.isArray(product?.variants) ? product.variants : [];
}

function getActiveVariantList(product) {
  return getVariantList(product).filter((variant) => variant?.isActive !== false);
}

function buildVariantTitle(product, variant) {
  return String(variant?.title || "").trim() || String(product?.name || "Default");
}

function calculateAvailableStock(stock, reservedStock) {
  return Math.max(0, toNumber(stock) - toNumber(reservedStock));
}

function calculateStatus(stock, reservedStock, threshold) {
  const available = calculateAvailableStock(stock, reservedStock);
  const normalizedThreshold = toNumber(threshold, DEFAULT_THRESHOLD);
  return {
    available,
    threshold: normalizedThreshold,
    isLowStock: available <= normalizedThreshold,
    status: available <= normalizedThreshold ? "LOW_STOCK" : "IN_STOCK",
  };
}

function syncAggregateStock(product) {
  const activeVariants = getActiveVariantList(product);
  if (!activeVariants.length) {
    return;
  }

  product.stock = activeVariants.reduce((sum, variant) => sum + toNumber(variant.stock), 0);
}

class InventoryService {
  async getLatestLedgerState(productId, variantId) {
    const latest = await InventoryLedger.findOne({ productId, variantId })
      .sort({ createdAt: -1 })
      .select("stockAfter reservedAfter")
      .lean();

    return {
      stock: toNumber(latest?.stockAfter),
      reservedStock: toNumber(latest?.reservedAfter),
    };
  }

  async getProductOrFail(productId, { session = null } = {}) {
    const query = Product.findById(productId);
    if (session) query.session(session);
    const product = await query;
    if (!product) {
      throw new AppError("Product not found", 404, "PRODUCT_NOT_FOUND");
    }
    return product;
  }

  assertOwnership(product, expectedSellerId = null) {
    if (!expectedSellerId) {
      return;
    }

    // Platform-managed products can be routed through a synthetic vendor record
    // during checkout even when the legacy product document does not store sellerId.
    if (!product?.sellerId) {
      return;
    }

    if (String(product?.sellerId || "") !== String(expectedSellerId)) {
      throw new AppError("Forbidden", 403, "FORBIDDEN");
    }
  }

  async buildLegacyVariant(product) {
    const ledgerState = await this.getLatestLedgerState(product._id, LEGACY_VARIANT_ID);
    return {
      variantId: LEGACY_VARIANT_ID,
      variantTitle: "Default",
      sku: String(product.SKU || product.productNumber || product._id),
      price: toNumber(product.price),
      discountPrice: product.discountPrice,
      attributes: {},
      weight: product.weight,
      stock: toNumber(product.stock),
      reservedStock: ledgerState.reservedStock,
      threshold: toNumber(product.lowStockThreshold, DEFAULT_THRESHOLD),
      sellerId: product.sellerId,
      source: "LEGACY",
    };
  }

  async resolveInventoryRecord(product, variantId = "", { requireExplicit = false } = {}) {
    const activeVariants = getActiveVariantList(product);
    const normalizedVariantId = normalizeVariantId(variantId);

    if (!activeVariants.length) {
      if (requireExplicit && normalizedVariantId && !isLegacyVariantId(normalizedVariantId)) {
        throw new AppError("Variant not found", 404, "VARIANT_NOT_FOUND");
      }
      return { kind: "legacy", record: await this.buildLegacyVariant(product) };
    }

    let variant = null;
    if (normalizedVariantId) {
      variant = activeVariants.find((item) => item.variantId === normalizedVariantId) || null;
      if (!variant) {
        throw new AppError("Variant not found", 404, "VARIANT_NOT_FOUND");
      }
    } else if (!requireExplicit) {
      variant =
        activeVariants.find((item) => item.isDefault && calculateAvailableStock(item.stock, item.reservedStock) > 0) ||
        activeVariants.find((item) => calculateAvailableStock(item.stock, item.reservedStock) > 0) ||
        activeVariants.find((item) => item.isDefault) ||
        activeVariants[0] ||
        null;
    }

    if (!variant) {
      throw new AppError("Variant not found", 404, "VARIANT_NOT_FOUND");
    }

    return {
      kind: "variant",
      record: {
        variantId: variant.variantId,
        variantTitle: buildVariantTitle(product, variant),
        sku: variant.sku,
        price: toNumber(variant.price),
        discountPrice: variant.discountPrice,
        attributes: toPlainAttributes(variant.attributes),
        weight: variant.weight,
        stock: toNumber(variant.stock),
        reservedStock: toNumber(variant.reservedStock),
        threshold: toNumber(variant.threshold, DEFAULT_THRESHOLD),
        sellerId: product.sellerId,
        source: "VARIANT",
      },
      variant,
    };
  }

  buildInventoryView(product, inventoryRecord) {
    const summary = calculateStatus(
      inventoryRecord.stock,
      inventoryRecord.reservedStock,
      inventoryRecord.threshold
    );

    return {
      productId: product._id,
      productName: product.name,
      productSku: product.SKU,
      sellerId: product.sellerId,
      variantId: inventoryRecord.variantId,
      variantTitle: inventoryRecord.variantTitle,
      sku: inventoryRecord.sku,
      price: inventoryRecord.price,
      discountPrice: inventoryRecord.discountPrice,
      attributes: inventoryRecord.attributes,
      weight: inventoryRecord.weight,
      stock: inventoryRecord.stock,
      reserved: inventoryRecord.reservedStock,
      reservedStock: inventoryRecord.reservedStock,
      available: summary.available,
      availableStock: summary.available,
      threshold: summary.threshold,
      isLowStock: summary.isLowStock,
      status: summary.status,
      source: inventoryRecord.source,
    };
  }

  async getAvailableStock(productId, variantId = "", options = {}) {
    const product = await this.getProductOrFail(productId);
    this.assertOwnership(product, options.expectedSellerId);

    const { record } = await this.resolveInventoryRecord(product, variantId);
    const summary = this.buildInventoryView(product, record);

    return {
      productId: summary.productId,
      productName: summary.productName,
      variantId: summary.variantId,
      sku: summary.sku,
      stock: summary.stock,
      reserved: summary.reserved,
      available: summary.available,
      threshold: summary.threshold,
      status: summary.status,
    };
  }

  async getVariantInventory(productId, variantId, options = {}) {
    const product = await this.getProductOrFail(productId);
    this.assertOwnership(product, options.expectedSellerId);

    const { record } = await this.resolveInventoryRecord(product, variantId, { requireExplicit: true });
    return this.buildInventoryView(product, record);
  }

  async getProductInventory(productId, options = {}) {
    const product = await this.getProductOrFail(productId);
    this.assertOwnership(product, options.expectedSellerId);

    const activeVariants = getActiveVariantList(product);
    const variantRecords = activeVariants.length
      ? activeVariants.map((variant) => ({
          variantId: variant.variantId,
          variantTitle: buildVariantTitle(product, variant),
          sku: variant.sku,
          price: toNumber(variant.price),
          discountPrice: variant.discountPrice,
          attributes: toPlainAttributes(variant.attributes),
          weight: variant.weight,
          stock: toNumber(variant.stock),
          reservedStock: toNumber(variant.reservedStock),
          threshold: toNumber(variant.threshold, DEFAULT_THRESHOLD),
          sellerId: product.sellerId,
          source: "VARIANT",
        }))
      : [await this.buildLegacyVariant(product)];

    const variants = variantRecords.map((record) => this.buildInventoryView(product, record));
    const totalStock = variants.reduce((sum, variant) => sum + toNumber(variant.stock), 0);
    const totalReservedStock = variants.reduce((sum, variant) => sum + toNumber(variant.reserved), 0);
    const totalAvailableStock = variants.reduce((sum, variant) => sum + toNumber(variant.available), 0);
    const lowStockVariants = variants.filter((variant) => variant.isLowStock).length;

    return {
      productId: product._id,
      productName: product.name,
      productSku: product.SKU,
      totalStock,
      totalReservedStock,
      totalAvailableStock,
      variantCount: variants.length,
      lowStockVariants,
      alertStatus: lowStockVariants > 0 ? "ALERT" : "OK",
      variants,
    };
  }

  async reserveStock(productId, variantId, quantity, orderId, sellerId, userId, options = {}) {
    const normalizedQuantity = toNumber(quantity);
    if (!Number.isFinite(normalizedQuantity) || normalizedQuantity <= 0) {
      throw new AppError("Quantity must be greater than 0", 400, "INVALID_QUANTITY");
    }

    const product = await this.getProductOrFail(productId, options);
    this.assertOwnership(product, sellerId);

    const resolved = await this.resolveInventoryRecord(product, variantId);
    const currentAvailable = calculateAvailableStock(resolved.record.stock, resolved.record.reservedStock);
    if (currentAvailable < normalizedQuantity) {
      throw new AppError(
        `Insufficient stock. Available: ${currentAvailable}, Requested: ${normalizedQuantity}`,
        400,
        "INSUFFICIENT_STOCK"
      );
    }

    const nextReserved = resolved.record.reservedStock + normalizedQuantity;

    if (resolved.kind === "variant") {
      resolved.variant.reservedStock = nextReserved;
      await product.save({ session: options.session || undefined });
    }

    await this._recordTransaction({
      productId,
      variantId: resolved.record.variantId,
      variantSku: resolved.record.sku,
      sellerId: product.sellerId,
      transactionType: "RESERVED",
      quantityChange: normalizedQuantity,
      stockBefore: resolved.record.stock,
      stockAfter: resolved.record.stock,
      reservedBefore: resolved.record.reservedStock,
      reservedAfter: nextReserved,
      orderId,
      reason: "Order placed",
      performedBy: userId,
      session: options.session,
    });

    return {
      productId,
      variantId: resolved.record.variantId,
      sku: resolved.record.sku,
      reservedQuantity: normalizedQuantity,
      newReservedStock: nextReserved,
    };
  }

  async deductStock(productId, variantId, quantity, shipmentId, orderId, sellerId, userId, options = {}) {
    const normalizedQuantity = toNumber(quantity);
    if (!Number.isFinite(normalizedQuantity) || normalizedQuantity <= 0) {
      throw new AppError("Quantity must be greater than 0", 400, "INVALID_QUANTITY");
    }

    const product = await this.getProductOrFail(productId, options);
    this.assertOwnership(product, sellerId);

    const resolved = await this.resolveInventoryRecord(product, variantId);
    const currentStock = resolved.record.stock;
    const currentReserved = resolved.record.reservedStock;

    if (currentStock < normalizedQuantity) {
      throw new AppError(
        `Insufficient actual stock. Available: ${currentStock}, Requested: ${normalizedQuantity}`,
        400,
        "INSUFFICIENT_STOCK"
      );
    }

    if (currentReserved < normalizedQuantity) {
      throw new AppError(
        `Reserved quantity mismatch. Reserved: ${currentReserved}, To deduct: ${normalizedQuantity}`,
        400,
        "RESERVED_MISMATCH"
      );
    }

    const nextStock = currentStock - normalizedQuantity;
    const nextReserved = currentReserved - normalizedQuantity;

    if (resolved.kind === "variant") {
      resolved.variant.stock = nextStock;
      resolved.variant.reservedStock = nextReserved;
      syncAggregateStock(product);
    } else {
      product.stock = nextStock;
    }

    await product.save({ session: options.session || undefined });

    await this._recordTransaction({
      productId,
      variantId: resolved.record.variantId,
      variantSku: resolved.record.sku,
      sellerId: product.sellerId,
      transactionType: "SALE",
      quantityChange: -normalizedQuantity,
      stockBefore: currentStock,
      stockAfter: nextStock,
      reservedBefore: currentReserved,
      reservedAfter: nextReserved,
      shipmentId,
      orderId,
      reason: "Shipment confirmed",
      performedBy: userId,
      session: options.session,
    });

    return {
      productId,
      variantId: resolved.record.variantId,
      sku: resolved.record.sku,
      deductedQuantity: normalizedQuantity,
      newStock: nextStock,
      newReservedStock: nextReserved,
    };
  }

  async restoreStock(productId, variantId, quantity, returnId, orderId, sellerId, userId, reason = "Return processed", options = {}) {
    const normalizedQuantity = toNumber(quantity);
    if (!Number.isFinite(normalizedQuantity) || normalizedQuantity <= 0) {
      throw new AppError("Quantity must be greater than 0", 400, "INVALID_QUANTITY");
    }

    const product = await this.getProductOrFail(productId, options);
    this.assertOwnership(product, sellerId);

    const resolved = await this.resolveInventoryRecord(product, variantId);
    const currentStock = resolved.record.stock;
    const currentReserved = resolved.record.reservedStock;
    const nextStock = currentStock + normalizedQuantity;
    const nextReserved = Math.max(0, currentReserved - normalizedQuantity);

    if (resolved.kind === "variant") {
      resolved.variant.stock = nextStock;
      resolved.variant.reservedStock = nextReserved;
      syncAggregateStock(product);
    } else {
      product.stock = nextStock;
    }

    await product.save({ session: options.session || undefined });

    await this._recordTransaction({
      productId,
      variantId: resolved.record.variantId,
      variantSku: resolved.record.sku,
      sellerId: product.sellerId,
      transactionType: "RETURN",
      quantityChange: normalizedQuantity,
      stockBefore: currentStock,
      stockAfter: nextStock,
      reservedBefore: currentReserved,
      reservedAfter: nextReserved,
      returnId,
      orderId,
      reason,
      performedBy: userId,
      session: options.session,
    });

    return {
      productId,
      variantId: resolved.record.variantId,
      sku: resolved.record.sku,
      restoredQuantity: normalizedQuantity,
      newStock: nextStock,
      newReservedStock: nextReserved,
    };
  }

  async unreserveStock(productId, variantId, quantity, orderId, sellerId, userId, options = {}) {
    const normalizedQuantity = toNumber(quantity);
    if (!Number.isFinite(normalizedQuantity) || normalizedQuantity <= 0) {
      throw new AppError("Quantity must be greater than 0", 400, "INVALID_QUANTITY");
    }

    const product = await this.getProductOrFail(productId, options);
    this.assertOwnership(product, sellerId);

    const resolved = await this.resolveInventoryRecord(product, variantId);
    const currentReserved = resolved.record.reservedStock;
    if (currentReserved < normalizedQuantity) {
      throw new AppError(
        `Cannot unreserve more than reserved. Reserved: ${currentReserved}, To unreserve: ${normalizedQuantity}`,
        400,
        "INVALID_UNRESERVE"
      );
    }

    const nextReserved = currentReserved - normalizedQuantity;

    if (resolved.kind === "variant") {
      resolved.variant.reservedStock = nextReserved;
      await product.save({ session: options.session || undefined });
    }

    await this._recordTransaction({
      productId,
      variantId: resolved.record.variantId,
      variantSku: resolved.record.sku,
      sellerId: product.sellerId,
      transactionType: "UNRESERVED",
      quantityChange: 0,
      stockBefore: resolved.record.stock,
      stockAfter: resolved.record.stock,
      reservedBefore: currentReserved,
      reservedAfter: nextReserved,
      orderId,
      reason: "Order cancelled",
      performedBy: userId,
      session: options.session,
    });

    return {
      productId,
      variantId: resolved.record.variantId,
      sku: resolved.record.sku,
      unreservedQuantity: normalizedQuantity,
      newReservedStock: nextReserved,
    };
  }

  async adjustStock(productId, variantId, quantityChange, reason, notes, performedBy, options = {}) {
    const normalizedChange = toNumber(quantityChange);
    if (!Number.isFinite(normalizedChange) || normalizedChange === 0) {
      throw new AppError("Quantity change cannot be zero", 400, "INVALID_ADJUSTMENT");
    }

    const product = await this.getProductOrFail(productId);
    this.assertOwnership(product, options.expectedSellerId);

    const resolved = await this.resolveInventoryRecord(product, variantId, { requireExplicit: true });
    const currentStock = resolved.record.stock;
    const currentReserved = resolved.record.reservedStock;
    const nextStock = currentStock + normalizedChange;

    if (nextStock < 0) {
      throw new AppError(
        `Cannot reduce stock below 0. Current: ${currentStock}, Change: ${normalizedChange}`,
        400,
        "NEGATIVE_STOCK"
      );
    }

    if (nextStock < currentReserved) {
      throw new AppError(
        `Cannot reduce stock below reserved quantity. Reserved: ${currentReserved}, Resulting stock: ${nextStock}`,
        400,
        "RESERVED_CONFLICT"
      );
    }

    if (resolved.kind === "variant") {
      resolved.variant.stock = nextStock;
      syncAggregateStock(product);
    } else {
      product.stock = nextStock;
    }

    await product.save();

    await this._recordTransaction({
      productId,
      variantId: resolved.record.variantId,
      variantSku: resolved.record.sku,
      sellerId: product.sellerId,
      transactionType: normalizedChange > 0 ? "RESTOCK" : "MANUAL_ADJUSTMENT",
      quantityChange: normalizedChange,
      stockBefore: currentStock,
      stockAfter: nextStock,
      reservedBefore: currentReserved,
      reservedAfter: currentReserved,
      reason,
      notes,
      performedBy,
    });

    return {
      productId,
      variantId: resolved.record.variantId,
      sku: resolved.record.sku,
      adjustmentQuantity: normalizedChange,
      newStock: nextStock,
    };
  }

  async updateThreshold(productId, variantId, newThreshold, performedBy, options = {}) {
    const normalizedThreshold = toNumber(newThreshold, NaN);
    if (!Number.isFinite(normalizedThreshold) || normalizedThreshold < 0) {
      throw new AppError("Threshold cannot be negative", 400, "INVALID_THRESHOLD");
    }

    const product = await this.getProductOrFail(productId);
    this.assertOwnership(product, options.expectedSellerId);

    const resolved = await this.resolveInventoryRecord(product, variantId, { requireExplicit: true });
    const oldThreshold = resolved.record.threshold;

    if (resolved.kind === "variant") {
      resolved.variant.threshold = normalizedThreshold;
    } else {
      product.lowStockThreshold = normalizedThreshold;
    }

    await product.save();

    return {
      productId,
      variantId: resolved.record.variantId,
      oldThreshold,
      newThreshold: normalizedThreshold,
      message: "Threshold updated successfully",
    };
  }

  async getVariantLedger(productId, variantId, limit = 100, offset = 0, options = {}) {
    const product = await this.getProductOrFail(productId);
    this.assertOwnership(product, options.expectedSellerId);

    const { record } = await this.resolveInventoryRecord(product, variantId, { requireExplicit: true });
    const normalizedLimit = Math.max(1, Math.min(toNumber(limit, 100), 500));
    const normalizedOffset = Math.max(0, toNumber(offset, 0));

    const [ledgerEntries, total] = await Promise.all([
      InventoryLedger.find({
        productId,
        variantId: record.variantId,
      })
        .sort({ createdAt: -1 })
        .skip(normalizedOffset)
        .limit(normalizedLimit)
        .populate("orderId", "orderNumber status")
        .populate("performedBy", "name email")
        .lean(),
      InventoryLedger.countDocuments({
        productId,
        variantId: record.variantId,
      }),
    ]);

    return {
      productId,
      variantId: record.variantId,
      sku: record.sku,
      ledger: ledgerEntries,
      pagination: {
        limit: normalizedLimit,
        offset: normalizedOffset,
        total,
        pages: Math.ceil(total / normalizedLimit),
      },
    };
  }

  async getLowStockVariants(sellerId, limit = 50, offset = 0) {
    const products = await Product.find({ sellerId }).select("_id name SKU stock lowStockThreshold variants sellerId");
    const lowStockVariants = [];

    for (const product of products) {
      const inventory = await this.getProductInventory(product._id, { expectedSellerId: sellerId });
      for (const variant of inventory.variants) {
        if (variant.isLowStock) {
          lowStockVariants.push({
            productId: product._id,
            productName: product.name,
            variantId: variant.variantId,
            variantTitle: variant.variantTitle,
            sku: variant.sku,
            stock: variant.stock,
            reserved: variant.reserved,
            available: variant.available,
            threshold: variant.threshold,
            status: variant.status,
          });
        }
      }
    }

    const normalizedOffset = Math.max(0, toNumber(offset, 0));
    const normalizedLimit = Math.max(1, Math.min(toNumber(limit, 50), 500));
    return {
      sellerId,
      total: lowStockVariants.length,
      limit: normalizedLimit,
      offset: normalizedOffset,
      items: lowStockVariants.slice(normalizedOffset, normalizedOffset + normalizedLimit),
    };
  }

  async getSellerInventorySummary(sellerId) {
    const products = await Product.find({ sellerId }).select("_id name SKU sellerId stock lowStockThreshold variants");
    const inventorySummary = [];

    for (const product of products) {
      inventorySummary.push(await this.getProductInventory(product._id, { expectedSellerId: sellerId }));
    }

    return {
      sellerId,
      totalProducts: inventorySummary.length,
      totalStock: inventorySummary.reduce((sum, product) => sum + toNumber(product.totalStock), 0),
      totalReservedStock: inventorySummary.reduce((sum, product) => sum + toNumber(product.totalReservedStock), 0),
      totalAvailableStock: inventorySummary.reduce((sum, product) => sum + toNumber(product.totalAvailableStock), 0),
      lowStockVariants: inventorySummary.reduce((sum, product) => sum + toNumber(product.lowStockVariants), 0),
      products: inventorySummary,
    };
  }

  async commitOrderInventory(order, { shipmentId = null, performedBy = null, session = null } = {}) {
    if (!order || order.inventoryCommittedAt) {
      return order;
    }

    const sellerId = order.sellerId?._id || order.sellerId;
    for (const item of order.items || []) {
      await this.deductStock(
        item.productId?._id || item.productId,
        item.variantId || "",
        toNumber(item.quantity),
        shipmentId || order.shipmentId || undefined,
        order._id,
        sellerId,
        performedBy,
        { session }
      );
    }

    order.inventoryCommittedAt = new Date();
    return order;
  }

  async _recordTransaction(data) {
    try {
      await InventoryLedger.create(
        [{
          productId: data.productId,
          variantId: data.variantId,
          variantSku: data.variantSku,
          sellerId: data.sellerId,
          transactionType: data.transactionType,
          status: "COMPLETED",
          quantityChange: data.quantityChange,
          stockBefore: data.stockBefore,
          stockAfter: data.stockAfter,
          reservedBefore: data.reservedBefore,
          reservedAfter: data.reservedAfter,
          orderId: data.orderId,
          shipmentId: data.shipmentId,
          returnId: data.returnId,
          reason: data.reason,
          notes: data.notes,
          performedBy: data.performedBy,
        }],
        { session: data.session || undefined }
      );
    } catch (error) {
      console.error("Failed to record inventory transaction:", error.message);
    }
  }
}

module.exports = new InventoryService();
module.exports.LEGACY_VARIANT_ID = LEGACY_VARIANT_ID;
