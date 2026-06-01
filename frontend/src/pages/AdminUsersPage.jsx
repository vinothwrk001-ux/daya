import { useEffect, useMemo, useState } from "react";
import { confirmAction } from "../services/notificationService";
import { deleteUser, listUsers, toggleUserBlock } from "../services/adminApi";
import { ReportingToolbar } from "../components/ReportingToolbar";
import { StatusBadge } from "../components/StatusBadge";
import { InlineToast } from "../components/commerce/InlineToast";
import { useReporting } from "../hooks/useReporting";

function normalizeError(err) {
  return err?.response?.data?.message || err?.message || "Request failed";
}

const PAGE_SIZE = 10;

export function AdminUsersPage() {
  const [loading, setLoading] = useState(true);
  const [users, setUsers] = useState([]);
  const [error, setError] = useState("");
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const [busyId, setBusyId] = useState("");
  const reporting = useReporting({
    module: "users",
    onApply: () => setPage(1),
  });

  const filtered = useMemo(() => {
    const query = search.trim().toLowerCase();
    if (!query) return users;
    return users.filter((user) =>
      [user.name, user.email, user.phone]
        .filter(Boolean)
        .some((value) => String(value).toLowerCase().includes(query))
    );
  }, [users, search]);

  const pageCount = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const pageItems = filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  useEffect(() => {
    let alive = true;

    (async () => {
      setLoading(true);
      setError("");
      try {
        const res = await listUsers(reporting.appliedParams);
        if (alive) setUsers(res.data.filter((user) => user.role !== "admin"));
      } catch (err) {
        if (alive) setError(normalizeError(err));
      } finally {
        if (alive) setLoading(false);
      }
    })();

    return () => {
      alive = false;
    };
  }, [reporting.appliedParams]);

  useEffect(() => {
    setPage(1);
  }, [search]);

  async function handleBlock(user) {
    setBusyId(user._id);
    setError("");
    try {
      const res = await toggleUserBlock(user._id);
      setUsers((current) => current.map((item) => (item._id === user._id ? res.data : item)));
    } catch (err) {
      setError(normalizeError(err));
    } finally {
      setBusyId("");
    }
  }

  async function handleDelete(user) {
    if (!(await confirmAction({ message: `Delete ${user.name}?`, tone: "danger", confirmLabel: "Confirm" }))) return;
    setBusyId(user._id);
    setError("");
    try {
      await deleteUser(user._id);
      setUsers((current) => current.filter((item) => item._id !== user._id));
    } catch (err) {
      setError(normalizeError(err));
    } finally {
      setBusyId("");
    }
  }

  async function handleExport(format) {
    try {
      await reporting.exportReport(format);
    } catch (err) {
      setError(normalizeError(err));
    }
  }

  return (
    <div className="grid min-w-0 max-w-full gap-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search users by name, email, or phone"
          className="w-full rounded-2xl border border-slate-300 bg-white px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-slate-900 dark:border-slate-700 dark:bg-slate-900 dark:text-white sm:max-w-sm"
        />
        <div className="text-sm text-slate-500 dark:text-slate-400">Total users: {filtered.length}</div>
      </div>

      <ReportingToolbar
        startDate={reporting.startDate}
        endDate={reporting.endDate}
        onDateChange={reporting.setDateRange}
        onApply={reporting.applyDateRange}
        onExport={handleExport}
        exportingFormat={reporting.exportingFormat}
        isDirty={reporting.hasPendingChanges}
      />

      {error ? (
        <div className="rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-800 dark:border-rose-900 dark:bg-rose-950/30 dark:text-rose-200">
          {error}
        </div>
      ) : null}

      <div className="overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-sm dark:border-slate-800 dark:bg-slate-900">
        <div className="hidden overflow-x-auto lg:block">
          <div className="grid min-w-[780px] grid-cols-[1.4fr_1.1fr_.9fr_.7fr_1fr] gap-4 border-b border-slate-200 px-5 py-4 text-xs font-semibold uppercase tracking-wide text-slate-500 dark:border-slate-800 dark:text-slate-400">
            <div>User</div>
            <div>Contact</div>
            <div>Role</div>
            <div>Status</div>
            <div>Actions</div>
          </div>
        </div>

        {loading ? (
          <div className="grid gap-3 px-4 py-4">
            {Array.from({ length: 6 }).map((_, idx) => (
              <div key={idx} className="h-16 animate-pulse rounded-2xl bg-slate-100 dark:bg-slate-800" />
            ))}
          </div>
        ) : pageItems.length ? (
          <div className="divide-y divide-slate-200 dark:divide-slate-800">
            {pageItems.map((user) => (
              <div key={user._id} className="grid gap-3 px-4 py-4 lg:grid-cols-[1.4fr_1.1fr_.9fr_.7fr_1fr] lg:items-center lg:px-5">
                <div>
                  <div className="font-semibold text-slate-900 dark:text-white">{user.name}</div>
                  <div className="mt-1 text-xs text-slate-500 dark:text-slate-400">
                    Joined {new Date(user.createdAt).toLocaleDateString()}
                  </div>
                </div>
                <div className="text-sm text-slate-600 dark:text-slate-300">
                  <div>{user.email || "No email"}</div>
                  <div className="mt-1 text-xs text-slate-500 dark:text-slate-400">{user.phone}</div>
                </div>
                <div><StatusBadge value={user.role} /></div>
                <div><StatusBadge value={user.status} /></div>
                <div className="flex flex-wrap gap-2">
                  <button
                    type="button"
                    disabled={busyId === user._id}
                    onClick={() => handleBlock(user)}
                    className="w-full rounded-xl border border-slate-300 px-3 py-2 text-xs font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-50 dark:border-slate-700 dark:text-slate-200 dark:hover:bg-slate-800 sm:w-auto"
                  >
                    {user.status === "disabled" ? "Unblock" : "Block"}
                  </button>
                  <button
                    type="button"
                    disabled={busyId === user._id}
                    onClick={() => handleDelete(user)}
                    className="w-full rounded-xl border border-rose-200 bg-rose-50 px-3 py-2 text-xs font-medium text-rose-700 hover:bg-rose-100 disabled:opacity-50 dark:border-rose-900 dark:bg-rose-950 dark:text-rose-200 sm:w-auto"
                  >
                    Delete
                  </button>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="px-4 py-10 text-center text-sm text-slate-500 dark:text-slate-400">No users found.</div>
        )}
      </div>

      <Pagination page={page} totalPages={pageCount} onChange={setPage} />
      <InlineToast toast={reporting.toast} onClose={reporting.clearToast} />
    </div>
  );
}

function Pagination({ page, totalPages, onChange }) {
  return (
    <div className="flex flex-col gap-3 text-sm text-slate-500 dark:text-slate-400 sm:flex-row sm:items-center sm:justify-between">
      <div>Page {page} of {totalPages}</div>
      <div className="flex gap-2">
        <button
          type="button"
          disabled={page === 1}
          onClick={() => onChange(Math.max(1, page - 1))}
          className="w-full rounded-xl border border-slate-300 px-3 py-2 disabled:opacity-50 dark:border-slate-700 sm:w-auto"
        >
          Previous
        </button>
        <button
          type="button"
          disabled={page === totalPages}
          onClick={() => onChange(Math.min(totalPages, page + 1))}
          className="w-full rounded-xl border border-slate-300 px-3 py-2 disabled:opacity-50 dark:border-slate-700 sm:w-auto"
        >
          Next
        </button>
      </div>
    </div>
  );
}
