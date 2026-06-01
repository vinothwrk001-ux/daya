const { AppError } = require("../utils/AppError");
const { verifyAccessToken, verifyStaffAccessToken } = require("../utils/jwt");
const { Staff } = require("../modules/staff/models/Staff");
const { StaffSession } = require("../modules/staff/models/StaffSession");

async function privateDocumentAuth(req, res, next) {
  const userToken = req.cookies?.accessToken;
  const staffToken = req.cookies?.staffAccessToken;

  if (!userToken && !staffToken) return next(new AppError("Unauthorized", 401, "UNAUTHORIZED"));

  if (staffToken) {
    try {
      const payload = verifyStaffAccessToken(staffToken);
      const session = await StaffSession.findById(payload.sid);
      if (!session || session.revokedAt || session.expiresAt < new Date()) {
        return next(new AppError("Session expired", 401, "UNAUTHORIZED"));
      }
      const staff = await Staff.findById(payload.sub).populate("roleId");
      if (!staff || staff.status !== "active") {
        return next(new AppError("Staff account unavailable", 401, "UNAUTHORIZED"));
      }
      req.staff = {
        _id: staff._id,
        email: staff.email,
        roleId: staff.roleId?._id,
        permissions: staff.roleId?.permissions || {},
      };
      req.user = {
        sub: String(staff._id),
        role: "staff",
        permissions: req.staff.permissions,
        authType: "staff",
      };
      return next();
    } catch {
      return next(new AppError("Invalid or expired token", 401, "UNAUTHORIZED"));
    }
  }

  try {
    req.user = verifyAccessToken(userToken);
    return next();
  } catch {
    return next(new AppError("Invalid or expired token", 401, "UNAUTHORIZED"));
  }
}

module.exports = { privateDocumentAuth };
