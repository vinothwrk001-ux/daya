import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { BackButton } from "../components/BackButton";
import * as vendorService from "../services/vendorService";

export function VendorStatusPage() {
  const nav = useNavigate();
  const [loading, setLoading] = useState(true);
  const [vendor, setVendor] = useState(null);
  const [error, setError] = useState("");

  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const res = await vendorService.getVendorMe();
        if (!alive) return;
        setVendor(res.data);
        if (res.data.status === "approved") nav("/dashboard/vendor", { replace: true });
      } catch (e) {
        if (!alive) return;
        if (e?.response?.status === 404) {
          nav("/vendor/onboarding", { replace: true });
          return;
        }
        setError(e?.response?.data?.message || "Failed to load vendor status");
      } finally {
        if (alive) setLoading(false);
      }
    })();
    return () => {
      alive = false;
    };
  }, [nav]);

  if (loading) return <div className="text-sm text-slate-600">Loading...</div>;

  if (error) {
    return (
      <div className="rounded-2xl border bg-white p-6 shadow-sm">
        <div className="text-sm font-medium">Vendor profile</div>
        <p className="mt-2 text-sm text-rose-700">{error}</p>
        <Link className="mt-4 inline-block text-sm text-indigo-600 hover:underline" to="/vendor/onboarding">
          Start onboarding →
        </Link>
      </div>
    );
  }

  const status = vendor?.status || "draft";
  const step = vendor?.stepCompleted ?? 0;

  return (
    <div className="grid gap-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold tracking-tight">Vendor Status</h1>
        <BackButton />
      </div>
      <div className="rounded-2xl border bg-white p-6 shadow-sm">
        <div className="text-sm text-slate-600">Current status</div>
        <div className="mt-2 text-lg font-semibold capitalize">{status}</div>
        <div className="mt-2 text-sm text-slate-700">Step completed: {step}/4</div>
        {status === "rejected" && vendor?.rejectionReason ? (
          <div className="mt-3 rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-800">
            {vendor.rejectionReason}
          </div>
        ) : null}

        {status !== "approved" ? (
          <div className="mt-4 flex flex-wrap gap-3">
            <Link
              to="/vendor/onboarding"
              className="rounded-lg bg-slate-900 px-4 py-2 text-sm font-medium text-white hover:bg-slate-800"
            >
              Continue onboarding
            </Link>
            {status === "pending" ? (
              <span className="rounded-lg border px-4 py-2 text-sm text-slate-700">
                Waiting for admin approval
              </span>
            ) : null}
          </div>
        ) : null}
      </div>
    </div>
  );
}

