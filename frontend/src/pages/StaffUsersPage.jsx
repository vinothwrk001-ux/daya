import { useEffect, useMemo, useState } from "react";
import { confirmAction } from "../services/notificationService";
import { PasswordField } from "../components/PasswordField";
import { createUser, deleteUser, listUsers, toggleUserBlock } from "../services/adminApi";
import { useStaffPermission } from "../hooks/useStaffAuth";

function normalizeError(error) {
  return error?.response?.data?.message || error?.message || "Request failed";
}

const initialForm = {
  name: "",
  email: "",
  phone: "",
  password: "",
  role: "user",
};

export function StaffUsersPage() {
  const { hasPermission } = useStaffPermission();
  const [searchTerm, setSearchTerm] = useState("");
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState("");
  const [error, setError] = useState("");
  const [creating, setCreating] = useState(false);
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [form, setForm] = useState(initialForm);

  useEffect(() => {
    let active = true;

    async function loadUsers() {
      setLoading(true);
      setError("");
      try {
        const response = await listUsers();
        if (active) {
          setUsers((response.data || []).filter((user) => user.role !== "admin"));
        }
      } catch (err) {
        if (active) setError(normalizeError(err));
      } finally {
        if (active) setLoading(false);
      }
    }

    loadUsers();

    return () => {
      active = false;
    };
  }, []);

  const filteredUsers = useMemo(() => {
    const query = searchTerm.trim().toLowerCase();
    if (!query) return users;

    return users.filter((user) =>
      [user.name, user.email, user.phone].filter(Boolean).some((value) => String(value).toLowerCase().includes(query))
    );
  }, [searchTerm, users]);

  async function handleBlock(user) {
    setBusyId(user._id);
    setError("");
    try {
      const response = await toggleUserBlock(user._id);
      setUsers((current) => current.map((item) => (item._id === user._id ? response.data : item)));
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

  async function handleCreate(event) {
    event.preventDefault();
    setCreating(true);
    setError("");
    try {
      const response = await createUser({
        name: form.name.trim(),
        email: form.email.trim(),
        phone: form.phone.trim(),
        password: form.password,
        role: form.role,
      });
      setUsers((current) => [response.data, ...current.filter((item) => item._id !== response.data?._id)]);
      setForm(initialForm);
      setShowCreateForm(false);
    } catch (err) {
      setError(normalizeError(err));
    } finally {
      setCreating(false);
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Users</h1>
          <p className="mt-1 text-slate-600">Live customer account management based on your user permissions.</p>
        </div>
        <div className="flex items-center gap-3">
          <div className="inline-flex items-center gap-2 rounded-full border border-slate-200 bg-white px-3 py-2 text-sm text-slate-600">
            <UsersIcon className="h-4 w-4" />
            {filteredUsers.length} visible
          </div>
          {hasPermission("users.create") ? (
            <button
              type="button"
              onClick={() => {
                setShowCreateForm((current) => !current);
                setError("");
              }}
              className="inline-flex items-center gap-2 rounded-xl bg-slate-900 px-4 py-2 text-sm font-semibold text-white hover:bg-slate-800"
            >
              <PlusIcon className="h-4 w-4" />
              Create User
            </button>
          ) : null}
        </div>
      </div>

      {hasPermission("users.create") && showCreateForm ? (
        <form onSubmit={handleCreate} className="grid gap-4 rounded-[1.5rem] border border-slate-200 bg-white p-5 shadow-sm md:grid-cols-2">
          <label className="grid gap-2 text-sm text-slate-700">
            <span>Name</span>
            <input
              value={form.name}
              onChange={(event) => setForm((current) => ({ ...current, name: event.target.value }))}
              className="rounded-xl border border-slate-200 px-4 py-3 text-sm"
              required
            />
          </label>
          <label className="grid gap-2 text-sm text-slate-700">
            <span>Email</span>
            <input
              type="email"
              value={form.email}
              onChange={(event) => setForm((current) => ({ ...current, email: event.target.value }))}
              className="rounded-xl border border-slate-200 px-4 py-3 text-sm"
              placeholder="Optional for user"
            />
          </label>
          <label className="grid gap-2 text-sm text-slate-700">
            <span>Phone</span>
            <input
              value={form.phone}
              onChange={(event) => setForm((current) => ({ ...current, phone: event.target.value }))}
              className="rounded-xl border border-slate-200 px-4 py-3 text-sm"
              inputMode="numeric"
              maxLength={10}
              required
            />
          </label>
          <label className="grid gap-2 text-sm text-slate-700">
            <span>Password</span>
            <PasswordField
              value={form.password}
              onChange={(event) => setForm((current) => ({ ...current, password: event.target.value }))}
              className="rounded-xl border border-slate-200 px-4 py-3 text-sm"
              minLength={6}
              required
            />
          </label>
          <label className="grid gap-2 text-sm text-slate-700 md:col-span-2">
            <span>Role</span>
            <select
              value={form.role}
              onChange={(event) => setForm((current) => ({ ...current, role: event.target.value }))}
              className="max-w-xs rounded-xl border border-slate-200 px-4 py-3 text-sm"
            >
              <option value="user">User</option>
            </select>
          </label>
          <div className="flex gap-3 md:col-span-2">
            <button
              type="submit"
              disabled={creating}
              className="rounded-xl bg-slate-900 px-4 py-2 text-sm font-semibold text-white hover:bg-slate-800 disabled:opacity-50"
            >
              {creating ? "Creating..." : "Create"}
            </button>
            <button
              type="button"
              disabled={creating}
              onClick={() => {
                setShowCreateForm(false);
                setForm(initialForm);
              }}
              className="rounded-xl border border-slate-200 px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50"
            >
              Cancel
            </button>
          </div>
        </form>
      ) : null}

      <div className="relative flex-1">
        <SearchIcon className="absolute left-3 top-1/2 h-[18px] w-[18px] -translate-y-1/2 text-slate-400" />
        <input
          type="text"
          placeholder="Search by name, email, or phone"
          value={searchTerm}
          onChange={(event) => setSearchTerm(event.target.value)}
          className="w-full rounded-[1.25rem] border border-slate-200 bg-white py-3 pl-10 pr-4 text-sm focus:border-amber-500 focus:outline-none"
        />
      </div>

      {error ? (
        <div className="rounded-[1.25rem] border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-800">
          {error}
        </div>
      ) : null}

      <div className="overflow-hidden rounded-[1.5rem] border border-slate-200 bg-white shadow-sm">
        {loading ? (
          <div className="grid gap-3 p-4">
            {Array.from({ length: 6 }).map((_, index) => (
              <div key={index} className="h-16 animate-pulse rounded-2xl bg-slate-100" />
            ))}
          </div>
        ) : filteredUsers.length ? (
          <div className="divide-y divide-slate-200">
            {filteredUsers.map((user) => (
              <div key={user._id} className="grid gap-4 px-4 py-4 lg:grid-cols-[1.2fr_1fr_.8fr_.8fr] lg:items-center lg:px-5">
                <div>
                  <div className="font-semibold text-slate-950">{user.name}</div>
                  <div className="mt-1 text-xs text-slate-500">Joined {new Date(user.createdAt).toLocaleDateString()}</div>
                </div>
                <div className="text-sm text-slate-600">
                  <div>{user.email || "No email"}</div>
                  <div className="mt-1 text-xs text-slate-500">{user.phone || "No phone"}</div>
                </div>
                <div>
                  <span className={`rounded-full px-3 py-1 text-xs font-semibold ${user.status === "active" ? "bg-emerald-50 text-emerald-700" : "bg-rose-50 text-rose-700"}`}>
                    {user.status}
                  </span>
                </div>
                <div className="flex flex-wrap gap-2">
                  {hasPermission("users.update") ? (
                    <button
                      type="button"
                      disabled={busyId === user._id}
                      onClick={() => handleBlock(user)}
                      className="inline-flex items-center gap-2 rounded-xl border border-slate-200 px-3 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-50"
                    >
                      <BanIcon className="h-3.5 w-3.5" />
                      {user.status === "disabled" ? "Unblock" : "Block"}
                    </button>
                  ) : null}
                  {hasPermission("users.delete") ? (
                    <button
                      type="button"
                      disabled={busyId === user._id}
                      onClick={() => handleDelete(user)}
                      className="inline-flex items-center gap-2 rounded-xl border border-rose-200 bg-rose-50 px-3 py-2 text-xs font-semibold text-rose-700 hover:bg-rose-100 disabled:opacity-50"
                    >
                      <TrashIcon className="h-3.5 w-3.5" />
                      Delete
                    </button>
                  ) : null}
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="px-4 py-12 text-center text-sm text-slate-500">No users found for your current filters.</div>
        )}
      </div>
    </div>
  );
}

function IconBase({ className = "h-4 w-4", children }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      aria-hidden="true"
    >
      {children}
    </svg>
  );
}

function SearchIcon({ className = "h-4 w-4" }) {
  return (
    <IconBase className={className}>
      <circle cx="11" cy="11" r="7" />
      <path d="m20 20-3.5-3.5" />
    </IconBase>
  );
}

function UsersIcon({ className = "h-4 w-4" }) {
  return (
    <IconBase className={className}>
      <path d="M16 21v-2a4 4 0 0 0-4-4H7a4 4 0 0 0-4 4v2" />
      <circle cx="9.5" cy="7" r="3" />
      <path d="M22 21v-2a4 4 0 0 0-3-3.87" />
      <path d="M16 4.13a3 3 0 0 1 0 5.74" />
    </IconBase>
  );
}

function BanIcon({ className = "h-4 w-4" }) {
  return (
    <IconBase className={className}>
      <circle cx="12" cy="12" r="9" />
      <path d="m8.5 8.5 7 7" />
    </IconBase>
  );
}

function TrashIcon({ className = "h-4 w-4" }) {
  return (
    <IconBase className={className}>
      <path d="M3 6h18" />
      <path d="M8 6V4h8v2" />
      <path d="M19 6l-1 14H6L5 6" />
      <path d="M10 10v6" />
      <path d="M14 10v6" />
    </IconBase>
  );
}

function PlusIcon({ className = "h-4 w-4" }) {
  return (
    <IconBase className={className}>
      <path d="M12 5v14" />
      <path d="M5 12h14" />
    </IconBase>
  );
}
