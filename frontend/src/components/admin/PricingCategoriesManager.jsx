import { useCallback, useEffect, useState } from "react";
import * as pricingService from "../../services/pricingService";

export function PricingCategoriesManager() {
  const [categories, setCategories] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [showForm, setShowForm] = useState(false);
  const [editingCategory, setEditingCategory] = useState(null);
  const [filterActive, setFilterActive] = useState(null);

  const [formData, setFormData] = useState({
    name: "",
    key: "",
    description: "",
    isActive: true,
    sortOrder: 0,
  });

  function normalizeMessage(err, fallback) {
    return err?.response?.data?.message || err?.message || fallback;
  }

  const loadCategories = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const response = await pricingService.getPricingCategories();
      const items = Array.isArray(response?.data) ? response.data : [];
      
      // Apply filter
      let filtered = items;
      if (filterActive !== null) {
        filtered = items.filter((cat) => cat.isActive === filterActive);
      }
      
      setCategories(filtered);
    } catch (err) {
      setError(normalizeMessage(err, "Failed to load categories"));
    } finally {
      setLoading(false);
    }
  }, [filterActive]);

  useEffect(() => {
    loadCategories();
  }, [loadCategories]);

  function resetForm() {
    setFormData({
      name: "",
      key: "",
      description: "",
      isActive: true,
      sortOrder: 0,
    });
    setEditingCategory(null);
    setShowForm(false);
  }

  async function handleSubmit(e) {
    e.preventDefault();
    setError("");

    // Validation
    if (!formData.name.trim()) {
      setError("Category name is required");
      return;
    }

    if (!formData.key.trim()) {
      setError("Category key is required");
      return;
    }

    // Validate key format
    if (!/^[A-Z0-9_]+$/.test(formData.key)) {
      setError("Category key must contain only uppercase letters, numbers, and underscores");
      return;
    }

    try {
      if (editingCategory) {
        const response = await pricingService.updatePricingCategory(editingCategory._id, formData);
        setSuccess("Category updated successfully!");
        setCategories(categories.map((cat) => (cat._id === editingCategory._id ? response.data : cat)));
      } else {
        const response = await pricingService.createPricingCategory(formData);
        setSuccess("Category created successfully!");
        setCategories([...categories, response.data]);
      }
      resetForm();
      
      // Clear success message after 3 seconds
      setTimeout(() => setSuccess(""), 3000);
    } catch (err) {
      setError(normalizeMessage(err, "Failed to save category"));
    }
  }

  function handleEdit(category) {
    setEditingCategory(category);
    setFormData({
      name: category.name,
      key: category.key,
      description: category.description || "",
      isActive: category.isActive,
      sortOrder: category.sortOrder || 0,
    });
    setShowForm(true);
  }

  async function handleDelete(category) {
    if (category.isSystem) {
      setError("Cannot delete system categories");
      return;
    }

    if (!window.confirm(`Delete category "${category.name}"? This action cannot be undone.`)) return;

    try {
      await pricingService.deletePricingCategory(category._id);
      setSuccess("Category deleted successfully!");
      setCategories(categories.filter((item) => item._id !== category._id));
    } catch (err) {
      setError(normalizeMessage(err, "Failed to delete category"));
    }
  }

  async function handleToggleActive(category) {
    try {
      await pricingService.updatePricingCategory(category._id, { isActive: !category.isActive });
      setCategories(
        categories.map((item) =>
          item._id === category._id ? { ...item, isActive: !item.isActive } : item
        )
      );
      setSuccess(
        !category.isActive
          ? "Category enabled!"
          : "Category disabled. All rules in this category were also disabled."
      );
      setTimeout(() => setSuccess(""), 3000);
    } catch (err) {
      setError(normalizeMessage(err, "Failed to toggle category"));
    }
  }

  return (
    <div className="space-y-6">
      {error ? (
        <div className="rounded border border-red-200 bg-red-50 p-4 text-red-700">{error}</div>
      ) : null}
      {success ? (
        <div className="rounded border border-green-200 bg-green-50 p-4 text-green-700">{success}</div>
      ) : null}

      <div className="flex flex-wrap gap-4">
        <div>
          <label className="mb-1 block text-sm font-medium">Status</label>
          <select
            value={filterActive === null ? "" : filterActive}
            onChange={(e) => setFilterActive(e.target.value === "" ? null : e.target.value === "true")}
            className="rounded border px-3 py-2"
          >
            <option value="">All</option>
            <option value="true">Active</option>
            <option value="false">Inactive</option>
          </select>
        </div>

        <div className="flex items-end">
          <button
            onClick={() => (showForm ? resetForm() : setShowForm(true))}
            className="rounded bg-blue-600 px-4 py-2 text-white hover:bg-blue-700"
          >
            {showForm ? "Cancel" : "Add Category"}
          </button>
        </div>
      </div>

      {showForm ? (
        <form onSubmit={handleSubmit} className="space-y-4 rounded border bg-gray-50 p-6">
          <h3 className="text-lg font-semibold">
            {editingCategory ? "Edit Category" : "Create New Pricing Category"}
          </h3>

          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            <div>
              <label className="mb-1 block text-sm font-medium">Name*</label>
              <input
                type="text"
                placeholder="e.g., Storage Fees"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                className="w-full rounded border px-3 py-2"
                required
              />
            </div>

            <div>
              <label className="mb-1 block text-sm font-medium">Key (identifier)*</label>
              <input
                type="text"
                placeholder="e.g., STORAGE_FEES"
                value={formData.key}
                onChange={(e) =>
                  setFormData({
                    ...formData,
                    key: e.target.value.toUpperCase().replace(/[^A-Z0-9_]/g, "_"),
                  })
                }
                disabled={Boolean(editingCategory)}
                className="w-full rounded border px-3 py-2 disabled:bg-gray-200"
                required
              />
              <small className="text-gray-600">Uppercase, numbers and underscores only</small>
            </div>

            <div>
              <label className="mb-1 block text-sm font-medium">Sort Order</label>
              <input
                type="number"
                min="0"
                value={formData.sortOrder}
                onChange={(e) => setFormData({ ...formData, sortOrder: parseInt(e.target.value, 10) || 0 })}
                className="w-full rounded border px-3 py-2"
              />
              <small className="text-gray-600">Lower numbers appear first</small>
            </div>

            <div className="flex items-end">
              <label className="flex items-center gap-2">
                <input
                  type="checkbox"
                  checked={formData.isActive}
                  onChange={(e) => setFormData({ ...formData, isActive: e.target.checked })}
                  className="rounded border"
                />
                <span className="text-sm font-medium">Active</span>
              </label>
            </div>
          </div>

          <div>
            <label className="mb-1 block text-sm font-medium">Description</label>
            <textarea
              value={formData.description}
              onChange={(e) => setFormData({ ...formData, description: e.target.value })}
              placeholder="Explain what this category is for..."
              className="w-full rounded border px-3 py-2"
              rows="3"
            />
          </div>

          <div className="flex justify-end gap-2">
            <button
              type="button"
              onClick={resetForm}
              className="rounded border px-4 py-2 hover:bg-gray-100"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="rounded bg-blue-600 px-4 py-2 text-white hover:bg-blue-700"
            >
              {editingCategory ? "Update Category" : "Create Category"}
            </button>
          </div>
        </form>
      ) : null}

      <div className="overflow-x-auto">
        {loading ? (
          <div className="p-8 text-center text-gray-500">Loading categories...</div>
        ) : categories.length === 0 ? (
          <div className="p-8 text-center text-gray-500">No pricing categories found</div>
        ) : (
          <table className="w-full border-collapse">
            <thead className="bg-gray-100">
              <tr>
                <th className="border p-3 text-left">Name</th>
                <th className="border p-3 text-left">Key</th>
                <th className="border p-3 text-left">Description</th>
                <th className="border p-3 text-left">Sort Order</th>
                <th className="border p-3 text-left">Type</th>
                <th className="border p-3 text-left">Status</th>
                <th className="border p-3 text-left">Actions</th>
              </tr>
            </thead>
            <tbody>
              {categories.map((category) => (
                <tr key={category._id} className="hover:bg-gray-50">
                  <td className="border p-3 font-medium">{category.name}</td>
                  <td className="border p-3 font-mono text-sm">{category.key}</td>
                  <td className="border p-3 text-sm text-gray-600">{category.description}</td>
                  <td className="border p-3 text-center">{category.sortOrder}</td>
                  <td className="border p-3">
                    {category.isSystem ? (
                      <span className="rounded bg-purple-100 px-2 py-1 text-xs font-medium text-purple-800">
                        System
                      </span>
                    ) : (
                      <span className="rounded bg-blue-100 px-2 py-1 text-xs font-medium text-blue-800">
                        Custom
                      </span>
                    )}
                  </td>
                  <td className="border p-3">
                    <button
                      onClick={() => handleToggleActive(category)}
                      className={`rounded px-3 py-1 text-sm font-medium text-white ${
                        category.isActive
                          ? "bg-green-600 hover:bg-green-700"
                          : "bg-gray-400 hover:bg-gray-500"
                      }`}
                    >
                      {category.isActive ? "Active" : "Inactive"}
                    </button>
                  </td>
                  <td className="border p-3">
                    <div className="flex gap-2">
                      <button
                        onClick={() => handleEdit(category)}
                        className="rounded bg-blue-100 px-3 py-1 text-sm text-blue-700 hover:bg-blue-200"
                      >
                        Edit
                      </button>
                      {!category.isSystem && (
                        <button
                          onClick={() => handleDelete(category)}
                          className="rounded bg-red-100 px-3 py-1 text-sm text-red-700 hover:bg-red-200"
                        >
                          Delete
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}

export default PricingCategoriesManager;
