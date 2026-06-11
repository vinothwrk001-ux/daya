import { api } from "./api";
import { adminHttp } from "./adminHttp";

async function uploadImages(client, endpoint, files, metadata = {}, onUploadProgress) {
  const formData = new FormData();
  for (const file of files) {
    formData.append("images", file);
  }

  Object.entries(metadata || {}).forEach(([key, value]) => {
    if (value !== undefined && value !== null && value !== "") {
      formData.append(key, value);
    }
  });

  const { data } = await client.post(endpoint, formData, {
    headers: { "Content-Type": "multipart/form-data" },
    onUploadProgress,
  });

  return data;
}

export function uploadMarketplaceProductImages(files, metadata = {}, onUploadProgress) {
  return uploadImages(api, "/api/products/media", files, metadata, onUploadProgress);
}

export function uploadAdminProductImages(files, metadata = {}, onUploadProgress) {
  return uploadImages(adminHttp, "/api/admin/products/media", files, metadata, onUploadProgress);
}

