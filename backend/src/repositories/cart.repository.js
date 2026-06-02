const { Cart } = require("../models/Cart");

class CartRepository {
  async findByUserId(userId) {
    return await Cart.findOne({ userId })
      .populate("items.productId", "name slug images price discountPrice stock isActive status sellerId")
      .populate("items.sellerId", "companyName shopName storeSlug logoUrl status isStoreVisible")
      .exec();
  }

  async upsertEmpty(userId) {
    return await Cart.findOneAndUpdate(
      { userId },
      { $setOnInsert: { userId, items: [], totalAmount: 0 } },
      { returnDocument: "after", upsert: true }
    ).exec();
  }

  async save(cart) {
    return await cart.save();
  }

  async clear(userId) {
    return await Cart.findOneAndUpdate(
      { userId },
      { $set: { items: [], totalAmount: 0 } },
      { returnDocument: "after" }
    ).exec();
  }

  async removeMatchingItems(userId, purchasedItems = []) {
    const cart = await Cart.findOne({ userId }).exec();
    if (!cart || !Array.isArray(cart.items) || !cart.items.length) return cart;

    const keysToRemove = new Set(
      (Array.isArray(purchasedItems) ? purchasedItems : []).map((item) =>
        `${String(item.productId?._id || item.productId)}::${String(item.variantId || "")}`
      )
    );

    cart.items = cart.items.filter((item) => {
      const key = `${String(item.productId?._id || item.productId)}::${String(item.variantId || "")}`;
      return !keysToRemove.has(key);
    });

    cart.totalAmount = cart.items.reduce((sum, item) => {
      const price = Number(item.discountPrice || item.price || 0);
      const quantity = Number(item.quantity || 0);
      return sum + price * quantity;
    }, 0);

    return await cart.save();
  }
}

module.exports = new CartRepository();

