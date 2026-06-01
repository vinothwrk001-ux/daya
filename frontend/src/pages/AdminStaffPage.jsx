import { useEffect, useMemo, useState } from "react";
import { confirmAction } from "../services/notificationService";
import { PasswordField } from "../components/PasswordField";
import {
  createStaffAccount,
  deleteStaffAccount,
  forceLogoutStaffAccount,
  listStaffAccounts,
  listStaffRoles,
  updateStaffAccount,
} from "../services/adminApi";

function normalizeError(err) {
  return err?.response?.data?.message || err?.message || "Request failed";
}

const initialForm = {
  name: "",
  email: "",
  phone: "",
  password: "",
  roleId: "",
  status: "active",
};

export function AdminStaffPage() {
  const [staff, setStaff] = useState([]);
  const [roles, setRoles] = useState([]);
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [editingId, setEditingId] = useState("");
  const [form, setForm] = useState(initialForm);

  useEffect(() => {
    let alive = true;

    (async () => {
      setLoading(true);
      try {
        const [staffResponse, rolesResponse] = await Promise.all([
          listStaffAccounts(),
          listStaffRoles(),
        ]);

        if (!alive) return;
        setStaff(staffResponse.data || []);
        setRoles(rolesResponse.data || []);
      } catch (err) {
        if (alive) setError(normalizeError(err));
      } finally {
        if (alive) setLoading(false);
      }
    })();

    return () => {
      alive = false;
    };
  }, []);

  const filteredStaff = useMemo(() => {
    const query = search.trim().toLowerCase();
    if (!query) return staff;
    return staff.filter((member) =>
      [member.name, member.email, member.phone, member.role?.name]
        .filter(Boolean)
        .some((value) => String(value).toLowerCase().includes(query))
    );
  }, [search, staff]);

  function resetForm() {
    setEditingId("");
    setForm(initialForm);
  }

  function startEditing(member) {
    setEditingId(member._id);
    setForm({
      name: member.name,
      email: member.email,
      phone: member.phone,
      password: "",
      roleId: member.role?._id || "",
      status: member.status,
    });
  }

  async function handleSubmit(event) {
    event.preventDefault();
    setSaving(true);
    setError("");

    try {
      const payload = {
        name: form.name,
        email: form.email,
        phone: form.phone,
        roleId: form.roleId,
        status: form.status,
        ...(form.password ? { password: form.password } : {}),
      };

      const response = editingId
        ? await updateStaffAccount(editingId, payload)
        : await createStaffAccount({ ...payload, password: form.password });

      if (editingId) {
        setStaff((current) => current.map((member) => (member._id === editingId ? response.data : member)));
      } else {
        setStaff((current) => [response.data, ...current]);
      }
      resetForm();
    } catch (err) {
      setError(normalizeError(err));
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete(member) {
    if (!(await confirmAction({ message: `Delete staff account "${member.name}"?`, tone: "danger", confirmLabel: "Confirm" }))) return;
    try {
      await deleteStaffAccount(member._id);
      setStaff((current) => current.filter((item) => item._id !== member._id));
      if (editingId === member._id) resetForm();
    } catch (err) {
      setError(normalizeError(err));
    }
  }

  async function handleForceLogout(member) {
    try {
      await forceLogoutStaffAccount(member._id);
    } catch (err) {
      setError(normalizeError(err));
    }
  }

  return (
    <div className="grid gap-6 xl:grid-cols-[minmax(0,1.3fr)_minmax(22rem,0.95fr)]">
      <section className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h2 className="text-lg font-semibold text-slate-950 dark:text-white">Staff directory</h2>
            <p className="text-sm text-slate-500 dark:text-slate-400">Suspend accounts, rotate roles, and revoke sessions instantly.</p>
          </div>
          <input
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            className="w-full rounded-2xl border border-slate-300 px-4 py-3 text-sm sm:max-w-xs"
            placeholder="Search staff"
          />
        </div>

        {error ? <div className="mt-4 rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">{error}</div> : null}

        <div className="mt-4 grid gap-3">
          {loading ? (
            Array.from({ length: 4 }).map((_, index) => (
              <div key={index} className="h-24 animate-pulse rounded-2xl bg-slate-100 dark:bg-slate-800" />
            ))
          ) : filteredStaff.length ? (
            filteredStaff.map((member) => (
              <div key={member._id} className="rounded-2xl border border-slate-200 p-4 dark:border-slate-800">
                <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
                  <div>
                    <div className="font-semibold text-slate-950 dark:text-white">{member.name}</div>
                    <div className="mt-1 text-sm text-slate-500 dark:text-slate-400">
                      {member.email} · {member.phone}
                    </div>
                    <div className="mt-2 flex flex-wrap gap-2 text-xs">
                      <span className="rounded-full bg-slate-100 px-2 py-1 text-slate-600 dark:bg-slate-800 dark:text-slate-300">
                        {member.role?.name || "No role"}
                      </span>
                      <span className={`rounded-full px-2 py-1 ${member.status === "active" ? "bg-emerald-100 text-emerald-700" : "bg-amber-100 text-amber-700"}`}>
                        {member.status}
                      </span>
                    </div>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <button type="button" onClick={() => startEditing(member)} className="rounded-xl border border-slate-300 px-3 py-2 text-sm">
                      Edit
                    </button>
                    <button type="button" onClick={() => handleForceLogout(member)} className="rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-700">
                      Force logout
                    </button>
                    <button type="button" onClick={() => handleDelete(member)} className="rounded-xl border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-700">
                      Delete
                    </button>
                  </div>
                </div>
              </div>
            ))
          ) : (
            <div className="rounded-2xl border border-dashed border-slate-300 px-4 py-10 text-center text-sm text-slate-500 dark:border-slate-700 dark:text-slate-400">
              No staff accounts yet.
            </div>
          )}
        </div>
      </section>

      <section className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-lg font-semibold text-slate-950 dark:text-white">{editingId ? "Edit staff" : "Create staff"}</h2>
            <p className="text-sm text-slate-500 dark:text-slate-400">Accounts remain fully separate from users and vendors.</p>
          </div>
          <button type="button" onClick={resetForm} className="text-sm font-medium text-slate-600 hover:underline">
            Reset
          </button>
        </div>

        <form onSubmit={handleSubmit} className="mt-4 space-y-4">
          <label className="block text-sm font-medium text-slate-700 dark:text-slate-200">
            Name
            <input
              value={form.name}
              onChange={(event) => setForm((current) => ({ ...current, name: event.target.value }))}
              className="mt-1 w-full rounded-2xl border border-slate-300 px-4 py-3"
              required
            />
          </label>

          <label className="block text-sm font-medium text-slate-700 dark:text-slate-200">
            Email
            <input
              type="email"
              value={form.email}
              onChange={(event) => setForm((current) => ({ ...current, email: event.target.value }))}
              className="mt-1 w-full rounded-2xl border border-slate-300 px-4 py-3"
              required
            />
          </label>

          <label className="block text-sm font-medium text-slate-700 dark:text-slate-200">
            Phone
            <input
              value={form.phone}
              onChange={(event) => setForm((current) => ({ ...current, phone: event.target.value }))}
              className="mt-1 w-full rounded-2xl border border-slate-300 px-4 py-3"
              required
            />
          </label>

          <label className="block text-sm font-medium text-slate-700 dark:text-slate-200">
            Role
            <select
              value={form.roleId}
              onChange={(event) => setForm((current) => ({ ...current, roleId: event.target.value }))}
              className="mt-1 w-full rounded-2xl border border-slate-300 px-4 py-3"
              required
            >
              <option value="">Select a role</option>
              {roles.map((role) => (
                <option key={role._id} value={role._id}>
                  {role.name}
                </option>
              ))}
            </select>
          </label>

          <label className="block text-sm font-medium text-slate-700 dark:text-slate-200">
            Status
            <select
              value={form.status}
              onChange={(event) => setForm((current) => ({ ...current, status: event.target.value }))}
              className="mt-1 w-full rounded-2xl border border-slate-300 px-4 py-3"
            >
              <option value="active">Active</option>
              <option value="suspended">Suspended</option>
            </select>
          </label>

          <label className="block text-sm font-medium text-slate-700 dark:text-slate-200">
            {editingId ? "New password (optional)" : "Temporary password"}
            <PasswordField
              value={form.password}
              onChange={(event) => setForm((current) => ({ ...current, password: event.target.value }))}
              className="mt-1 w-full rounded-2xl border border-slate-300 px-4 py-3"
              placeholder="Min 8 chars, upper/lower/number/symbol"
              required={!editingId}
            />
            <div className="mt-1 text-xs text-slate-500 dark:text-slate-400">
              Leading and trailing spaces are ignored when the password is stored.
            </div>
          </label>

          <button
            type="submit"
            disabled={saving || !form.roleId}
            className="w-full rounded-2xl bg-slate-950 px-4 py-3 text-sm font-medium text-white disabled:opacity-50"
          >
            {saving ? "Saving account..." : editingId ? "Update staff" : "Create staff"}
          </button>
        </form>
      </section>
    </div>
  );
}
