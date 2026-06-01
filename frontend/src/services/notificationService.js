import { api } from "./api";

let handlers = null;

export async function getNotificationSummary(role) {
  const { data } = await api.get("/api/notifications/summary", {
    params: role ? { role } : undefined,
  });
  return data;
}

export async function getNotifications(role, params = {}) {
  const { data } = await api.get("/api/notifications", {
    params: { ...(role ? { role } : {}), ...params },
  });
  return data;
}

export async function markNotificationsRead(role, payload = {}) {
  const { data } = await api.post("/api/notifications/read", {
    ...(role ? { role } : {}),
    ...payload,
  });
  return data;
}

export function registerNotificationHandlers(nextHandlers) {
  handlers = nextHandlers;
  return () => {
    if (handlers === nextHandlers) handlers = null;
  };
}

function notify(type, message, options = {}) {
  if (!handlers?.showNotification) return "";
  return handlers.showNotification({ ...options, type, message });
}

export function showSuccess(message, options = {}) {
  return notify("success", message, options);
}

export function showError(message, options = {}) {
  return notify("error", message, options);
}

export function showWarning(message, options = {}) {
  return notify("warning", message, options);
}

export function showInfo(message, options = {}) {
  return notify("info", message, options);
}

export function showLoading(message, options = {}) {
  return notify("loading", message, { duration: 0, ...options });
}

export function dismissNotification(id) {
  handlers?.dismissNotification?.(id);
}

export function clearNotifications() {
  handlers?.clearNotifications?.();
}

export function confirmAction(options = {}) {
  if (!handlers?.confirmAction) return Promise.resolve(false);
  return handlers.confirmAction(options);
}

export function requestInput(options = {}) {
  if (!handlers?.requestInput) return Promise.resolve(null);
  return handlers.requestInput(options);
}

export const notificationService = {
  showSuccess,
  showError,
  showWarning,
  showInfo,
  showLoading,
  dismissNotification,
  clearNotifications,
  confirmAction,
  requestInput,
};
