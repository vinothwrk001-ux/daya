export function normalizeVendorStatus(status) {
  return String(status || "").trim().toLowerCase();
}

export function getVendorStepCompleted(vendor) {
  const value = Number(vendor?.stepCompleted || 0);
  return Number.isFinite(value) ? value : 0;
}

export function getVendorAccessRedirect(vendor) {
  if (!vendor) return "/vendor/onboarding";

  const status = normalizeVendorStatus(vendor.status);
  const stepCompleted = getVendorStepCompleted(vendor);

  if (status === "approved") return "";
  if (status === "pending" || status === "rejected") return "/vendor/status";
  if (status === "draft") return "/vendor/onboarding";
  if (stepCompleted >= 4) return "/vendor/status";

  return "/vendor/onboarding";
}

export function getPathnameFromTarget(target) {
  if (!target) return "";

  try {
    const base =
      typeof window !== "undefined" && window.location?.origin
        ? window.location.origin
        : "http://localhost";
    return new URL(target, base).pathname;
  } catch {
    return "";
  }
}

export function isVendorWorkspaceTarget(target) {
  const pathname = getPathnameFromTarget(target);
  return pathname === "/dashboard/vendor" || pathname === "/vendor" || pathname.startsWith("/vendor/");
}

export function getApprovedVendorDestination(target) {
  const pathname = getPathnameFromTarget(target);
  if (pathname === "/vendor/onboarding" || pathname === "/vendor/status" || pathname === "/vendor") {
    return "/vendor/dashboard";
  }
  if (isVendorWorkspaceTarget(target)) return target;
  return "/dashboard/vendor";
}

export function getVendorAccessDestination(vendor, approvedTarget) {
  const redirect = getVendorAccessRedirect(vendor);
  return redirect || getApprovedVendorDestination(approvedTarget);
}
