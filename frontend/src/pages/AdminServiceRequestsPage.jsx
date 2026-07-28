import { useEffect, useState, useCallback, useMemo } from "react";
import { format } from "date-fns";
import { 
  listServiceRequests, 
  updateServiceRequestStatus, 
  deleteServiceRequest 
} from "../services/adminApi";
import { AdminDataTable } from "../components/AdminDataTable";
import { Wrench, Search, RefreshCw, Trash2, CheckCircle, Clock } from "lucide-react";

export function AdminServiceRequestsPage() {
  const [requests, setRequests] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [search, setSearch] = useState("");
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [processing, setProcessing] = useState(null);

  const fetchRequests = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const response = await listServiceRequests({
        page: currentPage,
        limit: 20,
        status: statusFilter || undefined,
        search: search || undefined
      });
      setRequests(response.data || []);
      setTotalPages(response.pagination?.pages || 1);
    } catch (err) {
      setError(err.response?.data?.message || err.message || "Failed to fetch service requests");
    } finally {
      setLoading(false);
    }
  }, [currentPage, statusFilter, search]);

  useEffect(() => {
    const delayDebounceFn = setTimeout(() => {
      fetchRequests();
    }, 500);

    return () => clearTimeout(delayDebounceFn);
  }, [fetchRequests]);

  const handleStatusChange = async (id, newStatus) => {
    setProcessing(id);
    try {
      await updateServiceRequestStatus(id, newStatus);
      fetchRequests();
    } catch (err) {
      alert(err.response?.data?.message || "Failed to update status");
    } finally {
      setProcessing(null);
    }
  };

  const handleDelete = async (id) => {
    if (!window.confirm("Are you sure you want to delete this service request?")) return;
    setProcessing(id);
    try {
      await deleteServiceRequest(id);
      fetchRequests();
    } catch (err) {
      alert(err.response?.data?.message || "Failed to delete request");
    } finally {
      setProcessing(null);
    }
  };

  const columns = useMemo(() => [
    {
      key: "createdAt",
      label: "Date",
      render: (_, row) => format(new Date(row.createdAt), "MMM d, yyyy h:mm a")
    },
    {
      key: "client",
      label: "Client Info",
      render: (_, row) => (
        <div className="flex flex-col gap-0.5">
          <span className="font-bold text-slate-900">{row.name}</span>
          <span className="text-xs text-slate-500">{row.email}</span>
          <span className="text-xs text-slate-500">{row.phone}</span>
        </div>
      )
    },
    {
      key: "projectDetails",
      label: "Project Details",
      render: (_, row) => (
        <div className="max-w-xs whitespace-pre-wrap text-sm text-slate-700">
          {row.projectDetails}
        </div>
      )
    },
    {
      key: "status",
      label: "Status",
      render: (_, row) => {
        let badgeClass = "bg-slate-100 text-slate-700 border-slate-200";
        if (row.status === "completed") badgeClass = "bg-green-100 text-green-700 border-green-200";
        if (row.status === "reviewed") badgeClass = "bg-blue-100 text-blue-700 border-blue-200";
        if (row.status === "pending") badgeClass = "bg-yellow-100 text-yellow-700 border-yellow-200";

        return (
          <span className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-bold uppercase ${badgeClass}`}>
            {row.status === "pending" && <Clock className="h-3 w-3" />}
            {row.status === "completed" && <CheckCircle className="h-3 w-3" />}
            {row.status}
          </span>
        );
      }
    },
    {
      key: "actions",
      label: "Actions",
      render: (_, row) => (
        <div className="flex items-center gap-2">
          <select
            value={row.status}
            onChange={(e) => handleStatusChange(row._id, e.target.value)}
            disabled={processing === row._id}
            className="rounded-lg border border-slate-300 bg-white px-2 py-1 text-xs text-slate-700 focus:border-blue-500 focus:outline-none disabled:opacity-50"
          >
            <option value="pending">Pending</option>
            <option value="reviewed">Reviewed</option>
            <option value="completed">Completed</option>
          </select>
          <button
            onClick={() => handleDelete(row._id)}
            disabled={processing === row._id}
            className="rounded-lg p-1 text-red-500 hover:bg-red-50 disabled:opacity-50"
            title="Delete Request"
          >
            <Trash2 className="h-4 w-4" />
          </button>
        </div>
      )
    }
  ], [processing]);

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-4">
          <select
            value={statusFilter}
            onChange={(e) => {
              setStatusFilter(e.target.value);
              setCurrentPage(1);
            }}
            className="rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm text-slate-900 focus:border-blue-500 focus:outline-none"
          >
            <option value="">All Statuses</option>
            <option value="pending">Pending</option>
            <option value="reviewed">Reviewed</option>
            <option value="completed">Completed</option>
          </select>
        </div>
        <button
          onClick={fetchRequests}
          disabled={loading}
          className="inline-flex items-center gap-2 rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-700 transition-colors hover:bg-slate-50 disabled:opacity-50"
        >
          <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
          Refresh
        </button>
      </div>

      {error && (
        <div className="rounded-lg bg-red-500/10 p-4 text-sm font-bold text-red-500">
          {error}
        </div>
      )}

      <AdminDataTable
        columns={columns}
        data={requests}
        loading={loading}
        onSearch={(query) => {
          setSearch(query);
          setCurrentPage(1);
        }}
        emptyStateMessage="No service requests found"
        emptyStateIcon={Wrench}
      />

      {totalPages > 1 && (
        <div className="flex items-center justify-between border-t border-[#333] pt-4">
          <button
            disabled={currentPage === 1 || loading}
            onClick={() => setCurrentPage(p => p - 1)}
            className="rounded border border-[#333] px-3 py-1 text-sm text-white disabled:opacity-50"
          >
            Previous
          </button>
          <span className="text-sm text-slate-400">
            Page {currentPage} of {totalPages}
          </span>
          <button
            disabled={currentPage === totalPages || loading}
            onClick={() => setCurrentPage(p => p + 1)}
            className="rounded border border-[#333] px-3 py-1 text-sm text-white disabled:opacity-50"
          >
            Next
          </button>
        </div>
      )}
    </div>
  );
}
