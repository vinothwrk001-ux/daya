import React, { useEffect, useState } from "react";
import { Plus, Trash2, Loader2, Edit } from "lucide-react";
import { getAdminCustomTShirtColors, createCustomTShirtColor, updateCustomTShirtColor, deleteCustomTShirtColor } from "../services/customTShirtColorService";
import { InlineToast } from "../components/commerce/InlineToast";

export function AdminCustomTShirtColorsPage() {
  const [colors, setColors] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [toast, setToast] = useState(null);
  
  // Form State
  const [editingId, setEditingId] = useState(null);
  const [name, setName] = useState("");
  const [hex, setHex] = useState("#000000");
  const [border, setBorder] = useState(false);
  const [availableIn180, setAvailableIn180] = useState(true);
  const [availableIn220, setAvailableIn220] = useState(true);
  const [displayOrder, setDisplayOrder] = useState(0);

  useEffect(() => {
    fetchColors();
  }, []);

  const fetchColors = async () => {
    try {
      setIsLoading(true);
      const res = await getAdminCustomTShirtColors();
      setColors(res.data || res);
    } catch (error) {
      setToast({ type: "error", message: "Failed to load colors" });
      console.error(error);
    } finally {
      setIsLoading(false);
    }
  };

  const resetForm = () => {
    setEditingId(null);
    setName("");
    setHex("#000000");
    setBorder(false);
    setAvailableIn180(true);
    setAvailableIn220(true);
    setDisplayOrder(0);
  };

  const handleEdit = (color) => {
    setEditingId(color._id);
    setName(color.name);
    setHex(color.hex);
    setBorder(color.border || false);
    setAvailableIn180(color.availableInGsm?.includes("180"));
    setAvailableIn220(color.availableInGsm?.includes("220"));
    setDisplayOrder(color.displayOrder || 0);
  };

  const handleSave = async (e) => {
    e.preventDefault();
    if (!name || !hex) {
      setToast({ type: "error", message: "Please provide both a name and hex code" });
      return;
    }

    const availableInGsm = [];
    if (availableIn180) availableInGsm.push("180");
    if (availableIn220) availableInGsm.push("220");

    const payload = {
      name,
      hex,
      border,
      availableInGsm,
      displayOrder,
      isActive: true
    };

    try {
      setIsSaving(true);
      if (editingId) {
        await updateCustomTShirtColor(editingId, payload);
        setToast({ type: "success", message: "Color updated successfully!" });
      } else {
        await createCustomTShirtColor(payload);
        setToast({ type: "success", message: "Color added successfully!" });
      }
      
      resetForm();
      fetchColors();
    } catch (error) {
      setToast({ type: "error", message: error?.response?.data?.message || "Failed to save color" });
      console.error(error);
    } finally {
      setIsSaving(false);
    }
  };

  const handleDelete = async (id) => {
    if (!window.confirm("Are you sure you want to delete this color?")) return;

    try {
      await deleteCustomTShirtColor(id);
      setToast({ type: "success", message: "Color deleted successfully" });
      fetchColors();
    } catch (error) {
      setToast({ type: "error", message: "Failed to delete color" });
      console.error(error);
    }
  };

  return (
    <div className="p-6 max-w-6xl mx-auto space-y-8">
      <InlineToast toast={toast} onClose={() => setToast(null)} />
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Custom T-Shirt Colors</h1>
        <p className="text-gray-500 mt-1">Manage the available colors for each GSM type shown on the Custom T-Shirts page.</p>
      </div>

      <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-200">
        <h2 className="text-lg font-semibold mb-4">{editingId ? "Edit Color" : "Add New Color"}</h2>
        <form onSubmit={handleSave} className="space-y-4 max-w-xl">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Color Name</label>
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="e.g., BLACK"
                className="w-full rounded-lg border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm px-3 py-2 border"
                required
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Hex Code</label>
              <div className="flex items-center gap-2">
                <input
                  type="color"
                  value={hex}
                  onChange={(e) => setHex(e.target.value)}
                  className="h-9 w-9 rounded border border-gray-300 cursor-pointer p-0.5"
                />
                <input
                  type="text"
                  value={hex}
                  onChange={(e) => setHex(e.target.value)}
                  placeholder="#000000"
                  className="w-full rounded-lg border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm px-3 py-2 border uppercase"
                  required
                />
              </div>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4 pt-2">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Display Order</label>
              <input
                type="number"
                value={displayOrder}
                onChange={(e) => setDisplayOrder(Number(e.target.value))}
                className="w-full rounded-lg border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm px-3 py-2 border"
              />
            </div>
            <div className="flex items-center mt-6">
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={border}
                  onChange={(e) => setBorder(e.target.checked)}
                  className="rounded border-gray-300 text-blue-600 focus:ring-blue-500 h-4 w-4"
                />
                <span className="text-sm font-medium text-gray-700">Needs Border (e.g., White)</span>
              </label>
            </div>
          </div>

          <div className="pt-2">
            <label className="block text-sm font-medium text-gray-700 mb-2">Available In GSM Types</label>
            <div className="flex items-center gap-6">
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={availableIn180}
                  onChange={(e) => setAvailableIn180(e.target.checked)}
                  className="rounded border-gray-300 text-blue-600 focus:ring-blue-500 h-4 w-4"
                />
                <span className="text-sm text-gray-700">180 GSM</span>
              </label>
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={availableIn220}
                  onChange={(e) => setAvailableIn220(e.target.checked)}
                  className="rounded border-gray-300 text-blue-600 focus:ring-blue-500 h-4 w-4"
                />
                <span className="text-sm text-gray-700">220 GSM</span>
              </label>
            </div>
          </div>

          <div className="flex gap-3 pt-2">
            <button
              type="submit"
              disabled={isSaving}
              className="flex items-center justify-center px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50"
            >
              {isSaving ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : editingId ? <Edit className="w-4 h-4 mr-2" /> : <Plus className="w-4 h-4 mr-2" />}
              {isSaving ? "Saving..." : editingId ? "Update Color" : "Add Color"}
            </button>
            {editingId && (
              <button
                type="button"
                onClick={resetForm}
                className="px-4 py-2 border border-gray-300 rounded-md shadow-sm text-sm font-medium text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
              >
                Cancel
              </button>
            )}
          </div>
        </form>
      </div>

      <div className="space-y-4">
        <h2 className="text-lg font-semibold">Current Colors</h2>
        {isLoading ? (
          <div className="flex justify-center p-12">
            <Loader2 className="w-8 h-8 text-gray-400 animate-spin" />
          </div>
        ) : colors.length === 0 ? (
          <div className="text-center p-12 bg-gray-50 rounded-xl border border-dashed border-gray-300 text-gray-500">
            No colors added yet. Add one above.
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4">
            {colors.map((color) => (
              <div key={color._id} className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden flex flex-col p-4 items-center">
                <div 
                  className={`w-16 h-16 rounded-full shadow-sm mb-3 ${color.border ? 'border-2 border-gray-200' : ''}`} 
                  style={{ backgroundColor: color.hex }} 
                />
                <h3 className="font-bold text-sm text-gray-900 mb-1">{color.name}</h3>
                <p className="text-xs text-gray-500 font-mono mb-2">{color.hex}</p>
                <div className="flex flex-wrap gap-1 justify-center mb-4">
                  {color.availableInGsm?.map(gsm => (
                    <span key={gsm} className="px-2 py-0.5 bg-gray-100 text-gray-600 text-[10px] rounded-full font-medium">
                      {gsm} GSM
                    </span>
                  ))}
                </div>
                <div className="flex gap-2 mt-auto w-full">
                  <button
                    onClick={() => handleEdit(color)}
                    className="flex-1 py-1.5 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded text-xs font-medium transition-colors"
                  >
                    Edit
                  </button>
                  <button
                    onClick={() => handleDelete(color._id)}
                    className="flex-1 py-1.5 bg-red-50 hover:bg-red-100 text-red-600 rounded text-xs font-medium transition-colors"
                  >
                    Delete
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
