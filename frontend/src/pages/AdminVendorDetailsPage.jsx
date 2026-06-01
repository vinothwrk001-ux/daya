import { useEffect, useState } from "react";
import { requestInput } from "../services/notificationService";
import { Link, useNavigate, useParams } from "react-router-dom";
import { approveSeller, getSellerDetails, rejectSeller } from "../services/adminApi";
import { StatusBadge } from "../components/StatusBadge";
import { resolveApiAssetUrl } from "../utils/resolveUrl";

function normalizeError(err) {
  return err?.response?.data?.message || err?.message || "Request failed";
}

export function AdminVendorDetailsPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [vendor, setVendor] = useState(null);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [brokenImages, setBrokenImages] = useState({});

  useEffect(() => {
    let alive = true;

    (async () => {
      setLoading(true);
      setError("");
      try {
        const res = await getSellerDetails(id);
        if (alive) setVendor(res.data);
      } catch (err) {
        if (alive) setError(normalizeError(err));
      } finally {
        if (alive) setLoading(false);
      }
    })();

    return () => {
      alive = false;
    };
  }, [id]);

  async function handleApprove() {
    setBusy(true);
    setError("");
    try {
      const res = await approveSeller(id);
      setVendor(res.data);
    } catch (err) {
      setError(normalizeError(err));
    } finally {
      setBusy(false);
    }
  }

  async function handleReject() {
    const reason = (await requestInput({ title: "Reject vendor", label: "Rejection reason", required: false, multiline: true })) || "";
    setBusy(true);
    setError("");
    try {
      const res = await rejectSeller(id, reason);
      setVendor(res.data);
    } catch (err) {
      setError(normalizeError(err));
    } finally {
      setBusy(false);
    }
  }

  if (loading) {
    return <div className="h-72 animate-pulse rounded-3xl bg-slate-100 dark:bg-slate-800" />;
  }

  if (!vendor) {
    return (
      <div className="rounded-3xl border border-dashed border-slate-300 px-4 py-12 text-center text-sm text-slate-500 dark:border-slate-700 dark:text-slate-400">
        Seller not found.
      </div>
    );
  }

  return (
    <div className="grid gap-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <div className="text-sm text-slate-500 dark:text-slate-400">Seller application</div>
          <div className="mt-1 text-2xl font-semibold text-slate-950 dark:text-white">{vendor.companyName || "Unnamed seller"}</div>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <StatusBadge value={vendor.status} />
          <Link to={`/admin/vendors/${id}/finance`} className="rounded-xl border border-slate-300 px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 dark:border-slate-700 dark:text-slate-200 dark:hover:bg-slate-800">Finance</Link>
          <button type="button" onClick={() => navigate("/admin/sellers")} className="rounded-xl border border-slate-300 px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 dark:border-slate-700 dark:text-slate-200 dark:hover:bg-slate-800">Back</button>
        </div>
      </div>

      {error ? (
        <div className="rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-800 dark:border-rose-900 dark:bg-rose-950/30 dark:text-rose-200">
          {error}
        </div>
      ) : null}

      <div className="grid gap-4 xl:grid-cols-[1.2fr_1fr]">
        <section className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900">
          <h2 className="text-lg font-semibold text-slate-950 dark:text-white">Business profile</h2>
          <div className="mt-4 grid gap-3 text-sm text-slate-600 dark:text-slate-300">
            <div>Vendor ID: {vendor.vendorCode || vendor._id}</div>
            <div>Owner: {vendor.userId?.name || "Unknown"}</div>
            <div>Email: {vendor.userId?.email || "No email"}</div>
            <div>Phone: {vendor.userId?.phone || "No phone"}</div>
            <div>Address: {vendor.address || "Not provided"}</div>
            <div>Shop: {vendor.shopName || "Not provided"}</div>
            <div>GST: {vendor.noGst ? "No GST" : vendor.gstNumber || "Not provided"}</div>
            <div>Step completed: {vendor.stepCompleted || 0}/4</div>
          </div>

          <div className="mt-5 grid gap-3 sm:grid-cols-2">
            {(vendor.documents || []).map((doc, idx) => (
              <a
                key={doc.url + idx}
                href={resolveApiAssetUrl(doc.url)}
                target="_blank"
                rel="noreferrer"
                className="rounded-2xl border border-slate-200 px-4 py-3 text-sm font-medium text-slate-700 hover:bg-slate-50 dark:border-slate-800 dark:text-slate-200 dark:hover:bg-slate-800"
              >
                Open document {idx + 1}
              </a>
            ))}
          </div>
        </section>

        <section className="grid gap-4">
          <div className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900">
            <h2 className="text-lg font-semibold text-slate-950 dark:text-white">Bank details</h2>
            <div className="mt-4 grid gap-2 text-sm text-slate-600 dark:text-slate-300">
              <div>Account number: {vendor.bankDetails?.accountNumber || "Not provided"}</div>
              <div>IFSC: {vendor.bankDetails?.IFSC || "Not provided"}</div>
              <div>Holder name: {vendor.bankDetails?.holderName || "Not provided"}</div>
            </div>
          </div>

          <div className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900">
            <h2 className="text-lg font-semibold text-slate-950 dark:text-white">Decision</h2>
            {vendor.rejectionReason ? (
              <div className="mt-4 rounded-2xl bg-rose-50 px-4 py-3 text-sm text-rose-700 dark:bg-rose-950/40 dark:text-rose-200">
                {vendor.rejectionReason}
              </div>
            ) : null}
            <div className="mt-4 flex flex-wrap gap-2">
              <button
                type="button"
                disabled={busy || vendor.status === "approved"}
                onClick={handleApprove}
                className="rounded-xl bg-emerald-600 px-3 py-2 text-sm font-medium text-white hover:bg-emerald-700 disabled:opacity-50"
              >
                Approve
              </button>
              <button
                type="button"
                disabled={busy}
                onClick={handleReject}
                className="rounded-xl border border-rose-200 bg-rose-50 px-3 py-2 text-sm font-medium text-rose-700 hover:bg-rose-100 disabled:opacity-50 dark:border-rose-900 dark:bg-rose-950 dark:text-rose-200"
              >
                Reject
              </button>
            </div>
          </div>
        </section>
      </div>

      {(vendor.shopImages || []).length ? (
        <section className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900">
          <div className="flex items-center justify-between gap-3">
            <h2 className="text-lg font-semibold text-slate-950 dark:text-white">Shop images</h2>
            <Link to="/admin/sellers" className="text-sm font-medium text-blue-600 hover:underline">
              Back to sellers
            </Link>
          </div>
          <div className="mt-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
            {vendor.shopImages.map((image, idx) => (
              <div key={image.url + idx} className="overflow-hidden rounded-2xl border border-slate-200 bg-slate-100 dark:border-slate-800">
                {brokenImages[idx] ? (
                  <div className="flex h-44 w-full items-center justify-center bg-slate-100 text-sm text-slate-500 dark:bg-slate-900 dark:text-slate-400">
                    Image unavailable
                  </div>
                ) : (
                  <img
                    src={resolveApiAssetUrl(image.url)}
                    alt={`Shop ${idx + 1}`}
                    loading="lazy"
                    className="h-44 w-full object-cover"
                    onError={() =>
                      setBrokenImages((current) => ({
                        ...current,
                        [idx]: true,
                      }))
                    }
                  />
                )}
              </div>
            ))}
          </div>
        </section>
      ) : null}
    </div>
  );
}
