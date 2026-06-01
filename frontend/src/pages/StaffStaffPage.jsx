import { useEffect, useMemo, useRef, useState } from "react";
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
import { useStaffPermission, useRequirePermission } from "../hooks/useStaffAuth";

function normalizeError(error) {
  return error?.response?.data?.message || error?.message || "Request failed";
}

const initialForm = {
  name: "",
  email: "",
  phone: "",
  password: "",
  roleId: "",
  status: "active",
};

export function StaffStaffPage() {
  useRequirePermission("staff.read");
  const { hasPermission } = useStaffPermission();
  const formRef = useRef(null);
  const [searchTerm, setSearchTerm] = useState("");
  const [staff, setStaff] = useState([]);
  const [roles, setRoles] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [editingId, setEditingId] = useState("");
  const [form, setForm] = useState(initialForm);

  useEffect(() => {
    let active = true;

    async function loadStaffWorkspace() {
      setLoading(true);
      setError("");
      try {
        const [staffResponse, rolesResponse] = await Promise.all([
          listStaffAccounts(),
          listStaffRoles(),
        ]);

        if (!active) return;
        setStaff(staffResponse?.data || staffResponse || []);
        setRoles(rolesResponse?.data?.roles || rolesResponse?.data || rolesResponse || []);
      } catch (err) {
        if (active) setError(normalizeError(err));
      } finally {
        if (active) setLoading(false);
      }
    }

    loadStaffWorkspace();

    return () => {
      active = false;
    };
  }, []);

  const canCreate = hasPermission("staff.create");
  const canUpdate = hasPermission("staff.update");
  const canDelete = hasPermission("staff.delete");

  const filteredStaff = useMemo(() => {
    const query = searchTerm.trim().toLowerCase();
    if (!query) return staff;

    return staff.filter((member) =>
      [member.name, member.email, member.phone, member.roleId?.name, member.role?.name]
        .filter(Boolean)
        .some((value) => String(value).toLowerCase().includes(query))
    );
  }, [searchTerm, staff]);

  function focusForm() {
    window.requestAnimationFrame(() => {
      formRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
    });
  }

  function resetForm() {
    setEditingId("");
    setForm(initialForm);
  }

  function startCreating() {
    resetForm();
    focusForm();
  }

  function startEditing(member) {
    setEditingId(member._id);
    setForm({
      name: member.name || "",
      email: member.email || "",
      phone: member.phone || "",
      password: "",
      roleId: member.roleId?._id || member.role?._id || "",
      status: member.status || "active",
    });
    focusForm();
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

      const savedMember = response?.data || response;

      if (editingId) {
        setStaff((current) => current.map((member) => (member._id === editingId ? savedMember : member)));
      } else {
        setStaff((current) => [savedMember, ...current]);
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
    <div className="space-y-6">
      <section className="flex flex-col items-start justify-between gap-4 lg:flex-row lg:items-center">
        <div>
          <h1 className="text-2xl font-semibold text-slate-950">Staff Management</h1>
          <p className="mt-1 text-sm text-slate-600">Manage staff members and their access levels</p>
        </div>
        {canCreate && (
          <button
            type="button"
            onClick={startCreating}
            className="inline-flex items-center gap-2 rounded-lg bg-slate-950 px-4 py-2 text-sm font-medium text-white hover:bg-slate-800"
          >
            + Add Staff
          </button>
        )}
      </section>

      <div className="flex gap-4">
        <input
          type="text"
          placeholder="Search by name, email, or phone..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          className="flex-1 rounded-xl border border-slate-200 px-4 py-2 text-sm focus:border-amber-500 focus:outline-none"
        />
      </div>

      {error && (
        <div className="rounded-xl border border-rose-200 bg-rose-50 p-4 text-sm text-rose-700">
          {error}
        </div>
      )}

      <div className="overflow-hidden rounded-xl border border-slate-200 bg-white">
        {loading ? (
          <div className="flex h-64 items-center justify-center">
            <div className="text-center">
              <div className="mx-auto h-12 w-12 animate-spin rounded-full border-4 border-slate-200 border-t-amber-500" />
              <p className="mt-4 text-sm text-slate-600">Loading staff...</p>
            </div>
          </div>
        ) : filteredStaff.length === 0 ? (
          <div className="flex h-64 items-center justify-center">
            <p className="text-sm text-slate-600">No staff found</p>
          </div>
        ) : (
          <table className="w-full text-sm">
            <thead className="border-b border-slate-200 bg-slate-50">
              <tr>
                <th className="px-6 py-3 text-left font-semibold text-slate-950">Name</th>
                <th className="px-6 py-3 text-left font-semibold text-slate-950">Email</th>
                <th className="px-6 py-3 text-left font-semibold text-slate-950">Phone</th>
                <th className="px-6 py-3 text-left font-semibold text-slate-950">Role</th>
                <th className="px-6 py-3 text-left font-semibold text-slate-950">Status</th>
                <th className="px-6 py-3 text-left font-semibold text-slate-950">Last Login</th>
                {(canUpdate || canDelete) && <th className="px-6 py-3 text-left font-semibold text-slate-950">Actions</th>}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200">
              {filteredStaff.map((member) => (
                <tr key={member._id} className="hover:bg-slate-50">
                  <td className="px-6 py-4 font-semibold text-slate-950">{member.name}</td>
                  <td className="px-6 py-4 text-slate-600">{member.email}</td>
                  <td className="px-6 py-4 text-slate-600">{member.phone}</td>
                  <td className="px-6 py-4">
                    <span className="inline-flex rounded-full bg-blue-50 px-3 py-1 text-xs font-semibold text-blue-700">
                      {member.roleId?.name || member.role?.name || "Unassigned"}
                    </span>
                  </td>
                  <td className="px-6 py-4">
                    <span
                      className={`inline-flex rounded-full px-3 py-1 text-xs font-semibold ${
                        member.status === "active" ? "bg-emerald-50 text-emerald-700" : "bg-slate-100 text-slate-600"
                      }`}
                    >
                      {member.status?.charAt(0).toUpperCase() + member.status?.slice(1)}
                    </span>
                  </td>
                  <td className="px-6 py-4 text-slate-600">
                    {member.lastLogin ? new Date(member.lastLogin).toLocaleDateString() : "Never"}
                  </td>
                  {(canUpdate || canDelete) && (
                    <td className="px-6 py-4">
                      <div className="flex flex-wrap gap-3">
                        {canUpdate && (
                          <button
                            type="button"
                            onClick={() => startEditing(member)}
                            className="text-sm font-medium text-amber-700 hover:text-amber-900"
                          >
                            Edit
                          </button>
                        )}
                        {canUpdate && (
                          <button
                            type="button"
                            onClick={() => handleForceLogout(member)}
                            className="text-sm font-medium text-slate-700 hover:text-slate-900"
                          >
                            Force logout
                          </button>
                        )}
                        {canDelete && (
                          <button
                            type="button"
                            onClick={() => handleDelete(member)}
                            className="text-sm font-medium text-rose-700 hover:text-rose-900"
                          >
                            Remove
                          </button>
                        )}
                      </div>
                    </td>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {(canCreate || (canUpdate && editingId)) && (
        <section ref={formRef} className="rounded-xl border border-slate-200 bg-white p-6">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h2 className="text-xl font-semibold text-slate-950">{editingId ? "Edit Staff" : "Add Staff"}</h2>
              <p className="mt-1 text-sm text-slate-600">Create staff accounts and assign the right role access.</p>
            </div>
            <button
              type="button"
              onClick={resetForm}
              className="text-sm font-medium text-slate-600 hover:text-slate-900"
            >
              Reset
            </button>
          </div>

          <form onSubmit={handleSubmit} className="mt-6 grid gap-4 md:grid-cols-2">
            <label className="block text-sm font-medium text-slate-700">
              Name
              <input
                value={form.name}
                onChange={(event) => setForm((current) => ({ ...current, name: event.target.value }))}
                className="mt-1 w-full rounded-xl border border-slate-300 px-4 py-3"
                required
              />
            </label>

            <label className="block text-sm font-medium text-slate-700">
              Email
              <input
                type="email"
                value={form.email}
                onChange={(event) => setForm((current) => ({ ...current, email: event.target.value }))}
                className="mt-1 w-full rounded-xl border border-slate-300 px-4 py-3"
                required
              />
            </label>

            <label className="block text-sm font-medium text-slate-700">
              Phone
              <input
                value={form.phone}
                onChange={(event) => setForm((current) => ({ ...current, phone: event.target.value }))}
                className="mt-1 w-full rounded-xl border border-slate-300 px-4 py-3"
                required
              />
            </label>

            <label className="block text-sm font-medium text-slate-700">
              Role
              <select
                value={form.roleId}
                onChange={(event) => setForm((current) => ({ ...current, roleId: event.target.value }))}
                className="mt-1 w-full rounded-xl border border-slate-300 px-4 py-3"
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

            <label className="block text-sm font-medium text-slate-700">
              Status
              <select
                value={form.status}
                onChange={(event) => setForm((current) => ({ ...current, status: event.target.value }))}
                className="mt-1 w-full rounded-xl border border-slate-300 px-4 py-3"
              >
                <option value="active">Active</option>
                <option value="suspended">Suspended</option>
              </select>
            </label>

            <label className="block text-sm font-medium text-slate-700">
              {editingId ? "New password (optional)" : "Temporary password"}
              <PasswordField
                value={form.password}
                onChange={(event) => setForm((current) => ({ ...current, password: event.target.value }))}
                className="mt-1 w-full rounded-xl border border-slate-300 px-4 py-3"
                placeholder="Min 8 chars, upper/lower/number/symbol"
                required={!editingId}
              />
            </label>

            <div className="md:col-span-2">
              <button
                type="submit"
                disabled={saving || !form.roleId}
                className="inline-flex rounded-lg bg-slate-950 px-5 py-3 text-sm font-medium text-white hover:bg-slate-800 disabled:opacity-50"
              >
                {saving ? "Saving account..." : editingId ? "Update Staff" : "Create Staff"}
              </button>
            </div>
          </form>
        </section>
      )}
    </div>
  );
}
