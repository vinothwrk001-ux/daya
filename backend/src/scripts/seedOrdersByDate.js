const { logger } = require("../utils/logger");
require("dotenv").config();

const mongoose = require("mongoose");
const { connectDb } = require("../config/db");
const { Order } = require("../models/Order");
const { User } = require("../models/User");
const { Vendor } = require("../models/Vendor");

async function main() {
  try {
    await connectDb();
    logger.info("script_output", { value: "Connected to MongoDB" });

    // Find or create buyer
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

    // Get or create vendors
    let vendors = await Vendor.find({ status: "approved" }).limit(10);
    if (vendors.length < 10) {
      logger.info("script_output", { value: `Creating ${10 - vendors.length} test vendors...` });
      for (let i = vendors.length; i < 10; i++) {
        const vendorUser = await User.create({
          name: `Vendor ${i + 1}`,
          email: `vendor${i + 1}@test.com`,
          phone: `998877665${i}`,
          password: "Password123",
          role: "vendor",
          status: "active",
        });

        const vendor = await Vendor.create({
          userId: vendorUser._id,
          companyName: `Store ${i + 1}`,
          address: `${100 + i} Business St`,
          shopName: `Shop ${i + 1}`,
          storeSlug: `shop-${i + 1}`,
          status: "approved",
          stepCompleted: 4,
        });
        vendors.push(vendor);
      }
    }

    // Dates
    const april15 = new Date("2026-04-15T00:00:00Z");
    const april14 = new Date("2026-04-14T00:00:00Z");

    // Product data for variety
    const productDataSets = [
      [
        { name: "Smartphone", price: 25000, quantity: 1 },
        { name: "Phone Charger", price: 800, quantity: 2 },
      ],
      [
        { name: "Laptop", price: 55000, quantity: 1 },
        { name: "Laptop Bag", price: 2000, quantity: 1 },
      ],
      [
        { name: "Tablet", price: 18000, quantity: 1 },
        { name: "Screen Protector", price: 400, quantity: 3 },
      ],
      [
        { name: "Smartwatch", price: 12000, quantity: 1 },
        { name: "Watch Band", price: 1500, quantity: 2 },
      ],
      [
        { name: "Wireless Earbuds", price: 8000, quantity: 1 },
        { name: "Earbuds Case", price: 500, quantity: 1 },
      ],
    ];

    const dates = [
      { date: april15, label: "April 15" },
      { date: april14, label: "April 14" },
    ];

    let totalOrders = 0;
    let totalRevenue = 0;

    // Create 5 orders for each date
    for (const { date, label } of dates) {
      logger.info("script_output", { value: `\n📅 Creating orders for ${label}...` });

      for (let i = 0; i < 5; i++) {
        const productData = productDataSets[i];
        const orderTime = new Date(date.getTime() + i * 4 * 60 * 60 * 1000); // Space orders 4 hours apart

        const items = productData.map((p) => ({
          productId: new mongoose.Types.ObjectId(),
          name: p.name,
          price: p.price,
          quantity: p.quantity,
          image: "https://via.placeholder.com/300",
        }));

        const subtotal = productData.reduce((sum, p) => sum + p.price * p.quantity, 0);
        const shippingFee = 100;
        const taxAmount = Math.round(subtotal * 0.1);
        const totalAmount = subtotal + shippingFee + taxAmount;

        const order = await Order.create({
          orderNumber: `ORD-${date.getTime()}-${i + 1}`,
          userId: buyer._id,
          sellerId: vendors[i]._id,
          items,
          subtotal,
          shippingFee,
          taxAmount,
          totalAmount,
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

        logger.info("script_output", { value: `  ✅ Order ${i + 1}: ${order.orderNumber} - ₹${order.totalAmount}` });
        totalOrders++;
        totalRevenue += order.totalAmount;
      }
    }

    logger.info("script_output", { value: "\n" + "=".repeat(50) });
    logger.info("script_output", { value: "📊 SUMMARY" });
    logger.info("script_output", { value: "=".repeat(50) });
    logger.info("script_output", { value: `✅ Created ${totalOrders} orders` });
    logger.info("script_output", { value: `📈 Total Revenue: ₹${totalRevenue}` });
    logger.info("script_output", { value: `  - April 15: 5 orders` });
    logger.info("script_output", { value: `  - April 14: 5 orders` });

    process.exit(0);
  } catch (err) {
    logger.error("Error:", { error: err.message });
    process.exit(1);
  }
}

main();
