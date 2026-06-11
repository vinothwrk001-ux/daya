const { Product } = require("../models/Product");
const { normalizeDateRange, applyDateRange } = require("../utils/dateRange");

function escapeRegex(value = "") {
  return String(value).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function getAttributePath(key) {
  return `attributes.${key}`;
}

function getVariantAttributePath(key) {
  return `variants.attributes.${key}`;
}

function buildFilterCondition(rawValue) {
  if (Array.isArray(rawValue) && rawValue.length) {
    return { $in: rawValue };
  }

  if (rawValue && typeof rawValue === "object" && (rawValue.min !== undefined || rawValue.max !== undefined)) {
    const condition = {};
    if (rawValue.min !== undefined) condition.$gte = rawValue.min;
    if (rawValue.max !== undefined) condition.$lte = rawValue.max;
    return Object.keys(condition).length ? condition : undefined;
  }

  if (rawValue !== undefined && rawValue !== null && rawValue !== "") {
    return rawValue;
  }

  return undefined;
}

function buildProductQuery({
  category,
  categoryId,
  subCategoryId,
  status,
  isActive,
  creatorType,
  search,
  minPrice,
  maxPrice,
  attributeFilters = {},
  filterDefMap = {},
  startDate,
  endDate,
} = {}) {
  const query = {};
  const variantConditions = {};

  if (category) query.category = category;
  if (categoryId) query.categoryId = categoryId;
  if (subCategoryId) query.subCategoryId = subCategoryId;
  if (status) query.status = status;
  if (isActive !== undefined) query.isActive = isActive;
  if (creatorType) query.creatorType = creatorType;

  if (minPrice !== undefined || maxPrice !== undefined) {
    query.price = {};
    if (minPrice !== undefined) query.price.$gte = minPrice;
    if (maxPrice !== undefined) query.price.$lte = maxPrice;
  }

  if (search) {
    query.name = { $regex: escapeRegex(search.trim()), $options: "i" };
  }

  for (const [key, rawValue] of Object.entries(attributeFilters || {})) {
    const filterDef = filterDefMap?.[key];
    const condition = buildFilterCondition(rawValue);
    if (condition === undefined) continue;

    if (key === "price") {
      query.price = condition;
      continue;
    }

    if (key === "rating") {
      query["ratings.averageRating"] = condition;
      continue;
    }

    if (filterDef?.isVariant) {
      variantConditions[`attributes.${key}`] = condition;
      continue;
    }

    query[getAttributePath(key)] = condition;
  }

  if (Object.keys(variantConditions).length) {
    query.variants = { $elemMatch: variantConditions };
  }

  applyDateRange(query, normalizeDateRange({ startDate, endDate }));
  return query;
}

function omitAttributeFilter(attributeFilters = {}, filterKey = "") {
  return Object.fromEntries(Object.entries(attributeFilters).filter(([key]) => key !== filterKey));
}

async function buildFacetPayload(filterDefs = [], baseFilters = {}) {
  if (!Array.isArray(filterDefs) || filterDefs.length === 0) {
    return [];
  }

  return await Promise.all(filterDefs.map(async (filterDef) => {
    const scopedQuery = buildProductQuery({
      ...baseFilters,
      attributeFilters: omitAttributeFilter(baseFilters.attributeFilters, filterDef.key),
      filterDefMap: baseFilters.filterDefMap,
    });

    if (filterDef.type === "range") {
      const targetPath =
        filterDef.key === "price"
          ? "$price"
          : filterDef.isVariant
            ? `$${getVariantAttributePath(filterDef.key)}`
            : `$${getAttributePath(filterDef.key)}`;
      const [rangeStats] = await Product.aggregate([
        { $match: scopedQuery },
        ...(filterDef.isVariant
          ? [
              { $unwind: "$variants" },
              { $match: { "variants.isActive": { $ne: false } } },
            ]
          : []),
        {
          $group: {
            _id: null,
            min: { $min: targetPath },
            max: { $max: targetPath },
          },
        },
      ]);

      return {
        key: filterDef.key,
        type: filterDef.type,
        name: filterDef.name,
        group: filterDef.group,
        order: filterDef.order,
        min: Number.isFinite(rangeStats?.min) ? rangeStats.min : filterDef.rangeConfig?.min ?? 0,
        max: Number.isFinite(rangeStats?.max) ? rangeStats.max : filterDef.rangeConfig?.max ?? 0,
        step: filterDef.rangeConfig?.step ?? 1,
        unit: filterDef.unit || "",
      };
    }

    const [countBuckets] = await Product.aggregate([
      { $match: scopedQuery },
      ...(filterDef.isVariant
        ? [
            { $unwind: "$variants" },
            { $match: { "variants.isActive": { $ne: false } } },
          ]
        : []),
      {
        $project: {
          productId: "$_id",
          rawValue: filterDef.isVariant ? `$${getVariantAttributePath(filterDef.key)}` : `$${getAttributePath(filterDef.key)}`,
        },
      },
      {
        $project: {
          productId: 1,
          values: {
            $cond: [
              { $isArray: "$rawValue" },
              "$rawValue",
              {
                $cond: [
                  {
                    $or: [{ $eq: ["$rawValue", null] }, { $eq: ["$rawValue", ""] }],
                  },
                  [],
                  ["$rawValue"],
                ],
              },
            ],
          },
        },
      },
      { $unwind: "$values" },
      {
        $match: {
          values: { $nin: [null, ""] },
        },
      },
      {
        $group: {
          _id: {
            productId: "$productId",
            value: "$values",
          },
        },
      },
      {
        $group: {
          _id: "$_id.value",
          count: { $sum: 1 },
        },
      },
      {
        $group: {
          _id: null,
          options: {
            $push: {
              value: "$_id",
              count: "$count",
            },
          },
        },
      },
    ]);

    const optionCountMap = new Map((countBuckets?.options || []).map((item) => [String(item.value), Number(item.count || 0)]));
    const dynamicOptions = (countBuckets?.options || [])
      .map((item) => String(item.value))
      .filter(Boolean);
    const preferredOptions = Array.isArray(filterDef.options) && filterDef.options.length ? filterDef.options : dynamicOptions;
    const preferredOptionSet = new Set(preferredOptions.map((item) => String(item)));
    const mergedOptions = [
      ...preferredOptions.map((item) => String(item)),
      ...dynamicOptions
        .filter((item) => !preferredOptionSet.has(String(item)))
        .sort((a, b) => a.localeCompare(b, undefined, { numeric: true, sensitivity: "base" })),
    ];

    return {
      key: filterDef.key,
      type: filterDef.type,
      name: filterDef.name,
      group: filterDef.group,
      order: filterDef.order,
      options: mergedOptions.map((option) => ({
        value: option,
        count: optionCountMap.get(String(option)) || 0,
      })),
    };
  }));
}

class ProductRepository {
  // Create a new product
  async create(productData) {
    const product = new Product(productData);
    return await product.save();
  }

  // Find product by ID
  async findById(productId) {
    return await Product.findById(productId)
      .populate("createdBy", "name email role")
      .populate("approvedBy", "name email");
  }

  // Find product by slug
  async findBySlug(slug) {
    return await Product.findOne({ slug }).populate("createdBy", "name email");
  }

  // Find by SKU
  async findBySKU(sku) {
    return await Product.findOne({ SKU: sku });
  }

  // List products with filters and pagination
  async list({
    page = 1,
    limit = 20,
    category,
    categoryId,
    subCategoryId,
    status,
    isActive,
    creatorType,
    search,
    sortBy = "createdAt",
    sortOrder = -1,
    minPrice,
    maxPrice,
    attributeFilters = {},
    filterDefs = [],
    filterDefMap = {},
    startDate,
    endDate,
  } = {}) {
    const query = buildProductQuery({
      category,
      categoryId,
      subCategoryId,
      status,
      isActive,
      creatorType,
      search,
      minPrice,
      maxPrice,
      attributeFilters,
      filterDefMap,
      startDate,
      endDate,
    });

    const skip = (page - 1) * limit;
    const sortObj = { [sortBy]: sortOrder };

    const [products, total, facets] = await Promise.all([
      Product.find(query)
        .populate("createdBy", "name email")
        .sort(sortObj)
        .skip(skip)
        .limit(limit),
      Product.countDocuments(query),
      buildFacetPayload(filterDefs, {
        category,
        categoryId,
        subCategoryId,
        status,
        isActive,
        creatorType,
        search,
        minPrice,
        maxPrice,
        attributeFilters,
        filterDefMap,
        startDate,
        endDate,
      }),
    ]);

    return {
      products,
      facets,
      pagination: {
        total,
        page,
        limit,
        pages: Math.ceil(total / limit),
      },
    };
  }

  // Get only approved and active products (for public API)
  async getPublicProducts({
    page = 1,
    limit = 20,
    category,
    categoryId,
    subCategoryId,
    search,
    sortBy = "createdAt",
    sortOrder = -1,
    minPrice,
    maxPrice,
    attributeFilters = {},
    filterDefs = [],
    filterDefMap = {},
  } = {}) {
    return this.list({
      page,
      limit,
      category,
      categoryId,
      subCategoryId,
      status: "APPROVED",
      isActive: true,
      search,
      sortBy,
      sortOrder,
      minPrice,
      maxPrice,
      attributeFilters,
      filterDefs,
      filterDefMap,
    });
  }

  async getPublicProductFilters({
    category,
    categoryId,
    subCategoryId,
    search,
    minPrice,
    maxPrice,
    attributeFilters = {},
    filterDefs = [],
    filterDefMap = {},
  } = {}) {
    const query = buildProductQuery({
      category,
      categoryId,
      subCategoryId,
      status: "APPROVED",
      isActive: true,
      search,
      minPrice,
      maxPrice,
      attributeFilters,
      filterDefMap,
    });

    const [total, facets] = await Promise.all([
      Product.countDocuments(query),
      buildFacetPayload(filterDefs, {
        category,
        categoryId,
        subCategoryId,
        status: "APPROVED",
        isActive: true,
        search,
        minPrice,
        maxPrice,
        attributeFilters,
        filterDefMap,
      }),
    ]);

    return {
      total,
      filters: filterDefs,
      facets,
    };
  }

  // Update product
  async updateById(productId, updateData) {
    return await Product.findByIdAndUpdate(productId, { $set: updateData }, { returnDocument: "after", runValidators: true })
      .populate("createdBy", "name email");
  }

  // Delete product (soft delete)
  async softDeleteById(productId) {
    return await Product.findByIdAndUpdate(productId, { $set: { isActive: false } }, { returnDocument: "after" });
  }

  // Hard delete
  async deleteById(productId) {
    return await Product.findByIdAndDelete(productId);
  }

  // Find pending products (for admin approval)
  async getPendingProducts({ page = 1, limit = 20, startDate, endDate } = {}) {
    const query = { status: "PENDING" };
    applyDateRange(query, normalizeDateRange({ startDate, endDate }));
    const skip = (page - 1) * limit;
    const [products, total] = await Promise.all([
      Product.find(query)
        .populate("createdBy", "name email")
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit),
      Product.countDocuments(query),
    ]);

    return {
      products,
      pagination: {
        total,
        page,
        limit,
        pages: Math.ceil(total / limit),
      },
    };
  }

  // Approve product
  async approveProduct(productId, approvedBy) {
    return await Product.findByIdAndUpdate(
      productId,
      {
        $set: {
          status: "APPROVED",
          isActive: true,
          approvedBy,
          approvedAt: new Date(),
        },
      },
      { returnDocument: "after" }
    );
  }

  // Reject product
  async rejectProduct(productId, rejectionReason, approvedBy) {
    return await Product.findByIdAndUpdate(
      productId,
      {
        $set: {
          status: "REJECTED",
          rejectionReason,
          isActive: false,
          approvedBy,
          approvedAt: new Date(),
        },
      },
      { returnDocument: "after" }
    );
  }

  // Get product count by status
  async getCountByStatus() {
    return await Product.aggregate([
      {
        $group: {
          _id: "$status",
          count: { $sum: 1 },
        },
      },
    ]);
  }

  async countDocuments(query = {}) {
    return await Product.countDocuments(query);
  }

  async getTopProducts(limit = 5) {
    return await Product.find({ status: "APPROVED", isActive: true })
      .sort({ "analytics.totalRevenue": -1, "analytics.salesCount": -1, createdAt: -1 })
      .limit(limit)
      .select("name category price analytics ratings status isActive")
      .exec();
  }

  // Update views count
  async incrementViews(productId) {
    return await Product.findByIdAndUpdate(
      productId,
      { $inc: { "analytics.views": 1 } },
      { returnDocument: "after" }
    );
  }

  // Update sales count and revenue
  async recordSale(productId, quantity, amount, variantId = "") {
    if (!variantId) {
      return await Product.findByIdAndUpdate(
        productId,
        {
          $inc: {
            "analytics.salesCount": quantity,
            "analytics.totalRevenue": amount,
            stock: -quantity,
          },
        },
        { returnDocument: "after" }
      );
    }

    const product = await Product.findById(productId);
    if (!product) return null;
    const variant = Array.isArray(product.variants)
      ? product.variants.find((item) => item.variantId === variantId)
      : null;
    if (variant) {
      variant.stock = Math.max(0, Number(variant.stock || 0) - quantity);
    }
    product.stock = Math.max(0, Number(product.stock || 0) - quantity);
    product.analytics.salesCount = Number(product.analytics?.salesCount || 0) + quantity;
    product.analytics.totalRevenue = Number(product.analytics?.totalRevenue || 0) + amount;
    await product.save();
    return product;
  }

  async restoreSale(productId, quantity, amount, variantId = "") {
    if (!variantId) {
      return await Product.findByIdAndUpdate(
        productId,
        {
          $inc: {
            "analytics.salesCount": -quantity,
            "analytics.totalRevenue": -amount,
            stock: quantity,
          },
        },
        { returnDocument: "after" }
      );
    }

    const product = await Product.findById(productId);
    if (!product) return null;
    const variant = Array.isArray(product.variants)
      ? product.variants.find((item) => item.variantId === variantId)
      : null;
    if (variant) {
      variant.stock = Number(variant.stock || 0) + quantity;
    }
    product.stock = Number(product.stock || 0) + quantity;
    product.analytics.salesCount = Math.max(0, Number(product.analytics?.salesCount || 0) - quantity);
    product.analytics.totalRevenue = Math.max(0, Number(product.analytics?.totalRevenue || 0) - amount);
    await product.save();
    return product;
  }
}

module.exports = new ProductRepository();
