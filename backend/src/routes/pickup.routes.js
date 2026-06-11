const express = require("express");
const { body } = require("express-validator");
const { validate } = require("../middleware/validate");
const { adminWorkspaceAuthRequired, requireWorkspacePermission } = require("../middleware/adminAccess");
const pickupController = require("../controllers/pickup.controller");

const router = express.Router();

router.get(
  "/admin/pickups",
  adminWorkspaceAuthRequired,
  requireWorkspacePermission("orders.read"),
  pickupController.getAdminPickups
);

router.post(
  "/admin/pickups/schedule",
  adminWorkspaceAuthRequired,
  requireWorkspacePermission("orders.update"),
  validate([
    body("shipmentIds")
      .isArray({ min: 1 })
      .withMessage("shipmentIds must be a non-empty array"),
    body("shipmentIds.*")
      .isString()
      .trim()
      .notEmpty()
      .withMessage("shipmentIds must contain valid shipment ids"),
  ]),
  pickupController.scheduleAdminPickup
);

module.exports = router;
