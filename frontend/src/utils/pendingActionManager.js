/**
 * Pending Action Manager
 * Handles storing and retrieving pending checkout actions before login
 *
 * Used for "Buy Now" flow:
 * Guest user clicks "Buy Now" -> Save pending action -> Redirect to login
 * After login -> Resume pending action -> Proceed to checkout
 */

const PENDING_ACTION_KEY = "pending_checkout_action";
const PENDING_ACTION_EXPIRY_KEY = "pending_action_expiry";
const ACTION_EXPIRY_TIME = 30 * 60 * 1000; // 30 minutes

export const pendingActionManager = {
  /**
   * Save pending action to sessionStorage
   * @param {string} type - Type of action ('buy_now', 'checkout', etc)
   * @param {object} data - Action data (productId, quantity, variantId, etc)
   */
  setPendingAction: (type, data) => {
    const action = {
      type,
      data,
      createdAt: Date.now(),
      expiresAt: Date.now() + ACTION_EXPIRY_TIME,
    };

    try {
      sessionStorage.setItem(PENDING_ACTION_KEY, JSON.stringify(action));
      sessionStorage.setItem(PENDING_ACTION_EXPIRY_KEY, action.expiresAt.toString());
    } catch (err) {
      console.error("Failed to save pending action:", err);
    }
  },

  /**
   * Get pending action from sessionStorage
   */
  getPendingAction: () => {
    try {
      const actionStr = sessionStorage.getItem(PENDING_ACTION_KEY);
      if (!actionStr) return null;

      const action = JSON.parse(actionStr);

      // Check if expired
      if (action.expiresAt && action.expiresAt < Date.now()) {
        pendingActionManager.clearPendingAction();
        return null;
      }

      return action;
    } catch (err) {
      console.error("Failed to get pending action:", err);
      return null;
    }
  },

  /**
   * Clear pending action
   */
  clearPendingAction: () => {
    try {
      sessionStorage.removeItem(PENDING_ACTION_KEY);
      sessionStorage.removeItem(PENDING_ACTION_EXPIRY_KEY);
    } catch (err) {
      console.error("Failed to clear pending action:", err);
    }
  },

  /**
   * Check if there's a pending action
   */
  hasPendingAction: () => {
    const action = pendingActionManager.getPendingAction();
    return action !== null;
  },

  /**
   * Execute pending "buy now" action
   * Returns object with productId, quantity, variantId for checkout
   */
  resumeBuyNow: () => {
    const action = pendingActionManager.getPendingAction();
    if (!action || action.type !== "buy_now") return null;

    return {
      productId: action.data.productId,
      quantity: action.data.quantity || 1,
      variantId: action.data.variantId || "",
    };
  },

  consumePendingAction: () => {
    const action = pendingActionManager.getPendingAction();
    if (!action) return null;
    pendingActionManager.clearPendingAction();
    return action;
  },

  /**
   * Trigger "Buy Now" action for guest user
   * Saves pending action and returns flag to redirect to login
   */
  initiateGuestBuyNow: (productId, quantity = 1, variantId = "") => {
    pendingActionManager.setPendingAction("buy_now", {
      productId,
      quantity,
      variantId,
    });
    return true;
  },

  initiateGuestCheckout: (source = "cart") => {
    pendingActionManager.setPendingAction("checkout", { source });
    return true;
  },
};

export default pendingActionManager;
