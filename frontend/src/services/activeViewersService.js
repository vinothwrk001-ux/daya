/**
 * Active Viewers Service - Frontend
 * Handles real-time active viewer count tracking for products
 */

import { api } from "./api";

/**
 * Get the current active viewer count for a product
 */
export async function getActiveViewerCount(productId) {
  try {
    const response = await api.get(`/api/products/${productId}/viewers/count`);
    return response?.data?.data?.count || 0;
  } catch (error) {
    console.warn(`Failed to fetch active viewer count for product ${productId}:`, error);
    return 0;
  }
}

/**
 * Track this session as an active viewer for a product
 * Returns the session ID and current viewer count
 */
export async function trackActiveViewer(productId, sessionId = null) {
  try {
    const response = await api.post(`/api/products/${productId}/viewers`, {
      sessionId,
    });
    return {
      sessionId: response?.data?.data?.sessionId,
      count: response?.data?.data?.count || 0,
    };
  } catch (error) {
    console.warn(`Failed to track active viewer for product ${productId}:`, error);
    return { sessionId: null, count: 0 };
  }
}

/**
 * Keep the viewer session alive (call periodically to prevent timeout)
 */
export async function keepViewerAlive(productId, sessionId) {
  try {
    const response = await api.patch(`/api/products/${productId}/viewers/${sessionId}`);
    return response?.data?.data?.count || 0;
  } catch (error) {
    console.warn(`Failed to keep viewer alive for product ${productId}:`, error);
    return 0;
  }
}

/**
 * Remove this viewer session (call when leaving product page)
 */
export async function removeViewerSession(productId, sessionId) {
  try {
    const response = await api.delete(`/api/products/${productId}/viewers/${sessionId}`);
    return response?.data?.data?.count || 0;
  } catch (error) {
    console.warn(`Failed to remove viewer session for product ${productId}:`, error);
    return 0;
  }
}
