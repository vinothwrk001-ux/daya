import { useEffect, useMemo, useRef, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { AddressModal } from "../components/AddressModal";
import { BackButton } from "../components/BackButton";
import { AddressCard } from "../components/commerce/AddressCard";
import { CheckoutStepper } from "../components/commerce/CheckoutStepper";
import { InlineToast } from "../components/commerce/InlineToast";
import { OrderSummaryCard } from "../components/commerce/OrderSummaryCard";
import { PriceBreakdown } from "../components/commerce/PriceBreakdown";
import * as cartService from "../services/cartService";
import * as checkoutService from "../services/checkoutService";
import * as paymentService from "../services/paymentService";
import * as pricingService from "../services/pricingService";
import * as userService from "../services/userService";
import { formatCurrency } from "../utils/formatCurrency";
import {
  EMPTY_ADDRESS_FORM,
  buildPriceBreakdown,
  getAddressFormFromSavedAddress,
  getDefaultAddress,
  getShippingAddressFromForm,
  getShippingAddressFromSavedAddress,
  getSummaryItems,
  isAddressFormValid,
} from "../utils/checkout";
import { loadTrackingContext } from "../utils/influencerTracking";

const CHECKOUT_SUCCESS_STORAGE_KEY = "checkoutSuccessPayload";

function normalizeError(err) {
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

function ensureRazorpay() {
  if (typeof window !== "undefined" && typeof window.Razorpay === "function") {
    return Promise.resolve();
  }

  return new Promise((resolve, reject) => {
    const existing = document.querySelector('script[data-razorpay-sdk="true"]');
    if (existing) {
      const timeoutId = setTimeout(() => {
        reject(new Error("Razorpay SDK loading timeout. Please check your internet connection."));
      }, 30000); // 30 second timeout
      existing.addEventListener("load", () => {
        clearTimeout(timeoutId);
        resolve();
      }, { once: true });
      existing.addEventListener("error", () => {
        clearTimeout(timeoutId);
        reject(new Error("Failed to load Razorpay checkout."));
      }, { once: true });
      return;
    }

    const script = document.createElement("script");
    script.src = "https://checkout.razorpay.com/v1/checkout.js";
    script.async = true;
    script.dataset.razorpaySdk = "true";
    
    const timeoutId = setTimeout(() => {
      reject(new Error("Razorpay SDK loading timeout. Please check your internet connection and try again."));
    }, 30000); // 30 second timeout
    
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
  const [currentStep, setCurrentStep] = useState("address");
  const [showAddressSelector, setShowAddressSelector] = useState(false);
  const [showAddressModal, setShowAddressModal] = useState(false);
  const [toast, setToast] = useState(null);
  const [pricingConfig, setPricingConfig] = useState(null);
  const [amountPulse, setAmountPulse] = useState(false);
  const [codAvailability, setCodAvailability] = useState(null);
  const mapsKey = import.meta.env.VITE_GOOGLE_MAPS_API_KEY;
  const didMountPaymentMethodRef = useRef(false);

  async function loadPreparedCheckout(shippingAddress, selectedPaymentMethod = paymentMethod) {
    const trackingContext = loadTrackingContext();
    // Only send shippingAddress if it has a valid fullName
    const payload = {};
    if (shippingAddress && String(shippingAddress?.fullName || "").trim()) {
      payload.shippingAddress = shippingAddress;
    }
    payload.paymentMethod = selectedPaymentMethod;
    if (trackingContext?.trackingToken) payload.trackingToken = trackingContext.trackingToken;
    const checkoutRes = await checkoutService.prepareCheckout(payload);
    return checkoutRes?.data || null;
  }

  async function refresh() {
    setLoading(true);
    setError("");
    try {
      const [addressRes, pricingRes] = await Promise.all([
        userService.getUserAddresses(),
        pricingService.getPricingConfig().catch(() => ({ data: null })),
      ]);

      const nextAddresses = Array.isArray(addressRes?.data) ? addressRes.data : [];
      const nextPricingConfig = pricingRes?.data || null;
      const defaultAddress = getDefaultAddress(nextAddresses);
      const nextSummary = await loadPreparedCheckout(
        defaultAddress ? getShippingAddressFromSavedAddress(defaultAddress) : null
      );

      setSummary(nextSummary);
      setCodAvailability(nextSummary?.codAvailability || null);
      setAddresses(nextAddresses);
      setPricingConfig(nextPricingConfig);

      if (defaultAddress) {
        setSelectedAddressId(defaultAddress._id);
        setAddressForm(getAddressFormFromSavedAddress(defaultAddress));
        setShowAddressModal(false);
      } else {
        setSelectedAddressId("");
        setAddressForm(EMPTY_ADDRESS_FORM);
        setShowAddressModal(true);
      }
    } catch (err) {
      setError(normalizeError(err));
      setSummary(null);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    refresh();
  }, []);

  useEffect(() => {
    if (!didMountPaymentMethodRef.current) {
      didMountPaymentMethodRef.current = true;
      return;
    }

    const activeShippingAddress = getActiveShippingAddress();
    setError("");
    loadPreparedCheckout(activeShippingAddress, paymentMethod)
      .then((nextSummary) => {
        setSummary(nextSummary);
        setCodAvailability(nextSummary?.codAvailability || null);
        setAmountPulse(true);
      })
      .catch((err) => setError(normalizeError(err)));
  }, [paymentMethod]);

  useEffect(() => {
    if (!amountPulse) return undefined;
    const timer = window.setTimeout(() => setAmountPulse(false), 320);
    return () => window.clearTimeout(timer);
  }, [amountPulse]);

  const selectedAddress = useMemo(
    () => addresses.find((address) => String(address?._id) === String(selectedAddressId)) || null,
    [addresses, selectedAddressId]
  );
  const orderItems = useMemo(() => getSummaryItems(summary), [summary]);
  
  // Use dynamic pricing breakdown from API response (includes all active pricing rules)
  const totalAmount = useMemo(() => {
    return summary?.total || summary?.totalAmount || 0;
  }, [summary]);

  // Build summary for display that includes dynamic charges
  const priceBreakdown = useMemo(() => {
    if (!summary) return null;
    
    // New API response includes charges and total from pricing engine
    if (summary.charges && summary.chargesTotal !== undefined) {
      return {
        subtotal: summary.subtotal || 0,
        charges: summary.charges,
        chargesTotal: summary.chargesTotal || 0,
        totalAmount: summary.total || 0,
      };
    }
    
    // Fall back to old calculation method if new format not available
    if (pricingConfig) {
      return pricingService.calculatePriceBreakdown({
        subtotal: Number(summary?.subtotal || 0),
        discount: Math.max((Number(summary?.originalAmount || summary?.subtotal || 0) - Number(summary?.subtotal || 0)), 0),
        itemCount: getSummaryItems(summary).reduce((sum, item) => sum + Number(item?.quantity || 0), 0),
        pricingConfig,
      });
    }
    
    // Fallback to legacy method
    return buildPriceBreakdown(summary);
  }, [summary, pricingConfig]);
  const activeShippingAddress = useMemo(() => {
    if (selectedAddress) {
      return getShippingAddressFromSavedAddress(selectedAddress);
    }
    return getShippingAddressFromForm(addressForm);
  }, [selectedAddress, addressForm]);
  const hasUsableAddress = selectedAddress
    ? hasValidShippingAddress(activeShippingAddress)
    : isAddressFormValid(addressForm) && hasValidShippingAddress(activeShippingAddress);
  const unlockedSteps = useMemo(() => (hasUsableAddress ? ["address", "summary", "payment"] : ["address"]), [hasUsableAddress]);

  function getActiveShippingAddress() {
    return activeShippingAddress;
  }

  async function handleQuantityChange(productId, variantId, quantity) {
    setUpdatingItemId(`${String(productId)}:${variantId || ""}`);
    setError("");
    try {
      await cartService.updateCartItem(productId, quantity, variantId);
      const nextSummary = await loadPreparedCheckout(getActiveShippingAddress(), paymentMethod);
      setSummary(nextSummary);
      setCodAvailability(nextSummary?.codAvailability || null);
      setAmountPulse(true);
      setToast({ type: "success", message: "Order summary updated." });
    } catch (err) {
      setError(normalizeError(err));
    } finally {
      setUpdatingItemId("");
    }
  }

  async function handleRemoveItem(productId, variantId) {
    setUpdatingItemId(`${String(productId)}:${variantId || ""}`);
    setError("");
    try {
      await cartService.removeCartItem(productId, variantId);
      try {
        const nextSummary = await loadPreparedCheckout(getActiveShippingAddress(), paymentMethod);
        // Check if summary has items by using getSummaryItems
        const remainingItems = getSummaryItems(nextSummary);
        if (!nextSummary || remainingItems.length === 0) {
          setSummary(null);
          setToast({ type: "success", message: "Item removed. Your checkout is now empty." });
        } else {
          // If there are items remaining, keep the summary
          setSummary(nextSummary);
          setCodAvailability(nextSummary?.codAvailability || null);
          setAmountPulse(true);
          setToast({ type: "success", message: "Item removed from checkout." });
        }
      } catch (err) {
        const normalizedMessage = normalizeError(err);
        // Only empty the cart if error explicitly says cart is empty
        if (/cart is empty|no items|items.*empty/i.test(normalizedMessage)) {
          setSummary(null);
          setToast({ type: "success", message: "Item removed. Your checkout is now empty." });
        } else {
          // For other errors, show error and don't modify summary
          setError(normalizedMessage);
        }
      }
    } catch (err) {
      setError(normalizeError(err));
    } finally {
      setUpdatingItemId("");
    }
  }

  async function handleAddressModalSubmit(payload, formSnapshot) {
    setSavingAddress(true);
    setError("");
    try {
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
        createdAddress ? getShippingAddressFromSavedAddress(createdAddress) : getShippingAddressFromForm(formSnapshot),
        paymentMethod
      );
      setSummary(nextSummary);
      setCodAvailability(nextSummary?.codAvailability || null);
      setAmountPulse(true);
      setToast({ type: "success", message: "Address saved and selected for delivery." });
      setCurrentStep("summary");
    } catch (err) {
      setError(normalizeError(err));
    } finally {
      setSavingAddress(false);
    }
  }

  async function placeOrder() {
    const shippingAddress = getActiveShippingAddress();

    if (!hasValidShippingAddress(shippingAddress)) {
      setCurrentStep("address");
      setToast({ type: "error", message: "Complete the delivery address, including recipient name, before payment." });
      return;
    }
    if (paymentMethod === "COD" && codAvailability?.codAvailable === false) {
      setToast({ type: "error", message: "Cash on Delivery is not available for this address." });
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
        navigate("/checkout/success", { replace: true, state: { orders, payment } });
        return;
      }

      const orderRes = await paymentService.createRazorpayOrder({
        cartId: "current",
        shippingAddress,
        trackingToken: trackingContext?.trackingToken,
      });
      const razorpayData = orderRes || {};
      
      if (!razorpayData.key || !razorpayData.orderId) {
        throw new Error("Invalid Razorpay configuration. Please contact support or try again.");
      }
      
      try {
        await ensureRazorpay();
      } catch (err) {
        setToast({ type: "error", message: err.message || "Failed to load Razorpay. Please check your internet connection." });
        setPlacing(false);
        return;
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
          try {
            setVerifyingPayment(true);
            const verified = await paymentService.verifyRazorpayPayment({
              razorpay_order_id: response.razorpay_order_id,
              razorpay_payment_id: response.razorpay_payment_id,
              razorpay_signature: response.razorpay_signature,
            });
            const successPayload = {
              orders: verified?.orders || [],
              payment: verified?.payment || null,
            };
            persistCheckoutSuccessPayload(successPayload);
            navigate("/checkout/success", {
              replace: true,
              state: successPayload,
            });
          } catch (verifyError) {
            setError(normalizeError(verifyError));
            setToast({ type: "error", message: "Payment verification failed. Please retry or open your orders." });
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
    } catch (err) {
      setError(normalizeError(err));
    } finally {
      setPlacing(false);
    }
  }

  return (
    <div className="grid gap-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <div className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-500 dark:text-slate-400">Secure checkout</div>
          <h1 className="mt-2 text-3xl font-bold tracking-tight text-slate-950 dark:text-white">Address, summary, payment</h1>
          <p className="mt-1 text-sm text-slate-600 dark:text-slate-300">Live cart validation, saved addresses, current location, and secure Razorpay handoff.</p>
        </div>
        <BackButton fallbackTo="/cart" />
      </div>

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
            onClick={() => navigate("/")}
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
                  <div className="text-sm font-semibold uppercase tracking-[0.18em] text-slate-500 dark:text-slate-400">Step 1</div>
                  <h2 className="mt-1 text-xl font-semibold text-slate-950 dark:text-white">Select delivery address</h2>
                </div>
                <div className="flex flex-wrap gap-2">
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
                  <button
                    type="button"
                    onClick={() => {
                      setSelectedAddressId("");
                      setAddressForm(EMPTY_ADDRESS_FORM);
                      setShowAddressSelector(false);
                      setShowAddressModal(true);
                    }}
                    className="rounded-xl bg-slate-950 px-4 py-2 text-sm font-semibold text-white dark:bg-slate-100 dark:text-slate-950"
                  >
                    Add New Address
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
              ) : null}

              {!selectedAddress && !showAddressModal ? (
                <div className="mt-5 rounded-[1.5rem] border border-dashed border-slate-300 bg-slate-50 px-4 py-5 text-sm text-slate-600 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-300">
                  No saved address is selected yet. Add one below to continue.
                </div>
              ) : null}

              {showAddressSelector ? (
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
                            .catch((err) => setError(normalizeError(err)));
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
                  onClick={() => {
                    if (hasUsableAddress) {
                      setCurrentStep("summary");
                      return;
                    }
                    setToast({ type: "error", message: "Select or save a valid address to continue." });
                  }}
                  className="rounded-2xl bg-slate-950 px-5 py-3 text-sm font-semibold text-white dark:bg-slate-100 dark:text-slate-950"
                >
                  Continue to summary
                </button>
              </div>
            </section>

            <section className="rounded-[2rem] border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900">
              <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <div className="text-sm font-semibold uppercase tracking-[0.18em] text-slate-500 dark:text-slate-400">Step 2</div>
                  <h2 className="mt-1 text-xl font-semibold text-slate-950 dark:text-white">Review your order</h2>
                </div>
                <div className="text-sm text-slate-500 dark:text-slate-400">{orderItems.length} products ready for checkout</div>
              </div>

              <div className="mt-5 grid gap-4">
                {orderItems.map((item) => (
                  <OrderSummaryCard
                    key={`${String(item.productId)}:${item.variantId || ""}`}
                    item={item}
                    busy={updatingItemId === `${String(item.productId)}:${item.variantId || ""}`}
                    onQuantityChange={(quantity) => handleQuantityChange(String(item.productId), item.variantId || "", quantity)}
                    onRemove={() => handleRemoveItem(String(item.productId), item.variantId || "")}
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
                <div className="text-sm font-semibold uppercase tracking-[0.18em] text-slate-500 dark:text-slate-400">Step 3</div>
                <h2 className="mt-1 text-xl font-semibold text-slate-950 dark:text-white">Choose payment</h2>
              </div>

              <div className="mt-5 grid gap-3">
                {[
                  {
                    value: "COD",
                    title: "Cash on Delivery",
                    description: "Pay when the order arrives. Best for familiar delivery locations.",
                    disabled: paymentMethod !== "COD" ? Boolean(codAvailability && codAvailability.codAvailable === false) : false,
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
                <div className="text-sm font-semibold uppercase tracking-[0.18em] text-slate-500 dark:text-slate-400">Order total</div>
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
                  {paymentMethod === "ONLINE" ? "You will be redirected to Razorpay next." : "Cash will be collected on delivery."}
                </div>

                <button
                  type="button"
                  disabled={placing || !hasUsableAddress || (paymentMethod === "COD" && codAvailability?.codAvailable === false)}
                  onClick={placeOrder}
                  className="mt-5 w-full rounded-2xl bg-[color:var(--commerce-accent-warm)] px-4 py-4 text-sm font-semibold text-slate-950 shadow-sm transition hover:translate-y-[-1px] hover:shadow-lg disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {placing ? "Processing..." : paymentMethod === "ONLINE" ? "Continue to Razorpay" : "Place COD Order"}
                </button>

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
