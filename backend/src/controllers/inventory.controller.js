const inventoryService = require("../services/inventory.service");
const { AppError } = require("../utils/AppError");
const vendorRepo = require("../repositories/vendor.repository");

async function resolveVendorIdForUser(user) {
  if (!user?.sub && !user?._id) {
    return null;
  }

  const vendor = await vendorRepo.findByUserId(user.sub || user._id);
  return vendor?._id || null;
}

/**
 * Get product inventory overview with all variants
 */
exports.getProductInventory = async (req, res, next) => {
  try {
    const { productId } = req.params;
    const sellerId = await resolveVendorIdForUser(req.user);
    const inventory = await inventoryService.getProductInventory(productId, {
      expectedSellerId: sellerId || undefined,
    });

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
    const sellerId = await resolveVendorIdForUser(req.user);
    const inventory = await inventoryService.getVariantInventory(productId, variantId, {
      expectedSellerId: sellerId || undefined,
    });

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
    const sellerId = await resolveVendorIdForUser(req.user);
    const stockInfo = await inventoryService.getAvailableStock(productId, variantId, {
      expectedSellerId: sellerId || undefined,
    });

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
    const sellerId = await resolveVendorIdForUser(req.user);

    const ledger = await inventoryService.getVariantLedger(
      productId,
      variantId,
      parseInt(limit),
      parseInt(offset),
      { expectedSellerId: sellerId || undefined }
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
 * Manual stock adjustment (admin/seller only)
 */
exports.adjustStock = async (req, res, next) => {
  try {
    const { productId, variantId } = req.params;
    const { quantityChange, reason, notes } = req.body;
    const userId = req.user?._id;
    const sellerId = await resolveVendorIdForUser(req.user);

    if (!reason) {
      throw new AppError("Reason is required for stock adjustment", 400, "MISSING_REASON");
    }

    const result = await inventoryService.adjustStock(
      productId,
      variantId,
      quantityChange,
      reason,
      notes,
      userId,
      { expectedSellerId: sellerId || undefined }
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
    const sellerId = await resolveVendorIdForUser(req.user);

    if (threshold === undefined) {
      throw new AppError("Threshold value is required", 400, "MISSING_THRESHOLD");
    }

    const result = await inventoryService.updateThreshold(productId, variantId, threshold, userId, {
      expectedSellerId: sellerId || undefined,
    });

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
 * Get seller's low stock variants
 */
exports.getSellersLowStockVariants = async (req, res, next) => {
  try {
    const sellerId = await resolveVendorIdForUser(req.user);
    const { limit = 50, offset = 0 } = req.query;

    if (!sellerId) {
      throw new AppError("Seller ID not found", 400, "MISSING_SELLER");
    }

    const lowStockVariants = await inventoryService.getLowStockVariants(
      sellerId,
      parseInt(limit),
      parseInt(offset)
    );

    res.status(200).json({
      success: true,
      data: lowStockVariants,
    });
  } catch (err) {
    next(err);
  }
};

/**
 * Export inventory as CSV (admin/seller only)
 */
exports.exportInventoryCSV = async (req, res, next) => {
  try {
    const { productId } = req.params;
    const sellerId = await resolveVendorIdForUser(req.user);

    const inventory = await inventoryService.getProductInventory(productId, {
      expectedSellerId: sellerId || undefined,
    });

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

/**
 * Get all seller products' inventory summary
 */
exports.getSellerInventorySummary = async (req, res, next) => {
  try {
    const sellerId = await resolveVendorIdForUser(req.user);

    if (!sellerId) {
      throw new AppError("Seller ID not found", 400, "MISSING_SELLER");
    }
    const summary = await inventoryService.getSellerInventorySummary(sellerId);

    res.status(200).json({
      success: true,
      data: summary,
    });
  } catch (err) {
    next(err);
  }
};
