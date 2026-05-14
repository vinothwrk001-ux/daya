# Guest User Experience System - Implementation Guide

## Overview
This document provides comprehensive guidance for integrating the guest user experience system into your ecommerce frontend. All backend services are production-ready; this guide focuses on frontend integration.

## Quick Start

### 1. Import New Stores and Hooks in Your Components

```javascript
import useGuestCartStore from '../context/guestCartStore';
import useGuestWishlistStore from '../context/guestWishlistStore';
import { useCart } from '../hooks/useCart';
import { useWishlist } from '../hooks/useWishlist';
import pendingActionManager from '../utils/pendingActionManager';
import cartMerger from '../utils/cartMerger';
```

### 2. Update ProductDetailsPage

**What to change:**
- Allow guests to add to cart without login
- Show "Buy Now" button that redirects unauthenticated users to login
- Allow guests to add to wishlist

**Key code:**
```javascript
import { useCart } from '../hooks/useCart';
import { useWishlist } from '../hooks/useWishlist';
import pendingActionManager from '../utils/pendingActionManager';
import { useNavigate } from 'react-router-dom';

export default function ProductDetailsPage() {
  const { isAuthenticated } = useAuthStore();
  const { addItem } = useCart();
  const { addItem: addToWishlist, isInWishlist } = useWishlist();
  const navigate = useNavigate();
  const [productId, setProductId] = useState(params.productId);
  const [quantity, setQuantity] = useState(1);

  const handleAddToCart = async () => {
    try {
      await addItem(productId, quantity);
      // Show success toast
    } catch (err) {
      // Show error toast
    }
  };

  const handleBuyNow = () => {
    if (!isAuthenticated) {
      // Save pending action and redirect to login
      pendingActionManager.initiateGuestBuyNow(productId, quantity);
      navigate('/login?redirect=/checkout');
      return;
    }
    // Proceed to checkout for authenticated users
    navigate('/checkout');
  };

  const handleAddToWishlist = async () => {
    try {
      await addToWishlist(productId);
      // Show success toast
    } catch (err) {
      // Show error toast
    }
  };

  return (
    <div>
      {/* Product details */}
      <button onClick={handleAddToCart}>Add to Cart</button>
      <button onClick={handleBuyNow}>Buy Now</button>
      <button onClick={handleAddToWishlist}>
        {await isInWishlist(productId) ? '❤️' : '🤍'} Add to Wishlist
      </button>
    </div>
  );
}
```

### 3. Update CartPage

**What to change:**
- Show both guest and authenticated carts
- For guests: show localStorage cart
- Add validation before checkout
- Show login prompt for guests

**Key code:**
```javascript
import { useCart } from '../hooks/useCart';
import { useAuthStore } from '../context/authStore';

export default function CartPage() {
  const { isAuthenticated } = useAuthStore();
  const { cart, isGuest, validateCart, loading, error } = useCart();
  const [validationErrors, setValidationErrors] = useState([]);
  const navigate = useNavigate();

  const handleCheckout = async () => {
    if (!isAuthenticated) {
      // Guests must login first
      navigate('/login?redirect=/checkout');
      return;
    }

    // Validate cart before checkout
    try {
      const validation = await validateCart();
      if (validation.errors.length > 0) {
        setValidationErrors(validation.errors);
        // Show which items are invalid
        return;
      }
      navigate('/checkout');
    } catch (err) {
      // Show error
    }
  };

  return (
    <div>
      {isGuest && (
        <div className="guest-notice">
          <p>Browse freely! Login required only at checkout.</p>
        </div>
      )}
      
      {/* Render cart items */}
      {cart.items.map(item => (
        <div key={`${item.productId}-${item.variantId}`}>
          {/* Item details */}
        </div>
      ))}

      {validationErrors.length > 0 && (
        <div className="error-banner">
          {validationErrors.map(err => (
            <p key={err.productId}>{err.error}</p>
          ))}
        </div>
      )}

      <button onClick={handleCheckout} disabled={loading || cart.items.length === 0}>
        {isGuest ? 'Proceed to Login' : 'Checkout'}
      </button>
    </div>
  );
}
```

### 4. Update LoginPage

**What to change:**
- After successful login, merge guest cart and wishlist
- Handle pending "Buy Now" action
- Redirect appropriately after merge

**Key code:**
```javascript
import { useAuthStore } from '../context/authStore';
import { mergeGuestData } from '../services/authService';
import pendingActionManager from '../utils/pendingActionManager';
import { useCart } from '../hooks/useCart';
import { useWishlist } from '../hooks/useWishlist';

export default function LoginPage() {
  const { setAuth } = useAuthStore();
  const { mergeOnLogin: mergeCart } = useCart();
  const { mergeOnLogin: mergeWishlist } = useWishlist();
  const navigate = useNavigate();
  const [credentials, setCredentials] = useState({ identifier: '', password: '' });
  const [loading, setLoading] = useState(false);

  const handleLogin = async (e) => {
    e.preventDefault();
    setLoading(true);

    try {
      // Standard login
      const result = await authService.login(credentials);
      setAuth({
        token: result.token,
        refreshToken: result.refreshToken,
        user: result.user,
      });

      // CRITICAL: Merge guest data immediately after login
      try {
        await mergeGuestData(
          useGuestCartStore.getState().items,
          useGuestWishlistStore.getState().items
        );
        
        // Clear guest stores
        useGuestCartStore.getState().clearCart();
        useGuestWishlistStore.getState().clearWishlist();
      } catch (mergeErr) {
        console.error('Merge failed:', mergeErr);
        // Continue anyway - guest data can be merged later
      }

      // Check for pending actions
      const pendingAction = pendingActionManager.getPendingAction();
      if (pendingAction?.type === 'buy_now') {
        // Clear pending action
        pendingActionManager.clearPendingAction();
        // Redirect to checkout
        navigate('/checkout');
      } else {
        // Get redirect from URL params, default to home
        const redirect = new URLSearchParams(window.location.search).get('redirect');
        navigate(redirect || '/');
      }
    } catch (err) {
      // Show error
      console.error('Login failed:', err);
    } finally {
      setLoading(false);
    }
  };

  return (
    <form onSubmit={handleLogin}>
      {/* Login form */}
    </form>
  );
}
```

### 5. Update CheckoutPage

**What to change:**
- Require authentication to proceed
- Show guest-specific message
- Validate cart before allowing purchase

**Key code:**
```javascript
import { useCart } from '../hooks/useCart';
import { useAuthStore } from '../context/authStore';

export default function CheckoutPage() {
  const { isAuthenticated } = useAuthStore();
  const { cart, validateCart } = useCart();
  const navigate = useNavigate();

  useEffect(() => {
    // Redirect guests to login
    if (!isAuthenticated) {
      navigate('/login?redirect=/checkout');
    }
  }, [isAuthenticated]);

  if (!isAuthenticated) {
    return <div>Redirecting to login...</div>;
  }

  const handleProceedToPayment = async () => {
    // Validate cart one more time
    const validation = await validateCart();
    if (validation.errors.length > 0) {
      // Show validation errors
      return;
    }
    // Proceed with payment
  };

  return (
    <div>
      {/* Checkout flow */}
    </div>
  );
}
```

### 6. Update Navbar/Header

**What to change:**
- Show cart count from guest or auth store
- Update in real-time when items added
- Show login prompt for guests during "Buy Now"

**Key code:**
```javascript
import { useCart } from '../hooks/useCart';
import { useWishlist } from '../hooks/useWishlist';

export default function Navbar() {
  const { cart } = useCart();
  const { wishlist } = useWishlist();

  return (
    <nav>
      {/* Other nav items */}
      <div className="cart-icon">
        Cart <span className="badge">{cart.itemCount || 0}</span>
      </div>
      <div className="wishlist-icon">
        Wishlist <span className="badge">{wishlist.itemCount || 0}</span>
      </div>
    </nav>
  );
}
```

### 7. Update RegisterPage

**What to change:**
- After successful registration, merge guest data (same as login)
- Show welcome message for new users

```javascript
// After successful registration:
await mergeGuestData(
  useGuestCartStore.getState().items,
  useGuestWishlistStore.getState().items
);
```

## API Endpoints Summary

### Cart Endpoints
- `POST /api/cart/validate-item` - Validate single item (guest accessible)
- `POST /api/cart/validate` - Validate multiple items (guest accessible)
- `POST /api/cart/summary` - Get cart summary (guest accessible)
- `POST /api/cart/merge` - Merge guest cart (auth required)
- `POST /api/cart/add` - Add to cart (auth required)
- `GET /api/cart` - Get cart (auth required)
- `PATCH /api/cart/update` - Update cart (auth required)
- `DELETE /api/cart/remove` - Remove item (auth required)
- `DELETE /api/cart/clear` - Clear cart (auth required)

### Wishlist Endpoints
- `POST /api/wishlist/{productId}/validate` - Validate product (guest accessible)
- `GET /api/wishlist/{productId}/check` - Check product status (guest accessible)
- `POST /api/wishlist/validate-items` - Validate items (guest accessible)
- `POST /api/wishlist/merge` - Merge guest wishlist (auth required)
- `GET /api/wishlist` - Get wishlist (auth required)
- `POST /api/wishlist/{productId}` - Add to wishlist (auth required)
- `DELETE /api/wishlist/{productId}` - Remove from wishlist (auth required)

### Checkout Endpoints
- `POST /api/checkout/guest/prepare` - Prepare guest checkout (guest accessible)
- `POST /api/checkout/prepare` - Prepare checkout (auth required)
- `POST /api/checkout/create` - Create order (auth required)

### Auth Endpoints
- `POST /api/auth/login` - Login
- `POST /api/auth/register` - Register
- `POST /api/auth/merge-guest-data` - Merge guest data (auth required)

## Error Handling

### Cart Validation Errors
```javascript
{
  productId: "507f1f77bcf86cd799439011",
  error: "Product not found" | "Insufficient stock" | "Product not available"
}
```

### Merge Conflicts
```javascript
{
  productId: "...",
  reason: "Merged quantity (10) exceeds available stock. Kept existing quantity (5)",
  guestQuantity: 5,
  cartQuantity: 5
}
```

## Local Storage Keys
- `guest_cart` - Guest cart items
- `guest_wishlist` - Guest wishlist items
- `pending_checkout_action` - Pending action before login
- `pending_action_expiry` - Expiry time for pending action

## Testing Checklist

- [ ] Guest can add items to cart without login
- [ ] Guest can add items to wishlist without login
- [ ] Guest cart persists across page refreshes
- [ ] Guest can view cart without login
- [ ] Guest redirected to login when clicking "Buy Now"
- [ ] Guest redirected to login when clicking "Checkout"
- [ ] Pending action triggers checkout after login
- [ ] Cart items merge correctly after login
- [ ] Wishlist items merge correctly after login
- [ ] Duplicate items handled correctly during merge
- [ ] Quantity conflicts handled gracefully
- [ ] Invalid items removed during merge
- [ ] Price updated from backend during validation
- [ ] Stock changes detected during checkout
- [ ] Guest data cleared after successful merge

## Performance Tips

1. **Debounce cart updates**: Use debouncing when updating cart quantities
2. **Lazy load wishlist**: Only fetch wishlist when user opens wishlist page
3. **Batch validation**: Validate entire cart before checkout, not item-by-item
4. **Cache product info**: Cache validated product info in guest cart items
5. **Use web workers**: Consider offloading heavy cart merge logic to web workers

## Troubleshooting

### Cart merge not working
- Check if `mergeGuestData` is called after login
- Verify guest cart items are in `useGuestCartStore`
- Check browser console for API errors

### Guest cart not persisting
- Verify localStorage is enabled in browser
- Check if browser private mode is blocking localStorage
- Verify Zustand persist middleware is working

### Validation failing
- Ensure product exists in database
- Check product status (must be APPROVED)
- Verify stock is available
- Check if variant ID is correct

## Next Steps

1. Update all product listing pages to use `useCart`
2. Add guest indicators throughout UI ("Login to save for later", etc.)
3. Implement analytics for guest to user conversion
4. Add A/B tests for guest checkout flow
5. Monitor merge success rates and timing
