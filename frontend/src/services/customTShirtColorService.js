import { api } from "./api";
import { adminHttp } from "./adminHttp";

// Admin: Get all colors
export const getAdminCustomTShirtColors = async () => {
  const { data } = await adminHttp.get("/api/custom-tshirt-colors");
  return data;
};

// Public: Get active colors
export const getPublicCustomTShirtColors = async () => {
  const { data } = await api.get("/api/custom-tshirt-colors/public");
  return data;
};

// Admin: Create color
export const createCustomTShirtColor = async (colorData) => {
  const { data } = await adminHttp.post("/api/custom-tshirt-colors", colorData);
  return data;
};

// Admin: Update color
export const updateCustomTShirtColor = async (id, colorData) => {
  const { data } = await adminHttp.put(`/api/custom-tshirt-colors/${id}`, colorData);
  return data;
};

// Admin: Delete color
export const deleteCustomTShirtColor = async (id) => {
  const { data } = await adminHttp.delete(`/api/custom-tshirt-colors/${id}`);
  return data;
};
