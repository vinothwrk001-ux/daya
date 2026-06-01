import { useState, useEffect, useCallback } from 'react';
import { confirmAction } from "../services/notificationService";
import { adminNotificationService } from '../services/adminService';
import { StatusBadge, Toast } from '../components/AdminComponents';
import { formatDateTime } from '../utils/adminUtils';

/**
 * Admin Notification Center Page
 * Real-time notification management for admins
 */
export function AdminNotificationCenterPage() {
  const [notifications, setNotifications] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [unreadCount, setUnreadCount] = useState(0);
  const [filter, setFilter] = useState('all'); // all, unread
  const [toast, setToast] = useState(null);
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);

  const limit = 15;

  const loadNotifications = useCallback(async () => {
    try {
      setIsLoading(true);
      const data = await adminNotificationService.getNotifications(
        page,
        limit,
        {
          unreadOnly: filter === 'unread',
        }
      );
      setNotifications(data.notifications || []);
      setTotal(data.pagination?.total || 0);

      // Load unread count
      const countData = await adminNotificationService.getUnreadCount();
      setUnreadCount(countData.unreadCount || 0);
    } catch {
      setToast({
        type: 'error',
        message: 'Failed to load notifications',
      });
    } finally {
      setIsLoading(false);
    }
  }, [filter, page]);

  useEffect(() => {
    loadNotifications();
    const interval = setInterval(loadNotifications, 30000);
    return () => clearInterval(interval);
  }, [loadNotifications]);

  const handleMarkAsRead = async (notificationId) => {
    try {
      await adminNotificationService.markAsRead(notificationId);
      loadNotifications();
      setToast({
        type: 'success',
        message: 'Marked as read',
      });
    } catch {
      setToast({
        type: 'error',
        message: 'Failed to mark as read',
      });
    }
  };

  const handleMarkAllAsRead = async () => {
    try {
      await adminNotificationService.markAllAsRead();
      loadNotifications();
      setToast({
        type: 'success',
        message: 'All notifications marked as read',
      });
    } catch {
      setToast({
        type: 'error',
        message: 'Failed to mark all as read',
      });
    }
  };

  const handleDelete = async (notificationId) => {
    try {
      await adminNotificationService.deleteNotification(notificationId);
      loadNotifications();
      setToast({
        type: 'success',
        message: 'Notification deleted',
      });
    } catch {
      setToast({
        type: 'error',
        message: 'Failed to delete notification',
      });
    }
  };

  const handleClearAll = async () => {
    if (await confirmAction({ message: 'Clear all notifications?', tone: "danger", confirmLabel: "Confirm" })) {
      try {
        await adminNotificationService.clearAll();
        loadNotifications();
        setToast({
          type: 'success',
          message: 'All notifications cleared',
        });
      } catch {
        setToast({
          type: 'error',
          message: 'Failed to clear notifications',
        });
      }
    }
  };

  const pages = Math.ceil(total / limit);

  const typeColors = {
    vendor_approval: 'bg-blue-100 text-blue-800',
    product_approval: 'bg-purple-100 text-purple-800',
    order_alert: 'bg-emerald-100 text-emerald-800',
    payment_alert: 'bg-amber-100 text-amber-800',
    system_alert: 'bg-red-100 text-red-800',
    report: 'bg-slate-100 text-slate-800',
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold text-slate-950 dark:text-white">
            Notifications
          </h1>
          {unreadCount > 0 && (
            <p className="mt-1 text-sm text-slate-600 dark:text-slate-300">
              {unreadCount} unread notification{unreadCount !== 1 ? 's' : ''}
            </p>
          )}
        </div>

        {unreadCount > 0 && (
          <button
            onClick={handleMarkAllAsRead}
            className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700"
          >
            Mark all as read
          </button>
        )}
      </div>

      {/* Filters */}
      <div className="flex gap-2">
        {['all', 'unread'].map(f => (
          <button
            key={f}
            onClick={() => {
              setFilter(f);
              setPage(1);
            }}
            className={`rounded-lg px-4 py-2 text-sm font-medium transition ${
              filter === f
                ? 'bg-blue-600 text-white'
                : 'border border-slate-300 text-slate-700 hover:bg-slate-50 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-800'
            }`}
          >
            {f === 'all' ? 'All' : 'Unread'}
          </button>
        ))}
      </div>

      {/* Notifications List */}
      <div className="space-y-3">
        {isLoading ? (
          <div className="text-center py-12 text-slate-500">
            Loading notifications...
          </div>
        ) : notifications.length === 0 ? (
          <div className="text-center py-12 text-slate-500">
            No notifications
          </div>
        ) : (
          notifications.map(notif => (
            <div
              key={notif._id}
              className={`rounded-xl border ${
                notif.isRead
                  ? 'border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-900'
                  : 'border-blue-200 bg-blue-50 dark:border-blue-900 dark:bg-blue-950/30'
              } p-4`}
            >
              <div className="flex items-start gap-4">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <h3 className="font-semibold text-slate-950 dark:text-white">
                      {notif.title}
                    </h3>
                    <span className={`text-xs rounded-full px-2 py-1 ${typeColors[notif.type] || typeColors.system_alert}`}>
                      {notif.type}
                    </span>
                    <StatusBadge status={notif.priority} />
                  </div>
                  {notif.message && (
                    <p className="mt-1 text-sm text-slate-600 dark:text-slate-300">
                      {notif.message}
                    </p>
                  )}
                  <div className="mt-2 text-xs text-slate-500 dark:text-slate-400">
                    {formatDateTime(notif.createdAt)}
                  </div>
                </div>

                <div className="flex flex-shrink-0 gap-2">
                  {!notif.isRead && (
                    <button
                      onClick={() => handleMarkAsRead(notif._id)}
                      className="rounded-lg bg-blue-600 px-3 py-2 text-xs font-medium text-white hover:bg-blue-700"
                    >
                      Read
                    </button>
                  )}
                  <button
                    onClick={() => handleDelete(notif._id)}
                    className="rounded-lg border border-red-300 px-3 py-2 text-xs font-medium text-red-700 hover:bg-red-50 dark:border-red-900 dark:text-red-400 dark:hover:bg-red-950/30"
                  >
                    Delete
                  </button>
                </div>
              </div>
            </div>
          ))
        )}
      </div>

      {/* Pagination */}
      {pages > 1 && (
        <div className="flex items-center justify-between">
          <span className="text-xs text-slate-600 dark:text-slate-300">
            Page {page} of {pages}
          </span>
          <div className="flex gap-2">
            <button
              onClick={() => setPage(p => Math.max(1, p - 1))}
              disabled={page === 1}
              className="rounded-lg border border-slate-300 px-3 py-2 text-xs font-medium disabled:opacity-50 dark:border-slate-700"
            >
              Previous
            </button>
            <button
              onClick={() => setPage(p => Math.min(pages, p + 1))}
              disabled={page === pages}
              className="rounded-lg border border-slate-300 px-3 py-2 text-xs font-medium disabled:opacity-50 dark:border-slate-700"
            >
              Next
            </button>
          </div>
        </div>
      )}

      {notifications.length > 0 && (
        <button
          onClick={handleClearAll}
          className="mt-4 w-full rounded-lg border border-red-300 px-4 py-2 text-sm font-medium text-red-700 hover:bg-red-50 dark:border-red-900 dark:text-red-400 dark:hover:bg-red-950/30"
        >
          Clear all notifications
        </button>
      )}

      {/* Toast */}
      {toast && (
        <Toast
          message={toast.message}
          type={toast.type}
          onClose={() => setToast(null)}
        />
      )}
    </div>
  );
}

export default AdminNotificationCenterPage;
