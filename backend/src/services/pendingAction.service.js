/**
 * Pending Action Service
 * Handles storing pending actions (like "Buy Now") that require authentication
 * User gets redirected to login, then completes action after login
 *
 * Actions are stored in MongoDB (optional, short-lived, with expiry)
 * Alternatively, frontend handles storage in sessionStorage for simplicity
 *
 * This service provides backend support for persistent action tracking
 */

const mongoose = require("mongoose");
const { v4: uuidv4 } = require("uuid");

const PendingActionSchema = new mongoose.Schema(
  {
    actionId: { type: String, default: uuidv4, index: true },
    sessionId: String, // Optional: track by session
    type: {
      type: String,
      enum: ["buy_now", "checkout", "wishlist_action"],
      required: true,
    },
    productId: mongoose.Schema.Types.ObjectId,
    quantity: { type: Number, default: 1 },
    variantId: String,
    selectedAttributes: mongoose.Schema.Types.Mixed,
    metadata: mongoose.Schema.Types.Mixed, // Additional context
    expiresAt: { type: Date, default: () => new Date(Date.now() + 30 * 60 * 1000) }, // 30 min expiry
  },
  { timestamps: true }
);

// Auto-delete expired documents
PendingActionSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

const PendingAction = mongoose.model("PendingAction", PendingActionSchema);

class PendingActionService {
  /**
   * Create a pending action
   * Returns actionId that can be passed via URL or stored in sessionStorage
   */
  async createAction(type, data = {}) {
    const action = new PendingAction({
      type,
      productId: data.productId,
      quantity: data.quantity || 1,
      variantId: data.variantId || "",
      selectedAttributes: data.selectedAttributes,
      metadata: data.metadata,
    });

    await action.save();
    return action.actionId;
  }

  /**
   * Retrieve pending action by ID
   */
  async getAction(actionId) {
    const action = await PendingAction.findOne({ actionId });
    return action;
  }

  /**
   * Complete pending action (delete it)
   */
  async completeAction(actionId) {
    const result = await PendingAction.findOneAndDelete({ actionId });
    return result;
  }

  /**
   * Delete expired action
   */
  async deleteAction(actionId) {
    await PendingAction.findOneAndDelete({ actionId });
  }

  /**
   * Clear all pending actions for a session (e.g., on logout)
   */
  async clearSessionActions(sessionId) {
    await PendingAction.deleteMany({ sessionId });
  }
}

module.exports = new PendingActionService();
