import { useEffect, useState } from "react";
import { formatCurrency } from "../../utils/formatCurrency";
import { formatWeight } from "../../utils/weight";

function AnimatedAmount({ value, freeLabel = "", className = "" }) {
  const numericValue = Number(value || 0);
  const [isChanging, setIsChanging] = useState(false);

  useEffect(() => {
    setIsChanging(true);
    const timer = window.setTimeout(() => setIsChanging(false), 320);
    return () => window.clearTimeout(timer);
  }, [numericValue]);

  return (
    <span
      className={`${className} inline-block transition-all duration-300 ${
        isChanging ? "translate-y-[-1px] scale-[1.03] text-[color:var(--commerce-accent)]" : ""
      }`}
    >
      {numericValue === 0 && freeLabel ? freeLabel : formatCurrency(numericValue)}
    </span>
  );
}

export function PriceBreakdown({ breakdown }) {
  if (!breakdown) return null;

  const hasDynamicCharges = Array.isArray(breakdown.charges);
  const itemCount = breakdown.itemCount || 1;
  const shippingCharge = hasDynamicCharges
    ? breakdown.charges.find((charge) => charge.key === "shipping_cost")
    : null;
  const shippingCostBreakdown = shippingCharge?.metadata?.costBreakdown || null;
  const nonShippingCharges = hasDynamicCharges
    ? breakdown.charges.filter((charge) => charge.key !== "shipping_cost")
    : [];
  const shippingAmount = Number(shippingCharge?.amount || 0);
  const shippingDiscount = Number(shippingCostBreakdown?.freeShippingDiscount || 0);
  const baseShipping = Number(shippingCostBreakdown?.basePrice || 0);
  const extraShipping = Number(shippingCostBreakdown?.extraCost || 0);

  return (
    <div className="rounded-[1.75rem] border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900">
      <div className="text-sm font-semibold uppercase tracking-[0.18em] text-slate-500 dark:text-slate-400">
        Price Breakdown
      </div>

      <div className="mt-4 space-y-3 text-sm text-slate-600 dark:text-slate-300">
        <div className="flex items-center justify-between">
          <span>{hasDynamicCharges ? "Subtotal" : `MRP (${itemCount} ${itemCount === 1 ? "item" : "items"})`}</span>
          <AnimatedAmount
            value={hasDynamicCharges ? breakdown.subtotal || 0 : breakdown.mrp || 0}
            className="font-medium text-slate-950 dark:text-white"
          />
        </div>

        {!hasDynamicCharges && breakdown.discount > 0 ? (
          <div className="flex items-center justify-between">
            <span>Item Discount</span>
            <span className="font-medium text-emerald-600 dark:text-emerald-400">- <AnimatedAmount value={breakdown.discount} /></span>
          </div>
        ) : null}

        {!hasDynamicCharges && breakdown.discount > 0 ? (
          <div className="flex items-center justify-between border-t border-dashed border-slate-200 pt-3 dark:border-slate-800">
            <span>Subtotal</span>
            <AnimatedAmount value={breakdown.subtotal || 0} className="font-medium text-slate-950 dark:text-white" />
          </div>
        ) : null}

        {hasDynamicCharges ? (
          <>
            {shippingCostBreakdown ? (
              <>
                {extraShipping > 0 || shippingDiscount > 0 ? (
                  <>
                    <div className="flex items-center justify-between">
                      <span>Base shipping</span>
                      <AnimatedAmount value={baseShipping} className="font-medium text-slate-950 dark:text-white" />
                    </div>

                    {extraShipping > 0 ? (
                      <div className="flex items-center justify-between">
                        <span>Extra weight charge</span>
                        <AnimatedAmount value={extraShipping} className="font-medium text-slate-950 dark:text-white" />
                      </div>
                    ) : null}

                    {shippingDiscount > 0 ? (
                      <div className="flex items-center justify-between text-emerald-600 dark:text-emerald-400">
                        <span>Shipping discount</span>
                        <span className="font-medium">- <AnimatedAmount value={shippingDiscount} /></span>
                      </div>
                    ) : null}
                  </>
                ) : null}

                <div className="flex items-center justify-between">
                  <span>Shipping fee</span>
                  <AnimatedAmount value={shippingAmount} freeLabel="Free" className="font-medium text-slate-950 dark:text-white" />
                </div>
              </>
            ) : shippingCharge ? (
              <div className="flex items-center justify-between">
                <span>Shipping</span>
                <AnimatedAmount value={shippingAmount} freeLabel="Free" className="font-medium text-slate-950 dark:text-white" />
              </div>
            ) : null}

            {nonShippingCharges.map((charge) => (
              <div key={charge.id || charge.key} className="flex items-center justify-between">
                <span>{charge.displayName || charge.key}</span>
                <AnimatedAmount value={charge.amount || 0} className="font-medium text-slate-950 dark:text-white" />
              </div>
            ))}

            <div className="flex items-center justify-between border-t border-dashed border-slate-200 pt-3 dark:border-slate-800">
              <span>Total Charges</span>
              <AnimatedAmount value={breakdown.chargesTotal || 0} className="font-medium text-slate-950 dark:text-white" />
            </div>
          </>
        ) : (
          <>
            <div className="flex items-center justify-between">
            <span>Delivery Fee</span>
              <AnimatedAmount value={breakdown.deliveryFee || 0} freeLabel="Free" className="font-medium text-slate-950 dark:text-white" />
            </div>

            {breakdown.platformFee > 0 ? (
              <div className="flex items-center justify-between">
                <span>Platform Fee</span>
                <span className="font-medium text-slate-950 dark:text-white">+ <AnimatedAmount value={breakdown.platformFee} /></span>
              </div>
            ) : null}

            {breakdown.handlingFee > 0 ? (
              <div className="flex items-center justify-between">
                <span>Handling Charge</span>
                <span className="font-medium text-slate-950 dark:text-white">+ <AnimatedAmount value={breakdown.handlingFee} /></span>
              </div>
            ) : null}

            <div className="flex items-center justify-between">
              <span>Taxes & Fees</span>
              <AnimatedAmount value={breakdown.taxAmount || 0} className="font-medium text-slate-950 dark:text-white" />
            </div>
          </>
        )}
      </div>

      <div className="mt-4 flex items-center justify-between border-t border-dashed border-slate-200 pt-4 text-base font-semibold text-slate-950 dark:border-slate-800 dark:text-white">
        <span>Total Amount</span>
        <AnimatedAmount value={breakdown.totalAmount || 0} className="text-lg" />
      </div>

      {shippingCharge?.metadata?.weight ? (
        <div className="mt-3 text-sm text-slate-500 dark:text-slate-400">
          Shipment weight: {formatWeight(shippingCharge.metadata.weight, "kg")}
        </div>
      ) : null}

      {shippingCostBreakdown?.freeShippingApplied ? (
        <div className="mt-2 text-sm text-emerald-600 dark:text-emerald-400">
          Free shipping applied above {formatCurrency(shippingCostBreakdown.freeShippingThreshold || 0)}.
        </div>
      ) : null}

      {!hasDynamicCharges && breakdown.totalSavings > 0 ? (
        <div className="mt-4 rounded-2xl bg-emerald-50 px-4 py-3 text-sm font-medium text-emerald-700 dark:bg-emerald-500/10 dark:text-emerald-300">
          You save {formatCurrency(breakdown.totalSavings)} on this order!
        </div>
      ) : null}

      {!hasDynamicCharges && breakdown.deliveryFee === 0 && breakdown.mrp > 0 ? (
        <div className="mt-4 rounded-2xl bg-blue-50 px-4 py-3 text-sm font-medium text-blue-700 dark:bg-blue-500/10 dark:text-blue-300">
          Qualified for free delivery!
        </div>
      ) : null}

      {shippingCharge?.metadata?.matchType?.startsWith("zone_fallback") ? (
        <div className="mt-4 rounded-2xl bg-amber-50 px-4 py-3 text-sm font-medium text-amber-700 dark:bg-amber-500/10 dark:text-amber-300">
          Shipping matched a fallback rule for {shippingCharge.metadata.state} because no exact {shippingCharge.metadata.zone} zone rule was found.
        </div>
      ) : null}
    </div>
  );
}
