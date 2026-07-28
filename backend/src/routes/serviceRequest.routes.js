const express = require("express");
const {
  createServiceRequest,
  getServiceRequests,
  updateServiceRequestStatus,
  deleteServiceRequest,
} = require("../controllers/serviceRequest.controller");
const { adminWorkspaceAuthRequired, requireWorkspacePermission } = require("../middleware/adminAccess");

const router = express.Router();

// Public route for submitting a request
router.post("/", createServiceRequest);

// Protected routes for admin
router.use(adminWorkspaceAuthRequired);
router.use(requireWorkspacePermission("orders.read"));

router.route("/")
  .get(getServiceRequests);

router.route("/:id")
  .delete(deleteServiceRequest);

router.route("/:id/status")
  .patch(updateServiceRequestStatus);

module.exports = router;
