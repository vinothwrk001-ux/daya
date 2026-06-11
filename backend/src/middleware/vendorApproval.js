const { AppError } = require("../utils/AppError");
const vendorRepo = require("../repositories/vendor.repository");

function normalizeVendorStatus(status) {
  return String(status || "").trim().toLowerCase();
}

function getVendorApprovalRedirect(vendor) {
  if (!vendor) return "/vendor/onboarding";

  const status = normalizeVendorStatus(vendor.status);
  const stepCompleted = Number(vendor.stepCompleted || 0);

  if (status === "approved") return "";
  if (status === "pending" || status === "rejected") return "/vendor/status";
  if (status === "draft") return "/vendor/onboarding";
  if (Number.isFinite(stepCompleted) && stepCompleted >= 4) return "/vendor/status";

  return "/vendor/onboarding";
}

function vendorAccessError(vendor) {
  const redirect = getVendorApprovalRedirect(vendor);
  const status = normalizeVendorStatus(vendor?.status);
  const stepCompleted = Number(vendor?.stepCompleted || 0);
  const details = {
    redirect,
    status: status || "missing",
    stepCompleted: Number.isFinite(stepCompleted) ? stepCompleted : 0,
  };

  if (redirect === "/vendor/status") {
    return new AppError(
      "Vendor registration must be approved by admin before accessing the seller workspace.",
      403,
      "VENDOR_APPROVAL_REQUIRED",
      details
    );
  }

  return new AppError(
    "Complete vendor registration before accessing the seller workspace.",
    403,
    "VENDOR_ONBOARDING_REQUIRED",
    details
  );
}

async function ensureApprovedVendorForRequest(req) {
  if (!req.user || req.user.role !== "vendor") return null;

  if (req.vendor && normalizeVendorStatus(req.vendor.status) === "approved") {
    return req.vendor;
  }

  const vendor = req.vendor || await vendorRepo.findByUserId(req.user.sub);
  req.vendor = vendor || null;

  if (getVendorApprovalRedirect(vendor)) {
    throw vendorAccessError(vendor);
  }

  return vendor;
}

function requireApprovedVendor(req, res, next) {
  ensureApprovedVendorForRequest(req)
    .then(() => next())
    .catch(next);
}

module.exports = {
  ensureApprovedVendorForRequest,
  getVendorApprovalRedirect,
  requireApprovedVendor,
};
