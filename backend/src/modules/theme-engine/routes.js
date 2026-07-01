const express = require("express");
const { requireWorkspacePermission } = require("../../middleware/adminAccess");
const themeEngineController = require("./controller");

const router = express.Router();

router.get(
  "/",
  requireWorkspacePermission("theme.view", { legacyPermission: "theme:view" }),
  themeEngineController.listAdminThemes
);

router.post(
  "/",
  requireWorkspacePermission("theme.create", { legacyPermission: "theme:create" }),
  express.json({ limit: "512kb" }),
  themeEngineController.createAdminTheme
);

router.post(
  "/presets/:presetKey",
  requireWorkspacePermission("theme.create", { legacyPermission: "theme:create" }),
  themeEngineController.createPresetTheme
);

router.get(
  "/:id",
  requireWorkspacePermission("theme.view", { legacyPermission: "theme:view" }),
  themeEngineController.getAdminTheme
);

router.put(
  "/:id",
  requireWorkspacePermission("theme.update", { legacyPermission: "theme:update" }),
  express.json({ limit: "512kb" }),
  themeEngineController.updateAdminTheme
);

router.post(
  "/:id/duplicate",
  requireWorkspacePermission("theme.create", { legacyPermission: "theme:create" }),
  themeEngineController.duplicateAdminTheme
);

router.post(
  "/:id/publish",
  requireWorkspacePermission("theme.update", { legacyPermission: "theme:update" }),
  themeEngineController.publishAdminTheme
);

router.post(
  "/:id/schedule",
  requireWorkspacePermission("theme.update", { legacyPermission: "theme:update" }),
  express.json(),
  themeEngineController.scheduleAdminTheme
);

router.get(
  "/:id/preview",
  requireWorkspacePermission("theme.view", { legacyPermission: "theme:view" }),
  themeEngineController.previewAdminTheme
);

router.get(
  "/:id/versions",
  requireWorkspacePermission("theme.view", { legacyPermission: "theme:view" }),
  themeEngineController.getAdminVersions
);

router.post(
  "/:id/rollback/:versionId",
  requireWorkspacePermission("theme.update", { legacyPermission: "theme:update" }),
  themeEngineController.rollbackAdminTheme
);

router.delete(
  "/:id",
  requireWorkspacePermission("theme.delete", { legacyPermission: "theme:delete" }),
  themeEngineController.removeAdminTheme
);

module.exports = router;
