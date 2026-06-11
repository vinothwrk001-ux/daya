const { logger } = require("../utils/logger");
require("dotenv").config();

const mongoose = require("mongoose");
const { connectDb } = require("../config/db");
const { Order } = require("../models/Order");
const { User } = require("../models/User");

async function main() {
  try {
    await connectDb();
    logger.info("script_output", { value: "Connected to MongoDB" });

    // Find an existing user (buyer)
    let buyer = await User.findOne({ role: "user" });
    if (!buyer) {
      logger.info("script_output", { value: "Creating test buyer..." });
      buyer = await User.create({
        name: "Test Buyer",
        email: "buyer@test.com",
        phone: "9876543210",
        password: "Password123",
        role: "user",
        status: "active",
      });
    }

    // Yesterday's date
    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);

    // Create 4 orders for yesterday
    const orders = [];
    const orderData = [
      {
        products: [
          { name: "Laptop", price: 45000, quantity: 1 },
          { name: "Mouse", price: 500, quantity: 2 },
        ],
        subtotal: 46000,
        total: 47300,
      },
      {
        products: [
          { name: "Headphones", price: 3999, quantity: 1 },
          { name: "Phone Case", price: 299, quantity: 3 },
        ],
        subtotal: 4896,
        total: 5175,
      },
      {
        products: [
          { name: "Keyboard", price: 2499, quantity: 1 },
          { name: "Monitor", price: 15000, quantity: 1 },
        ],
        subtotal: 17499,
        total: 18249,
      },
      {
        products: [
          { name: "USB Cable", price: 199, quantity: 5 },
          { name: "Power Bank", price: 999, quantity: 1 },
        ],
        subtotal: 1894,
        total: 2079,
      },
    ];

    for (let i = 0; i < 4; i++) {
      const orderTime = new Date(yesterday.getTime() + i * 6 * 60 * 60 * 1000); // Space orders 6 hours apart
      const data = orderData[i];

      const items = data.products.map((p) => ({
        productId: new mongoose.Types.ObjectId(),
        name: p.name,
        price: p.price,
        quantity: p.quantity,
        image: "https://via.placeholder.com/300",
      }));

      const order = await Order.create({
        orderNumber: `ORD-${Date.now()}-${i + 1}`,
        userId: buyer._id,
        items,
        subtotal: data.subtotal,
        shippingFee: 150,
        taxAmount: Math.round(data.subtotal * 0.1),
        totalAmount: data.total,
        currency: "INR",
        status: "Delivered",
        paymentStatus: "Paid",
        paymentMethod: "ONLINE",
        deliveryStatus: "DELIVERED",
        shippingAddress: {
          fullName: "John Doe",
          phone: "9876543210",
          line1: "123 Main Street",
          line2: "Apt 4B",
          city: "Mumbai",
          state: "Maharashtra",
          postalCode: "400001",
          country: "India",
        },
        timeline: [
          { status: "Placed", note: "Order placed", changedAt: orderTime },
          { status: "Packed", note: "Order packed", changedAt: new Date(orderTime.getTime() + 4 * 60 * 60 * 1000) },
          { status: "Shipped", note: "Order shipped", changedAt: new Date(orderTime.getTime() + 8 * 60 * 60 * 1000) },
          { status: "Delivered", note: "Order delivered", changedAt: new Date(orderTime.getTime() + 24 * 60 * 60 * 1000) },
        ],
        deliveredAt: new Date(orderTime.getTime() + 24 * 60 * 60 * 1000),
        createdAt: orderTime,
        updatedAt: new Date(orderTime.getTime() + 24 * 60 * 60 * 1000),
      });

      orders.push(order);
      logger.info("script_output", { value: `✅ Order ${i + 1} created: ${order.orderNumber} - ₹${order.totalAmount}` });
    }

    logger.info("script_output", { value: "\n📊 Summary:" });
    logger.info("script_output", { value: `Created 4 orders for yesterday (${yesterday.toDateString()})` });
    const totalRevenue = orders.reduce((sum, o) => sum + o.totalAmount, 0);
    logger.info("script_output", { value: `Total Revenue: ₹${totalRevenue}` });

    process.exit(0);
  } catch (err) {
    logger.error("Error:", { error: err.message });
    process.exit(1);
  }
}

main();
