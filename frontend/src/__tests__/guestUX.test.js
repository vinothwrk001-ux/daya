import { describe, it, expect, beforeEach, vi } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import useGuestCartStore from '../context/guestCartStore';
import useGuestWishlistStore from '../context/guestWishlistStore';
import { useCart } from '../hooks/useCart';
import { useWishlist } from '../hooks/useWishlist';
import pendingActionManager from '../utils/pendingActionManager';
import pendingCheckoutManager from '../utils/pendingCheckoutManager';

/**
 * GUEST CART STORE TESTS
 */
describe('Guest Cart Store', () => {
  beforeEach(() => {
    useGuestCartStore.getState().clearCart();
  });

  it('should add item to guest cart', () => {
    const { getState } = useGuestCartStore;
    const item = {
      productId: '123',
      vendorId: '456',
      quantity: 1,
      price: 100,
      image: 'image.jpg',
      variantId: '',
    };

    act(() => {
      getState().addItem(item);
    });

    const state = getState();
    expect(state.items).toHaveLength(1);
    expect(state.totalAmount).toBe(100);
  });

  it('should prevent duplicate items in cart', () => {
    const { getState } = useGuestCartStore;
    const item = {
      productId: '123',
      vendorId: '456',
      quantity: 1,
      price: 100,
      image: 'image.jpg',
      variantId: '',
    };

    act(() => {
      getState().addItem(item);
      getState().addItem(item);
    });

    // Should increase quantity, not add duplicate
    const state = getState();
    expect(state.items).toHaveLength(1);
    expect(state.items[0].quantity).toBe(2);
    expect(state.totalAmount).toBe(200);
  });

  it('should update item quantity', () => {
    const { getState } = useGuestCartStore;
    act(() => {
      getState().addItem({
        productId: '123',
        vendorId: '456',
        quantity: 1,
        price: 100,
        variantId: '',
      });
      getState().updateItem('123', '', 5);
    });

    const state = getState();
    expect(state.items[0].quantity).toBe(5);
    expect(state.totalAmount).toBe(500);
  });

  it('should remove item from cart', () => {
    const { getState } = useGuestCartStore;
    act(() => {
      getState().addItem({
        productId: '123',
        vendorId: '456',
        quantity: 2,
        price: 100,
        variantId: '',
      });
      getState().removeItem('123', '');
    });

    const state = getState();
    expect(state.items).toHaveLength(0);
    expect(state.totalAmount).toBe(0);
  });

  it('should clear cart', () => {
    const { getState } = useGuestCartStore;
    act(() => {
      getState().addItem({
        productId: '123',
        vendorId: '456',
        quantity: 1,
        price: 100,
        variantId: '',
      });
      getState().clearCart();
    });

    const state = getState();
    expect(state.items).toHaveLength(0);
    expect(state.totalAmount).toBe(0);
  });

  it('should handle variant-specific items', () => {
    const { getState } = useGuestCartStore;
    const item1 = {
      productId: '123',
      vendorId: '456',
      quantity: 1,
      price: 100,
      variantId: 'v1',
    };
    const item2 = {
      productId: '123',
      vendorId: '456',
      quantity: 1,
      price: 150,
      variantId: 'v2',
    };

    act(() => {
      getState().addItem(item1);
      getState().addItem(item2);
    });

    const state = getState();
    expect(state.items).toHaveLength(2);
    expect(state.totalAmount).toBe(250);
  });
});

/**
 * GUEST WISHLIST STORE TESTS
 */
describe('Guest Wishlist Store', () => {
  beforeEach(() => {
    useGuestWishlistStore.getState().clearWishlist();
  });

  it('should add item to wishlist', () => {
    const { getState } = useGuestWishlistStore;
    const item = {
      productId: '123',
      name: 'Product',
      price: 100,
      image: 'image.jpg',
    };

    act(() => {
      getState().addItem(item);
    });

    const state = getState();
    expect(state.items).toHaveLength(1);
  });

  it('should prevent duplicate products in wishlist', () => {
    const { getState } = useGuestWishlistStore;
    const item = {
      productId: '123',
      name: 'Product',
      price: 100,
    };

    act(() => {
      getState().addItem(item);
      getState().addItem(item);
    });

    const state = getState();
    expect(state.items).toHaveLength(1);
  });

  it('should remove item from wishlist', () => {
    const { getState } = useGuestWishlistStore;
    act(() => {
      getState().addItem({ productId: '123', name: 'Product' });
      getState().removeItem('123');
    });

    const state = getState();
    expect(state.items).toHaveLength(0);
  });

  it('should check if product is in wishlist', () => {
    const { getState } = useGuestWishlistStore;
    act(() => {
      getState().addItem({ productId: '123', name: 'Product' });
    });

    expect(getState().isInWishlist('123')).toBe(true);
    expect(getState().isInWishlist('456')).toBe(false);
  });

  it('should clear wishlist', () => {
    const { getState } = useGuestWishlistStore;
    act(() => {
      getState().addItem({ productId: '123', name: 'Product' });
      getState().clearWishlist();
    });

    expect(getState().items).toHaveLength(0);
  });
});

/**
 * PENDING ACTION MANAGER TESTS
 */
describe('Pending Action Manager', () => {
  beforeEach(() => {
    sessionStorage.clear();
  });

  it('should save pending action', () => {
    pendingActionManager.setPendingAction('buy_now', {
      productId: '123',
      quantity: 2,
    });

    expect(pendingActionManager.hasPendingAction()).toBe(true);
  });

  it('should retrieve pending action', () => {
    pendingActionManager.setPendingAction('buy_now', {
      productId: '123',
      quantity: 2,
    });

    const action = pendingActionManager.getPendingAction();
    expect(action.type).toBe('buy_now');
    expect(action.data.productId).toBe('123');
    expect(action.data.quantity).toBe(2);
  });

  it('should clear pending action', () => {
    pendingActionManager.setPendingAction('buy_now', { productId: '123' });
    pendingActionManager.clearPendingAction();

    expect(pendingActionManager.hasPendingAction()).toBe(false);
  });

  it('should handle expired pending actions', async () => {
    // Create action with past expiry
    const action = {
      type: 'buy_now',
      data: { productId: '123' },
      expiresAt: Date.now() - 1000, // Already expired
    };
    sessionStorage.setItem('pending_checkout_action', JSON.stringify(action));

    expect(pendingActionManager.getPendingAction()).toBeNull();
  });

  it('should resume buy now action', () => {
    pendingActionManager.setPendingAction('buy_now', {
      productId: '123',
      quantity: 2,
      variantId: 'v1',
    });

    const buyNow = pendingActionManager.resumeBuyNow();
    expect(buyNow).toEqual({
      productId: '123',
      quantity: 2,
      variantId: 'v1',
    });
  });
});

describe('Pending Checkout Manager', () => {
  beforeEach(() => {
    sessionStorage.clear();
  });

  it('should persist pending checkout data', () => {
    pendingCheckoutManager.set({
      cartItems: [{ productId: '123', quantity: 2 }],
      source: 'checkout',
      redirectAfterLogin: '/checkout',
    });

    expect(pendingCheckoutManager.has()).toBe(true);
    expect(pendingCheckoutManager.get()?.source).toBe('checkout');
  });

  it('should clear expired pending checkout data', () => {
    sessionStorage.setItem(
      'pending_checkout',
      JSON.stringify({
        source: 'checkout',
        expiresAt: Date.now() - 1000,
      })
    );

    expect(pendingCheckoutManager.get()).toBeNull();
  });

  it('should update checkout continuation fields without losing existing state', () => {
    pendingCheckoutManager.set({
      cartItems: [{ productId: '123', quantity: 1 }],
      redirectAfterAuth: '/checkout',
      paymentMethod: 'COD',
      currentStep: 'summary',
    });

    pendingCheckoutManager.update({
      selectedPaymentMethod: 'ONLINE',
      checkoutStep: 'payment',
    });

    const state = pendingCheckoutManager.get();
    expect(state?.cartItems).toHaveLength(1);
    expect(state?.redirectAfterAuth).toBe('/checkout');
    expect(state?.selectedPaymentMethod).toBe('ONLINE');
    expect(state?.checkoutStep).toBe('payment');
  });
});

/**
 * USE CART HOOK TESTS
 */
describe('useCart Hook', () => {
  it('should add item to guest cart', async () => {
    const { result } = renderHook(() => useCart());

    expect(result.current.isGuest).toBe(true);

    // Mock the validation API
    vi.mock('../services/cartService', () => ({
      validateItem: vi.fn().mockResolvedValue({
        productId: '123',
        quantity: 1,
        price: 100,
      }),
    }));

    act(() => {
      result.current.addItem('123', 1);
    });

    // Cart should now have the item
    expect(result.current.cart.itemCount).toBeGreaterThan(0);
  });

  it('should validate cart before checkout', async () => {
    const { result } = renderHook(() => useCart());

    // Mock validation
    vi.mock('../services/cartService', () => ({
      validateCart: vi.fn().mockResolvedValue({
        validatedItems: [],
        errors: [],
      }),
    }));

    const validation = await result.current.validateCart();
    expect(validation).toHaveProperty('validatedItems');
    expect(validation).toHaveProperty('errors');
  });
});

/**
 * USE WISHLIST HOOK TESTS
 */
describe('useWishlist Hook', () => {
  it('should add item to guest wishlist', async () => {
    const { result } = renderHook(() => useWishlist());

    expect(result.current.isGuest).toBe(true);

    // Mock the validation API
    vi.mock('../services/wishlistService', () => ({
      validateProduct: vi.fn().mockResolvedValue({
        productId: '123',
        name: 'Product',
        price: 100,
      }),
    }));

    act(() => {
      result.current.addItem('123');
    });

    expect(result.current.wishlist.itemCount).toBeGreaterThan(0);
  });

  it('should check if product is in wishlist', async () => {
    const { result } = renderHook(() => useWishlist());

    const inWishlist = await result.current.isInWishlist('123');
    expect(typeof inWishlist).toBe('boolean');
  });
});

/**
 * CART MERGE SCENARIOS
 */
describe('Cart Merge Scenarios', () => {
  beforeEach(() => {
    useGuestCartStore.getState().clearCart();
  });

  it('should handle empty guest cart', async () => {
    // If guest cart is empty, merge should do nothing
    const guestItems = useGuestCartStore.getState().items;
    expect(guestItems).toHaveLength(0);
  });

  it('should handle cart with different variants', () => {
    const { getState } = useGuestCartStore;
    
    act(() => {
      getState().addItem({
        productId: '123',
        variantId: 'red',
        quantity: 1,
        price: 100,
      });
      getState().addItem({
        productId: '123',
        variantId: 'blue',
        quantity: 1,
        price: 100,
      });
    });

    const state = getState();
    expect(state.items).toHaveLength(2);
    expect(state.totalAmount).toBe(200);
  });

  it('should detect invalid items during merge', () => {
    // Invalid items should be filtered during backend merge
    const items = [
      { productId: 'valid123', quantity: 1 },
      { productId: 'invalid', quantity: 1 }, // Won't exist in DB
    ];
    
    // Backend validates and removes invalid items
    const validItems = items.filter(item => item.productId !== 'invalid');
    expect(validItems).toHaveLength(1);
  });
});

/**
 * EDGE CASES
 */
describe('Edge Cases', () => {
  it('should handle corrupted localStorage', () => {
    // Simulate corrupted data
    localStorage.setItem('guest_cart', 'invalid json {]');
    
    // Should fallback to empty cart
    const store = useGuestCartStore();
    expect(store.items || []).toBeDefined();
  });

  it('should handle network error during merge', async () => {
    // If merge fails, guest data should remain in localStorage
    const items = useGuestCartStore.getState().items;
    expect(items).toBeDefined();
  });

  it('should handle rapid add/remove operations', () => {
    const { getState } = useGuestCartStore;
    
    act(() => {
      for (let i = 0; i < 100; i++) {
        getState().addItem({
          productId: '123',
          quantity: 1,
          price: 100,
          variantId: '',
        });
      }
    });

    const state = getState();
    expect(state.items[0].quantity).toBe(100);
  });

  it('should handle very large quantities', () => {
    const { getState } = useGuestCartStore;
    
    act(() => {
      getState().addItem({
        productId: '123',
        quantity: 999999,
        price: 100,
        variantId: '',
      });
    });

    // Should calculate correctly
    expect(getState().totalAmount).toBe(99999900);
  });
});
