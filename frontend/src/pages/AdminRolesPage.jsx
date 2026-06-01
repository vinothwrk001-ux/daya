import { useEffect, useMemo, useState } from "react";
import { confirmAction } from "../services/notificationService";
import {
  createStaffRole,
  deleteStaffRole,
  getStaffPermissionCatalog,
  listStaffRoles,
  updateStaffRole,
} from "../services/adminApi";

function normalizeError(err) {
  return err?.response?.data?.message || err?.message || "Request failed";
}

export function AdminRolesPage() {
  const [catalog, setCatalog] = useState({});
  const [emptyPermissions, setEmptyPermissions] = useState({});
  const [roles, setRoles] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [editingId, setEditingId] = useState("");
  const [form, setForm] = useState({
    name: "",
    description: "",
    permissions: {},
  });

  useEffect(() => {
    let alive = true;

    (async () => {
      setLoading(true);
      try {
        const [catalogResponse, rolesResponse] = await Promise.all([
          getStaffPermissionCatalog(),
          listStaffRoles(),
        ]);
        if (!alive) return;
        setCatalog(catalogResponse.data.catalog || {});
        setEmptyPermissions(catalogResponse.data.emptyPermissions || {});
        setRoles(rolesResponse.data || []);
        setForm((current) => ({
          ...current,
          permissions: structuredClone(catalogResponse.data.emptyPermissions || {}),
        }));
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

  const modules = useMemo(() => Object.entries(catalog), [catalog]);

  function updatePermission(moduleName, action, checked) {
    setForm((current) => ({
      ...current,
      permissions: {
        ...current.permissions,
        [moduleName]: {
          ...current.permissions[moduleName],
          [action]: checked,
        },
      },
    }));
  }

  function toggleModule(moduleName, checked) {
    setForm((current) => ({
      ...current,
      permissions: {
        ...current.permissions,
        [moduleName]: Object.fromEntries(
          Object.keys(current.permissions[moduleName] || {}).map((action) => [action, checked])
        ),
      },
    }));
  }

  function toggleAll(checked) {
    setForm((current) => ({
      ...current,
      permissions: Object.fromEntries(
        Object.entries(current.permissions).map(([moduleName, actions]) => [
          moduleName,
          Object.fromEntries(Object.keys(actions).map((action) => [action, checked])),
        ])
      ),
    }));
  }

  function startEditing(role) {
    setEditingId(role._id);
    setForm({
      name: role.name,
      description: role.description || "",
      permissions: structuredClone(role.permissions),
    });
  }

  const editingRole = useMemo(
    () => roles.find((role) => role._id === editingId) || null,
    [editingId, roles]
  );

  function resetForm() {
    setEditingId("");
    setForm({
      name: "",
      description: "",
      permissions: structuredClone(emptyPermissions),
    });
  }

  async function handleSubmit(event) {
    event.preventDefault();
    setSaving(true);
    setError("");

    try {
      const payload = {
        name: form.name,
        description: form.description,
        permissions: form.permissions,
      };

      const response = editingId
        ? await updateStaffRole(editingId, payload)
        : await createStaffRole(payload);

      if (editingId) {
        setRoles((current) => current.map((role) => (role._id === editingId ? response.data : role)));
      } else {
        setRoles((current) => [response.data, ...current]);
      }
      resetForm();
    } catch (err) {
      setError(normalizeError(err));
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete(role) {
    if (role.isSystem) return;
    if (!(await confirmAction({ message: `Delete role "${role.name}"?`, tone: "danger", confirmLabel: "Confirm" }))) return;

    try {
      await deleteStaffRole(role._id);
      setRoles((current) => current.filter((item) => item._id !== role._id));
      if (editingId === role._id) resetForm();
    } catch (err) {
      setError(normalizeError(err));
    }
  }

  return (
    <div className="grid gap-6 xl:grid-cols-[minmax(0,1.4fr)_minmax(22rem,0.9fr)]">
      <section className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h2 className="text-lg font-semibold text-slate-950 dark:text-white">Role library</h2>
            <p className="text-sm text-slate-500 dark:text-slate-400">Dynamic RBAC roles with per-module actions.</p>
          </div>
          <button
            type="button"
            onClick={() => toggleAll(true)}
            className="rounded-xl border border-slate-300 px-3 py-2 text-sm"
          >
            Enable all
          </button>
        </div>

        {error ? <div className="mt-4 rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">{error}</div> : null}

        <div className="mt-4 grid gap-3">
          {loading ? (
            Array.from({ length: 4 }).map((_, index) => (
              <div key={index} className="h-24 animate-pulse rounded-2xl bg-slate-100 dark:bg-slate-800" />
            ))
          ) : (
            roles.map((role) => (
              <div key={role._id} className="rounded-2xl border border-slate-200 p-4 dark:border-slate-800">
                <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                  <div>
                    <div className="flex items-center gap-2">
                      <h3 className="font-semibold text-slate-950 dark:text-white">{role.name}</h3>
                      {role.isSystem ? (
                        <span className="rounded-full bg-slate-100 px-2 py-1 text-xs font-medium text-slate-600 dark:bg-slate-800 dark:text-slate-300">
                          System
                        </span>
                      ) : null}
                    </div>
                    <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">{role.description || "No description provided"}</p>
                  </div>
                  <div className="flex gap-2">
                    <button type="button" onClick={() => startEditing(role)} className="rounded-xl border border-slate-300 px-3 py-2 text-sm">
                      Edit
                    </button>
                    {!role.isSystem ? (
                      <button type="button" onClick={() => handleDelete(role)} className="rounded-xl border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-700">
                        Delete
                      </button>
                    ) : null}
                  </div>
                </div>
              </div>
            ))
          )}
        </div>
      </section>

      <section className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-lg font-semibold text-slate-950 dark:text-white">{editingId ? "Edit role" : "Create role"}</h2>
            <p className="text-sm text-slate-500 dark:text-slate-400">Delete, update, refund, and process actions automatically imply read where applicable.</p>
          </div>
          <button type="button" onClick={resetForm} className="text-sm font-medium text-slate-600 hover:underline">
            Reset
          </button>
        </div>

        <form onSubmit={handleSubmit} className="mt-4 space-y-4">
          <label className="block text-sm font-medium text-slate-700 dark:text-slate-200">
            Role name
            <input
              value={form.name}
              onChange={(event) => setForm((current) => ({ ...current, name: event.target.value }))}
              className="mt-1 w-full rounded-2xl border border-slate-300 px-4 py-3"
              placeholder="Support Staff"
              disabled={Boolean(editingRole?.isSystem)}
              required
            />
            {editingRole?.isSystem ? (
              <div className="mt-1 text-xs text-slate-500 dark:text-slate-400">
                System role names are locked. You can still update description and permissions.
              </div>
            ) : null}
          </label>

          <label className="block text-sm font-medium text-slate-700 dark:text-slate-200">
            Description
            <textarea
              value={form.description}
              onChange={(event) => setForm((current) => ({ ...current, description: event.target.value }))}
              className="mt-1 w-full rounded-2xl border border-slate-300 px-4 py-3"
              rows={3}
              placeholder="Explain how this role should be used."
            />
          </label>

          <div className="flex gap-2">
            <button type="button" onClick={() => toggleAll(true)} className="rounded-xl border border-slate-300 px-3 py-2 text-sm">
              Select all
            </button>
            <button type="button" onClick={() => toggleAll(false)} className="rounded-xl border border-slate-300 px-3 py-2 text-sm">
              Clear all
            </button>
          </div>

          <div className="space-y-4">
            {modules.map(([moduleName, actions]) => {
              const enabledCount = actions.filter((action) => form.permissions?.[moduleName]?.[action]).length;
              return (
                <div key={moduleName} className="rounded-2xl border border-slate-200 p-4 dark:border-slate-800">
                  <div className="flex items-center justify-between">
                    <div>
                      <div className="text-sm font-semibold capitalize text-slate-950 dark:text-white">{moduleName}</div>
                      <div className="text-xs text-slate-500 dark:text-slate-400">{enabledCount} permissions enabled</div>
                    </div>
                    <button
                      type="button"
                      onClick={() => toggleModule(moduleName, enabledCount !== actions.length)}
                      className="rounded-xl border border-slate-300 px-3 py-2 text-xs font-medium uppercase tracking-wide"
                    >
                      {enabledCount === actions.length ? "Clear module" : "Select module"}
                    </button>
                  </div>

                  <div className="mt-3 grid grid-cols-2 gap-2">
                    {actions.map((action) => (
                      <label key={action} className="flex items-center gap-2 rounded-xl bg-slate-50 px-3 py-2 text-sm capitalize dark:bg-slate-800">
                        <input
                          type="checkbox"
                          checked={Boolean(form.permissions?.[moduleName]?.[action])}
                          onChange={(event) => updatePermission(moduleName, action, event.target.checked)}
                        />
                        {action}
                      </label>
                    ))}
                  </div>
                </div>
              );
            })}
          </div>

          <button type="submit" disabled={saving || !form.name.trim()} className="w-full rounded-2xl bg-slate-950 px-4 py-3 text-sm font-medium text-white disabled:opacity-50">
            {saving ? "Saving role..." : editingId ? "Update role" : "Create role"}
          </button>
        </form>
      </section>
    </div>
  );
}
