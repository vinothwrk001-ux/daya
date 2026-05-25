import { api } from "./api";

export async function saveStep1(payload) {
  const { data } = await api.post("/api/vendor/step1", payload);
  return data;
}

export async function saveStep2({ gstNumber, noGst, documents }) {
  const form = new FormData();
  if (gstNumber != null) form.append("gstNumber", gstNumber);
  form.append("noGst", String(Boolean(noGst)));
  for (const f of documents || []) form.append("documents", f);
  const { data } = await api.post("/api/vendor/step2", form, {
    headers: { "Content-Type": "multipart/form-data" },
  });
  return data;
}

export async function saveStep3(payload) {
  const { data } = await api.post("/api/vendor/step3", payload);
  return data;
}

export async function submitStep4({ shopName, shopImages }) {
  const form = new FormData();
  form.append("shopName", shopName);
  for (const f of shopImages || []) form.append("shopImages", f);
  const { data } = await api.post("/api/vendor/step4", form, {
    headers: { "Content-Type": "multipart/form-data" },
  });
  return data;
}

export async function getVendorMe() {
  const { data } = await api.get("/api/vendor/me");
  return data;
}

export async function getAllVendors(params = {}) {
  const { data } = await api.get("/api/public/vendors", { params });
  return data;
}

