import { useCallback, useEffect, useMemo, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { BadgeCheck, Banknote, FileCheck2, FileText, History, IdCard, ShieldCheck, Upload } from "lucide-react";
import {
  getInfluencerVerification,
  saveInfluencerVerificationBank,
  saveInfluencerVerificationTax,
  uploadInfluencerVerificationDocuments,
} from "../../services/influencerCommerceService";

const TABS = [
  ["identity", "Identity Documents", IdCard],
  ["tax", "Tax Information", FileText],
  ["bank", "Bank Information", Banknote],
  ["status", "Verification Status", ShieldCheck],
  ["history", "Approval History", History],
  ["documents", "Uploaded Documents", FileCheck2],
];

function StatusBadge({ value }) {
  const status = String(value || "not_submitted").replace(/_/g, " ");
  const tone = status.includes("verified") || status.includes("approved")
    ? "bg-emerald-50 text-emerald-700 dark:bg-emerald-950/30 dark:text-emerald-200"
    : status.includes("rejected") || status.includes("expired")
      ? "bg-rose-50 text-rose-700 dark:bg-rose-950/30 dark:text-rose-200"
      : "bg-amber-50 text-amber-700 dark:bg-amber-950/30 dark:text-amber-200";
  return <span className={`rounded-full px-2.5 py-1 text-xs font-semibold capitalize ${tone}`}>{status}</span>;
}

function DataTable({ columns, rows, empty = "No records found." }) {
  return (
    <div className="overflow-x-auto rounded-2xl border border-slate-200 bg-white shadow-sm dark:border-slate-800 dark:bg-slate-900">
      <table className="min-w-full divide-y divide-slate-200 text-sm dark:divide-slate-800">
        <thead className="bg-slate-50 text-xs uppercase tracking-wide text-slate-500 dark:bg-slate-950/50 dark:text-slate-400">
          <tr>{columns.map((column) => <th key={column.key} className="px-4 py-3 text-left">{column.label}</th>)}</tr>
        </thead>
        <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
          {rows.length ? rows.map((row, index) => (
            <tr key={row.id || row._id || index} className="text-slate-700 dark:text-slate-200">
              {columns.map((column) => <td key={column.key} className="px-4 py-3">{column.render ? column.render(row) : row[column.key]}</td>)}
            </tr>
          )) : (
            <tr><td className="px-4 py-10 text-center text-slate-500 dark:text-slate-400" colSpan={columns.length}>{empty}</td></tr>
          )}
        </tbody>
      </table>
    </div>
  );
}

function Metric({ label, value, icon: Icon = ShieldCheck }) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-800 dark:bg-slate-900">
      <div className="flex items-center justify-between">
        <p className="text-sm text-slate-500 dark:text-slate-400">{label}</p>
        <Icon className="h-5 w-5 text-indigo-500" />
      </div>
      <div className="mt-3 text-xl font-semibold text-slate-950 dark:text-white">{value}</div>
    </div>
  );
}

function IdentityUpload({ onSubmit, busy }) {
  const [documentType, setDocumentType] = useState("passport");
  const [documentNumber, setDocumentNumber] = useState("");
  const [countryOfIssue, setCountryOfIssue] = useState("");
  const [expiryDate, setExpiryDate] = useState("");
  const [files, setFiles] = useState([]);
  return (
    <form
      onSubmit={(event) => {
        event.preventDefault();
        const form = new FormData();
        form.append("category", "identity");
        form.append("documentType", documentType);
        form.append("documentNumber", documentNumber);
        form.append("countryOfIssue", countryOfIssue);
        if (expiryDate) form.append("expiryDate", new Date(expiryDate).toISOString());
        Array.from(files).forEach((file) => form.append("documents", file));
        onSubmit(form);
      }}
      className="grid gap-3 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900 md:grid-cols-2"
    >
      <div className="md:col-span-2">
        <h3 className="font-semibold text-slate-950 dark:text-white">Upload identity document</h3>
        <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">Passport, national ID, driver license, voter ID, residence permit, or business certificate.</p>
      </div>
      <select value={documentType} onChange={(event) => setDocumentType(event.target.value)} className="h-11 rounded-xl border border-slate-200 bg-white px-3 text-sm dark:border-slate-700 dark:bg-slate-950 dark:text-white">
        <option value="passport">Passport</option>
        <option value="national_id">National ID Card</option>
        <option value="driver_license">Driver License</option>
        <option value="residence_permit">Residence Permit</option>
        <option value="voter_id">Voter ID</option>
        <option value="business_registration">Business Registration</option>
        <option value="company_incorporation">Company Incorporation Certificate</option>
      </select>
      <input value={documentNumber} onChange={(event) => setDocumentNumber(event.target.value)} placeholder="Document number" className="h-11 rounded-xl border border-slate-200 bg-white px-3 text-sm dark:border-slate-700 dark:bg-slate-950 dark:text-white" />
      <input value={countryOfIssue} onChange={(event) => setCountryOfIssue(event.target.value)} placeholder="Country of issue" className="h-11 rounded-xl border border-slate-200 bg-white px-3 text-sm dark:border-slate-700 dark:bg-slate-950 dark:text-white" />
      <input type="date" value={expiryDate} onChange={(event) => setExpiryDate(event.target.value)} className="h-11 rounded-xl border border-slate-200 bg-white px-3 text-sm dark:border-slate-700 dark:bg-slate-950 dark:text-white" />
      <input type="file" multiple accept="image/*,application/pdf" onChange={(event) => setFiles(event.target.files || [])} className="rounded-xl border border-dashed border-slate-300 bg-slate-50 px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-950 dark:text-white md:col-span-2" />
      <button disabled={busy || !files.length} className="inline-flex h-11 items-center justify-center gap-2 rounded-xl bg-indigo-600 px-5 text-sm font-semibold text-white hover:bg-indigo-500 disabled:opacity-50 md:col-span-2">
        <Upload className="h-4 w-4" />
        Upload Document
      </button>
    </form>
  );
}

function TaxForm({ onSubmit, busy }) {
  const [form, setForm] = useState({ taxType: "PAN", taxNumber: "", legalName: "", country: "IN", registeredAddress: "" });
  const setField = (key, value) => setForm((current) => ({ ...current, [key]: value }));
  return (
    <form
      onSubmit={(event) => {
        event.preventDefault();
        const data = new FormData();
        Object.entries(form).forEach(([key, value]) => data.append(key, value));
        if (form.taxType === "PAN") data.append("panNumber", form.taxNumber);
        else if (form.taxType === "GST") data.append("gstNumber", form.taxNumber);
        else data.append("taxId", form.taxNumber);
        onSubmit(data);
      }}
      className="grid gap-3 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900 md:grid-cols-2"
    >
      <div className="md:col-span-2">
        <h3 className="font-semibold text-slate-950 dark:text-white">Tax compliance information</h3>
        <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">PAN, GST, TIN, VAT, SSN, EIN, tax residency, or business tax ID.</p>
      </div>
      <select value={form.taxType} onChange={(event) => setField("taxType", event.target.value)} className="h-11 rounded-xl border border-slate-200 bg-white px-3 text-sm dark:border-slate-700 dark:bg-slate-950 dark:text-white">
        {["PAN", "GST", "TIN", "VAT", "SSN", "EIN", "Tax ID"].map((item) => <option key={item}>{item}</option>)}
      </select>
      <input value={form.taxNumber} onChange={(event) => setField("taxNumber", event.target.value)} placeholder="Tax number" className="h-11 rounded-xl border border-slate-200 bg-white px-3 text-sm dark:border-slate-700 dark:bg-slate-950 dark:text-white" />
      <input value={form.legalName} onChange={(event) => setField("legalName", event.target.value)} placeholder="Legal name" className="h-11 rounded-xl border border-slate-200 bg-white px-3 text-sm dark:border-slate-700 dark:bg-slate-950 dark:text-white" />
      <input value={form.country} onChange={(event) => setField("country", event.target.value)} placeholder="Country" className="h-11 rounded-xl border border-slate-200 bg-white px-3 text-sm dark:border-slate-700 dark:bg-slate-950 dark:text-white" />
      <input value={form.registeredAddress} onChange={(event) => setField("registeredAddress", event.target.value)} placeholder="Registered address" className="h-11 rounded-xl border border-slate-200 bg-white px-3 text-sm dark:border-slate-700 dark:bg-slate-950 dark:text-white md:col-span-2" />
      <button disabled={busy} className="h-11 rounded-xl bg-indigo-600 px-5 text-sm font-semibold text-white hover:bg-indigo-500 disabled:opacity-50 md:col-span-2">Save Tax Information</button>
    </form>
  );
}

function BankForm({ onSubmit, busy }) {
  const [form, setForm] = useState({ paymentMethod: "bank_transfer", accountHolderName: "", bankName: "", branchName: "", accountNumber: "", ifscCode: "", swiftCode: "", routingNumber: "", upiId: "", paypalEmail: "", country: "IN", currency: "INR" });
  const setField = (key, value) => setForm((current) => ({ ...current, [key]: value }));
  return (
    <form onSubmit={(event) => { event.preventDefault(); onSubmit(form); }} className="grid gap-3 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900 md:grid-cols-2">
      <div className="md:col-span-2">
        <h3 className="font-semibold text-slate-950 dark:text-white">Bank account verification</h3>
        <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">Uses the existing payout account and bank verification infrastructure.</p>
      </div>
      {Object.entries(form).map(([key, value]) => key === "paymentMethod" ? (
        <select key={key} value={value} onChange={(event) => setField(key, event.target.value)} className="h-11 rounded-xl border border-slate-200 bg-white px-3 text-sm dark:border-slate-700 dark:bg-slate-950 dark:text-white">
          <option value="bank_transfer">Bank Transfer</option>
          <option value="upi">UPI</option>
          <option value="paypal">PayPal</option>
          <option value="wise">Wise</option>
        </select>
      ) : (
        <input key={key} value={value} onChange={(event) => setField(key, event.target.value)} placeholder={key.replace(/([A-Z])/g, " $1")} className="h-11 rounded-xl border border-slate-200 bg-white px-3 text-sm capitalize dark:border-slate-700 dark:bg-slate-950 dark:text-white" />
      ))}
      <button disabled={busy} className="h-11 rounded-xl bg-indigo-600 px-5 text-sm font-semibold text-white hover:bg-indigo-500 disabled:opacity-50 md:col-span-2">Save Bank Information</button>
    </form>
  );
}

export default function InfluencerVerificationPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const tab = searchParams.get("tab") || "identity";
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const res = await getInfluencerVerification();
      setData(res?.data || null);
    } catch (err) {
      setError(err?.response?.data?.message || "Failed to load verification center.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const activeLabel = useMemo(() => TABS.find(([id]) => id === tab)?.[1] || "Identity Documents", [tab]);

  async function submit(work, fallback) {
    setBusy(true);
    setError("");
    try {
      await work();
      await load();
    } catch (err) {
      setError(err?.response?.data?.message || fallback);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="mx-auto flex max-w-7xl flex-col gap-6">
      <section className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900">
        <p className="inline-flex items-center gap-2 rounded-full bg-indigo-50 px-3 py-1 text-xs font-semibold uppercase tracking-wide text-indigo-700 dark:bg-indigo-950/40 dark:text-indigo-200">
          <BadgeCheck className="h-3.5 w-3.5" />
          Documents & Verification
        </p>
        <h1 className="mt-3 text-2xl font-semibold text-slate-950 dark:text-white">{activeLabel}</h1>
        <p className="mt-2 max-w-3xl text-sm text-slate-600 dark:text-slate-300">
          Upload identity, tax, and bank information while reusing existing influencer application, payout, audit, and admin review workflows.
        </p>
      </section>

      {error ? <div className="rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-900 dark:border-rose-900/40 dark:bg-rose-950/30 dark:text-rose-100">{error}</div> : null}

      <section className="grid gap-3 md:grid-cols-5">
        <Metric label="Completion" value={`${data?.verificationStatus?.score || 0}%`} />
        <Metric label="Level" value={data?.verificationStatus?.level || "Basic"} />
        <Metric label="Identity" value={<StatusBadge value={data?.verificationStatus?.identity} />} />
        <Metric label="Tax" value={<StatusBadge value={data?.verificationStatus?.tax} />} />
        <Metric label="Bank" value={<StatusBadge value={data?.verificationStatus?.bank} />} />
      </section>

      <div className="flex gap-2 overflow-x-auto pb-1">
        {TABS.map(([id, label, Icon]) => (
          <button key={id} onClick={() => setSearchParams(id === "identity" ? {} : { tab: id })} className={`inline-flex whitespace-nowrap items-center gap-2 rounded-xl px-4 py-2 text-sm font-semibold ${tab === id ? "bg-indigo-600 text-white" : "border border-slate-200 bg-white text-slate-700 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-200"}`}>
            <Icon className="h-4 w-4" />
            {label}
          </button>
        ))}
      </div>

      {loading ? <div className="h-64 animate-pulse rounded-2xl bg-slate-200 dark:bg-slate-800" /> : null}

      {!loading && tab === "identity" ? (
        <div className="grid gap-4 lg:grid-cols-[0.9fr_1.1fr]">
          <IdentityUpload busy={busy} onSubmit={(form) => submit(() => uploadInfluencerVerificationDocuments(form), "Document upload failed.")} />
          <DataTable
            columns={[
              { key: "documentType", label: "Document Type" },
              { key: "status", label: "Status", render: (row) => <StatusBadge value={row.status} /> },
              { key: "uploadDate", label: "Upload Date", render: (row) => row.uploadDate ? new Date(row.uploadDate).toLocaleDateString() : "-" },
              { key: "expiryDate", label: "Expiry", render: (row) => row.expiryDate ? new Date(row.expiryDate).toLocaleDateString() : "-" },
            ]}
            rows={data?.identityDocuments || []}
            empty="No identity documents uploaded yet."
          />
        </div>
      ) : null}

      {!loading && tab === "tax" ? (
        <div className="grid gap-4 lg:grid-cols-[0.9fr_1.1fr]">
          <TaxForm busy={busy} onSubmit={(form) => submit(() => saveInfluencerVerificationTax(form), "Tax save failed.")} />
          <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900">
            <h3 className="font-semibold text-slate-950 dark:text-white">Current tax status</h3>
            <div className="mt-4 space-y-3 text-sm text-slate-600 dark:text-slate-300">
              <p>Country: <span className="font-semibold text-slate-950 dark:text-white">{data?.taxInformation?.country || "-"}</span></p>
              <p>Legal name: <span className="font-semibold text-slate-950 dark:text-white">{data?.taxInformation?.legalName || "-"}</span></p>
              <p>Status: <StatusBadge value={data?.taxInformation?.status} /></p>
            </div>
          </div>
        </div>
      ) : null}

      {!loading && tab === "bank" ? (
        <div className="grid gap-4 lg:grid-cols-[0.9fr_1.1fr]">
          <BankForm busy={busy} onSubmit={(payload) => submit(() => saveInfluencerVerificationBank(payload), "Bank save failed.")} />
          <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900">
            <h3 className="font-semibold text-slate-950 dark:text-white">Current bank information</h3>
            <div className="mt-4 space-y-3 text-sm text-slate-600 dark:text-slate-300">
              <p>Holder: <span className="font-semibold text-slate-950 dark:text-white">{data?.bankInformation?.accountHolderName || "-"}</span></p>
              <p>Bank: <span className="font-semibold text-slate-950 dark:text-white">{data?.bankInformation?.bankName || "-"}</span></p>
              <p>Method: <span className="font-semibold text-slate-950 dark:text-white">{data?.bankInformation?.paymentMethod || "-"}</span></p>
              <p>Status: <StatusBadge value={data?.bankInformation?.verificationStatus} /></p>
            </div>
          </div>
        </div>
      ) : null}

      {!loading && tab === "status" ? (
        <div className="grid gap-4 lg:grid-cols-2">
          <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900">
            <h3 className="font-semibold text-slate-950 dark:text-white">Verification progress</h3>
            <div className="mt-4 h-3 overflow-hidden rounded-full bg-slate-100 dark:bg-slate-800">
              <div className="h-full bg-indigo-600" style={{ width: `${data?.verificationStatus?.score || 0}%` }} />
            </div>
            <p className="mt-3 text-sm text-slate-600 dark:text-slate-300">{data?.verificationStatus?.eligibilityStatus || "Incomplete"} · {data?.verificationStatus?.level || "Basic"}</p>
          </div>
          <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900">
            <h3 className="font-semibold text-slate-950 dark:text-white">Pending actions</h3>
            <ul className="mt-4 space-y-2 text-sm text-slate-600 dark:text-slate-300">
              {(data?.verificationStatus?.pendingActions || []).length ? data.verificationStatus.pendingActions.map((item) => <li key={item}>- {item}</li>) : <li>No pending actions.</li>}
            </ul>
          </div>
        </div>
      ) : null}

      {!loading && tab === "history" ? (
        <DataTable
          columns={[
            { key: "submissionDate", label: "Submission Date", render: (row) => row.submissionDate ? new Date(row.submissionDate).toLocaleString() : "-" },
            { key: "documentType", label: "Document Type" },
            { key: "verificationType", label: "Verification Type" },
            { key: "reviewer", label: "Reviewer" },
            { key: "status", label: "Status", render: (row) => <StatusBadge value={row.status} /> },
          ]}
          rows={data?.approvalHistory || []}
          empty="No approval history yet."
        />
      ) : null}

      {!loading && tab === "documents" ? (
        <DataTable
          columns={[
            { key: "documentName", label: "Document Name" },
            { key: "category", label: "Category" },
            { key: "uploadDate", label: "Upload Date", render: (row) => row.uploadDate ? new Date(row.uploadDate).toLocaleDateString() : "-" },
            { key: "status", label: "Status", render: (row) => <StatusBadge value={row.status} /> },
            { key: "size", label: "Size", render: (row) => `${Math.round((row.size || 0) / 1024)} KB` },
            { key: "expiryDate", label: "Expiry", render: (row) => row.expiryDate ? new Date(row.expiryDate).toLocaleDateString() : "-" },
          ]}
          rows={data?.uploadedDocuments || []}
          empty="No documents uploaded yet."
        />
      ) : null}
    </div>
  );
}
