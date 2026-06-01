const express = require("express");
const { validate } = require("../../middleware/validate");
const { adminWorkspaceAuthRequired, requireWorkspacePermission } = require("../../middleware/adminAccess");
const authController = require("./controllers/auth.controller");
const roleController = require("./controllers/role.controller");
const staffController = require("./controllers/staff.controller");
const permissionVerificationController = require("./controllers/permission-verification.controller");
const { staffAuthRequired } = require("./middleware/staff-auth");
const {
  roleSchema,
  createStaffSchema,
  updateStaffSchema,
  staffLoginSchema,
  staffRefreshSchema,
  passwordResetRequestSchema,
  passwordResetSchema,
} = require("./validators");

const router = express.Router();
const adminRouter = express.Router();

// Public authentication routes (no auth required)
router.post("/auth/login", validate(staffLoginSchema), authController.login);
router.post("/auth/refresh", validate(staffRefreshSchema), authController.refresh);
router.get("/auth/csrf", authController.csrf);
router.post("/auth/logout", authController.logout);
router.get("/auth/me", staffAuthRequired, authController.me);
router.post(
  "/auth/password-reset/request",
  validate(passwordResetRequestSchema),
  authController.requestPasswordReset
);
router.post(
  "/auth/password-reset/reset",
  validate(passwordResetSchema),
  authController.resetPassword
);

// Admin routes (auth + permissions required)
adminRouter.use(adminWorkspaceAuthRequired);
adminRouter.get("/permissions/catalog", requireWorkspacePermission("roles.read"), roleController.getPermissionCatalog);
adminRouter.get("/roles", requireWorkspacePermission("roles.read"), roleController.listRoles);
adminRouter.get("/roles/:id", requireWorkspacePermission("roles.read"), roleController.getRoleById);
adminRouter.post("/roles", requireWorkspacePermission("roles.create"), validate(roleSchema), roleController.createRole);
adminRouter.patch("/roles/:id", requireWorkspacePermission("roles.update"), validate(roleSchema), roleController.updateRole);
adminRouter.delete("/roles/:id", requireWorkspacePermission("roles.delete"), roleController.deleteRole);

adminRouter.get("/accounts", requireWorkspacePermission("staff.read"), staffController.listStaff);
adminRouter.post("/accounts", requireWorkspacePermission("staff.create"), validate(createStaffSchema), staffController.createStaff);
adminRouter.patch("/accounts/:id", requireWorkspacePermission("staff.update"), validate(updateStaffSchema), staffController.updateStaff);
adminRouter.delete("/accounts/:id", requireWorkspacePermission("staff.delete"), staffController.deleteStaff);
adminRouter.post("/accounts/:id/force-logout", requireWorkspacePermission("staff.update"), staffController.forceLogoutStaff);

// Permission verification endpoints (debug/audit)
adminRouter.get("/verify/report", requireWorkspacePermission("staff.read"), permissionVerificationController.getPermissionReportEndpoint);
adminRouter.get("/verify/staff/:staffId", requireWorkspacePermission("staff.read"), permissionVerificationController.verifyStaffPermissionsEndpoint);
adminRouter.get("/verify/role/:roleId", requireWorkspacePermission("roles.read"), permissionVerificationController.verifyRoleStaffEndpoint);

// Test endpoints (debug/simulation)
adminRouter.post("/test/permission-sync", requireWorkspacePermission("staff.read"), permissionVerificationController.testPermissionSyncEndpoint);
adminRouter.post("/test/module-access", requireWorkspacePermission("staff.read"), permissionVerificationController.testModuleAccessEndpoint);
adminRouter.post("/test/permission-update-sync", requireWorkspacePermission("staff.read"), permissionVerificationController.testPermissionUpdateSyncEndpoint);

router.use("/admin", adminRouter);

module.exports = router;
