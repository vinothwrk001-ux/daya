import React, { useEffect, useState } from "react";
import { Plus, Trash2, Image as ImageIcon, Loader2 } from "lucide-react";
import { getAdminCustomTShirtBanners, createCustomTShirtBanner, deleteCustomTShirtBanner } from "../services/customTShirtBannerService";
import { InlineToast } from "../components/commerce/InlineToast";

export function AdminCustomTShirtBannersPage() {
  const [banners, setBanners] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isUploading, setIsUploading] = useState(false);
  const [toast, setToast] = useState(null);
  
  // Form State
  const [label, setLabel] = useState("");
  const [imageFile, setImageFile] = useState(null);
  const [imagePreview, setImagePreview] = useState(null);

  useEffect(() => {
    fetchBanners();
  }, []);

  const fetchBanners = async () => {
    try {
      setIsLoading(true);
      const res = await getAdminCustomTShirtBanners();
      setBanners(res.data || res); // Depending on how backend structures the 'data' field
    } catch (error) {
      setToast({ type: "error", message: "Failed to load banners" });
      console.error(error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleImageChange = (e) => {
    const file = e.target.files?.[0];
    if (file) {
      setImageFile(file);
      const reader = new FileReader();
      reader.onloadend = () => {
        setImagePreview(reader.result);
      };
      reader.readAsDataURL(file);
    }
  };

  const handleUpload = async (e) => {
    e.preventDefault();
    if (!label || !imageFile) {
      setToast({ type: "error", message: "Please provide both a label and an image" });
      return;
    }

    try {
      setIsUploading(true);
      const formData = new FormData();
      formData.append("label", label);
      formData.append("image", imageFile);

      await createCustomTShirtBanner(formData);
      setToast({ type: "success", message: "Banner uploaded successfully!" });
      
      // Reset form
      setLabel("");
      setImageFile(null);
      setImagePreview(null);
      
      // Refresh list
      fetchBanners();
    } catch (error) {
      setToast({ type: "error", message: error?.response?.data?.message || "Failed to upload banner" });
      console.error(error);
    } finally {
      setIsUploading(false);
    }
  };

  const handleDelete = async (id) => {
    if (!window.confirm("Are you sure you want to delete this banner?")) return;

    try {
      await deleteCustomTShirtBanner(id);
      setToast({ type: "success", message: "Banner deleted successfully" });
      fetchBanners();
    } catch (error) {
      setToast({ type: "error", message: "Failed to delete banner" });
      console.error(error);
    }
  };

  return (
    <div className="p-6 max-w-6xl mx-auto space-y-8">
      <InlineToast toast={toast} onClose={() => setToast(null)} />
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Custom T-Shirt Banners</h1>
        <p className="text-gray-500 mt-1">Manage the "Worn By You" images shown on the Custom T-Shirts page.</p>
      </div>

      <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-200">
        <h2 className="text-lg font-semibold mb-4">Upload New Banner</h2>
        <form onSubmit={handleUpload} className="space-y-4 max-w-xl">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Banner Label (Shown on hover)</label>
            <input
              type="text"
              value={label}
              onChange={(e) => setLabel(e.target.value)}
              placeholder="e.g., CUSTOM ORDER COIMBATORE"
              className="w-full rounded-lg border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm px-3 py-2 border"
              required
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Image File</label>
            <div className="flex items-center space-x-4">
              {imagePreview ? (
                <div className="relative w-32 h-32 rounded-lg overflow-hidden border">
                  <img src={imagePreview} alt="Preview" className="w-full h-full object-cover" />
                  <button
                    type="button"
                    onClick={() => { setImageFile(null); setImagePreview(null); }}
                    className="absolute top-1 right-1 bg-red-600 text-white rounded-full p-1 hover:bg-red-700 transition-colors"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              ) : (
                <label className="flex flex-col items-center justify-center w-full h-32 border-2 border-gray-300 border-dashed rounded-lg cursor-pointer bg-gray-50 hover:bg-gray-100">
                  <div className="flex flex-col items-center justify-center pt-5 pb-6">
                    <ImageIcon className="w-8 h-8 text-gray-400 mb-2" />
                    <p className="text-sm text-gray-500"><span className="font-semibold">Click to upload</span></p>
                  </div>
                  <input type="file" className="hidden" accept="image/*" onChange={handleImageChange} required />
                </label>
              )}
            </div>
          </div>

          <button
            type="submit"
            disabled={isUploading}
            className="flex items-center justify-center px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isUploading ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Plus className="w-4 h-4 mr-2" />}
            {isUploading ? "Uploading..." : "Upload Banner"}
          </button>
        </form>
      </div>

      <div className="space-y-4">
        <h2 className="text-lg font-semibold">Current Banners</h2>
        {isLoading ? (
          <div className="flex justify-center p-12">
            <Loader2 className="w-8 h-8 text-gray-400 animate-spin" />
          </div>
        ) : banners.length === 0 ? (
          <div className="text-center p-12 bg-gray-50 rounded-xl border border-dashed border-gray-300 text-gray-500">
            No banners uploaded yet. Upload one above.
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-6">
            {banners.map((banner) => (
              <div key={banner._id} className="group relative bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden flex flex-col">
                <div className="aspect-[4/5] relative">
                  <img src={banner.imageUrl} alt={banner.label} className="absolute inset-0 w-full h-full object-cover" />
                  <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                    <button
                      onClick={() => handleDelete(banner._id)}
                      className="bg-red-600 text-white p-2 rounded-full hover:bg-red-700 hover:scale-110 transition-all shadow-lg"
                      title="Delete Banner"
                    >
                      <Trash2 className="w-5 h-5" />
                    </button>
                  </div>
                </div>
                <div className="p-3 border-t">
                  <p className="text-sm font-medium text-gray-900 truncate" title={banner.label}>{banner.label}</p>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
