import { api } from "./api";

export async function getVendorStorefront(slug) {
  const { data } = await api.get(`/api/vendor-stores/${slug}`);
  return data;
}

export async function getVendorStoreProducts(slug, params = {}) {
  const { data } = await api.get(`/api/vendor-stores/${slug}/products`, { params });
  return data;
}

export async function getVendorStoreReviews(slug, params = {}) {
  const { data } = await api.get(`/api/vendor-stores/${slug}/reviews`, { params });
  return data;
}

export async function getVendorStoreFollowers(slug, params = {}) {
  const { data } = await api.get(`/api/vendor-stores/${slug}/followers`, { params });
  return data;
}

export async function followVendorStore(slug) {
  const { data } = await api.post(`/api/vendor-stores/${slug}/follow`);
  return data;
}

export async function unfollowVendorStore(slug) {
  const { data } = await api.delete(`/api/vendor-stores/${slug}/follow`);
  return data;
}

export async function trackVendorStoreEvent(slug, payload) {
  const { data } = await api.post(`/api/vendor-stores/${slug}/events`, payload);
  return data;
}

export async function getMyFollowedStores(params = {}) {
  const { data } = await api.get("/api/user/followed-stores", { params });
  return data;
}
