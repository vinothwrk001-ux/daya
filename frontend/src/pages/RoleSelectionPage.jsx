import { Link, useLocation } from "react-router-dom";

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
  const location = useLocation();

  return (
    <div className="mx-auto max-w-xl">
      <h1 className="text-center text-2xl font-semibold tracking-tight">
        Choose your role
      </h1>
      <p className="mt-2 text-center text-slate-600">
        Create a customer account to shop, track orders, and manage your profile.
      </p>

      <div className="mt-6 grid gap-4">
        <RoleCard
          title="User"
          desc="Browse and buy. Access user dashboard and profile."
          to="/register?role=user"
          state={location.state}
        />
      </div>
    </div>
  );
}

