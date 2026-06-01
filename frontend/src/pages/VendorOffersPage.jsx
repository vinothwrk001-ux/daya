import { useEffect, useState } from "react";
import { requestInput } from "../services/notificationService";
import { StatusBadge } from "../components/StatusBadge";
import { VendorDataTable, VendorSection } from "../components/VendorPanel";
import * as vendorDashboardService from "../services/vendorDashboardService";

export function VendorOffersPage() {
  const [data, setData] = useState(null);
  const [error, setError] = useState("");

  async function load() {
    try {
      const response = await vendorDashboardService.getVendorOffers({ limit: 20 });
      setData(response.data);
      setError("");
    } catch (err) {
      setError(err?.response?.data?.message || "Failed to load offers.");
    }
  }

  useEffect(() => {
    (async () => {
      await load();
    })();
  }, []);

  async function createOffer() {
    const title = await requestInput({ title: "Create offer", label: "Offer title" });
    if (!title) return;
    const code = await requestInput({ title: "Create offer", label: "Coupon code" });
    if (!code) return;
    const type = await requestInput({ title: "Create offer", label: "Type: PERCENTAGE or FIXED", defaultValue: "PERCENTAGE" });
    if (!type) return;
    const value = await requestInput({ title: "Create offer", label: "Discount value", defaultValue: "10" });
    if (value == null) return;

    try {
      await vendorDashboardService.createVendorOffer({
        title,
        code,
        type,
        value: Number(value),
        startsAt: new Date().toISOString(),
        endsAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
        isActive: true,
      });
      await load();
    } catch (err) {
      setError(err?.response?.data?.message || "Failed to create offer.");
    }
  }

  async function toggleOffer(offer) {
    try {
      await vendorDashboardService.updateVendorOffer(offer._id, { isActive: !offer.isActive });
      await load();
    } catch (err) {
      setError(err?.response?.data?.message || "Failed to update offer.");
    }
  }

  return (
    <VendorSection
      title="Discounts & Offers"
      description="Create promotional campaigns, coupon codes, and limited-time discounts."
      action={
        <button onClick={createOffer} className="rounded-xl bg-slate-900 px-3 py-2 text-sm font-medium text-white dark:bg-white dark:text-slate-950">
          Create Offer
        </button>
      }
    >
      {error ? <div className="mb-4 rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">{error}</div> : null}
      <VendorDataTable
        rows={(data?.offers || []).map((offer) => ({
          ...offer,
          id: offer._id,
          window: `${new Date(offer.startsAt).toLocaleDateString()} - ${new Date(offer.endsAt).toLocaleDateString()}`,
        }))}
        columns={[
          { key: "title", label: "Offer" },
          { key: "code", label: "Code" },
          { key: "type", label: "Type" },
          { key: "value", label: "Value" },
          { key: "window", label: "Window" },
          { key: "isActive", label: "Status", render: (row) => <StatusBadge value={row.isActive ? "Active" : "Disabled"} /> },
          {
            key: "actions",
            label: "Action",
            render: (row) => (
              <button onClick={() => toggleOffer(row)} className="rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-medium hover:bg-slate-50 dark:border-slate-700 dark:hover:bg-slate-800">
                {row.isActive ? "Pause" : "Activate"}
              </button>
            ),
          },
        ]}
      />
    </VendorSection>
  );
}
