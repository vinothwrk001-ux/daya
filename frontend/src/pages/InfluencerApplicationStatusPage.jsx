import { useEffect, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { Check, Clock, FileText, ShieldCheck } from "lucide-react";
import { getInfluencerApplicationStatus } from "../services/influencerRegistrationService";
import { getMe, refreshSession } from "../services/authService";
import { useAuthStore } from "../context/authStore";

function statusTone(status) {
  if (status === "approved") return "bg-emerald-50 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-200";
  if (["rejected", "suspended"].includes(status)) return "bg-rose-50 text-rose-700 dark:bg-rose-950 dark:text-rose-200";
  if (["requires_changes", "pending_documents"].includes(status)) return "bg-amber-50 text-amber-700 dark:bg-amber-950 dark:text-amber-200";
  return "bg-blue-50 text-blue-700 dark:bg-blue-950 dark:text-blue-200";
}

export function InfluencerApplicationStatusPage({ compact = false }) {
  const { applicationId } = useParams();
  const navigate = useNavigate();
  const user = useAuthStore((state) => state.user);
  const refreshToken = useAuthStore((state) => state.refreshToken);
  const setAuth = useAuthStore((state) => state.setAuth);
  const setUser = useAuthStore((state) => state.setUser);
  const [data, setData] = useState(null);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!applicationId) return;
    getInfluencerApplicationStatus(applicationId)
      .then((response) => setData(response?.data))
      .catch((err) => setError(err?.response?.data?.message || "Application status could not be loaded."));
  }, [applicationId]);

  useEffect(() => {
    if (data?.status !== "approved" || !user) return;
    const applicationEmail = data?.application?.email;
    if (applicationEmail && user.email && applicationEmail !== user.email) return;
    let cancelled = false;
    async function refreshAndRedirect() {
      try {
        if (refreshToken) {
          const refreshed = await refreshSession(refreshToken);
          if (!cancelled) setAuth(refreshed?.data || refreshed);
        } else {
          const me = await getMe();
          if (!cancelled) setUser(me?.data || me);
        }
        const nextUser = useAuthStore.getState().user;
        const roles = Array.from(new Set([nextUser?.role, ...(nextUser?.roles || [])].filter(Boolean)));
        if (!cancelled && roles.includes("influencer")) navigate("/influencer/dashboard", { replace: true });
      } catch {
        // Leave the approved status page visible if the current session cannot refresh.
      }
    }
    refreshAndRedirect();
    return () => {
      cancelled = true;
    };
  }, [data?.status, data?.application?.email, user, refreshToken, setAuth, setUser, navigate]);

  if (error) return <main className="min-h-screen bg-slate-50 p-6 dark:bg-slate-950"><div className="mx-auto max-w-3xl rounded-3xl border border-rose-200 bg-rose-50 p-6 font-bold text-rose-700">{error}</div></main>;
  if (!data) return <main className="min-h-screen bg-slate-50 p-6 dark:bg-slate-950"><div className="mx-auto max-w-3xl rounded-3xl border border-slate-200 bg-white p-6 dark:border-slate-800 dark:bg-slate-900">Loading application status...</div></main>;

  return (
    <main className="min-h-screen bg-slate-50 px-4 py-8 text-slate-950 dark:bg-slate-950 dark:text-white sm:px-6 lg:px-8">
      <div className="mx-auto max-w-6xl space-y-6">
        <section className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm dark:border-slate-800 dark:bg-slate-900">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
            <div>
              <p className="text-xs font-black uppercase tracking-[0.24em] text-blue-600 dark:text-blue-300">{compact ? "Application Submitted Successfully" : "Application Status"}</p>
              <h1 className="mt-2 text-3xl font-black">{data.applicationNumber}</h1>
              <p className="mt-2 text-slate-600 dark:text-slate-300">Estimated Review Time: {data.estimatedReviewTime}</p>
            </div>
            <span className={`rounded-full px-4 py-2 text-sm font-black uppercase ${statusTone(data.status)}`}>{String(data.status || "").replace(/_/g, " ")}</span>
          </div>
          <div className="mt-6 grid gap-3 sm:grid-cols-3">
            <div className="rounded-2xl bg-slate-50 p-4 dark:bg-slate-950"><div className="text-xs uppercase tracking-[0.2em] text-slate-400">Submission Date</div><div className="mt-2 font-black">{data.submittedAt ? new Date(data.submittedAt).toLocaleString() : "Not submitted"}</div></div>
            <div className="rounded-2xl bg-slate-50 p-4 dark:bg-slate-950"><div className="text-xs uppercase tracking-[0.2em] text-slate-400">Creator Score</div><div className="mt-2 font-black">{data.creatorScore || 0} / 100</div></div>
            <div className="rounded-2xl bg-slate-50 p-4 dark:bg-slate-950"><div className="text-xs uppercase tracking-[0.2em] text-slate-400">Current Stage</div><div className="mt-2 font-black">{String(data.reviewStage || "submitted").replace(/_/g, " ")}</div></div>
          </div>
          {compact ? <Link to={data.status === "approved" ? "/influencer/dashboard" : `/influencer/application-status/${data.application?.applicationId}`} className="mt-6 inline-flex rounded-2xl bg-blue-600 px-5 py-3 text-sm font-black text-white">{data.status === "approved" ? "Go To Dashboard" : "Track Application"}</Link> : null}
          {!compact && data.status === "approved" ? <Link to="/influencer/dashboard" className="mt-6 inline-flex rounded-2xl bg-blue-600 px-5 py-3 text-sm font-black text-white">Go To Dashboard</Link> : null}
        </section>

        <section className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm dark:border-slate-800 dark:bg-slate-900">
          <h2 className="text-xl font-black">Status Tracker</h2>
          <div className="mt-5 grid gap-3 md:grid-cols-6">
            {(data.timeline || []).map((item) => (
              <div key={item.stage} className={`rounded-2xl border p-4 text-sm font-bold ${item.status === "completed" ? "border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-900 dark:bg-emerald-950 dark:text-emerald-200" : item.status === "current" ? "border-blue-200 bg-blue-50 text-blue-700 dark:border-blue-900 dark:bg-blue-950 dark:text-blue-200" : "border-slate-200 bg-slate-50 text-slate-400 dark:border-slate-800 dark:bg-slate-950"}`}>
                {item.status === "completed" ? <Check className="mb-2 h-5 w-5" /> : <Clock className="mb-2 h-5 w-5" />}
                {item.label}
              </div>
            ))}
          </div>
        </section>

        {(data.stepTimeline || []).length ? (
          <section className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm dark:border-slate-800 dark:bg-slate-900">
            <h2 className="text-xl font-black">Registration Step Review</h2>
            <div className="mt-5 grid gap-3 md:grid-cols-3">
              {(data.stepTimeline || []).map((item) => {
                const approved = ["approved", "completed"].includes(item.status);
                const rejected = item.status === "rejected";
                return (
                  <div key={item.key} className={`rounded-2xl border p-4 text-sm font-bold ${approved ? "border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-900 dark:bg-emerald-950 dark:text-emerald-200" : rejected ? "border-rose-200 bg-rose-50 text-rose-700 dark:border-rose-900 dark:bg-rose-950 dark:text-rose-200" : "border-slate-200 bg-slate-50 text-slate-500 dark:border-slate-800 dark:bg-slate-950"}`}>
                    {approved ? <Check className="mb-2 h-5 w-5" /> : <Clock className="mb-2 h-5 w-5" />}
                    {item.label}
                    <div className="mt-2 text-xs font-semibold uppercase opacity-80">{String(item.status || "pending").replace(/_/g, " ")}</div>
                    {item.comments ? <p className="mt-2 text-xs font-medium opacity-80">{item.comments}</p> : null}
                  </div>
                );
              })}
            </div>
          </section>
        ) : null}

        {!compact ? (
          <div className="grid gap-6 lg:grid-cols-2">
            <section className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm dark:border-slate-800 dark:bg-slate-900">
              <h2 className="inline-flex items-center gap-2 text-xl font-black"><FileText className="h-5 w-5" /> Uploaded Documents</h2>
              <div className="mt-4 grid gap-3">
                {(data.documents || []).map((doc) => <div key={doc._id} className="rounded-2xl border border-slate-200 px-4 py-3 text-sm dark:border-slate-800">{doc.documentType.replace(/_/g, " ")} - {doc.status}</div>)}
              </div>
            </section>
            <section className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm dark:border-slate-800 dark:bg-slate-900">
              <h2 className="inline-flex items-center gap-2 text-xl font-black"><ShieldCheck className="h-5 w-5" /> Review Notes</h2>
              <div className="mt-4 grid gap-3">
                {(data.reviews || []).map((review) => <div key={review._id} className="rounded-2xl bg-slate-50 p-4 text-sm dark:bg-slate-950"><strong>{review.decision}</strong><div className="mt-1 text-slate-500">{review.comments || "No comments"}</div></div>)}
              </div>
            </section>
          </div>
        ) : null}
      </div>
    </main>
  );
}

export function InfluencerApplicationUnderReviewPage() {
  return <InfluencerApplicationStatusPage compact />;
}
