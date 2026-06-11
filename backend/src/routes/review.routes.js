const express = require("express");
const multer = require("multer");
const { authRequired, requireRole } = require("../middleware/auth");
const reviewController = require("../controllers/review.controller");

const router = express.Router();

const uploadReviewMedia = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 50 * 1024 * 1024,
    files: 11,
  },
});

const adminRoles = ["admin", "super_admin", "support_admin"];

router.get("/summary", reviewController.getReviewSummaries);
router.get("/product/:id", reviewController.listProductReviews);

router.post("/", authRequired, requireRole("user"), uploadReviewMedia.array("media", 11), reviewController.createReview);
router.get("/admin", authRequired, requireRole(...adminRoles), reviewController.listAdminReviews);
router.get("/admin/dashboard", authRequired, requireRole(...adminRoles), reviewController.getAdminDashboard);

router.put("/:id", authRequired, reviewController.updateReview);
router.delete("/:id", authRequired, reviewController.deleteReview);
router.post("/:id/vote", authRequired, requireRole("user"), reviewController.voteReview);
router.post("/:id/report", authRequired, requireRole("user"), reviewController.reportReview);

module.exports = router;
