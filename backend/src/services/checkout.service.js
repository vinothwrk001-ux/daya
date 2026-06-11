const crypto = require("crypto");
const mongoose = require("mongoose");
const { AppError } = require("../utils/AppError");
const cartRepo = require("../repositories/cart.repository");
const productRepo = require("../repositories/product.repository");
const orderRepo = require("../repositories/order.repository");
const paymentRepo = require("../repositories/payment.repository");
const userRepo = require("../repositories/user.repository");
const pricingService = require("./pricing.service");
const { logger } = require("../utils/logger");
const inventoryService = require("./inventory.service");
const { buildOrderSnapshot, generateInvoiceNumber } = require("./order-document.service");
const codService = require("./cod.service");
const guestCartService = require("./guestCart.service");
const { Order } = require("../models/Order");
const { Payment } = require("../models/Payment");
const { emitDomainEvent } = require("../modules/events/event-bus");
const productAnalyticsService = require("./product-analytics.service");

const PREPARED_CHECKOUT_CACHE_TTL_MS = 2 * 60 * 1000;
const preparedCheckoutCache = new Map();

function asObjectId(id, fieldName) {
  if (!mongoose.isValidObjectId(id)) throw new AppError(`Invalid ${fieldName}`, 400, "VALIDATION_ERROR");
  return id;
}

function generateOrderNumber() {
  return `ORD-${Date.now()}-${Math.random().toString(36).slice(2, 8).toUpperCase()}`;
}

function generateOrderGroupId() {
  return `grp_${Date.now()}_${crypto.randomBytes(4).toString("hex")}`;
}

function roundMoney(value) {
  return Math.round(Number(value || 0) * 100) / 100;
}

function normalizePaymentMethod(value = "ONLINE") {
  const normalized = String(value || "ONLINE").toUpperCase();
  return normalized === "COD" ? "COD" : "ONLINE";
}

function resolveVariant(product, variantId = "") {
  const variants = Array.isArray(product?.variants) ? product.variants : [];
  if (!variants.length) return null;
  if (!variantId) {
    return (
      variants.find((item) => item.isDefault && item.isActive && item.stock > 0) ||
      variants.find((item) => item.isActive && item.stock > 0) ||
      variants.find((item) => item.isActive) ||
      null
    );
  }
  return variants.find((item) => item.variantId === variantId && item.isActive) || null;
}

function normalizeAddressForCache(address = {}) {
  if (!address || typeof address !== "object") return {};
  return {
    fullName: String(address.fullName || "").trim(),
    phone: String(address.phone || "").trim(),
    line1: String(address.line1 || "").trim(),
    line2: String(address.line2 || "").trim(),
    city: String(address.city || "").trim(),
    state: String(address.state || "").trim(),
    postalCode: String(address.postalCode || "").trim(),
    country: String(address.country || "").trim(),
  };
}

function buildPreparedCheckoutCacheKey(userId, { shippingAddress, paymentMethod = "ONLINE" } = {}) {
  return JSON.stringify({
    userId: String(userId || ""),
    paymentMethod: normalizePaymentMethod(paymentMethod),
    shippingAddress: normalizeAddressForCache(shippingAddress),
  });
}

function getCachedPreparedCheckout(userId, { shippingAddress, paymentMethod = "ONLINE" } = {}) {
  const cacheKey = buildPreparedCheckoutCacheKey(userId, { shippingAddress, paymentMethod });
  const cached = preparedCheckoutCache.get(cacheKey);
  if (!cached) return null;
  if (cached.expiresAt <= Date.now()) {
    preparedCheckoutCache.delete(cacheKey);
    return null;
  }
  return cached.summary;
}

function setCachedPreparedCheckout(userId, { shippingAddress, paymentMethod = "ONLINE" } = {}, summary) {
  const cacheKey = buildPreparedCheckoutCacheKey(userId, { shippingAddress, paymentMethod });
  preparedCheckoutCache.set(cacheKey, {
    expiresAt: Date.now() + PREPARED_CHECKOUT_CACHE_TTL_MS,
    summary,
  });
}

function invalidatePreparedCheckoutCache(userId) {
  const normalizedUserId = String(userId || "");
  for (const cacheKey of preparedCheckoutCache.keys()) {
    try {
      const parsedKey = JSON.parse(cacheKey);
      if (String(parsedKey?.userId || "") === normalizedUserId) {
        preparedCheckoutCache.delete(cacheKey);
      }
    } catch {
      preparedCheckoutCache.delete(cacheKey);
    }
  }
}

function getChargeAmount(charges = [], predicate) {
  const charge = Array.isArray(charges) ? charges.find(predicate) : null;
  return roundMoney(charge?.amount || 0);
}

function buildAmountBreakdownSnapshot({ subtotal = 0, shippingFee = 0, taxAmount = 0, totalAmount = 0, paymentMethod = "ONLINE" }) {
  return {
    subtotal: roundMoney(subtotal),
    shippingFee: roundMoney(shippingFee),
    taxAmount: roundMoney(taxAmount),
    totalAmount: roundMoney(totalAmount),
    paymentMethod,
  };
}

async function runNonBlocking(taskName, work) {
  try {
    return await work();
  } catch (error) {
    logger.error(`Non-blocking checkout task failed: ${taskName}`, {
      message: error.message,
      stack: error.stack,
    });
    return null;
  }
}

function runDeferred(taskName, work) {
  setImmediate(async () => {
    try {
      await work();
    } catch (error) {
      logger.error(`Deferred checkout task failed: ${taskName}`, {
        message: error.message,
        stack: error.stack,
      });
    }
  });
}

async function executeWithOptionalTransaction(work) {
  const session = await mongoose.startSession();
  try {
    let result;
    await session.withTransaction(async () => {
      result = await work(session);
    });
    return result;
  } catch (error) {
    const message = String(error?.message || "");
    if (
      message.includes("Transaction numbers are only allowed") ||
      message.includes("replica set") ||
      message.includes("standalone")
    ) {
      logger.warn("Mongo transaction unavailable, falling back to non-transactional checkout flow", {
        source: "checkout.service",
      });
      return await work(null);
    }
    throw error;
  } finally {
    await session.endSession().catch(() => {});
  }
}

function getProductWeightSnapshot(product, variant = null) {
  if (variant?.weight && typeof variant.weight === "object" && Number(variant.weight.value) > 0) {
    return {
      value: Number(variant.weight.value),
      unit: variant.weight.unit || "kg",
    };
  }

  if (product?.weight && typeof product.weight === "object" && Number(product.weight.value) > 0) {
    return {
      value: Number(product.weight.value),
      unit: product.weight.unit || "kg",
    };
  }

  if (typeof product?.weight === "number" && product.weight > 0) {
    return {
      value: Number(product.weight),
      unit: "kg",
    };
  }

  return null;
}

function buildSummaryShape({ currency, items, subtotal, charges, chargesTotal, total, itemCount, shipping, paymentMethod }) {
  return {
    currency,
    items,
    subtotal: roundMoney(subtotal),
    charges,
    chargesTotal: roundMoney(chargesTotal),
    total: roundMoney(total),
    itemCount,
    shipping,
    shippingFee: getChargeAmount(charges, (charge) => charge?.key === "shipping_cost"),
    taxAmount: getChargeAmount(
      charges,
      (charge) => charge?.key === "tax" || String(charge?.category || "").toUpperCase() === "TAX"
    ),
    totalAmount: roundMoney(total),
    paymentMethod,
  };
}

async function buildValidatedItem(item) {
  asObjectId(item.productId, "productId");
  const product = await productRepo.findById(item.productId);
  if (!product) throw new AppError("Product not found", 404, "NOT_FOUND");
  if (product.status !== "APPROVED" || product.isActive !== true) {
    throw new AppError(`Product not available: ${product.name}`, 400, "NOT_AVAILABLE");
  }

  const variant = resolveVariant(product, item.variantId);
  const stockSnapshot = await inventoryService.getAvailableStock(
    product._id,
    variant?.variantId || item.variantId || ""
  );
  const availableStock = Number(stockSnapshot.available || 0);
  if (availableStock < Number(item.quantity || 0)) {
    throw new AppError(`Out of stock: ${product.name}`, 400, "INSUFFICIENT_STOCK");
  }

  return {
    productId: product._id,
    name: product.name,
    image:
      variant?.images?.find((image) => image.isPrimary)?.url ||
      variant?.images?.[0]?.url ||
      item.image ||
      (Array.isArray(product.images) && product.images.length ? product.images[0]?.url : undefined),
    quantity: Number(item.quantity || 0),
    price: Number(variant?.discountPrice || variant?.price || product.discountPrice || product.price || 0),
    maxAvailable: availableStock,
    variantId: variant?.variantId || item.variantId || "",
    variantSku: variant?.sku || item.variantSku || "",
    variantTitle: variant?.title || item.variantTitle || "",
    variantAttributes: variant?.attributes || item.variantAttributes || {},
    weight: getProductWeightSnapshot(product, variant),
    product,
  };
}

async function calculatePricing({ subtotal, itemsWithProducts, shippingAddress, itemCount, paymentMethod }) {
  if (shippingAddress) {
    try {
      return await Promise.race([
        pricingService.calculateOrderTotalWithShipping(
          subtotal,
          itemsWithProducts,
          shippingAddress,
          itemCount,
          { paymentMethod }
        ),
        new Promise((_, reject) => setTimeout(() => reject(new Error("Shipping calculation timeout")), 5000)),
      ]);
    } catch (error) {
      logger.warn("Shipping calculation failed during checkout", {
        source: "checkout.service",
        message: error.message,
      });
    }
  }

  return await pricingService.calculateOrderTotal(subtotal, itemCount, paymentMethod);
}

class CheckoutService {
  invalidatePreparedCheckoutCacheForUser(userId) {
    invalidatePreparedCheckoutCache(userId);
  }

  async prepareGuestCheckout(guestCartItems = [], { currency, shippingAddress, paymentMethod } = {}) {
    if (!Array.isArray(guestCartItems) || guestCartItems.length === 0) {
      throw new AppError("Cart is empty", 400, "EMPTY_CART");
    }

    const validation = await guestCartService.validateCartItems(guestCartItems);
    if (!validation.validatedItems.length) {
      throw new AppError("No valid items in cart", 400, "INVALID_CART");
    }

    const validatedItems = await Promise.all(validation.validatedItems.map(buildValidatedItem));
    const items = validatedItems.map(({ product, ...itemData }) => itemData);
    const subtotal = roundMoney(items.reduce((sum, item) => sum + item.price * item.quantity, 0));
    const totalItemCount = items.reduce((sum, item) => sum + Number(item.quantity || 0), 0);
    const resolvedPaymentMethod = normalizePaymentMethod(paymentMethod);
    const pricingBreakdown = await calculatePricing({
      subtotal,
      itemsWithProducts: validatedItems,
      shippingAddress,
      itemCount: totalItemCount,
      paymentMethod: resolvedPaymentMethod,
    });

    let eligibility = null;
    if (resolvedPaymentMethod === "COD" && shippingAddress) {
      try {
        eligibility = await codService.evaluateEligibility({
          userId: null,
          address: shippingAddress,
          cartItems: items,
          subtotal,
        });
      } catch (error) {
        logger.warn("Guest COD eligibility check failed during checkout prepare", {
          source: "checkout.service",
          message: error.message,
        });
        eligibility = {
          codAvailable: false,
          reasons: ["COD_CHECK_FAILED"],
        };
      }
    }

    return {
      ...buildSummaryShape({
        currency: currency || "INR",
        items,
        subtotal,
        charges: pricingBreakdown.charges,
        chargesTotal: pricingBreakdown.chargesTotal,
        total: pricingBreakdown.total,
        itemCount: totalItemCount,
        shipping: pricingBreakdown.shipping || null,
        paymentMethod: pricingBreakdown.paymentMethod || resolvedPaymentMethod,
      }),
      errors: validation.errors,
      codAvailability: eligibility
        ? {
            codAvailable: eligibility.codAvailable,
            reasons: eligibility.reasons,
          }
        : undefined,
    };
  }

  async prepare(userId, { currency, shippingAddress, paymentMethod } = {}) {
    const cachedSummary = getCachedPreparedCheckout(userId, { shippingAddress, paymentMethod });
    if (cachedSummary) {
      return cachedSummary;
    }

    const cart = await cartRepo.findByUserId(userId);
    if (!cart || !Array.isArray(cart.items) || cart.items.length === 0) {
      throw new AppError("Cart is empty", 400, "EMPTY_CART");
    }

    const validatedItems = await Promise.all(cart.items.map(buildValidatedItem));
    const items = validatedItems.map(({ product, ...itemData }) => itemData);
    const subtotal = roundMoney(items.reduce((sum, item) => sum + item.price * item.quantity, 0));
    const totalItemCount = items.reduce((sum, item) => sum + Number(item.quantity || 0), 0);
    const resolvedPaymentMethod = normalizePaymentMethod(paymentMethod);
    const pricingBreakdown = await calculatePricing({
      subtotal,
      itemsWithProducts: validatedItems,
      shippingAddress,
      itemCount: totalItemCount,
      paymentMethod: resolvedPaymentMethod,
    });

    let eligibility = null;
    if (resolvedPaymentMethod === "COD" && shippingAddress) {
      try {
        eligibility = await codService.evaluateEligibility({
          userId,
          address: shippingAddress,
          cartItems: items,
          subtotal,
        });
      } catch (error) {
        logger.warn("COD eligibility check failed during checkout prepare", {
          source: "checkout.service",
          message: error.message,
        });
        eligibility = {
          codAvailable: false,
          reasons: ["COD_CHECK_FAILED"],
        };
      }
    }

    const summary = {
      ...buildSummaryShape({
        currency: currency || cart.currency || "INR",
        items,
        subtotal,
        charges: pricingBreakdown.charges,
        chargesTotal: pricingBreakdown.chargesTotal,
        total: pricingBreakdown.total,
        itemCount: totalItemCount,
        shipping: pricingBreakdown.shipping || null,
        paymentMethod: pricingBreakdown.paymentMethod || resolvedPaymentMethod,
      }),
      codAvailability: eligibility
        ? {
            codAvailable: eligibility.codAvailable,
            reasons: eligibility.reasons,
          }
        : undefined,
    };

    setCachedPreparedCheckout(userId, { shippingAddress, paymentMethod }, summary);
    return summary;
  }

  async createOrder(userId, { shippingAddress, paymentMethod = "ONLINE", paymentRecordId = null, paymentStatus = null, razorpayOrderId = null, razorpayPaymentId = null, fraudFlags = [] } = {}) {
    const cart = await cartRepo.findByUserId(userId);
    if (!cart || !Array.isArray(cart.items) || cart.items.length === 0) {
      throw new AppError("Cart is empty", 400, "EMPTY_CART");
    }

    const user = await userRepo.findById(userId);
    const resolvedPaymentMethod = normalizePaymentMethod(paymentMethod);
    const resolvedGroupId = generateOrderGroupId();
    const resolvedPaymentStatus = paymentStatus || (resolvedPaymentMethod === "ONLINE" ? "Paid" : "Pending");
    const validatedItems = await Promise.all(cart.items.map(buildValidatedItem));
    const cleanedItems = validatedItems.map(({ product, maxAvailable, ...item }) => ({
      productId: item.productId,
      name: item.name,
      price: item.price,
      quantity: item.quantity,
      image: item.image,
      variantId: item.variantId,
      variantSku: item.variantSku,
      variantTitle: item.variantTitle,
      variantAttributes: item.variantAttributes,
      weight: item.weight || undefined,
    }));
    const subtotal = roundMoney(cleanedItems.reduce((sum, item) => sum + Number(item.price || 0) * Number(item.quantity || 0), 0));
    const totalItemCount = cleanedItems.reduce((sum, item) => sum + Number(item.quantity || 0), 0);
    const pricingBreakdown = await calculatePricing({
      subtotal,
      itemsWithProducts: validatedItems,
      shippingAddress,
      itemCount: totalItemCount,
      paymentMethod: resolvedPaymentMethod,
    });

    const codEligibility =
      resolvedPaymentMethod === "COD"
        ? await codService.evaluateEligibility({
            userId,
            address: shippingAddress,
            cartItems: cleanedItems,
            subtotal,
          })
        : null;
    if (resolvedPaymentMethod === "COD" && !codEligibility?.codAvailable) {
      throw new AppError("COD is not available for this order", 400, "COD_NOT_AVAILABLE", {
        reasons: codEligibility?.reasons || [],
      });
    }

    const chargesBreakdown = pricingBreakdown.charges || [];
    const shippingCharge = chargesBreakdown.find((charge) => charge.key === "shipping_cost");
    const platformFeeCharge = chargesBreakdown.find((charge) => charge.key === "platform_fee");
    const taxCharge = chargesBreakdown.find((charge) => charge.key === "tax");
    const discountCharge = chargesBreakdown.find((charge) => charge.key === "discount");
    const shippingFee = roundMoney(shippingCharge?.amount || 0);
    const taxAmount = roundMoney(taxCharge?.amount || 0);
    const discountAmount = roundMoney(discountCharge?.amount || 0);
    const platformFee = roundMoney(platformFeeCharge?.amount || 0);
    const totalAmount = roundMoney(pricingBreakdown.total || subtotal + Number(pricingBreakdown.chargesTotal || 0));
    const orderNumber = generateOrderNumber();

    const orderPayload = {
      _id: new mongoose.Types.ObjectId(),
      orderNumber,
      invoiceNumber: generateInvoiceNumber({ orderNumber }),
      userId: new mongoose.Types.ObjectId(userId),
      items: cleanedItems,
      subtotal,
      shippingFee,
      platformFee,
      taxAmount,
      discountAmount,
      chargesBreakdown,
      pricingSnapshot: {
        subtotal,
        charges: chargesBreakdown,
        chargesTotal: roundMoney(pricingBreakdown.chargesTotal || 0),
        total: totalAmount,
        paymentMethod: resolvedPaymentMethod,
        calculatedAt: pricingBreakdown.calculatedAt ? new Date(pricingBreakdown.calculatedAt) : new Date(),
      },
      priceBreakdown: codService.buildOrderPriceBreakdown({
        pricingBreakdown,
        subtotal,
        shippingFee,
        taxAmount,
        discountAmount,
        totalAmount,
        paymentMethod: resolvedPaymentMethod,
      }),
      chargesTotal: roundMoney(pricingBreakdown.chargesTotal || 0),
      totalAmount,
      currency: cart.currency || "INR",
      status: "Placed",
      paymentStatus: resolvedPaymentStatus,
      paymentMethod: resolvedPaymentMethod,
      codAmount: resolvedPaymentMethod === "COD" ? totalAmount : 0,
      shippingAddress,
      billingAddress: shippingAddress,
      paymentRecordId: paymentRecordId || undefined,
      orderGroupId: resolvedGroupId,
      razorpayOrderId: razorpayOrderId || undefined,
      razorpayPaymentId: razorpayPaymentId || undefined,
      paymentCapturedAt: resolvedPaymentStatus === "Paid" ? new Date() : undefined,
      fraudFlags,
      shippingMode: "PLATFORM",
      shippingStatus: "NOT_SHIPPED",
      pickupStatus: "NOT_REQUESTED",
      timeline: [{ status: "Placed", note: "Order placed", timestamp: new Date() }],
      inventoryReservedAt: new Date(),
      cod: resolvedPaymentMethod === "COD"
        ? {
            isEligible: true,
            ineligibleReasons: [],
            status: "pending_cod",
          }
        : undefined,
    };

    orderPayload.orderSnapshot = buildOrderSnapshot(orderPayload, {
      user,
      paymentRecord: {
        method: resolvedPaymentMethod,
        razorpayOrderId: razorpayOrderId || "",
        razorpayPaymentId: razorpayPaymentId || "",
        paidAt: resolvedPaymentStatus === "Paid" ? new Date() : null,
      },
    });

    const inventoryReservations = [];
    let orders = [];
    let payment = null;

    try {
      await executeWithOptionalTransaction(async (session) => {
        for (const item of orderPayload.items || []) {
          await inventoryService.reserveStock(
            item.productId,
            item.variantId || "",
            item.quantity,
            orderPayload._id,
            userId,
            { session }
          );
          inventoryReservations.push({
            productId: item.productId,
            variantId: item.variantId || "",
            quantity: item.quantity,
            orderId: orderPayload._id,
          });
        }

        orders = session
          ? await Order.insertMany([orderPayload], { ordered: true, session })
          : await orderRepo.createMany([orderPayload]);

        if (paymentRecordId) {
          payment = session
            ? await Payment.findByIdAndUpdate(
                paymentRecordId,
                {
                  $set: {
                    orderIds: orders.map((order) => order._id),
                    orderGroupId: resolvedGroupId,
                    shippingAddress,
                    status: resolvedPaymentStatus === "Paid" ? "PAID" : "PENDING",
                    fulfillmentStatus: "COMPLETED",
                    fulfilledAt: new Date(),
                    razorpayOrderId: razorpayOrderId || undefined,
                    razorpayPaymentId: razorpayPaymentId || undefined,
                    paidAt: resolvedPaymentStatus === "Paid" ? new Date() : undefined,
                  },
                  $unset: {
                    fulfillmentError: 1,
                  },
                },
                { returnDocument: "after", session }
              )
            : await paymentRepo.updateById(paymentRecordId, {
                $set: {
                  orderIds: orders.map((order) => order._id),
                  orderGroupId: resolvedGroupId,
                  shippingAddress,
                  status: resolvedPaymentStatus === "Paid" ? "PAID" : "PENDING",
                  fulfillmentStatus: "COMPLETED",
                  fulfilledAt: new Date(),
                  razorpayOrderId: razorpayOrderId || undefined,
                  razorpayPaymentId: razorpayPaymentId || undefined,
                  paidAt: resolvedPaymentStatus === "Paid" ? new Date() : undefined,
                },
                $unset: {
                  fulfillmentError: 1,
                },
              });
        } else if (resolvedPaymentMethod === "COD") {
          const codFee = codService.getCodFeeFromCharges(chargesBreakdown);
          const codPaymentPayload = {
            userId,
            orderIds: orders.map((order) => order._id),
            orderGroupId: resolvedGroupId,
            amount: totalAmount,
            currency: cart.currency || "INR",
            method: "COD",
            status: "PENDING",
            fulfillmentStatus: "COMPLETED",
            fulfilledAt: new Date(),
            shippingAddress,
            amountBreakdown: {
              ...buildAmountBreakdownSnapshot({
                subtotal,
                shippingFee,
                taxAmount,
                totalAmount,
                paymentMethod: "COD",
              }),
              codFee,
            },
            codDetails: {
              status: "pending_cod",
              eligibilitySnapshot: {
                codAvailable: Boolean(codEligibility?.codAvailable),
                reasons: codEligibility?.reasons || [],
              },
            },
          };
          payment = session
            ? (await Payment.create([codPaymentPayload], { session }))[0]
            : await paymentRepo.create(codPaymentPayload);

          for (const order of orders) {
            if (session) {
              await Order.updateOne({ _id: order._id }, { $set: { paymentRecordId: payment._id, orderGroupId: resolvedGroupId } }, { session });
            } else {
              await orderRepo.updateById(order._id, { paymentRecordId: payment._id, orderGroupId: resolvedGroupId });
            }
          }
        }

        for (const order of orders) {
          const shipmentRecord = await codService.createShipmentRecord(order, { session });
          if (session) {
            await Order.updateOne(
              { _id: order._id },
              { $set: { shipmentRecordId: shipmentRecord._id } },
              { session }
            );
          } else {
            await orderRepo.updateById(order._id, { shipmentRecordId: shipmentRecord._id });
          }
        }
      });

      runDeferred(`checkout follow-up for group ${resolvedGroupId}`, async () => {
        await runNonBlocking("refresh product analytics after checkout", () =>
          Promise.all(orders.map((order) => productAnalyticsService.refreshForOrder(order._id)))
        );
        await runNonBlocking(`clear cart for user ${userId}`, () => cartRepo.clear(userId));

        await runNonBlocking("emit shipment events", () =>
          Promise.all(
            orders.map((order) =>
              Promise.all([
                resolvedPaymentMethod === "COD"
                  ? emitDomainEvent("COD_ORDER_PLACED", {
                      orderId: order._id,
                      orderGroupId: order.orderGroupId,
                      paymentRecordId: payment?._id || null,
                    })
                  : Promise.resolve(),
                emitDomainEvent("SHIPMENT_CREATED", {
                  orderId: order._id,
                  orderGroupId: order.orderGroupId,
                  shipmentRecordId: order.shipmentRecordId || null,
                  paymentMethod: order.paymentMethod,
                }),
              ]).then(() => null)
            )
          )
        );
      });

      return { orders, payment, orderGroupId: resolvedGroupId };
    } catch (error) {
      if (orders.length === 0 && resolvedPaymentMethod === "COD" && payment?._id) {
        await paymentRepo
          .updateById(payment._id, {
            $set: {
              status: "FAILED",
              fulfillmentStatus: "FAILED",
              fulfillmentError: error.message,
              failedAt: new Date(),
            },
          })
          .catch(() => {});
      } else if (orders.length === 0 && paymentRecordId) {
        await paymentRepo
          .updateById(paymentRecordId, {
            $set: {
              fulfillmentStatus: "FAILED",
              fulfillmentError: error.message,
            },
          })
          .catch(() => {});
      }

      for (const reservation of inventoryReservations.reverse()) {
        await inventoryService
          .unreserveStock(
            reservation.productId,
            reservation.variantId,
            reservation.quantity,
            reservation.orderId,
            userId
          )
          .catch(() => {});
      }

      throw error;
    }
  }
}

module.exports = new CheckoutService();
