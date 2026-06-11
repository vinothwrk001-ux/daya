const { AppError } = require("../utils/AppError");
const productRepo = require("../repositories/product.repository");
const { generateSlug } = require("../utils/slug");
const {
  generateNextProductNumber,
  previewNextProductNumber,
  getCategoryAndSubcategory,
  assertUniqueProductNumber,
} = require("./product-number.service");
const {
  listAttributeDefinitions,
  validateAndNormalizeModulesData,
  flattenModulesDataToAttributes,
} = require("./attribute.service");
const { uploadMany } = require("../utils/upload");
const {
  normalizeDynamicFilterQuery,
  validateAndNormalizeFilterAttributes,
} = require("./product-filter.service");
const productAnalyticsService = require("./product-analytics.service");

function normalizeImage(image = {}) {
  return {
    url: String(image.url || "").trim(),
    altText: String(image.altText || "").trim(),
    isPrimary: Boolean(image.isPrimary),
    sortOrder: Number.isFinite(Number(image.sortOrder)) ? Number(image.sortOrder) : 0,
  };
}

function buildDefaultAltText({ originalName = "", productName = "", variantTitle = "" } = {}) {
  const baseName = String(originalName || "")
    .replace(/\.[^.]+$/, "")
    .replace(/[-_]+/g, " ")
    .trim();

  return [productName, variantTitle, baseName].filter(Boolean).join(" ").trim();
}

function buildVariantTitle(options = []) {
  return options.map((item) => item.value).filter(Boolean).join(" / ");
}

function normalizeVariantWeight(rawWeight, fallbackWeight) {
  if (rawWeight === undefined || rawWeight === null || rawWeight === "") {
    return fallbackWeight || undefined;
  }
  if (typeof rawWeight === "number") {
    if (!Number.isFinite(rawWeight) || rawWeight <= 0) {
      throw new AppError("Variant weight must be greater than 0", 400, "VALIDATION_ERROR");
    }
    return { value: rawWeight, unit: "kg" };
  }
  const value = Number(rawWeight?.value);
  const unit = String(rawWeight?.unit || "kg").trim().toLowerCase();
  if (!Number.isFinite(value) || value <= 0) {
    throw new AppError("Variant weight must be greater than 0", 400, "VALIDATION_ERROR");
  }
  if (unit !== "kg") {
    throw new AppError("Variant weight unit must be kg", 400, "VALIDATION_ERROR");
  }
  return { value, unit: "kg" };
}

function normalizeProductWeight(rawWeight, { required = false } = {}) {
  if (rawWeight === undefined) {
    if (!required) return undefined;
    throw new AppError("Product weight is required", 400, "VALIDATION_ERROR");
  }

  if (rawWeight === null || rawWeight === "") {
    throw new AppError("Product weight is required", 400, "VALIDATION_ERROR");
  }

  if (typeof rawWeight === "number") {
    if (!Number.isFinite(rawWeight) || rawWeight <= 0) {
      throw new AppError("Product weight must be greater than 0", 400, "VALIDATION_ERROR");
    }
    return { value: rawWeight, unit: "kg" };
  }

  const value = Number(rawWeight?.value);
  const unit = String(rawWeight?.unit || "kg").trim().toLowerCase();
  if (!Number.isFinite(value) || value <= 0) {
    throw new AppError("Product weight must be greater than 0", 400, "VALIDATION_ERROR");
  }
  if (unit !== "kg") {
    throw new AppError("Product weight unit must be kg", 400, "VALIDATION_ERROR");
  }

  return {
    value,
    unit: "kg",
  };
}

async function normalizeProductVariants({
  categoryId,
  subCategoryId,
  variants = [],
  fallbackImages = [],
  productWeight,
}) {
  const attributeDefs = await listAttributeDefinitions({ categoryId, subCategoryId, activeOnly: true });
  const variantDefs = attributeDefs.filter((item) => item.isVariant);
  const variantKeys = variantDefs.map((item) => item.key);
  const variantDefByKey = new Map(variantDefs.map((item) => [item.key, item]));

  if (!variantDefs.length) {
    return {
      variantConfig: [],
      variants: [],
      defaultVariant: null,
      aggregate: null,
    };
  }

  if (!Array.isArray(variants) || variants.length === 0) {
    throw new AppError("At least one product variant is required for this category", 400, "VALIDATION_ERROR");
  }

  const normalized = [];
  const seenIds = new Set();
  const seenSkus = new Set();

  for (const rawVariant of variants) {
    const variantId = String(rawVariant.variantId || "").trim();
    if (!variantId) throw new AppError("Each variant must include a variantId", 400, "VALIDATION_ERROR");
    if (seenIds.has(variantId)) throw new AppError("Variant IDs must be unique", 400, "VALIDATION_ERROR");
    seenIds.add(variantId);

    const attributeMap = {};
    const options = [];
    for (const key of variantKeys) {
      const value = String(rawVariant.attributes?.[key] || "").trim();
      if (!value) {
        throw new AppError(`Variant value is required for ${variantDefByKey.get(key)?.name || key}`, 400, "VALIDATION_ERROR");
      }
      const def = variantDefByKey.get(key);
      if (Array.isArray(def?.options) && def.options.length && !def.options.includes(value)) {
        throw new AppError(`${def.name} has an invalid option`, 400, "VALIDATION_ERROR");
      }
      attributeMap[key] = value;
      options.push({ key, name: def?.name || key, value });
    }

    const variantSku = String(rawVariant.sku || "").trim().toUpperCase();
    if (!variantSku) throw new AppError("Each variant must include a SKU", 400, "VALIDATION_ERROR");
    if (seenSkus.has(variantSku)) throw new AppError("Variant SKUs must be unique", 400, "VALIDATION_ERROR");
    seenSkus.add(variantSku);

    const price = Number(rawVariant.price);
    if (!Number.isFinite(price) || price < 0) {
      throw new AppError("Each variant must include a valid price", 400, "VALIDATION_ERROR");
    }

    const stock = Number(rawVariant.stock);
    if (!Number.isFinite(stock) || stock < 0) {
      throw new AppError("Each variant must include a valid stock quantity", 400, "VALIDATION_ERROR");
    }

    const discountPrice =
      rawVariant.discountPrice === undefined || rawVariant.discountPrice === null || rawVariant.discountPrice === ""
        ? undefined
        : Number(rawVariant.discountPrice);
    if (discountPrice !== undefined && (!Number.isFinite(discountPrice) || discountPrice < 0)) {
      throw new AppError("Variant discount price is invalid", 400, "VALIDATION_ERROR");
    }

    const images = (Array.isArray(rawVariant.images) ? rawVariant.images : [])
      .map(normalizeImage)
      .filter((image) => image.url);
    const normalizedWeight = normalizeVariantWeight(rawVariant.weight, productWeight);

    normalized.push({
      variantId,
      title: String(rawVariant.title || "").trim() || buildVariantTitle(options),
      attributes: attributeMap,
      options,
      price,
      ...(discountPrice !== undefined ? { discountPrice } : {}),
      stock,
      sku: variantSku,
      images: images.length ? images : fallbackImages,
      ...(normalizedWeight ? { weight: normalizedWeight } : {}),
      isDefault: Boolean(rawVariant.isDefault),
      isActive: rawVariant.isActive !== false,
    });
  }

  let defaultVariant =
    normalized.find((item) => item.isDefault && item.isActive && item.stock > 0) ||
    normalized.find((item) => item.isActive && item.stock > 0) ||
    normalized.find((item) => item.isActive) ||
    normalized[0];

  normalized.forEach((item) => {
    item.isDefault = item.variantId === defaultVariant?.variantId;
  });

  const aggregate = normalized.reduce(
    (acc, item) => {
      if (!item.isActive) return acc;
      acc.stock += Number(item.stock || 0);
      acc.price = Math.min(acc.price, Number(item.price || 0));
      if (item.discountPrice !== undefined) {
        acc.discountPrice = Math.min(acc.discountPrice, Number(item.discountPrice || item.price || 0));
      }
      return acc;
    },
    { price: Number.POSITIVE_INFINITY, discountPrice: Number.POSITIVE_INFINITY, stock: 0 }
  );

  return {
    variantConfig: variantKeys,
    variants: normalized,
    defaultVariant,
    aggregate: {
      price: Number.isFinite(aggregate.price) ? aggregate.price : Number(defaultVariant?.price || 0),
      discountPrice: Number.isFinite(aggregate.discountPrice) ? aggregate.discountPrice : undefined,
      stock: aggregate.stock,
    },
  };
}

async function prepareDynamicProductData({
  categoryId,
  subCategoryId,
  modulesData = {},
  attributes = {},
  variants = [],
  images = [],
  genericImages = [],
  extraDetails = {},
  productWeight,
}) {
  const normalizedModulesData = await validateAndNormalizeModulesData({
    categoryId,
    subCategoryId,
    modulesData,
    attributes,
    extraDetails,
    requireAll: true,
  });
  const normalizedAttributes = await flattenModulesDataToAttributes({
    categoryId,
    subCategoryId,
    modulesData: normalizedModulesData,
  });
  const normalizedFilterAttributes = await validateAndNormalizeFilterAttributes({
    categoryId,
    subCategoryId,
    attributes,
  });
  // Prefer the incoming canonical gallery payload on save/update.
  // Falling back to genericImages first caused edit flows to keep the stale
  // persisted gallery instead of the newly submitted images array.
  const sourceImages = Array.isArray(images) && images.length ? images : genericImages;
  const normalizedImages = (Array.isArray(sourceImages) ? sourceImages : []).map(normalizeImage).filter((item) => item.url);
  const variantState = await normalizeProductVariants({
    categoryId,
    subCategoryId,
    variants,
    fallbackImages: normalizedImages,
    productWeight,
  });

  return {
    normalizedModulesData,
    normalizedAttributes: {
      ...normalizedAttributes,
      ...normalizedFilterAttributes,
    },
    normalizedImages,
    variantState,
  };
}

class ProductService {
  /**
   * Create a new product
   * @param {Object} productData - Product details
   * @param {String} userId - User ID (who is creating)
   */
  async createProduct(productData, userId) {
    // Validate inputs
    if (!productData.name || !productData.description || !productData.categoryId || !productData.subCategoryId) {
      throw new AppError("Missing required fields: name, description, category, subcategory", 400, "VALIDATION_ERROR");
    }

    // Generate slug from name
    const slug = generateSlug(productData.name);

    // Check if slug already exists
    const existingProduct = await productRepo.findBySlug(slug);
    if (existingProduct) {
      throw new AppError("Product with this name already exists", 409, "DUPLICATE_PRODUCT");
    }

    const { category, subcategory } = await getCategoryAndSubcategory(productData.categoryId, productData.subCategoryId);
    const { normalizedModulesData, normalizedAttributes, normalizedImages, variantState } =
      await prepareDynamicProductData({
        categoryId: productData.categoryId,
        subCategoryId: productData.subCategoryId,
        modulesData: productData.modulesData || {},
        attributes: productData.attributes || {},
        variants: productData.variants || [],
        images: productData.images || [],
        genericImages: productData.genericImages || [],
        extraDetails: productData.extraDetails || {},
        productWeight: normalizeProductWeight(productData.weight, { required: true }),
      });
    const generatedProductNumber = await generateNextProductNumber({
      categoryId: productData.categoryId,
      subCategoryId: productData.subCategoryId,
    });
    await assertUniqueProductNumber(generatedProductNumber);

    const productPayload = {
      ...productData,
      weight: normalizeProductWeight(productData.weight, { required: true }),
      slug,
      category: category.name,
      subCategory: subcategory.name,
      SKU: generatedProductNumber,
      productNumber: generatedProductNumber,
      price: variantState.aggregate?.price ?? Number(productData.price || 0),
      ...(variantState.aggregate?.discountPrice !== undefined
        ? { discountPrice: variantState.aggregate.discountPrice }
        : productData.discountPrice !== undefined
          ? { discountPrice: productData.discountPrice }
          : {}),
      stock: variantState.aggregate?.stock ?? Number(productData.stock || 0),
      images: normalizedImages,
      modulesData: normalizedModulesData,
      attributes: normalizedAttributes,
      extraDetails: normalizedModulesData,
      variantConfig: variantState.variantConfig,
      variants: variantState.variants,
      status: "APPROVED",
      isActive: true,
      createdBy: userId,
      creatorType: "ADMIN",
      approvedAt: new Date(),
      approvedBy: userId,
    };

    const product = await productRepo.create(productPayload);
    await productAnalyticsService.ensureProductAnalyticsSeed(product);
    return product;
  }

  /**
   * Update product
   * @param {String} productId - Product ID
   * @param {Object} updateData - Data to update
   * @param {String} userId - User ID (who is updating)
   * @param {String} userRole - User role
   */
  async updateProduct(productId, updateData, userId) {
    const product = await productRepo.findById(productId);
    if (!product) {
      throw new AppError("Product not found", 404, "NOT_FOUND");
    }

    // Don't allow changing immutable identifiers
    delete updateData.slug;
    delete updateData.SKU;
    delete updateData.productNumber;
    delete updateData.creatorType;
    delete updateData.createdBy;

    if (Object.prototype.hasOwnProperty.call(updateData, "weight")) {
      updateData.weight = normalizeProductWeight(updateData.weight);
    }

    const nextCategoryId = updateData.categoryId || product.categoryId;
    const nextSubCategoryId = updateData.subCategoryId || product.subCategoryId;
    if (nextCategoryId && nextSubCategoryId) {
      const { category, subcategory } = await getCategoryAndSubcategory(nextCategoryId, nextSubCategoryId);
      updateData.category = category.name;
      updateData.subCategory = subcategory.name;

      const hasModulesDataUpdate = updateData.modulesData !== undefined;
      const hasAttributeUpdate = updateData.attributes !== undefined;
      const hasVariantUpdate = updateData.variants !== undefined;
      const hasExtraDetailsUpdate = updateData.extraDetails !== undefined;
      const categoryChanged = String(nextCategoryId) !== String(product.categoryId);
      const subcategoryChanged = String(nextSubCategoryId) !== String(product.subCategoryId);
      if (hasModulesDataUpdate || hasAttributeUpdate || hasVariantUpdate || hasExtraDetailsUpdate || categoryChanged || subcategoryChanged) {
        const { normalizedModulesData, normalizedAttributes, normalizedImages, variantState } =
          await prepareDynamicProductData({
            categoryId: nextCategoryId,
            subCategoryId: nextSubCategoryId,
            modulesData: hasModulesDataUpdate ? updateData.modulesData || {} : product.modulesData || {},
            attributes: hasAttributeUpdate ? updateData.attributes || {} : product.attributes || {},
            variants: hasVariantUpdate ? updateData.variants || [] : product.variants || [],
            images: updateData.images !== undefined ? updateData.images || [] : product.images || [],
            genericImages:
              updateData.genericImages !== undefined
                ? updateData.genericImages || []
                : product.genericImages || product.images || [],
            extraDetails: hasExtraDetailsUpdate ? updateData.extraDetails || {} : product.extraDetails || {},
            productWeight: updateData.weight || product.weight,
          });

        updateData.modulesData = normalizedModulesData;
        updateData.attributes = normalizedAttributes;
        updateData.extraDetails = normalizedModulesData;
        updateData.images = normalizedImages;
        updateData.variantConfig = variantState.variantConfig;
        updateData.variants = variantState.variants;
        if (variantState.aggregate) {
          updateData.price = variantState.aggregate.price;
          updateData.stock = variantState.aggregate.stock;
          updateData.discountPrice = variantState.aggregate.discountPrice;
        }
      }
    }

    const updatedProduct = await productRepo.updateById(productId, updateData);
    await productAnalyticsService.ensureProductAnalyticsSeed(updatedProduct);
    return updatedProduct;
  }

  /**
   * Delete product permanently
   * @param {String} productId - Product ID
   * @param {String} userId - User ID
   */
  async deleteProduct(productId, userId) {
    void userId;
    const product = await productRepo.findById(productId);
    if (!product) {
      throw new AppError("Product not found", 404, "NOT_FOUND");
    }

    const deletedProduct = await productRepo.deleteById(productId);
    await productAnalyticsService.markProductDeleted(productId);
    return deletedProduct;
  }

  /**
   * Get product by ID
   */
  async getProductById(productId) {
    const product = await productRepo.findById(productId);
    if (!product) {
      throw new AppError("Product not found", 404, "NOT_FOUND");
    }
    return product;
  }

  /**
   * Get all products with filters (admin view)
   */
  async getProducts(filters) {
    return await productRepo.list(filters);
  }

  /**
   * Get public products (only approved and active)
   */
  async getPublicProducts(filters) {
    const { filterDefs, filterDefMap, attributeFilters } = await normalizeDynamicFilterQuery({
      categoryId: filters.categoryId,
      subCategoryId: filters.subCategoryId,
      query: filters.rawQuery || {},
    });

    return await productRepo.getPublicProducts({
      ...filters,
      attributeFilters,
      filterDefs,
      filterDefMap,
    });
  }

  async getPublicProductFilters(filters) {
    const { filterDefs, filterDefMap, attributeFilters } = await normalizeDynamicFilterQuery({
      categoryId: filters.categoryId,
      subCategoryId: filters.subCategoryId,
      query: filters.rawQuery || {},
    });

    return await productRepo.getPublicProductFilters({
      ...filters,
      attributeFilters,
      filterDefs,
      filterDefMap,
    });
  }

  /**
   * Get pending products for admin approval
   */
  async getPendingProducts(filters) {
    return await productRepo.getPendingProducts(filters);
  }

  /**
   * Approve product (admin only)
   */
  async approveProduct(productId, adminId) {
    const product = await productRepo.findById(productId);
    if (!product) {
      throw new AppError("Product not found", 404, "NOT_FOUND");
    }

    if (product.status === "APPROVED") {
      throw new AppError("Product is already approved", 400, "ALREADY_APPROVED");
    }

    const approvedProduct = await productRepo.approveProduct(productId, adminId);
    return approvedProduct;
  }

  /**
   * Reject product (admin only)
   */
  async rejectProduct(productId, rejectionReason, adminId) {
    const product = await productRepo.findById(productId);
    if (!product) {
      throw new AppError("Product not found", 404, "NOT_FOUND");
    }

    if (!rejectionReason || typeof rejectionReason !== "string" || !rejectionReason.trim()) {
      throw new AppError("Rejection reason is required", 400, "VALIDATION_ERROR");
    }

    if (product.status === "REJECTED") {
      throw new AppError("Product is already rejected", 400, "ALREADY_REJECTED");
    }

    const rejectedProduct = await productRepo.rejectProduct(productId, rejectionReason, adminId);
    return rejectedProduct;
  }

  /**
   * Get product statistics
   */
  async getProductStats() {
    const countByStatus = await productRepo.getCountByStatus();
    return {
      countByStatus,
    };
  }

  async previewProductNumber({ categoryId, subCategoryId }) {
    if (!categoryId || !subCategoryId) {
      throw new AppError("Category and subcategory are required", 400, "VALIDATION_ERROR");
    }

    return await previewNextProductNumber({ categoryId, subCategoryId });
  }

  /**
   * Record product view
   */
  async recordView(productId) {
    return await productRepo.incrementViews(productId);
  }

  /**
   * Record product sale
   */
  async recordSale(productId, quantity, amount, variantId = "") {
    const product = await productRepo.findById(productId);
    if (!product) {
      throw new AppError("Product not found", 404, "NOT_FOUND");
    }

    const targetVariant =
      variantId && Array.isArray(product.variants)
        ? product.variants.find((item) => item.variantId === variantId && item.isActive)
        : null;

    if (targetVariant && Number(targetVariant.stock || 0) < quantity) {
      throw new AppError("Insufficient stock", 400, "INSUFFICIENT_STOCK");
    }

    if (product.stock < quantity) {
      throw new AppError("Insufficient stock", 400, "INSUFFICIENT_STOCK");
    }

    return await productRepo.recordSale(productId, quantity, amount, variantId);
  }

  async restoreSale(productId, quantity, amount, variantId = "") {
    const product = await productRepo.findById(productId);
    if (!product) {
      throw new AppError("Product not found", 404, "NOT_FOUND");
    }

    return await productRepo.restoreSale(productId, quantity, amount, variantId);
  }

  async uploadProductImages(files = [], { folder = "products", productName = "", variantTitle = "" } = {}) {
    const uploaded = await uploadMany(files, { folder });

    return uploaded.map((item, index) => ({
      url: item.url,
      altText: buildDefaultAltText({
        originalName: item.originalName,
        productName,
        variantTitle,
      }),
      isPrimary: false,
      sortOrder: index,
      originalName: item.originalName,
      mimeType: item.mimeType,
      size: item.size,
      publicId: item.publicId,
    }));
  }
}

module.exports = new ProductService();
