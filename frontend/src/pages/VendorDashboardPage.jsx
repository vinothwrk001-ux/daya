import { useEffect, useState } from "react";
import { Navigate } from "react-router-dom";
import * as vendorService from "../services/vendorService";
import { getVendorAccessRedirect } from "../utils/vendorAccess";

export function VendorDashboardPage() {
  const [loading, setLoading] = useState(true);
  const [destination, setDestination] = useState("");
  const [error, setError] = useState("");

  useEffect(() => {
    let active = true;
    vendorService
      .getVendorMe()
      .then((response) => {
        if (!active) return;
        setDestination(getVendorAccessRedirect(response.data) || "/vendor/dashboard");
      })
      .catch((err) => {
        if (!active) return;
        const redirect = err?.response?.data?.details?.redirect;
        if (redirect) {
          setDestination(redirect);
        } else if (err?.response?.status === 404) {
          setDestination("/vendor/onboarding");
        } else {
          setError(err?.response?.data?.message || "Failed to load vendor profile");
        }
      })
      .finally(() => {
        if (active) setLoading(false);
      });

    return () => {
      active = false;
    };
  }, []);

  if (loading) return <div className="text-sm text-slate-600">Loading vendor access...</div>;
  if (error) return <div className="text-sm text-rose-700">{error}</div>;
  return <Navigate to={destination || "/vendor/onboarding"} replace />;
}
