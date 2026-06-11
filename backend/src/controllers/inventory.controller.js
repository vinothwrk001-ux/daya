const inventoryService = require("../services/inventory.service");
const { AppError } = require("../utils/AppError");

/**
 * Get product inventory overview with all variants
 */
exports.getProductInventory = async (req, res, next) => {
  try {
    const { productId } = req.params;
    const inventory = await inventoryService.getProductInventory(productId);

    res.status(200).json({
      success: true,
      data: inventory,
    });
  } catch (err) {
    next(err);
  }
};

/**
 * Get specific variant inventory details
 */
exports.getVariantInventory = async (req, res, next) => {
  try {
    const { productId, variantId } = req.params;
    const inventory = await inventoryService.getVariantInventory(productId, variantId);

    res.status(200).json({
      success: true,
      data: inventory,
    });
  } catch (err) {
    next(err);
  }
};

/**
 * Get available stock for a variant
 */
exports.getAvailableStock = async (req, res, next) => {
  try {
    const { productId, variantId } = req.params;
    const stockInfo = await inventoryService.getAvailableStock(productId, variantId);

    res.status(200).json({
      success: true,
      data: stockInfo,
    });
  } catch (err) {
    next(err);
  }
};

/**
 * Get inventory transaction ledger for a variant
 */
exports.getVariantLedger = async (req, res, next) => {
  try {
    const { productId, variantId } = req.params;
    const { limit = 100, offset = 0 } = req.query;

    const ledger = await inventoryService.getVariantLedger(
      productId,
      variantId,
      parseInt(limit),
      parseInt(offset)
    );

    res.status(200).json({
      success: true,
      data: ledger,
    });
  } catch (err) {
    next(err);
  }
};

/**
 * Manual stock adjustment
 */
exports.adjustStock = async (req, res, next) => {
  try {
    const { productId, variantId } = req.params;
    const { quantityChange, reason, notes } = req.body;
    const userId = req.user?._id;

    if (!reason) {
      throw new AppError("Reason is required for stock adjustment", 400, "MISSING_REASON");
    }

    const result = await inventoryService.adjustStock(
      productId,
      variantId,
      quantityChange,
      reason,
      notes,
      userId
    );

    res.status(200).json({
      success: true,
      message: "Stock adjusted successfully",
      data: result,
    });
  } catch (err) {
    next(err);
  }
};

/**
 * Update variant threshold
 */
exports.updateThreshold = async (req, res, next) => {
  try {
    const { productId, variantId } = req.params;
    const { threshold } = req.body;
    const userId = req.user?._id;

    if (threshold === undefined) {
      throw new AppError("Threshold value is required", 400, "MISSING_THRESHOLD");
    }

    const result = await inventoryService.updateThreshold(productId, variantId, threshold, userId);

    res.status(200).json({
      success: true,
      message: "Threshold updated successfully",
      data: result,
    });
  } catch (err) {
    next(err);
  }
};

/**
 * Export inventory as CSV
 */
exports.exportInventoryCSV = async (req, res, next) => {
  try {
    const { productId } = req.params;

    const inventory = await inventoryService.getProductInventory(productId);

    // Build CSV header
    const headers = ["Variant ID", "Variant Title", "SKU", "Price", "Stock", "Reserved", "Available", "Threshold", "Status"];
    const csvContent = [
      headers.join(","),
      ...inventory.variants.map((v) =>
        [
          v.variantId,
          `"${v.variantTitle}"`,
          v.sku,
          v.price || "",
          v.stock,
          v.reserved,
          v.available,
          v.threshold,
          v.status,
        ].join(",")
      ),
    ].join("\n");

    res.setHeader("Content-Type", "text/csv");
    res.setHeader("Content-Disposition", `attachment; filename="inventory_${productId}.csv"`);
    res.send(csvContent);
  } catch (err) {
    next(err);
  }
};

