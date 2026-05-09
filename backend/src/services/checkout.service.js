const crypto = require("crypto");
const mongoose = require("mongoose");
const { AppError } = require("../utils/AppError");
const cartRepo = require("../repositories/cart.repository");
const productRepo = require("../repositories/product.repository");
const orderRepo = require("../repositories/order.repository");
const payoutRepo = require("../repositories/payout.repository");
const paymentRepo = require("../repositories/payment.repository");
const userRepo = require("../repositories/user.repository");
const vendorRepo = require("../repositories/vendor.repository");
const { getCommissionPercentage } = require("./finance-config.service");
const { resolveVendorShippingModes } = require("./shipping.service");
const pricingService = require("./pricing.service");
const { getItemWeight } = require("../utils/cartWeightCalculator");
const notificationService = require("./notification.service");
const trackingService = require("../modules/tracking/service");
const commissionService = require("../modules/commission/service");
const { emitDomainEvent } = require("../modules/events/event-bus");
const { INFLUENCER_EVENTS } = require("../modules/shared/constants");
const { logger } = require("../utils/logger");
const inventoryService = require("./inventory.service");
const { buildOrderSnapshot, generateInvoiceNumber } = require("./order-document.service");

function asObjectId(id, fieldName) {
  if (!mongoose.isValidObjectId(id)) throw new AppError(`Invalid ${fieldName}`, 400, "VALIDATION_ERROR");
  return id;
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

function groupBySeller(items = []) {
  const map = new Map();
  for (const it of items) {
    const key = String(it.sellerId);
    if (!map.has(key)) map.set(key, { sellerId: it.sellerId, items: [] });
    map.get(key).items.push(it);
  }
  return map;
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

function buildSummaryShape({ currency, sellers, subtotal, charges, chargesTotal, total, itemCount, shipping, paymentMethod }) {
  return {
    currency,
    sellers,
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

function calculateAttributionCommission({ subtotal, commissionPercent, platformCommissionAmount }) {
  const gross = roundMoney(subtotal || 0);
  const influencerShare = roundMoney((gross * Number(commissionPercent || 0)) / 100);
  const platformFee = roundMoney(platformCommissionAmount || 0);
  const vendorNet = roundMoney(gross - platformFee - influencerShare);
  return {
    gross,
    platformFee,
    influencerShare,
    vendorNet: vendorNet < 0 ? 0 : vendorNet,
    commissionPercent: Number(commissionPercent || 0),
  };
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

function buildSellerShippingShares(items = [], shippingFee = 0) {
  if (!Array.isArray(items) || items.length === 0 || shippingFee <= 0) {
    return new Map();
  }

  const weightsBySeller = new Map();
  let totalWeight = 0;

  for (const item of items) {
    const sellerKey = String(item.sellerId);
    const itemWeight = getItemWeight(item) * Number(item.quantity || 0);
    totalWeight += itemWeight;
    weightsBySeller.set(sellerKey, (weightsBySeller.get(sellerKey) || 0) + itemWeight);
  }

  const sellerIds = Array.from(weightsBySeller.keys());
  if (sellerIds.length === 0) {
    return new Map();
  }

  const shares = new Map();
  let assigned = 0;
  sellerIds.forEach((sellerId, index) => {
    const rawShare =
      totalWeight > 0
        ? shippingFee * ((weightsBySeller.get(sellerId) || 0) / totalWeight)
        : shippingFee / sellerIds.length;
    const roundedShare =
      index === sellerIds.length - 1
        ? Math.round((shippingFee - assigned) * 100) / 100
        : Math.round(rawShare * 100) / 100;
    assigned = Math.round((assigned + roundedShare) * 100) / 100;
    shares.set(sellerId, roundedShare);
  });

  return shares;
}

async function resolveSellerIdForProduct(product) {
  if (product?.sellerId) return product.sellerId;
  if (product?.creatorType === "ADMIN" && product?.createdBy?._id) {
    const vendor = await vendorRepo.upsertByUserId(product.createdBy._id, {
      status: "approved",
      stepCompleted: 4,
      companyName: "Platform Store",
      shopName: "Platform Store",
      storeDescription: "Products sold directly by the platform.",
    });
    return vendor._id;
  }
  return null;
}

class CheckoutService {
  async prepare(userId, { currency, shippingAddress, paymentMethod } = {}) {
    const cart = await cartRepo.findByUserId(userId);
    if (!cart || !Array.isArray(cart.items) || cart.items.length === 0) {
      throw new AppError("Cart is empty", 400, "EMPTY_CART");
    }
    const user = await userRepo.findById(userId);

    const validated = [];
    const validatedWithProducts = []; // Keep full product data for shipping calculation

    for (const item of cart.items) {
      asObjectId(item.productId, "productId");
      const product = await productRepo.findById(item.productId);
      if (!product) throw new AppError("Product not found", 404, "NOT_FOUND");
      if (product.status !== "APPROVED" || product.isActive !== true) {
        throw new AppError(`Product not available: ${product.name}`, 400, "NOT_AVAILABLE");
      }
      const variant = resolveVariant(product, item.variantId);
      const stockSnapshot = await inventoryService.getAvailableStock(product._id, variant?.variantId || item.variantId || "");
      const availableStock = Number(stockSnapshot.available || 0);
      if (availableStock < item.quantity) {
        throw new AppError(`Out of stock: ${product.name}`, 400, "INSUFFICIENT_STOCK");
      }
      const resolvedSellerId = await resolveSellerIdForProduct(product);
      if (!resolvedSellerId) throw new AppError("Seller not found for product", 400, "INVALID_PRODUCT");

      const itemData = {
        productId: product._id,
        sellerId: resolvedSellerId,
        name: product.name,
        image:
          variant?.images?.find((image) => image.isPrimary)?.url ||
          variant?.images?.[0]?.url ||
          item.image ||
          (Array.isArray(product.images) && product.images.length ? product.images[0]?.url : undefined),
        quantity: item.quantity,
        price: Number(variant?.discountPrice || variant?.price || product.discountPrice || product.price || 0),
        maxAvailable: availableStock,
        variantId: variant?.variantId || item.variantId || "",
        variantSku: variant?.sku || item.variantSku || "",
        variantTitle: variant?.title || item.variantTitle || "",
        variantAttributes: variant?.attributes || item.variantAttributes || {},
        weight: getProductWeightSnapshot(product, variant),
      };

      validated.push(itemData);

      // For shipping calculation, include product data
      validatedWithProducts.push({
        ...itemData,
        product, // Include full product for weight extraction
      });
    }

    const bySeller = groupBySeller(validated);
    const sellers = Array.from(bySeller.values()).map((sellerData) => {
      const items = sellerData.items;
      const subtotal = items.reduce((sum, it) => sum + it.price * it.quantity, 0);
      return { sellerId: sellerData.sellerId, items, subtotal };
    });

    const subtotal = sellers.reduce((sum, s) => sum + s.subtotal, 0);
    const totalItemCount = validated.reduce((sum, item) => sum + item.quantity, 0);

    // Calculate pricing with shipping if address is provided
    let pricingBreakdown;
    let shippingData = null;

    if (shippingAddress) {
      try {
        pricingBreakdown = await pricingService.calculateOrderTotalWithShipping(
          subtotal,
          validatedWithProducts,
          shippingAddress,
          totalItemCount,
          { paymentMethod }
        );
        
        shippingData = pricingBreakdown.shipping || null;
      } catch (error) {
        // If shipping calculation fails, fall back to regular pricing
        console.error("Shipping calculation error:", error.message);
        pricingBreakdown = await pricingService.calculateOrderTotal(subtotal, totalItemCount, paymentMethod);
      }
    } else {
      // No shipping address provided, use regular pricing
      pricingBreakdown = await pricingService.calculateOrderTotal(subtotal, totalItemCount, paymentMethod);
    }

    return buildSummaryShape({
      currency: currency || cart.currency || "INR",
      sellers,
      subtotal,
      charges: pricingBreakdown.charges,
      chargesTotal: pricingBreakdown.chargesTotal,
      total: pricingBreakdown.total,
      itemCount: totalItemCount,
      shipping: shippingData,
      paymentMethod: pricingBreakdown.paymentMethod,
    });
  }

  async createOrder(
    userId,
    {
      shippingAddress,
      paymentMethod = "ONLINE",
      paymentRecordId = null,
      orderGroupId = null,
      paymentStatus,
      razorpayOrderId = "",
      razorpayPaymentId = "",
      fraudFlags = [],
      trackingToken = null,
    } = {}
  ) {
    if (!shippingAddress) {
      throw new AppError("Shipping address is required", 400, "MISSING_ADDRESS");
    }

    if (!["ONLINE", "COD"].includes(paymentMethod)) {
      throw new AppError("Invalid payment method", 400, "INVALID_PAYMENT_METHOD");
    }

    const cart = await cartRepo.findByUserId(userId);
    if (!cart || !Array.isArray(cart.items) || cart.items.length === 0) {
      throw new AppError("Cart is empty", 400, "EMPTY_CART");
    }
    const user = await userRepo.findById(userId);
    if (!user) {
      throw new AppError("User not found", 404, "NOT_FOUND");
    }

      const validated = [];
      const trackingContext = trackingToken ? await trackingService.validateTrackingToken(trackingToken, userId) : null;
      for (const item of cart.items) {
        const product = await productRepo.findById(item.productId);
        if (!product) throw new AppError("Product not found", 404, "NOT_FOUND");
        if (product.status !== "APPROVED" || product.isActive !== true) {
          throw new AppError(`Product not available: ${product.name}`, 400, "NOT_AVAILABLE");
        }
        const variant = resolveVariant(product, item.variantId);
        const stockSnapshot = await inventoryService.getAvailableStock(product._id, variant?.variantId || item.variantId || "");
        const availableStock = Number(stockSnapshot.available || 0);
        if (availableStock < item.quantity) {
          throw new AppError(`Out of stock: ${product.name}`, 400, "INSUFFICIENT_STOCK");
        }
        const resolvedSellerId = await resolveSellerIdForProduct(product);
        if (!resolvedSellerId) throw new AppError("Seller not found for product", 400, "INVALID_PRODUCT");

        validated.push({
          productId: product._id,
          sellerId: resolvedSellerId,
          name: product.name,
          price: Number(variant?.discountPrice || variant?.price || product.discountPrice || product.price || 0),
          quantity: item.quantity,
          image:
            variant?.images?.find((image) => image.isPrimary)?.url ||
            variant?.images?.[0]?.url ||
            item.image ||
            (Array.isArray(product.images) && product.images.length ? product.images[0]?.url : undefined),
          variantId: variant?.variantId || item.variantId || "",
          variantSku: variant?.sku || item.variantSku || "",
          variantTitle: variant?.title || item.variantTitle || "",
          variantAttributes: variant?.attributes || item.variantAttributes || {},
          weight: getProductWeightSnapshot(product, variant),
        });
      }

      const bySeller = groupBySeller(validated);
      const orderPayloads = [];
      const commissionPercentage = await getCommissionPercentage();
      const resolvedGroupId = orderGroupId || generateOrderGroupId();
      const resolvedPaymentStatus = paymentStatus || (paymentMethod === "ONLINE" ? "Paid" : "Pending");
      const totalItemCount = validated.reduce((sum, item) => sum + item.quantity, 0);

      // Calculate total pricing for the entire order
      let overallSubtotal = 0;
      for (const sellerData of bySeller.values()) {
        const items = sellerData.items;
        const subtotal = items.reduce((sum, it) => sum + it.price * it.quantity, 0);
        overallSubtotal += subtotal;
      }

      // Prepare validated items with full product data for shipping calculation
      const validatedWithProducts = [];
      for (const item of validated) {
        const product = await productRepo.findById(item.productId);
        if (product) {
          validatedWithProducts.push({
            ...item,
            product,
          });
        }
      }

      // Get pricing breakdown with shipping for entire order
      let pricingBreakdown;
      try {
        pricingBreakdown = await pricingService.calculateOrderTotalWithShipping(
          overallSubtotal,
          validatedWithProducts,
          shippingAddress,
          totalItemCount,
          { paymentMethod }
        );
      } catch (error) {
        // If shipping calculation fails, fall back to regular pricing
        console.error("Shipping calculation error in createOrder:", error.message);
        pricingBreakdown = await pricingService.calculateOrderTotal(overallSubtotal, totalItemCount, paymentMethod);
      }

    const chargesBreakdown = pricingBreakdown.charges || [];
    const shippingCharge = chargesBreakdown.find((c) => c.key === "shipping_cost");
    const platformFeeCharge = chargesBreakdown.find((c) => c.key === "platform_fee");
    const taxCharge = chargesBreakdown.find((c) => c.key === "tax");
    const discountCharge = chargesBreakdown.find((c) => c.key === "discount");
    const shippingFee = shippingCharge?.amount || 0;
    const shippingShares = buildSellerShippingShares(validatedWithProducts, shippingFee);

    for (const sellerData of bySeller.values()) {
      const vendor = await vendorRepo.findById(sellerData.sellerId);
      const vendorShipping = await resolveVendorShippingModes(vendor);
      const items = sellerData.items;
      const cleanedItems = items.map((it) => ({
        productId: it.productId,
        name: it.name,
        price: it.price,
        quantity: it.quantity,
        image: it.image,
        variantId: it.variantId,
        variantSku: it.variantSku,
        variantTitle: it.variantTitle,
        variantAttributes: it.variantAttributes,
        weight: it.weight || undefined,
      }));

      const subtotal = items.reduce((sum, it) => sum + it.price * it.quantity, 0);
      const sellerShippingFee = shippingShares.get(String(sellerData.sellerId)) || 0;
      
      // Calculate this seller's share of charges proportionally
      const sellerChargeShare = chargesBreakdown.length > 0 
        ? pricingBreakdown.chargesTotal * (overallSubtotal > 0 ? subtotal / overallSubtotal : 1 / bySeller.size)
        : 0;
      
      const totalAmount = subtotal + sellerChargeShare;
      const commission = Number(((totalAmount * commissionPercentage) / 100).toFixed(2));
      let sellerAmount = Number((totalAmount - commission).toFixed(2));
      let attribution = undefined;

      if (trackingContext) {
        const matchedItem = items.find((item) => String(item.productId) === String(trackingContext.session.productId));
        if (matchedItem) {
          const campaign = await require("../modules/campaign/model").Campaign.findById(trackingContext.session.campaignId).lean();
          const frozenCommissionPercent = Number(campaign?.termsFrozen?.commissionPercent ?? campaign?.commissionPercent ?? 0);
          const finalCommission = calculateAttributionCommission({
            subtotal,
            commissionPercent: frozenCommissionPercent,
            platformCommissionAmount: commission,
          });

          sellerAmount = finalCommission.vendorNet;
          attribution = {
            influencerId: trackingContext.session.influencerId,
            campaignId: trackingContext.session.campaignId,
            reelId: trackingContext.session.reelId,
            trackingSessionId: trackingContext.session._id,
            productId: trackingContext.session.productId,
            commission: finalCommission,
          };
        }
      }

      const orderNumber = generateOrderNumber();
      const invoiceNumber = generateInvoiceNumber({ orderNumber });
      const orderPayload = {
        _id: new mongoose.Types.ObjectId(),
        orderNumber,
        invoiceNumber,
        userId: new mongoose.Types.ObjectId(userId),
        sellerId: sellerData.sellerId,
        items: cleanedItems,
        subtotal,
        shippingFee: Math.round(sellerShippingFee * 100) / 100,
        platformFee: Math.round((platformFeeCharge?.amount || 0) * (overallSubtotal > 0 ? subtotal / overallSubtotal : 1 / bySeller.size) * 100) / 100,
        taxAmount: Math.round((taxCharge?.amount || 0) * (overallSubtotal > 0 ? subtotal / overallSubtotal : 1 / bySeller.size) * 100) / 100,
        discountAmount: Math.round((discountCharge?.amount || 0) * (overallSubtotal > 0 ? subtotal / overallSubtotal : 1 / bySeller.size) * 100) / 100,
        chargesBreakdown: chargesBreakdown,
        pricingSnapshot: {
          subtotal: roundMoney(subtotal),
          charges: chargesBreakdown,
          chargesTotal: Math.round(sellerChargeShare * 100) / 100,
          total: roundMoney(totalAmount),
          paymentMethod,
          calculatedAt: pricingBreakdown.calculatedAt ? new Date(pricingBreakdown.calculatedAt) : new Date(),
        },
        chargesTotal: Math.round(sellerChargeShare * 100) / 100,
        totalAmount,
        platformCommissionRate: commissionPercentage,
        platformCommissionAmount: commission,
        vendorEarning: sellerAmount,
        currency: "INR",
        status: "Placed",
        paymentStatus: resolvedPaymentStatus,
        paymentMethod,
        shippingAddress,
        billingAddress: shippingAddress,
        paymentRecordId: paymentRecordId || undefined,
        orderGroupId: resolvedGroupId,
        razorpayOrderId: razorpayOrderId || undefined,
        razorpayPaymentId: razorpayPaymentId || undefined,
        paymentCapturedAt: resolvedPaymentStatus === "Paid" ? new Date() : undefined,
        fraudFlags,
        shippingMode: vendorShipping.defaultShippingMode,
        shippingStatus: "NOT_SHIPPED",
        pickupStatus: "NOT_REQUESTED",
        attribution,
        timeline: [{ status: "Placed", note: "Order placed", timestamp: new Date() }],
        inventoryReservedAt: new Date(),
      };

      orderPayload.orderSnapshot = buildOrderSnapshot(orderPayload, {
        user,
        seller: vendor,
        paymentRecord: {
          method: paymentMethod,
          razorpayOrderId: razorpayOrderId || "",
          razorpayPaymentId: razorpayPaymentId || "",
          paidAt: resolvedPaymentStatus === "Paid" ? new Date() : null,
        },
      });

      orderPayloads.push(orderPayload);
    }

    const inventoryReservations = [];
    let orders = [];
    let payment = null;
    const payouts = [];

    try {
      for (const orderPayload of orderPayloads) {
        for (const item of orderPayload.items || []) {
          await inventoryService.reserveStock(
            item.productId,
            item.variantId || "",
            item.quantity,
            orderPayload._id,
            orderPayload.sellerId,
            userId
          );
          inventoryReservations.push({
            productId: item.productId,
            variantId: item.variantId || "",
            quantity: item.quantity,
            orderId: orderPayload._id,
            sellerId: orderPayload.sellerId,
          });
        }
      }

      orders = await orderRepo.createMany(orderPayloads);

      if (paymentRecordId) {
        payment = await paymentRepo.updateById(paymentRecordId, {
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
      } else if (paymentMethod === "COD") {
        const totalAmount = orders.reduce((sum, order) => sum + Number(order.totalAmount || 0), 0);
        payment = await paymentRepo.create({
          userId,
          orderIds: orders.map((order) => order._id),
          orderGroupId: resolvedGroupId,
          amount: totalAmount,
          currency: "INR",
          method: "COD",
          status: "PENDING",
          fulfillmentStatus: "COMPLETED",
          fulfilledAt: new Date(),
          shippingAddress,
          amountBreakdown: buildAmountBreakdownSnapshot({
            subtotal: overallSubtotal,
            shippingFee,
            taxAmount: taxCharge?.amount || 0,
            totalAmount,
            paymentMethod: "COD",
          }),
        });

        for (const order of orders) {
          await orderRepo.updateById(order._id, { paymentRecordId: payment._id, orderGroupId: resolvedGroupId });
        }
      }

      for (const order of orders) {
        const payout = await runNonBlocking(`create payout for order ${order.orderNumber}`, () =>
          payoutRepo.create({
            sellerId: order.sellerId,
            orderId: order._id,
            amount: order.totalAmount,
            commission: order.platformCommissionAmount,
            netAmount: order.vendorEarning,
            status: "ON_HOLD",
            notes: "Awaiting delivery confirmation and payout eligibility window.",
          })
        );
        if (payout) {
          payouts.push(payout);
        }
      }

      await cartRepo.clear(userId);

      for (const order of orders) {
        await runNonBlocking(`emit order-created event for ${order.orderNumber}`, () =>
          emitDomainEvent(INFLUENCER_EVENTS.ORDER_CREATED, {
            orderId: order._id,
            attribution: order.attribution || null,
          })
        );

        if (order.attribution?.influencerId) {
          await runNonBlocking(`create commission hold for ${order.orderNumber}`, () =>
            commissionService.createHoldRecord(order)
          );
        }
      }

      await runNonBlocking("notify vendor and operations for created orders", () =>
        Promise.all(
          orders.map((order) =>
            notificationService.notifyVendorAndOperations({
              vendorId: order.sellerId,
              permissionKey: "orders.read",
              module: "MANAGEMENT",
              subModule: "ORDERS",
              type: "ORDER_CREATED",
              title: "New order",
              message: `Order ${order.orderNumber} was placed successfully.`,
              referenceId: order._id,
              meta: {
                orderNumber: order.orderNumber,
                paymentMethod: order.paymentMethod,
                totalAmount: order.totalAmount,
              },
            })
          )
        )
      );

      const freshOrders = await runNonBlocking(`reload orders for group ${resolvedGroupId}`, () =>
        orderRepo.findByGroupId(resolvedGroupId)
      );
      return { orders: Array.isArray(freshOrders) && freshOrders.length ? freshOrders : orders, payouts, payment, orderGroupId: resolvedGroupId };
    } catch (error) {
      for (const payout of payouts) {
        await payoutRepo
          .updateById(payout._id, {
            $set: {
              status: "CANCELLED",
              notes: "Rolled back after order creation failure.",
            },
          })
          .catch(() => {});
      }

      if (orders.length === 0 && paymentMethod === "COD" && payment?._id) {
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
            reservation.sellerId,
            userId
          )
          .catch(() => {});
      }

      throw error;
    }
  }
}

module.exports = new CheckoutService();
