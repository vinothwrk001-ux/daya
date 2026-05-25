import { create } from "zustand";
import * as vendorDashboardService from "../services/vendorDashboardService";
import { getNotificationSummary } from "../services/notificationService";

export const useVendorDashboardStore = create((set) => ({
  sidebarOpen: true,
  dashboard: null,
  notificationsUnread: 0,
  setSidebarOpen: (sidebarOpen) => set({ sidebarOpen }),
  fetchDashboard: async (params = {}) => {
    const response = await vendorDashboardService.getVendorDashboard(params);
    set({ dashboard: response.data });
    return response.data;
  },
  fetchNotificationsUnread: async () => {
    const response = await getNotificationSummary("vendor");
    set({ notificationsUnread: response.data?.total || 0 });
    return response.data?.total || 0;
  },
}));
