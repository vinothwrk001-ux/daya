/**
 * Admin Utilities & Helpers
 */

/**
 * Format timestamp to readable date
 */
export function formatDate(date) {
  if (!date) return '-';
  return new Date(date).toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  });
}

/**
 * Format timestamp to datetime
 */
export function formatDateTime(date) {
  if (!date) return '-';
  return new Date(date).toLocaleString('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

/**
 * Format currency
 */
export function formatCurrency(amount) {
  if (!amount) return '₹0';
  return new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
  }).format(amount);
}

/**
 * Format percentage
 */
export function formatPercentage(value, decimals = 1) {
  if (!value) return '0%';
  return `${(value * 100).toFixed(decimals)}%`;
}

/**
 * Truncate long text
 */
export function truncate(text, length = 50) {
  if (!text) return '';
  return text.length > length ? `${text.slice(0, length)}...` : text;
}

/**
 * Get status color
 */
export function getStatusColor(status) {
  const colorMap = {
    active: 'emerald',
    inactive: 'slate',
    pending: 'amber',
    approved: 'emerald',
    rejected: 'red',
    blocked: 'red',
    success: 'emerald',
    failed: 'red',
    processing: 'blue',
    draft: 'slate',
  };
  return colorMap[status?.toLowerCase()] || 'slate';
}

/**
 * Export data to CSV
 */
export function exportToCSV(data, filename = 'export.csv') {
  if (!data || data.length === 0) return;

  const headers = Object.keys(data[0]);
  const csvContent = [
    headers.join(','),
    ...data.map(row =>
      headers.map(header => {
        const value = row[header];
        return typeof value === 'string' && value.includes(',')
          ? `"${value}"`
          : value;
      }).join(',')
    ),
  ].join('\n');

  const blob = new Blob([csvContent], { type: 'text/csv' });
  const url = window.URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  link.click();
}

/**
 * Export data to JSON
 */
export function exportToJSON(data, filename = 'export.json') {
  const json = JSON.stringify(data, null, 2);
  const blob = new Blob([json], { type: 'application/json' });
  const url = window.URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  link.click();
}

/**
 * Calculate date range statistics
 */
export function getDateRangeStats(data, dateField) {
  if (!data || data.length === 0) return null;

  const dates = data
    .map(item => new Date(item[dateField]))
    .sort((a, b) => a - b);

  return {
    from: formatDate(dates[0]),
    to: formatDate(dates[dates.length - 1]),
    days: Math.ceil((dates[dates.length - 1] - dates[0]) / (1000 * 60 * 60 * 24)),
  };
}

/**
 * Get trend indicator
 */
export function getTrendIndicator(current, previous) {
  if (!previous) return { trend: 'neutral', change: 0 };

  const change = ((current - previous) / previous) * 100;

  return {
    trend: change > 0 ? 'up' : change < 0 ? 'down' : 'neutral',
    change: Math.abs(change).toFixed(1),
  };
}

/**
 * Validate email
 */
export function validateEmail(email) {
  const regex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return regex.test(email);
}

/**
 * Validate phone number (Indian)
 */
export function validatePhone(phone) {
  return /^[6-9]\d{9}$/.test(phone.replace(/\D/g, ''));
}

/**
 * Generate random color
 */
export function getRandomColor() {
  const colors = [
    'bg-blue-500',
    'bg-emerald-500',
    'bg-amber-500',
    'bg-rose-500',
    'bg-violet-500',
    'bg-cyan-500',
  ];
  return colors[Math.floor(Math.random() * colors.length)];
}

/**
 * Create permission matrix
 */
export function canPerformAction(userRole, action) {
  const permissions = {
    admin: ['all'],
    super_admin: ['all'],
    support_admin: [
      'view_dashboard',
      'manage_users',
      'manage_orders',
      'view_products',
    ],
    finance_admin: [
      'view_dashboard',
      'view_analytics',
      'view_payments',
    ],
  };

  const userPerms = permissions[userRole] || [];
  return userPerms.includes('all') || userPerms.includes(action);
}

export default {
  formatDate,
  formatDateTime,
  formatCurrency,
  formatPercentage,
  truncate,
  getStatusColor,
  exportToCSV,
  exportToJSON,
  getDateRangeStats,
  getTrendIndicator,
  validateEmail,
  validatePhone,
  getRandomColor,
  canPerformAction,
};
