import { Link, useLocation } from "react-router-dom";
import { usePlatformFeatures } from "../context/PlatformFeaturesContext";

function RoleCard({ title, desc, to, state }) {
  return (
    <Link
      to={to}
      state={state}
      className="group rounded-2xl border bg-white p-6 shadow-sm transition hover:-translate-y-0.5 hover:shadow-md"
    >
      <div className="text-lg font-semibold">{title}</div>
      <p className="mt-2 text-sm text-slate-600">{desc}</p>
      <div className="mt-4 text-sm font-medium text-indigo-600 group-hover:underline">
        Continue →
      </div>
    </Link>
  );
}

export function RoleSelectionPage() {
  const { influencerCommerceEnabled, loading } = usePlatformFeatures();
  const location = useLocation();

  return (
    <div className="mx-auto max-w-xl">
      <h1 className="text-center text-2xl font-semibold tracking-tight">
        Choose your role
      </h1>
      <p className="mt-2 text-center text-slate-600">
        This determines your onboarding flow and dashboard access.
      </p>

      <div className="mt-6 grid gap-4">
        <RoleCard
          title="User"
          desc="Browse and buy. Access user dashboard and profile."
          to="/register?role=user"
          state={location.state}
        />
        <RoleCard
          title="Vendor"
          desc="Sell on the platform. Complete onboarding and wait for approval."
          to="/register?role=vendor"
          state={location.state}
        />
        {loading || influencerCommerceEnabled ? (
          <RoleCard
            title="Influencer"
            desc="Create shoppable reels, accept campaigns, and earn tracked commissions."
            to="/register/influencer"
            state={location.state}
          />
        ) : (
          <div className="rounded-2xl border border-dashed border-slate-300 bg-slate-50 px-4 py-5 text-center text-sm text-slate-600 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-400">
            Influencer onboarding is paused by administrators.
          </div>
        )}
      </div>
    </div>
  );
}

