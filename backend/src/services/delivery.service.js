const { AppError } = require("../utils/AppError");
const orderRepo = require("../repositories/order.repository");
const logisticsService = require("./logistics.service");
const {
  applyShippingLifecycle,
  validateCourierName,
  validateTrackingId,
} = require("./shipping.service");

const SERVICEABLE_PINCODE_PATTERN = /^\d{6}$/;

function normalizePickupAddress() {
  const primary = {
    name: process.env.PLATFORM_PICKUP_NAME,
    phone: process.env.PLATFORM_PICKUP_PHONE,
    addressLine1: process.env.PLATFORM_PICKUP_ADDRESS_LINE1 || process.env.PLATFORM_PICKUP_ADDRESS,
    addressLine2: process.env.PLATFORM_PICKUP_ADDRESS_LINE2,
    city: process.env.PLATFORM_PICKUP_CITY,
    state: process.env.PLATFORM_PICKUP_STATE,
    pincode: process.env.PLATFORM_PICKUP_PINCODE,
    country: process.env.PLATFORM_PICKUP_COUNTRY || "India",
    latitude: process.env.PLATFORM_PICKUP_LATITUDE,
    longitude: process.env.PLATFORM_PICKUP_LONGITUDE,
  };

  if (!Object.values(primary).some(Boolean)) {
    throw new AppError(
      "Platform pickup address is missing. Configure PLATFORM_PICKUP_* values before requesting pickup.",
      400,
      "PICKUP_ADDRESS_MISSING"
    );
  }

  return {
    name: String(primary.name || "").trim(),
    phone: String(primary.phone || "").trim(),
    addressLine1: String(primary.addressLine1 || primary.address || "").trim(),
    addressLine2: String(primary.addressLine2 || "").trim(),
    city: String(primary.city || "").trim(),
    state: String(primary.state || "").trim(),
    pincode: String(primary.pincode || primary.postalCode || "").trim(),
    country: String(primary.country || "India").trim(),
    latitude: Number.isFinite(Number(primary.latitude)) ? Number(primary.latitude) : undefined,
    longitude: Number.isFinite(Number(primary.longitude)) ? Number(primary.longitude) : undefined,
  };
}

function assertPickupAddressIsComplete(pickupAddress) {
  const requiredFields = ["name", "phone", "addressLine1", "city", "state", "pincode", "country"];
  for (const field of requiredFields) {
    if (!pickupAddress[field]) {
      throw new AppError(`Platform pickup address is incomplete. Missing ${field}.`, 400, "PICKUP_ADDRESS_INCOMPLETE");
    }
  }

  if (!SERVICEABLE_PINCODE_PATTERN.test(pickupAddress.pincode)) {
    throw new AppError("Platform pickup pincode must be a valid 6-digit serviceable pincode.", 400, "PICKUP_PINCODE_INVALID");
  }
}

async function buildPlatformShipmentRequest(order) {
  const pickupAddress = normalizePickupAddress();
  assertPickupAddressIsComplete(pickupAddress);

  if (!order?.shippingAddress?.postalCode || !SERVICEABLE_PINCODE_PATTERN.test(String(order.shippingAddress.postalCode).trim())) {
    throw new AppError("Customer delivery pincode is invalid for platform shipping.", 400, "DELIVERY_PINCODE_INVALID");
  }

  return {
    provider: "SHIPROCKET",
    pickupAddress,
    deliveryAddress: {
      fullName: order.shippingAddress.fullName,
      phone: order.shippingAddress.phone,
      line1: order.shippingAddress.line1,
      line2: order.shippingAddress.line2 || "",
      city: order.shippingAddress.city,
      state: order.shippingAddress.state,
      postalCode: order.shippingAddress.postalCode,
      country: order.shippingAddress.country,
    },
    orderDetails: {
      orderId: order.orderNumber,
      orderDate: order.createdAt,
      paymentMethod: order.paymentMethod,
      subtotal: order.subtotal,
      customerEmail: order.userId?.email || process.env.SUPPORT_EMAIL || "support@example.com",
      items: (order.items || []).map((item) => {
        const itemWeight = Number(item?.weight?.value || 0);
        return {
          name: item.name,
          sku: item.variantSku || String(item.productId),
          units: item.quantity,
          sellingPrice: item.price,
          weight: itemWeight > 0 ? itemWeight : undefined,
        };
      }),
    },
  };
}

function buildShiprocketPayload(platformRequest) {
  const { orderDetails, deliveryAddress, pickupAddress } = platformRequest;
  const totalWeight = (orderDetails.items || []).reduce(
    (sum, item) => sum + Number(item.weight || 0) * Number(item.units || 0),
    0
  );
  return {
    order_id: orderDetails.orderId,
    order_date: new Date(orderDetails.orderDate).toISOString(),
    pickup_location: process.env.SHIPROCKET_PICKUP_LOCATION || pickupAddress.name || "Primary",
    comment: "Marketplace order shipment",
    billing_customer_name: deliveryAddress.fullName,
    billing_last_name: "",
    billing_address: deliveryAddress.line1,
    billing_address_2: deliveryAddress.line2 || "",
    billing_city: deliveryAddress.city,
    billing_pincode: deliveryAddress.postalCode,
    billing_state: deliveryAddress.state,
    billing_country: deliveryAddress.country,
    billing_email: orderDetails.customerEmail,
    billing_phone: deliveryAddress.phone,
    shipping_is_billing: true,
    order_items: (orderDetails.items || []).map((item) => ({
      name: item.name,
      sku: item.sku,
      units: item.units,
      selling_price: item.sellingPrice,
    })),
    payment_method: orderDetails.paymentMethod === "COD" ? "COD" : "Prepaid",
    sub_total: orderDetails.subtotal,
    length: 10,
    breadth: 10,
    height: 10,
    weight: totalWeight > 0 ? Number(totalWeight.toFixed(3)) : 1,
  };
}

class DeliveryService {
  async createShipment(order) {
    let resolvedOrder = order;
    if (typeof order === "string") {
      resolvedOrder = await orderRepo.findById(order);
      if (!resolvedOrder) throw new AppError("Order not found", 404, "NOT_FOUND");
    }
    if (!resolvedOrder) throw new AppError("Order not found", 404, "NOT_FOUND");
    const platformRequest = await buildPlatformShipmentRequest(resolvedOrder);
    const shipment = await logisticsService.createPlatformShipment({
      ...platformRequest,
      providerPayload: buildShiprocketPayload(platformRequest),
    });
    return {
      ...shipment,
      pickupAddress: platformRequest.pickupAddress,
    };
  }

  buildSelfShippingUpdate({ trackingId, courierName }) {
    const nextTrackingId = validateTrackingId(trackingId);
    const nextCourierName = validateCourierName(courierName);
    const lifecycle = applyShippingLifecycle({
      orderStatus: "Packed",
      shippingMode: "SELF",
      shippingStatus: "SHIPPED",
      pickupStatus: "NOT_REQUESTED",
    });

    return {
      trackingId: nextTrackingId,
      courierName: nextCourierName,
      deliveryPartner: nextCourierName,
      trackingUrl: "",
      ...lifecycle,
      deliveryStatus: "SHIPPED",
      courierAssignedAt: new Date(),
    };
  }

  buildPlatformShippingUpdate(order, shipment) {
    const lifecycle = applyShippingLifecycle({
      orderStatus: order.status,
      shippingMode: "PLATFORM",
      shippingStatus: "READY_FOR_PICKUP",
      pickupStatus: "NOT_REQUESTED",
    });

    return {
      shipmentId: shipment.shipmentId,
      trackingId: shipment.trackingId || order.trackingId,
      trackingUrl: shipment.trackingUrl || order.trackingUrl,
      courierName: shipment.courierName || order.courierName,
      deliveryPartner: shipment.provider,
      logisticsProvider: shipment.provider,
      pickupAddressSnapshot: shipment.pickupAddress,
      logisticsMetadata: shipment.raw,
      pickupScheduled: false,
      pickupBatchId: "",
      pickupStatus: lifecycle.pickupStatus,
      pickupRequestedAt: new Date(),
      shippingMode: "PLATFORM",
      shippingStatus: lifecycle.shippingStatus,
      status: lifecycle.status,
      deliveryStatus: order.deliveryStatus,
      courierAssignedAt: new Date(),
    };
  }
}

module.exports = new DeliveryService();
