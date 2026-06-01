import { logger } from "../services/logger/logger.js";
import { useState, useCallback, useEffect } from 'react';
import { adminService } from '../services/adminService';

/**
 * Hook for managing admin data operations
 * Handles loading, error states, and data pagination
 */
export function useAdminData(fetchFn, initialFilters = {}) {
  const [data, setData] = useState([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState(null);
  const [pagination, setPagination] = useState({
    page: 1,
    limit: 20,
    total: 0,
  });
  const [filters, setFilters] = useState(initialFilters);

  const fetchData = useCallback(
    async (page = 1, newFilters = filters) => {
      setIsLoading(true);
      setError(null);

      try {
        const result = await fetchFn({
          page,
          limit: pagination.limit,
          ...newFilters,
        });

        setData(result.data || result);
        setPagination(prev => ({
          ...prev,
          page,
          total: result.total || result.length || 0,
        }));
      } catch (err) {
        setError(err.response?.data?.message || err.message);
      } finally {
        setIsLoading(false);
      }
    },
    [fetchFn, filters, pagination.limit]
  );

  const updateFilters = useCallback((newFilters) => {
    setFilters(prev => ({ ...prev, ...newFilters }));
    fetchData(1, { ...filters, ...newFilters });
  }, [filters, fetchData]);

  const goToPage = useCallback((page) => {
    fetchData(page, filters);
  }, [filters, fetchData]);

  return {
    data,
    isLoading,
    error,
    pagination,
    filters,
    updateFilters,
    goToPage,
    refetch: () => fetchData(pagination.page, filters),
  };
}

/**
 * Hook for managing bulk operations
 */
export function useBulkOperation(operationFn) {
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(false);

  const execute = useCallback(
    async (ids) => {
      setIsLoading(true);
      setError(null);
      setSuccess(false);

      try {
        await operationFn(ids);
        setSuccess(true);
        return true;
      } catch (err) {
        setError(err.response?.data?.message || err.message);
        return false;
      } finally {
        setIsLoading(false);
      }
    },
    [operationFn]
  );

  return {
    execute,
    isLoading,
    error,
    success,
  };
}

/**
 * Hook for managing admin notifications
 */
export function useAdminNotifications(pollingInterval = 30000) {
  const [notifications, setNotifications] = useState([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [isLoading, setIsLoading] = useState(false);

  const fetchNotifications = useCallback(async () => {
    try {
      setIsLoading(true);
      const result = await adminService.getNotifications(1, 10);
      setNotifications(result?.notifications || []);
      setUnreadCount(result?.unreadCount || 0);
    } catch (error) {
      logger.error("Failed to fetch notifications:", { error: error });
    } finally {
      setIsLoading(false);
    }
  }, []);

  const markAsRead = useCallback(async (notificationId) => {
    try {
      await adminService.markAsRead(notificationId);
      fetchNotifications();
    } catch (error) {
      logger.error("Failed to mark as read:", { error: error });
    }
  }, [fetchNotifications]);

  // Start polling
  useEffect(() => {
    fetchNotifications();
    const interval = setInterval(fetchNotifications, pollingInterval);
    return () => clearInterval(interval);
  }, [fetchNotifications, pollingInterval]);

  return {
    notifications,
    unreadCount,
    isLoading,
    markAsRead,
    refetch: fetchNotifications,
  };
}

/**
 * Hook for managing admin actions with confirmation
 */
export function useAdminAction(actionFn, onSuccess, onError) {
  const [isLoading, setIsLoading] = useState(false);

  const execute = useCallback(
    async (id, ...args) => {
      setIsLoading(true);
      try {
        const result = await actionFn(id, ...args);
        onSuccess?.(result);
        return result;
      } catch (error) {
        onError?.(error);
        throw error;
      } finally {
        setIsLoading(false);
      }
    },
    [actionFn, onSuccess, onError]
  );

  return { execute, isLoading };
}

export default {
  useAdminData,
  useBulkOperation,
  useAdminNotifications,
  useAdminAction,
};
