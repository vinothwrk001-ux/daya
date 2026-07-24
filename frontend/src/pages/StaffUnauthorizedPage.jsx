import { useLocation, useNavigate } from "react-router-dom";
import { useStaffAuthStore } from "../context/staffAuthStore";
import { getDefaultStaffRoute } from "../config/staffModules";

/**
 * Unauthorized Access Page
 */
export function StaffUnauthorizedPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const user = useStaffAuthStore((s) => s.user);
  const nextRoute = getDefaultStaffRoute(user?.permissions, user?.enabledModules || {});

  return (
    <div className="flex min-h-screen items-center justify-center bg-gradient-to-br from-slate-50 to-slate-100 px-4">
      <div className="max-w-md text-center">
        {/* Icon */}
        <div className="mx-auto mb-6 flex h-20 w-20 items-center justify-center rounded-full bg-red-100">
          <svg
            className="h-10 w-10 text-red-600"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M12 9v2m0 4v2m0 4v2M7.08 6.47a9 9 0 1 1 9.84 0"
            />
          </svg>
        </div>

        {/* Message */}
        <h1 className="text-3xl font-bold text-slate-900">Access Denied</h1>
        <p className="mt-2 text-slate-600">
          You don't have permission to access this resource. Contact your administrator if you believe this is an error.
        </p>
        {location.state?.from?.pathname ? (
          <p className="mt-2 text-xs text-slate-500">Requested route: {location.state.from.pathname}</p>
        ) : null}

        {/* User info */}
        {user && (
          <div className="mt-6 rounded-lg bg-slate-50 p-4">
            <p className="text-xs font-semibold uppercase text-slate-500">Current User</p>
            <p className="mt-1 text-sm font-medium text-slate-900">{user.name}</p>
            <p className="text-xs text-slate-500">{user.email}</p>
          </div>
        )}

        {/* Actions */}
        <div className="mt-8 flex flex-col gap-3 sm:flex-row sm:justify-center">
          <button
            onClick={() => navigate(nextRoute)}
            className="rounded-lg bg-red-500 px-6 py-2 font-medium text-white hover:bg-red-600"
          >
            Go to Workspace
          </button>
          <button
            onClick={() => navigate(-1)}
            className="rounded-lg border border-slate-200 px-6 py-2 font-medium text-slate-900 hover:bg-slate-50"
          >
            Go Back
          </button>
        </div>
      </div>
    </div>
  );
}
