const express = require("express");
const { authRequired } = require("../middleware/auth");
const compareController = require("../controllers/compare.controller");

const router = express.Router();

router.use(authRequired);

router.get("/", compareController.list);
router.post("/merge", compareController.merge);
router.get("/:productId/status", compareController.status);
router.post("/:productId", compareController.add);
router.delete("/:productId", compareController.remove);

module.exports = router;
