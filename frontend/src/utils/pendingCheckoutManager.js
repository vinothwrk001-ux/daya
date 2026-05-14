const PENDING_CHECKOUT_KEY = "pending_checkout";
const PENDING_CHECKOUT_EXPIRY_MS = 30 * 60 * 1000;

function safeParse(value) {
  try {
    return JSON.parse(value);
  } catch {
    return null;
  }
}

export const pendingCheckoutManager = {
  set(payload = {}) {
    const record = {
      ...payload,
      createdAt: Date.now(),
      expiresAt: Date.now() + PENDING_CHECKOUT_EXPIRY_MS,
    };

    try {
      sessionStorage.setItem(PENDING_CHECKOUT_KEY, JSON.stringify(record));
    } catch {
      // Ignore session storage failures gracefully.
    }

    return record;
  },

  get() {
    try {
      const raw = sessionStorage.getItem(PENDING_CHECKOUT_KEY);
      if (!raw) return null;
      const record = safeParse(raw);
      if (!record) return null;
      if (record.expiresAt && record.expiresAt < Date.now()) {
        pendingCheckoutManager.clear();
        return null;
      }
      return record;
    } catch {
      return null;
    }
  },

  has() {
    return Boolean(pendingCheckoutManager.get());
  },

  update(patch = {}) {
    const current = pendingCheckoutManager.get();
    return pendingCheckoutManager.set({
      ...(current || {}),
      ...patch,
    });
  },

  clear() {
    try {
      sessionStorage.removeItem(PENDING_CHECKOUT_KEY);
    } catch {
      // Ignore session storage failures gracefully.
    }
  },
};

export default pendingCheckoutManager;
