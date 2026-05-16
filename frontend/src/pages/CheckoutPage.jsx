import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { AddressModal } from "../components/AddressModal";
import { BackButton } from "../components/BackButton";
import { AddressCard } from "../components/commerce/AddressCard";
import { CheckoutStepper } from "../components/commerce/CheckoutStepper";
import { InlineToast } from "../components/commerce/InlineToast";
import { OrderSummaryCard } from "../components/commerce/OrderSummaryCard";
import { PriceBreakdown } from "../components/commerce/PriceBreakdown";
import { useAuthStore } from "../context/authStore";
import { useCart } from "../hooks/useCart";
import * as checkoutService from "../services/checkoutService";
import * as paymentService from "../services/paymentService";
import * as pricingService from "../services/pricingService";
import * as userService from "../services/userService";
import { extractProductId, extractVariantId, getCartItemKey } from "../utils/cartState";
import { formatCurrency } from "../utils/formatCurrency";
import {
  EMPTY_ADDRESS_FORM,
  buildPriceBreakdown,
  getAddressFormFromSavedAddress,
  getDefaultAddress,
  getShippingAddressFromForm,
  getShippingAddressFromSavedAddress,
  getSummaryItems,
} from "../utils/checkout";
import { loadTrackingContext } from "../utils/influencerTracking";
import { saveRedirectAfterLogin } from "../utils/loginRedirect";
import pendingCheckoutManager from "../utils/pendingCheckoutManager";

const CHECKOUT_SUCCESS_STORAGE_KEY = "checkoutSuccessPayload";

function normalizeError(err) {
  if (err?.code === "ECONNABORTED" || /timeout/i.test(String(err?.message || ""))) {
    return "Payment request timed out before Razorpay opened. Please try again.";
  }
  const firstIssue = err?.response?.data?.details?.issues?.[0];
  if (firstIssue?.path?.length) {
    return `${firstIssue.path.join(".")}: ${firstIssue.message}`;
  }
  if (err?.response?.data?.debug?.message) {
    return err.response.data.debug.message;
  }
  return err?.response?.data?.message || err?.message || "Request failed";
}

function hasValidShippingAddress(address) {
  return Boolean(
    String(address?.fullName || "").trim() &&
      String(address?.phone || "").trim() &&
      String(address?.line1 || "").trim() &&
      String(address?.city || "").trim() &&
      String(address?.state || "").trim() &&
      String(address?.postalCode || "").trim() &&
      String(address?.country || "").trim()
  );
}

function getAddressFormFromShippingAddress(address = {}) {
  return {
    name: String(address.fullName || "").trim(),
    phone: String(address.phone || "").trim(),
    addressLine: String(address.line1 || "").trim(),
    city: String(address.city || "").trim(),
    state: String(address.state || "").trim(),
    pincode: String(address.postalCode || "").trim(),
    country: String(address.country || "India").trim() || "India",
    isDefault: false,
    latitude: "",
    longitude: "",
  };
}

function ensureRazorpay() {
  if (typeof window !== "undefined" && typeof window.Razorpay === "function") {
    return Promise.resolve();
  }

  return new Promise((resolve, reject) => {
    const resolveWhenReady = () => {
      if (typeof window !== "undefined" && typeof window.Razorpay === "function") {
        resolve();
        return true;
      }
      return false;
    };

    if (resolveWhenReady()) return;

    const existing = document.querySelector(
      'script[data-razorpay-sdk="true"], script[src*="checkout.razorpay.com/v1/checkout.js"]'
    );
    if (existing) {
      const timeoutId = setTimeout(() => {
        reject(new Error("Razorpay SDK loading timeout. Please check your internet connection."));
      }, 30000);
      const intervalId = window.setInterval(() => {
        if (resolveWhenReady()) {
          clearTimeout(timeoutId);
          window.clearInterval(intervalId);
        }
      }, 250);
      existing.addEventListener(
        "load",
        () => {
          clearTimeout(timeoutId);
          window.clearInterval(intervalId);
          resolve();
        },
        { once: true }
      );
      existing.addEventListener(
        "error",
        () => {
          clearTimeout(timeoutId);
          window.clearInterval(intervalId);
          reject(new Error("Failed to load Razorpay checkout."));
        },
        { once: true }
      );
      return;
    }

    const script = document.createElement("script");
    script.src = "https://checkout.razorpay.com/v1/checkout.js";
    script.async = true;
    script.dataset.razorpaySdk = "true";

    const timeoutId = setTimeout(() => {
      reject(new Error("Razorpay SDK loading timeout. Please check your internet connection and try again."));
    }, 30000);

    script.onload = () => {
      clearTimeout(timeoutId);
      resolve();
    };
    script.onerror = () => {
      clearTimeout(timeoutId);
      reject(new Error("Failed to load Razorpay checkout."));
    };
    document.body.appendChild(script);
  });
}

function delay(ms) {
  return new Promise((resolve) => window.setTimeout(resolve, ms));
}

function reconcileSummaryWithCart(summary, cartLike) {
  const cartItems = Array.isArray(cartLike?.items) ? cartLike.items : [];
  if (!cartItems.length) return null;
  if (!summary || !Array.isArray(summary?.sellers)) return summary;

  const cartItemMap = new Map(
    cartItems.map((item) => [
      getCartItemKey(extractProductId(item?.productId || item), extractVariantId(item)),
      item,
    ])
  );

  const sellers = summary.sellers
    .map((seller) => {
      const items = Array.isArray(seller?.items)
        ? seller.items
            .map((item) => {
              const key = getCartItemKey(extractProductId(item?.productId || item), extractVariantId(item));
              const cartItem = cartItemMap.get(key);
              if (!cartItem) return null;
              return {
                ...item,
                quantity: cartItem.quantity,
                price: cartItem.price,
                image: cartItem.image || item.image,
                variantId: cartItem.variantId || item.variantId || "",
                variantTitle: cartItem.variantTitle || item.variantTitle || "",
              };
            })
            .filter(Boolean)
        : [];

      return {
        ...seller,
        items,
        subtotal: items.reduce((sum, item) => sum + Number(item?.price || 0) * Number(item?.quantity || 0), 0),
      };
    })
    .filter((seller) => seller.items.length > 0);

  if (!sellers.length) return null;

  const subtotal = sellers.reduce((sum, seller) => sum + Number(seller?.subtotal || 0), 0);
  const chargesTotal = Number(summary?.chargesTotal || 0);
  const itemCount = sellers.reduce(
    (sum, seller) => sum + seller.items.reduce((itemSum, item) => itemSum + Number(item?.quantity || 0), 0),
    0
  );

  return {
    ...summary,
    sellers,
    subtotal,
    itemCount,
    total: subtotal + chargesTotal,
    totalAmount: subtotal + chargesTotal,
  };
}

function persistCheckoutSuccessPayload(payload) {
  if (typeof window === "undefined") return;

  try {
    window.sessionStorage.setItem(CHECKOUT_SUCCESS_STORAGE_KEY, JSON.stringify(payload));
  } catch {
    // Ignore session storage failures and still allow in-memory navigation state.
  }
}

export function CheckoutPage() {
  const navigate = useNavigate();
  const isAuthenticated = useAuthStore((state) => state.isAuthenticated);
  const {
    cart,
    updateItem,
    removeItem,
    validateCart,
    refreshCart,
  } = useCart();
  const [loading, setLoading] = useState(true);
  const [placing, setPlacing] = useState(false);
  const [verifyingPayment, setVerifyingPayment] = useState(false);
  const [savingAddress, setSavingAddress] = useState(false);
  const [updatingItemId, setUpdatingItemId] = useState("");
  const [error, setError] = useState("");
  const [summary, setSummary] = useState(null);
  const [addresses, setAddresses] = useState([]);
  const [selectedAddressId, setSelectedAddressId] = useState("");
  const [addressForm, setAddressForm] = useState(EMPTY_ADDRESS_FORM);
  const [paymentMethod, setPaymentMethod] = useState("COD");
  const [currentStep, setCurrentStep] = useState("summary");
  const [showAddressSelector, setShowAddressSelector] = useState(false);
  const [showAddressModal, setShowAddressModal] = useState(false);
  const [toast, setToast] = useState(null);
  const [pricingConfig, setPricingConfig] = useState(null);
  const [amountPulse, setAmountPulse] = useState(false);
  const [codAvailability, setCodAvailability] = useState(null);
  const mapsKey = import.meta.env.VITE_GOOGLE_MAPS_API_KEY;
  const didMountPaymentMethodRef = useRef(false);
  const restoredPendingCheckoutRef = useRef(false);

  const selectedAddress = useMemo(
    () => addresses.find((address) => String(address?._id) === String(selectedAddressId)) || null,
    [addresses, selectedAddressId]
  );
  const activeShippingAddress = useMemo(() => {
    if (selectedAddress) {
      return getShippingAddressFromSavedAddress(selectedAddress);
    }
    return getShippingAddressFromForm(addressForm);
  }, [selectedAddress, addressForm]);
  const hasUsableAddress = hasValidShippingAddress(activeShippingAddress);
  const unlockedSteps = useMemo(() => ["address", "summary", "payment"], []);
  const orderItems = useMemo(() => getSummaryItems(summary), [summary]);
  const totalAmount = useMemo(() => summary?.total || summary?.totalAmount || 0, [summary]);
  const getCheckoutItemKey = useCallback(
    (item) => `${extractProductId(item?.productId || item)}:${extractVariantId(item)}`,
    []
  );

  const priceBreakdown = useMemo(() => {
    if (!summary) return null;

    if (summary.charges && summary.chargesTotal !== undefined) {
      return {
        subtotal: summary.subtotal || 0,
        charges: summary.charges,
        chargesTotal: summary.chargesTotal || 0,
        totalAmount: summary.total || 0,
      };
    }

    if (pricingConfig) {
      return pricingService.calculatePriceBreakdown({
        subtotal: Number(summary?.subtotal || 0),
        discount: Math.max(
          Number(summary?.originalAmount || summary?.subtotal || 0) - Number(summary?.subtotal || 0),
          0
        ),
        itemCount: getSummaryItems(summary).reduce((sum, item) => sum + Number(item?.quantity || 0), 0),
        pricingConfig,
      });
    }

    return buildPriceBreakdown(summary);
  }, [summary, pricingConfig]);

  const persistPendingCheckoutState = useCallback(
    ({
      selectedPaymentMethod = paymentMethod,
      shippingAddress = activeShippingAddress,
      step = currentStep,
      selectedSavedAddressId = selectedAddress?._id || selectedAddressId || "",
      cartItems = Array.isArray(cart?.items) ? cart.items : [],
    } = {}) => {
      if (!cartItems.length && !orderItems.length) return null;

      return pendingCheckoutManager.update({
        source: "checkout",
        redirectAfterAuth: "/checkout",
        redirectAfterLogin: "/checkout",
        cartItems,
        shippingAddress: hasValidShippingAddress(shippingAddress) ? shippingAddress : null,
        selectedAddress: hasValidShippingAddress(shippingAddress) ? shippingAddress : null,
        selectedAddressId: selectedSavedAddressId || "",
        paymentMethod: selectedPaymentMethod,
        selectedPaymentMethod,
        currentStep: step,
        checkoutStep: step,
        appliedCoupon: summary?.coupon || null,
      });
    },
    [
      activeShippingAddress,
      cart?.items,
      currentStep,
      orderItems.length,
      paymentMethod,
      selectedAddress?._id,
      selectedAddressId,
      summary?.coupon,
    ]
  );

  const restorePendingCheckoutState = useCallback(() => {
    if (restoredPendingCheckoutRef.current) return;
    const pendingCheckout = pendingCheckoutManager.get();
    if (!pendingCheckout) return;

    const restoredPaymentMethod =
      pendingCheckout.selectedPaymentMethod || pendingCheckout.paymentMethod;
    const restoredShippingAddress =
      pendingCheckout.selectedAddress || pendingCheckout.shippingAddress;
    const restoredStep = pendingCheckout.checkoutStep || pendingCheckout.currentStep;

    if (restoredPaymentMethod) {
      setPaymentMethod(restoredPaymentMethod);
    }
    if (pendingCheckout.selectedAddressId) {
      setSelectedAddressId(String(pendingCheckout.selectedAddressId));
    }
    if (restoredShippingAddress) {
      setAddressForm(getAddressFormFromShippingAddress(restoredShippingAddress));
    }
    if (restoredStep) {
      setCurrentStep(restoredStep);
    }

    restoredPendingCheckoutRef.current = true;
  }, []);

  async function verifyPaymentWithRetry(payload, maxAttempts = 4) {
    let lastError = null;

    for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
      try {
        return await paymentService.verifyRazorpayPayment(payload);
      } catch (verificationError) {
        lastError = verificationError;
        if (attempt < maxAttempts) {
          await delay(1500 * attempt);
          continue;
        }
      }
    }

    throw lastError || new Error("Payment verification failed.");
  }

  async function recoverLatestOrderRedirect(maxAttempts = 4) {
    for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
      try {
        const response = await userService.getUserOrders({ page: 1, limit: 5 });
        const orders = response?.data?.orders || [];
        const latestOrder = orders[0] || null;
        if (latestOrder?._id) {
          const successPayload = { orders, payment: null };
          persistCheckoutSuccessPayload(successPayload);
          navigate(`/orders/${latestOrder._id}`, {
            replace: true,
            state: successPayload,
          });
          return true;
        }
      } catch {
        // Keep retrying briefly because the order may have been created server-side just before navigation.
      }

      if (attempt < maxAttempts) {
        await delay(1500 * attempt);
      }
    }

    return false;
  }

  const loadPreparedCheckout = useCallback(
    async (shippingAddress, selectedPaymentMethod = paymentMethod, guestCartItems = cart?.items || []) => {
      const trackingContext = loadTrackingContext();
      const payload = {
        paymentMethod: selectedPaymentMethod,
      };

      if (shippingAddress && String(shippingAddress?.fullName || "").trim()) {
        payload.shippingAddress = shippingAddress;
      }
      if (trackingContext?.trackingToken) {
        payload.trackingToken = trackingContext.trackingToken;
      }

      if (isAuthenticated) {
        const checkoutRes = await checkoutService.prepareCheckout(payload);
        return checkoutRes?.data || null;
      }

      if (!Array.isArray(guestCartItems) || guestCartItems.length === 0) {
        return null;
      }

      const guestCheckoutRes = await checkoutService.prepareGuestCheckout({
        ...payload,
        guestCartItems,
      });
      return guestCheckoutRes?.data || null;
    },
    [cart?.items, isAuthenticated, paymentMethod]
  );

  const refresh = useCallback(
    async ({
      selectedPaymentMethod = paymentMethod,
      selectedAddressForm = addressForm,
      preserveGuestAddress = false,
    } = {}) => {
      setLoading(true);
      setError("");

      try {
        restorePendingCheckoutState();
        const pricingRes = await pricingService.getPricingConfig().catch(() => ({ data: null }));
        setPricingConfig(pricingRes?.data || null);

        if (isAuthenticated) {
          const [addressRes] = await Promise.all([userService.getUserAddresses(), refreshCart()]);
          const nextAddresses = Array.isArray(addressRes?.data) ? addressRes.data : [];
          const defaultAddress = getDefaultAddress(nextAddresses);
          const pendingCheckout = pendingCheckoutManager.get();
          const pendingSelectedAddressId = String(pendingCheckout?.selectedAddressId || "");
          const pendingSavedAddress =
            nextAddresses.find((address) => String(address?._id) === pendingSelectedAddressId) || null;
          const pendingShippingAddress =
            pendingCheckout?.selectedAddress || pendingCheckout?.shippingAddress || null;
          const shouldPreferPendingAddress =
            pendingShippingAddress && !pendingSavedAddress && !preserveGuestAddress;

          setAddresses(nextAddresses);

          if (pendingSavedAddress && !preserveGuestAddress) {
            setSelectedAddressId(pendingSavedAddress._id);
            setAddressForm(getAddressFormFromSavedAddress(pendingSavedAddress));
          } else if (shouldPreferPendingAddress) {
            setSelectedAddressId("");
            setAddressForm(getAddressFormFromShippingAddress(pendingShippingAddress));
          } else if (defaultAddress) {
            setSelectedAddressId(defaultAddress._id);
            setAddressForm(getAddressFormFromSavedAddress(defaultAddress));
          } else {
            setSelectedAddressId("");
          }

          const effectiveAddress = pendingSavedAddress
            ? getShippingAddressFromSavedAddress(pendingSavedAddress)
            : shouldPreferPendingAddress
              ? pendingShippingAddress
            : defaultAddress
              ? getShippingAddressFromSavedAddress(defaultAddress)
              : getShippingAddressFromForm(selectedAddressForm);

          const nextSummary = await loadPreparedCheckout(effectiveAddress, selectedPaymentMethod);
          setSummary(nextSummary);
          setCodAvailability(nextSummary?.codAvailability || null);
        } else {
          setAddresses([]);
          setSelectedAddressId("");
          const validation = await validateCart();
          const guestCartItems = validation?.validatedItems || [];
          const guestShippingAddress = getShippingAddressFromForm(selectedAddressForm);
          const nextSummary = await loadPreparedCheckout(
            guestShippingAddress,
            selectedPaymentMethod,
            guestCartItems
          );
          setSummary(nextSummary);
          setCodAvailability(nextSummary?.codAvailability || null);
        }
      } catch (refreshError) {
        setError(normalizeError(refreshError));
        setSummary(null);
      } finally {
        setLoading(false);
      }
    },
    [
      addressForm,
      isAuthenticated,
      loadPreparedCheckout,
      paymentMethod,
      refreshCart,
      restorePendingCheckoutState,
      validateCart,
    ]
  );

  const redirectToLoginForFinalCheckout = useCallback(
    (shippingAddress, step = "payment") => {
      persistPendingCheckoutState({
        shippingAddress,
        step,
      });
      saveRedirectAfterLogin(`${window.location.origin}/checkout`);
      navigate("/login", { state: { from: { pathname: "/checkout" } } });
    },
    [navigate, persistPendingCheckoutState]
  );

  useEffect(() => {
    refresh({ selectedAddressForm: addressForm });
    // We intentionally reload on auth changes, not every local address keystroke.
    // Address-driven recalculation is handled by explicit actions and the payment effect below.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isAuthenticated]);

  useEffect(() => {
    ensureRazorpay().catch(() => {});
  }, []);

  useEffect(() => {
    if (loading || !summary) return;
    persistPendingCheckoutState();
  }, [loading, persistPendingCheckoutState, summary]);

  useEffect(() => {
    if (!didMountPaymentMethodRef.current) {
      didMountPaymentMethodRef.current = true;
      return;
    }

    const activeAddress = activeShippingAddress;
    setError("");
    loadPreparedCheckout(activeAddress, paymentMethod)
      .then((nextSummary) => {
        setSummary(nextSummary);
        setCodAvailability(nextSummary?.codAvailability || null);
        setAmountPulse(true);
      })
      .catch((paymentError) => setError(normalizeError(paymentError)));
  }, [activeShippingAddress, loadPreparedCheckout, paymentMethod]);

  useEffect(() => {
    if (!amountPulse) return undefined;
    const timer = window.setTimeout(() => setAmountPulse(false), 320);
    return () => window.clearTimeout(timer);
  }, [amountPulse]);

  async function handleQuantityChange(productId, variantId, quantity) {
    setUpdatingItemId(`${String(productId)}:${variantId || ""}`);
    setError("");
    try {
      const updatedCart = await updateItem(productId, quantity, variantId);
      let resolvedSummary = null;

      if (isAuthenticated) {
        resolvedSummary = reconcileSummaryWithCart(summary, updatedCart);
        setSummary(resolvedSummary);
        setCodAvailability(resolvedSummary?.codAvailability || codAvailability || null);
        await refreshCart();
      } else {
        const guestValidation = await validateCart(Array.isArray(updatedCart?.items) ? updatedCart.items : []);
        const nextSummary = await loadPreparedCheckout(
          activeShippingAddress,
          paymentMethod,
          guestValidation?.validatedItems
        );
        resolvedSummary = nextSummary;
      }

      setSummary(resolvedSummary);
      setCodAvailability(resolvedSummary?.codAvailability || codAvailability || null);
      setAmountPulse(true);
      setToast({ type: "success", message: "Order summary updated." });
    } catch (quantityError) {
      setError(normalizeError(quantityError));
    } finally {
      setUpdatingItemId("");
    }
  }

  async function handleRemoveItem(productId, variantId) {
    setUpdatingItemId(`${String(productId)}:${variantId || ""}`);
    setError("");
    try {
      const updatedCart = await removeItem(productId, variantId);
      let resolvedSummary = null;

      if (isAuthenticated) {
        resolvedSummary = reconcileSummaryWithCart(summary, updatedCart);
        setSummary(resolvedSummary);
        setCodAvailability(resolvedSummary?.codAvailability || codAvailability || null);
        await refreshCart();
      } else {
        const guestValidation = await validateCart(Array.isArray(updatedCart?.items) ? updatedCart.items : []);
        const nextSummary = await loadPreparedCheckout(
          activeShippingAddress,
          paymentMethod,
          guestValidation?.validatedItems
        );
        resolvedSummary = nextSummary;
      }

      const remainingItems = getSummaryItems(resolvedSummary);

      if (!resolvedSummary || remainingItems.length === 0) {
        setSummary(null);
        setToast({ type: "success", message: "Item removed. Your checkout is now empty." });
      } else {
        setSummary(resolvedSummary);
        setCodAvailability(resolvedSummary?.codAvailability || codAvailability || null);
        setAmountPulse(true);
        setToast({ type: "success", message: "Item removed from checkout." });
      }
    } catch (removeError) {
      setError(normalizeError(removeError));
    } finally {
      setUpdatingItemId("");
    }
  }

  async function handleAddressModalSubmit(payload, formSnapshot) {
    setSavingAddress(true);
    setError("");
    try {
      if (isAuthenticated) {
        const response = await userService.createUserAddress(payload);
        const createdAddress = response?.data;
        const nextAddresses = createdAddress
          ? [createdAddress, ...addresses.filter((item) => item._id !== createdAddress._id)]
          : addresses;

        setAddresses(nextAddresses);
        setAddressForm(formSnapshot);
        setSelectedAddressId(createdAddress?._id || "");
        setShowAddressModal(false);
        setShowAddressSelector(false);
        const nextSummary = await loadPreparedCheckout(
          createdAddress
            ? getShippingAddressFromSavedAddress(createdAddress)
            : getShippingAddressFromForm(formSnapshot),
          paymentMethod
        );
        setSummary(nextSummary);
        setCodAvailability(nextSummary?.codAvailability || null);
        setAmountPulse(true);
        setToast({ type: "success", message: "Address saved and selected for delivery." });
      } else {
        setAddressForm(formSnapshot);
        setSelectedAddressId("");
        setShowAddressModal(false);
        const guestValidation = await validateCart();
        const nextSummary = await loadPreparedCheckout(
          getShippingAddressFromForm(formSnapshot),
          paymentMethod,
          guestValidation?.validatedItems
        );
        setSummary(nextSummary);
        setCodAvailability(nextSummary?.codAvailability || null);
        setAmountPulse(true);
        setToast({ type: "success", message: "Delivery address saved for this checkout session." });
      }

      setCurrentStep("summary");
    } catch (addressError) {
      setError(normalizeError(addressError));
    } finally {
      setSavingAddress(false);
    }
  }

  async function placeOrder() {
    const shippingAddress = activeShippingAddress;

    if (!hasValidShippingAddress(shippingAddress)) {
      setCurrentStep("address");
      setToast({ type: "error", message: "Add a valid delivery address before continuing." });
      return;
    }

    if (paymentMethod === "COD" && codAvailability?.codAvailable === false) {
      setToast({ type: "error", message: "Cash on Delivery is not available for this address." });
      return;
    }

    if (!isAuthenticated) {
      redirectToLoginForFinalCheckout(shippingAddress);
      return;
    }

    setPlacing(true);
    setError("");

    try {
      const trackingContext = loadTrackingContext();
      if (paymentMethod === "COD") {
        const response = await checkoutService.createOrder({
          shippingAddress,
          paymentMethod: "COD",
          trackingToken: trackingContext?.trackingToken,
        });
        const orders = response?.data?.orders || [];
        const payment = response?.data?.payment || null;
        persistCheckoutSuccessPayload({ orders, payment });
        pendingCheckoutManager.clear();
        navigate("/checkout/success", { replace: true, state: { orders, payment } });
        return;
      }

      const [orderRes] = await Promise.all([
        paymentService.createRazorpayOrder({
          cartId: "current",
          shippingAddress,
          trackingToken: trackingContext?.trackingToken,
        }),
        ensureRazorpay(),
      ]);
      const razorpayData = orderRes || {};

      if (!razorpayData.key || !razorpayData.orderId) {
        throw new Error("Invalid Razorpay configuration. Please contact support or try again.");
      }

      if (typeof window === "undefined" || typeof window.Razorpay !== "function") {
        throw new Error("Razorpay checkout is not available.");
      }

      const options = {
        key: razorpayData.key,
        amount: razorpayData.amount,
        currency: razorpayData.currency,
        order_id: razorpayData.razorpayOrderId || razorpayData.orderId,
        name: "UChooseMe",
        description: "Secure checkout",
        prefill: {
          name: shippingAddress.fullName,
          contact: shippingAddress.phone,
        },
        theme: {
          color: "#0f766e",
        },
        modal: {
          ondismiss: () => {
            setToast({ type: "error", message: "Payment window closed. You can retry securely from checkout." });
            setPlacing(false);
          },
        },
        retry: {
          enabled: true,
          max_count: 2,
        },
        handler: async (response) => {
          const verificationPayload = {
            razorpay_order_id: response.razorpay_order_id,
            razorpay_payment_id: response.razorpay_payment_id,
            razorpay_signature: response.razorpay_signature,
            shippingAddress,
            trackingToken: trackingContext?.trackingToken,
          };

          navigate("/checkout/success", {
            replace: true,
            state: {
              orders: [],
              payment: {
                method: "ONLINE",
                status: "PROCESSING",
                razorpayOrderId: response.razorpay_order_id,
                razorpayPaymentId: response.razorpay_payment_id,
              },
              processing: true,
              verificationPayload,
            },
          });

          try {
            setVerifyingPayment(true);
            const verified = await verifyPaymentWithRetry(verificationPayload);
            const successPayload = {
              orders: verified?.orders || [],
              payment: verified?.payment || null,
            };
            persistCheckoutSuccessPayload(successPayload);
            pendingCheckoutManager.clear();
            navigate("/checkout/success", {
              replace: true,
              state: successPayload,
            });
          } catch (verificationError) {
            const recovered = await recoverLatestOrderRedirect();
            if (!recovered) {
              if (verificationError?.response?.status === 401) {
                redirectToLoginForFinalCheckout(shippingAddress);
                return;
              }
              setError(normalizeError(verificationError));
              setToast({ type: "error", message: "Payment verification failed. Please retry or open your orders." });
            }
          } finally {
            setVerifyingPayment(false);
            setPlacing(false);
          }
        },
      };

      const rzp = new window.Razorpay(options);
      rzp.on("payment.failed", () => {
        setToast({ type: "error", message: "Payment failed before verification. Please retry." });
        setPlacing(false);
      });
      rzp.open();
    } catch (placeOrderError) {
      if (placeOrderError?.response?.status === 401) {
        redirectToLoginForFinalCheckout(shippingAddress);
        return;
      }
      setError(normalizeError(placeOrderError));
    } finally {
      setPlacing(false);
    }
  }

  return (
    <div className="grid gap-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <div className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-500 dark:text-slate-400">
            Secure checkout
          </div>
          <h1 className="mt-2 text-3xl font-bold tracking-tight text-slate-950 dark:text-white">
            Address, summary, payment
          </h1>
          <p className="mt-1 text-sm text-slate-600 dark:text-slate-300">
            Review products, shipping estimates, and pricing before signing in for the final purchase step.
          </p>
        </div>
        <BackButton fallbackTo="/cart" />
      </div>

      {!isAuthenticated ? (
        <div className="rounded-[1.5rem] border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900 dark:border-amber-900/40 dark:bg-amber-950/20 dark:text-amber-100">
          Login is required only when you place the order or continue to Razorpay. You can review the entire checkout first.
        </div>
      ) : null}

      <CheckoutStepper currentStep={currentStep} onStepChange={setCurrentStep} unlockedSteps={unlockedSteps} />

      {error ? (
        <div className="rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-800 dark:border-rose-900 dark:bg-rose-950/30 dark:text-rose-200">
          {error}
        </div>
      ) : null}

      {loading ? (
        <div className="grid gap-3">
          <div className="h-28 animate-pulse rounded-2xl bg-slate-100 dark:bg-slate-800" />
          <div className="h-64 animate-pulse rounded-2xl bg-slate-100 dark:bg-slate-800" />
        </div>
      ) : !summary ? (
        <div className="rounded-2xl border border-slate-200 bg-white p-6 text-sm text-slate-600 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-300">
          Your checkout is empty. Please review your cart.
          <button
            type="button"
            onClick={() => navigate("/shop")}
            className="mt-4 inline-flex rounded-xl bg-[color:var(--commerce-accent)] px-4 py-2 text-sm font-semibold text-white hover:opacity-95"
          >
            Go to shopping
          </button>
        </div>
      ) : (
        <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_360px]">
          <div className="grid gap-5">
            <section className="rounded-[2rem] border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900">
              <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                <div>
                  <div className="text-sm font-semibold uppercase tracking-[0.18em] text-slate-500 dark:text-slate-400">
                    Step 1
                  </div>
                  <h2 className="mt-1 text-xl font-semibold text-slate-950 dark:text-white">
                    {isAuthenticated ? "Select delivery address" : "Add delivery address"}
                  </h2>
                </div>
                <div className="flex flex-wrap gap-2">
                  {isAuthenticated ? (
                    <button
                      type="button"
                      onClick={() => {
                        setShowAddressSelector((current) => !current);
                        setShowAddressModal(false);
                      }}
                      className="rounded-xl border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 dark:border-slate-700 dark:text-slate-200 dark:hover:bg-slate-800"
                    >
                      Change
                    </button>
                  ) : null}
                  <button
                    type="button"
                    onClick={() => {
                      if (!isAuthenticated) {
                        setAddressForm(addressForm || EMPTY_ADDRESS_FORM);
                      } else {
                        setSelectedAddressId("");
                        setAddressForm(EMPTY_ADDRESS_FORM);
                        setShowAddressSelector(false);
                      }
                      setShowAddressModal(true);
                    }}
                    className="rounded-xl bg-slate-950 px-4 py-2 text-sm font-semibold text-white dark:bg-slate-100 dark:text-slate-950"
                  >
                    {isAuthenticated ? "Add New Address" : "Add Delivery Address"}
                  </button>
                </div>
              </div>

              {selectedAddress ? (
                <div className="mt-5">
                  <AddressCard
                    address={selectedAddress}
                    selected
                    compact
                    onEdit={() => setShowAddressSelector((current) => !current)}
                  />
                </div>
              ) : hasUsableAddress ? (
                <div className="mt-5 rounded-[1.5rem] border border-slate-200 bg-slate-50 px-4 py-4 text-sm text-slate-700 dark:border-slate-800 dark:bg-slate-950 dark:text-slate-200">
                  <div className="font-semibold text-slate-950 dark:text-white">{addressForm.name}</div>
                  <div className="mt-1">{addressForm.addressLine}</div>
                  <div className="mt-1">
                    {addressForm.city}, {addressForm.state} {addressForm.pincode}
                  </div>
                  <div className="mt-1">{addressForm.phone}</div>
                </div>
              ) : (
                <div className="mt-5 rounded-[1.5rem] border border-dashed border-slate-300 bg-slate-50 px-4 py-5 text-sm text-slate-600 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-300">
                  {isAuthenticated
                    ? "No saved address is selected yet. Add one below to continue."
                    : "Add a delivery address to unlock shipping estimates and COD availability. The address stays only for this checkout session until you sign in."}
                </div>
              )}

              {isAuthenticated && showAddressSelector ? (
                <div className="mt-5 grid gap-4">
                  {addresses.length ? (
                    addresses.map((address) => (
                      <AddressCard
                        key={address._id}
                        address={address}
                        selected={String(address._id) === String(selectedAddressId)}
                        onSelect={() => {
                          setSelectedAddressId(address._id);
                          setAddressForm(getAddressFormFromSavedAddress(address));
                          setShowAddressSelector(false);
                          setShowAddressModal(false);
                          loadPreparedCheckout(getShippingAddressFromSavedAddress(address), paymentMethod)
                            .then((nextSummary) => {
                              setSummary(nextSummary);
                              setCodAvailability(nextSummary?.codAvailability || null);
                              setAmountPulse(true);
                            })
                            .catch((selectionError) => setError(normalizeError(selectionError)));
                          setCurrentStep("summary");
                        }}
                      />
                    ))
                  ) : (
                    <div className="rounded-[1.5rem] border border-dashed border-slate-300 bg-slate-50 px-4 py-5 text-sm text-slate-600 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-300">
                      No saved addresses yet. Add a new address to enable faster checkout next time.
                    </div>
                  )}
                </div>
              ) : null}

              <div className="mt-5 flex flex-wrap gap-3">
                <button
                  type="button"
                  onClick={() => setCurrentStep("summary")}
                  className="rounded-2xl bg-slate-950 px-5 py-3 text-sm font-semibold text-white dark:bg-slate-100 dark:text-slate-950"
                >
                  Continue to summary
                </button>
              </div>
            </section>

            <section className="rounded-[2rem] border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900">
              <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <div className="text-sm font-semibold uppercase tracking-[0.18em] text-slate-500 dark:text-slate-400">
                    Step 2
                  </div>
                  <h2 className="mt-1 text-xl font-semibold text-slate-950 dark:text-white">Review your order</h2>
                </div>
                <div className="text-sm text-slate-500 dark:text-slate-400">
                  {orderItems.length} products ready for checkout
                </div>
              </div>

              <div className="mt-5 grid gap-4">
                {orderItems.map((item) => (
                  <OrderSummaryCard
                    key={getCheckoutItemKey(item)}
                    item={item}
                    busy={updatingItemId === getCheckoutItemKey(item)}
                    onQuantityChange={(quantity) =>
                      handleQuantityChange(extractProductId(item?.productId || item), extractVariantId(item), quantity)
                    }
                    onRemove={() => handleRemoveItem(extractProductId(item?.productId || item), extractVariantId(item))}
                  />
                ))}
              </div>

              <div className="mt-5 flex flex-wrap gap-3">
                <button
                  type="button"
                  onClick={() => setCurrentStep("payment")}
                  className="rounded-2xl bg-slate-950 px-5 py-3 text-sm font-semibold text-white dark:bg-slate-100 dark:text-slate-950"
                >
                  Continue to payment
                </button>
              </div>
            </section>

            <section className="rounded-[2rem] border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900">
              <div>
                <div className="text-sm font-semibold uppercase tracking-[0.18em] text-slate-500 dark:text-slate-400">
                  Step 3
                </div>
                <h2 className="mt-1 text-xl font-semibold text-slate-950 dark:text-white">Choose payment</h2>
              </div>

              <div className="mt-5 grid gap-3">
                {[
                  {
                    value: "COD",
                    title: "Cash on Delivery",
                    description: "Pay when the order arrives. Best for familiar delivery locations.",
                    disabled:
                      paymentMethod !== "COD"
                        ? Boolean(codAvailability && codAvailability.codAvailable === false)
                        : false,
                  },
                  {
                    value: "ONLINE",
                    title: "Razorpay",
                    description: "UPI, cards, wallets, and net banking through secure Razorpay checkout.",
                  },
                ].map((option) => (
                  <button
                    key={option.value}
                    type="button"
                    onClick={() => !option.disabled && setPaymentMethod(option.value)}
                    disabled={option.disabled}
                    className={`rounded-[1.5rem] border p-4 text-left transition ${
                      paymentMethod === option.value
                        ? "border-[color:var(--commerce-accent)] bg-[color:var(--commerce-accent-soft)]"
                        : "border-slate-200 hover:border-slate-300 dark:border-slate-800 dark:hover:border-slate-700"
                    } ${option.disabled ? "cursor-not-allowed opacity-50" : ""}`}
                  >
                    <div className="flex items-center justify-between gap-3">
                      <div>
                        <div className="text-base font-semibold text-slate-950 dark:text-white">{option.title}</div>
                        <div className="mt-1 text-sm text-slate-600 dark:text-slate-300">{option.description}</div>
                        {option.value === "COD" && codAvailability?.codAvailable === false ? (
                          <div className="mt-2 text-xs font-medium text-rose-600">
                            COD unavailable: {(codAvailability.reasons || []).join(", ")}
                          </div>
                        ) : null}
                      </div>
                      <div
                        className={`h-5 w-5 rounded-full border ${
                          paymentMethod === option.value
                            ? "border-[color:var(--commerce-accent)] bg-[color:var(--commerce-accent)]"
                            : "border-slate-300 dark:border-slate-700"
                        }`}
                      />
                    </div>
                  </button>
                ))}
              </div>
            </section>
          </div>

          <aside className="xl:sticky xl:top-24 xl:self-start">
            <div className="grid gap-4">
              <PriceBreakdown breakdown={priceBreakdown} />
              {paymentMethod === "COD" && codAvailability?.codAvailable === false ? (
                <div className="rounded-[1.5rem] border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
                  Cash on Delivery is unavailable for this address right now.
                </div>
              ) : null}

              <div className="rounded-[1.75rem] border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900">
                <div className="text-sm font-semibold uppercase tracking-[0.18em] text-slate-500 dark:text-slate-400">
                  Order total
                </div>
                <div className="mt-3 text-3xl font-black tracking-tight text-slate-950 dark:text-white">
                  <span
                    className={`inline-block transition-all duration-300 ${
                      amountPulse ? "translate-y-[-1px] scale-[1.03] text-[color:var(--commerce-accent)]" : ""
                    }`}
                  >
                    {formatCurrency(totalAmount || 0)}
                  </span>
                </div>
                <div className="mt-2 text-sm text-slate-500 dark:text-slate-400">
                  {!isAuthenticated
                    ? "Review complete. Sign in only when you are ready to place the order."
                    : paymentMethod === "ONLINE"
                      ? "You will be redirected to Razorpay next."
                      : "Cash will be collected on delivery."}
                </div>

                <button
                  type="button"
                  disabled={placing || orderItems.length === 0 || (paymentMethod === "COD" && codAvailability?.codAvailable === false)}
                  onClick={placeOrder}
                  className="mt-5 w-full rounded-2xl bg-[color:var(--commerce-accent-warm)] px-4 py-4 text-sm font-semibold text-slate-950 shadow-sm transition hover:translate-y-[-1px] hover:shadow-lg disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {placing
                    ? "Processing..."
                    : !isAuthenticated
                      ? paymentMethod === "ONLINE"
                        ? "Login to Continue to Razorpay"
                        : "Login to Place COD Order"
                      : paymentMethod === "ONLINE"
                        ? "Continue to Razorpay"
                        : "Place COD Order"}
                </button>

                {!isAuthenticated ? (
                  <button
                    type="button"
                    onClick={() => {
                      persistPendingCheckoutState();
                      saveRedirectAfterLogin(`${window.location.origin}/checkout`);
                      navigate("/login", { state: { from: { pathname: "/checkout" } } });
                    }}
                    className="mt-3 w-full rounded-2xl border border-slate-300 px-4 py-3 text-sm font-semibold text-slate-700 hover:bg-slate-50 dark:border-slate-700 dark:text-slate-200 dark:hover:bg-slate-800"
                  >
                    Sign in now
                  </button>
                ) : null}

                <button
                  type="button"
                  onClick={() => navigate("/cart")}
                  className="mt-3 w-full rounded-2xl border border-slate-300 px-4 py-3 text-sm font-semibold text-slate-700 hover:bg-slate-50 dark:border-slate-700 dark:text-slate-200 dark:hover:bg-slate-800"
                >
                  Back to cart
                </button>
              </div>
            </div>
          </aside>
        </div>
      )}

      <AddressModal
        open={showAddressModal}
        initialValues={addressForm}
        saving={savingAddress}
        mapsKey={mapsKey}
        title={isAuthenticated ? "Add New Address" : "Delivery Address"}
        description={
          isAuthenticated
            ? "Save a delivery address without leaving checkout."
            : "Use this delivery address to estimate shipping and resume checkout after login."
        }
        submitLabel={isAuthenticated ? "Save address" : "Use this address"}
        onClose={() => {
          setShowAddressModal(false);
          if (selectedAddress) {
            setAddressForm(getAddressFormFromSavedAddress(selectedAddress));
          }
        }}
        onSubmit={handleAddressModalSubmit}
      />

      <InlineToast toast={toast} onClose={() => setToast(null)} />

      {verifyingPayment ? (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-slate-950/70 px-6 backdrop-blur-sm">
          <div className="w-full max-w-sm rounded-[2rem] bg-white p-6 text-center shadow-2xl dark:bg-slate-900">
            <div className="mx-auto h-12 w-12 animate-spin rounded-full border-4 border-slate-200 border-t-[color:var(--commerce-accent)] dark:border-slate-700 dark:border-t-[color:var(--commerce-accent)]" />
            <h2 className="mt-5 text-xl font-semibold text-slate-950 dark:text-white">Verifying payment securely...</h2>
            <p className="mt-2 text-sm text-slate-600 dark:text-slate-300">
              Please wait while we confirm your Razorpay payment and create the order.
            </p>
            <div className="mt-5">
              <Link to="/orders" className="text-sm font-medium text-blue-600 hover:underline">
                View orders instead
              </Link>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
