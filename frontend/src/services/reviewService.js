import { api } from "./api";

export async function getProductReviews(productId, params = {}) {
  const { data } = await api.get(`/api/reviews/product/${productId}`, { params });
  return data;
}

export async function getReviewSummaries(productIds = []) {
  const { data } = await api.get("/api/reviews/summary", {
    params: { productIds: productIds.join(",") },
  });
  return data;
}

export async function submitReview(payload, mediaFiles = []) {
  const formData = new FormData();
  Object.entries(payload || {}).forEach(([key, value]) => {
    if (value !== undefined && value !== null && value !== "") {
      formData.append(key, value);
    }
  });
  mediaFiles.forEach((file) => formData.append("media", file));

  const { data } = await api.post("/api/reviews", formData, {
    headers: { "Content-Type": "multipart/form-data" },
  });
  return data;
}

export async function voteReview(reviewId, voteType) {
  const { data } = await api.post(`/api/reviews/${reviewId}/vote`, { voteType });
  return data;
}

export async function reportReview(reviewId, payload) {
  const { data } = await api.post(`/api/reviews/${reviewId}/report`, payload);
  return data;
}

export async function getVendorReviews(params = {}) {
  const { data } = await api.get("/api/reviews/vendor", { params });
  return data;
}

export async function replyToReview(reviewId, message) {
  const { data } = await api.post(`/api/reviews/${reviewId}/reply`, { message });
  return data;
}
