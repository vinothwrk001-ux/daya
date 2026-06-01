import { useEffect, useState } from "react";
import { requestInput } from "../services/notificationService";
import { StatusBadge } from "../components/StatusBadge";
import { VendorList, VendorSection } from "../components/VendorPanel";
import * as vendorDashboardService from "../services/vendorDashboardService";

export function VendorSupportPage() {
  const [data, setData] = useState(null);
  const [error, setError] = useState("");

  async function load() {
    try {
      const response = await vendorDashboardService.getVendorSupportTickets({ limit: 20 });
      setData(response.data);
      setError("");
    } catch (err) {
      setError(err?.response?.data?.message || "Failed to load support tickets.");
    }
  }

  useEffect(() => {
    (async () => {
      await load();
    })();
  }, []);

  async function createTicket() {
    const subject = await requestInput({ title: "Create support ticket", label: "Ticket subject" });
    if (!subject) return;
    const message = await requestInput({ title: "Create support ticket", label: "Describe the issue", multiline: true });
    if (!message) return;

    try {
      await vendorDashboardService.createVendorSupportTicket({
        subject,
        message,
        category: "general",
        priority: "medium",
      });
      await load();
    } catch (err) {
      setError(err?.response?.data?.message || "Failed to create support ticket.");
    }
  }

  async function reply(ticketId) {
    const message = await requestInput({ title: "Reply to ticket", label: "Reply", multiline: true });
    if (!message) return;

    try {
      await vendorDashboardService.replyVendorSupportTicket(ticketId, { message });
      await load();
    } catch (err) {
      setError(err?.response?.data?.message || "Failed to send support reply.");
    }
  }

  return (
    <VendorSection
      title="Support Center"
      description="Raise tickets, monitor responses, and keep a vendor-visible issue trail."
      action={
        <button onClick={createTicket} className="rounded-xl bg-slate-900 px-3 py-2 text-sm font-medium text-white dark:bg-white dark:text-slate-950">
          New Ticket
        </button>
      }
    >
      {error ? <div className="mb-4 rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">{error}</div> : null}
      <VendorList
        items={data?.tickets || []}
        emptyMessage="No support tickets yet."
        renderItem={(ticket) => (
          <div key={ticket._id} className="rounded-2xl border border-slate-200 bg-white px-4 py-4 shadow-sm dark:border-slate-800 dark:bg-slate-900">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div className="space-y-2">
                <div className="flex flex-wrap items-center gap-2">
                  <div className="text-sm font-semibold text-slate-950 dark:text-white">{ticket.subject}</div>
                  <StatusBadge value={ticket.status} />
                </div>
                <div className="text-xs text-slate-500 dark:text-slate-400">{ticket.category || "general"} • {ticket.priority}</div>
                <div className="space-y-2">
                  {(ticket.messages || []).slice(-3).map((message, index) => (
                    <div key={`${ticket._id}-${index}`} className="rounded-xl bg-slate-50 px-3 py-2 text-sm text-slate-700 dark:bg-slate-800 dark:text-slate-200">
                      <span className="font-semibold">{message.senderType}:</span> {message.message}
                    </div>
                  ))}
                </div>
              </div>
              <button onClick={() => reply(ticket._id)} className="rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-medium hover:bg-slate-50 dark:border-slate-700 dark:hover:bg-slate-800">
                Reply
              </button>
            </div>
          </div>
        )}
      />
    </VendorSection>
  );
}
