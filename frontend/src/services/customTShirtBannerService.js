import { api } from "./api";
import { adminHttp } from "./adminHttp";

export const getPublicCustomTShirtBanners = async () => {
  const { data } = await api.get("/api/custom-tshirt-banners/public");
  return data;
};

export const getAdminCustomTShirtBanners = async () => {
  const { data } = await adminHttp.get("/api/custom-tshirt-banners");
  return data;
};

export const createCustomTShirtBanner = async (formData) => {
  const { data } = await adminHttp.post("/api/custom-tshirt-banners", formData, {
    headers: {
      "Content-Type": "multipart/form-data",
    },
  });
  return data;
};

export const deleteCustomTShirtBanner = async (id) => {
  const { data } = await adminHttp.delete(`/api/custom-tshirt-banners/${id}`);
  return data;
};
